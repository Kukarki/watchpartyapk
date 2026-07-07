/**
 * SocketClient
 * Lightweight Socket.io-compatible client for the extension.
 * Uses native WebSocket — no npm dependencies needed in content scripts.
 *
 * Implements the same event protocol as the web app:
 * room:join, video:play, video:pause, video:seek, chat:message, etc.
 */
export class SocketClient {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.ws = null;
    this.listeners = new Map(); // event → Set of handlers
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnects = 5;
    this.reconnectDelay = 1000;
    this._pingInterval = null;
    this._token = null;
  }

  connect(token) {
    this._token = token;
    const wsUrl = this.serverUrl
      .replace('http://', 'ws://')
      .replace('https://', 'wss://');

    // Socket.io handshake via polling first, then upgrade
    // For simplicity we use the Socket.io websocket transport directly
    const url = `${wsUrl}/socket.io/?EIO=4&transport=websocket`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      // Socket.io EIO4 handshake
      this.ws.onmessage = (e) => this._handleMessage(e.data);
    };

    this.ws.onclose = () => {
      this.connected = false;
      clearInterval(this._pingInterval);
      this._emit('_disconnect');
      this._scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('[WatchParty] WebSocket error', err);
    };
  }

  _handleMessage(raw) {
    // Socket.io EIO4 protocol parsing
    // Packet types: 0=open, 1=close, 2=ping, 3=pong, 40=connect, 42=event
    if (raw === '2') { this.ws.send('3'); return; } // ping/pong
    if (raw.startsWith('0')) {
      // Server open — send auth connect packet
      this.ws.send(`40${JSON.stringify({ token: this._token })}`);
      return;
    }
    if (raw === '40') {
      // Connected to default namespace
      this.connected = true;
      this.reconnectAttempts = 0;
      this._startPing();
      this._emit('_connect');
      return;
    }
    if (raw.startsWith('42')) {
      try {
        const payload = JSON.parse(raw.slice(2));
        const [event, data] = payload;
        this._emit(event, data);
      } catch (e) {
        console.error('[WatchParty] Parse error', e, raw);
      }
    }
  }

  send(event, data) {
    if (!this.connected || !this.ws) return;
    const packet = JSON.stringify([event, data]);
    this.ws.send(`42${packet}`);
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  off(event, handler) {
    this.listeners.get(event)?.delete(handler);
  }

  _emit(event, data) {
    this.listeners.get(event)?.forEach((h) => h(data));
  }

  _startPing() {
    clearInterval(this._pingInterval);
    this._pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send('2');
    }, 25000);
  }

  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnects) return;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    setTimeout(() => this.connect(this._token), delay);
  }

  disconnect() {
    clearInterval(this._pingInterval);
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }
}