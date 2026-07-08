import { useEffect, useRef, useCallback } from 'react';
import { useSocketContext } from '@/contexts/SocketContext.jsx';
import { useRoomStore } from '@/store/roomStore.js';
import { useAuthStore } from '@/store/authStore.js';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  ...(import.meta.env.VITE_TURN_URL
    ? [{
        urls:       import.meta.env.VITE_TURN_URL.split(','),
        username:   import.meta.env.VITE_TURN_USERNAME,
        credential: import.meta.env.VITE_TURN_CREDENTIAL,
      }]
    : []),
];

/**
 * useVoice
 * Manages WebRTC peer connections for voice chat.
 * Handles offer/answer/ICE signaling via socket relay.
 */
export function useVoice() {
  const { socket, emit } = useSocketContext();
  const { user } = useAuthStore();
  const { localVoiceState } = useRoomStore();

  const peersRef = useRef({}); // { userId: RTCPeerConnection }
  const localStreamRef = useRef(null);
  const audioElementsRef = useRef({}); // { userId: HTMLAudioElement }

  // ── Get local microphone ─────────────────────────────────
  const startLocalAudio = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    return stream;
  }, []);

  const stopLocalAudio = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
  }, []);

  // ── Create peer connection to a remote user ───────────────
  const createPeer = useCallback((remoteUserId, initiator) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current[remoteUserId] = pc;

    // Add local tracks
    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });

    // ICE candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        emit('voice:ice_candidate', { targetId: remoteUserId, candidate });
      }
    };

    // Remote audio
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (!audioElementsRef.current[remoteUserId]) {
        const audio = new Audio();
        audio.autoplay = true;
        audioElementsRef.current[remoteUserId] = audio;
      }
      audioElementsRef.current[remoteUserId].srcObject = stream;
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        destroyPeer(remoteUserId);
      }
    };

    // If we're the initiator, create and send offer
    if (initiator) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          emit('voice:offer', { targetId: remoteUserId, sdp: pc.localDescription });
        })
        .catch(console.error);
    }

    return pc;
  }, [emit]);

  const destroyPeer = useCallback((userId) => {
    peersRef.current[userId]?.close();
    delete peersRef.current[userId];
    if (audioElementsRef.current[userId]) {
      audioElementsRef.current[userId].srcObject = null;
      delete audioElementsRef.current[userId];
    }
  }, []);

  const destroyAllPeers = useCallback(() => {
    Object.keys(peersRef.current).forEach(destroyPeer);
  }, [destroyPeer]);

  // ── WebRTC signaling listeners ────────────────────────────
  useEffect(() => {
    const s = socket.current;
    if (!s) return;

    const onOffer = async ({ fromId, sdp }) => {
      let pc = peersRef.current[fromId];
      if (!pc) pc = createPeer(fromId, false);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      emit('voice:answer', { targetId: fromId, sdp: pc.localDescription });
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
        console.error('[WebRTC] ICE candidate error', e);
      }
    };

    // When a new user joins voice, we initiate connection to them
    const onMemberJoined = ({ userId: remoteId }) => {
      if (remoteId === user?.userId) return;
      if (!localStreamRef.current) return;
      createPeer(remoteId, true);
    };

    const onMemberLeft = ({ userId: remoteId }) => {
      destroyPeer(remoteId);
    };

    s.on('voice:offer', onOffer);
    s.on('voice:answer', onAnswer);
    s.on('voice:ice_candidate', onIceCandidate);
    s.on('voice:member_joined', onMemberJoined);
    s.on('voice:member_left', onMemberLeft);

    return () => {
      s.off('voice:offer', onOffer);
      s.off('voice:answer', onAnswer);
      s.off('voice:ice_candidate', onIceCandidate);
      s.off('voice:member_joined', onMemberJoined);
      s.off('voice:member_left', onMemberLeft);
    };
  }, [socket, user, createPeer, destroyPeer, emit]);

  // ── Mute/unmute local tracks ─────────────────────────────
  const setMuted = useCallback((isMuted) => {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });
  }, []);

  useEffect(() => {
    setMuted(localVoiceState.isMuted);
  }, [localVoiceState.isMuted, setMuted]);

  return {
    startLocalAudio,
    stopLocalAudio,
    destroyAllPeers,
    setMuted,
  };
}