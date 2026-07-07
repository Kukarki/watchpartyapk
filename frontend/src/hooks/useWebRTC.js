import { useState, useRef, useCallback, useEffect } from 'react';
import { useSocketContext } from '@/contexts/SocketContext.jsx';
import { useAuthStore } from '@/store/authStore.js';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const MAX_PEERS = 3; // supports up to 4 participants total (you + 3)

export function useWebRTC() {
  const { socket, emit } = useSocketContext();
  const { user } = useAuthStore();

  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});  // { userId: MediaStream }
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [callError, setCallError] = useState(null);

  const peersRef = useRef({});       // { userId: RTCPeerConnection }
  const localStreamRef = useRef(null);
  const currentRoomRef = useRef(null);

  // ── Media acquisition ─────────────────────────────────────────────────────

  const startLocalMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCallError(null);
      return stream;
    } catch (err) {
      // Camera denied or missing — fall back to audio-only
      if (err.name === 'NotAllowedError' || err.name === 'NotFoundError') {
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          localStreamRef.current = audioOnly;
          setLocalStream(audioOnly);
          setIsCameraOff(true);
          setCallError('Camera unavailable — joined with audio only');
          return audioOnly;
        } catch (audioErr) {
          setCallError('Microphone access denied. Check browser permissions.');
          throw audioErr;
        }
      }
      setCallError('Could not access camera or microphone.');
      throw err;
    }
  }, []);

  const stopLocalMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
  }, []);

  // ── Peer connection lifecycle ─────────────────────────────────────────────

  const destroyPeer = useCallback((userId) => {
    peersRef.current[userId]?.close();
    delete peersRef.current[userId];
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, []);

  const destroyAllPeers = useCallback(() => {
    Object.keys(peersRef.current).forEach(destroyPeer);
  }, [destroyPeer]);

  const createPeer = useCallback((remoteUserId, isInitiator) => {
    if (peersRef.current[remoteUserId]) return peersRef.current[remoteUserId];

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current[remoteUserId] = pc;

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) emit('call:ice_candidate', { targetId: remoteUserId, candidate });
    };

    pc.ontrack = ({ streams }) => {
      setRemoteStreams((prev) => ({ ...prev, [remoteUserId]: streams[0] }));
    };

    // Auto-cleanup on peer disconnect
    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        destroyPeer(remoteUserId);
      }
    };

    if (isInitiator) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => emit('call:offer', { targetId: remoteUserId, sdp: pc.localDescription }))
        .catch((e) => console.error('[WebRTC] offer failed', e));
    }

    return pc;
  }, [emit, destroyPeer]);

  // ── Join / leave ──────────────────────────────────────────────────────────

  const startCall = useCallback(async (roomId) => {
    if (isInCall) return;
    try {
      await startLocalMedia();
      currentRoomRef.current = roomId;
      emit('call:join', { roomId });
      setIsInCall(true);
    } catch {
      // callError already set inside startLocalMedia
    }
  }, [isInCall, startLocalMedia, emit]);

  const leaveCall = useCallback(() => {
    if (currentRoomRef.current) {
      emit('call:leave', { roomId: currentRoomRef.current });
    }
    destroyAllPeers();
    stopLocalMedia();
    currentRoomRef.current = null;
    setIsInCall(false);
    setIsMuted(false);
    setIsCameraOff(false);
    setCallError(null);
  }, [emit, destroyAllPeers, stopLocalMedia]);

  // ── Track controls ────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
  }, []);

  const toggleCamera = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsCameraOff(!track.enabled);
  }, []);

  // ── Socket signaling ──────────────────────────────────────────────────────

  useEffect(() => {
    const s = socket.current;
    if (!s) return;

    const onMemberJoined = ({ userId: remoteId }) => {
      if (remoteId === user?.userId) return;
      if (!localStreamRef.current) return;
      if (Object.keys(peersRef.current).length >= MAX_PEERS) return;
      createPeer(remoteId, true);
    };

    const onMemberLeft = ({ userId: remoteId }) => {
      destroyPeer(remoteId);
    };

    const onOffer = async ({ fromId, sdp }) => {
      let pc = peersRef.current[fromId];
      if (!pc) pc = createPeer(fromId, false);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      emit('call:answer', { targetId: fromId, sdp: pc.localDescription });
    };

    const onAnswer = async ({ fromId, sdp }) => {
      const pc = peersRef.current[fromId];
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    };

    const onIceCandidate = async ({ fromId, candidate }) => {
      const pc = peersRef.current[fromId];
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('[WebRTC] ICE error', e);
      }
    };

    s.on('call:member_joined', onMemberJoined);
    s.on('call:member_left', onMemberLeft);
    s.on('call:offer', onOffer);
    s.on('call:answer', onAnswer);
    s.on('call:ice_candidate', onIceCandidate);

    return () => {
      s.off('call:member_joined', onMemberJoined);
      s.off('call:member_left', onMemberLeft);
      s.off('call:offer', onOffer);
      s.off('call:answer', onAnswer);
      s.off('call:ice_candidate', onIceCandidate);
    };
  }, [socket, user, createPeer, destroyPeer, emit]);

  // Cleanup if the component using this hook unmounts mid-call
  useEffect(() => {
    return () => {
      if (currentRoomRef.current) leaveCall();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Replaces the video track in every live RTCPeerConnection.
  // Used by useBackgroundBlur to swap to a canvas-processed track.
  const updateVideoTrack = useCallback((newTrack) => {
    if (!newTrack) return;
    Object.values(peersRef.current).forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(newTrack);
    });
  }, []);

  return {
    localStream,
    remoteStreams,   // { [userId]: MediaStream }
    isMuted,
    isCameraOff,
    isInCall,
    callError,
    startCall,
    leaveCall,
    toggleMute,
    toggleCamera,
    updateVideoTrack,
  };
}
