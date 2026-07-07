import { useEffect, useRef } from 'react';
import Avatar from '@/components/ui/Avatar.jsx';

/**
 * PeerVideo
 * Renders a single participant tile in the video call grid.
 * Shows an avatar fallback when camera is off or stream has no video tracks.
 */
export default function PeerVideo({
  stream,
  displayName = 'Participant',
  avatar,
  isMuted = false,
  isCameraOff = false,
  isLocal = false,
}) {
  const videoRef = useRef(null);

  const hasVideoTrack = (stream?.getVideoTracks()?.length ?? 0) > 0;
  const showVideo = hasVideoTrack && !isCameraOff;

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream ?? null;
    }
  }, [stream]);

  return (
    <div className="relative w-full h-full bg-raised rounded-xl overflow-hidden
                     flex items-center justify-center border border-border">

      {/* Video element — always in the DOM so srcObject assignment works */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover transition-opacity duration-200
                     ${showVideo ? 'opacity-100' : 'opacity-0 absolute inset-0 pointer-events-none'}`}
      />

      {/* Avatar fallback when camera is off or audio-only */}
      {!showVideo && (
        <div className="flex flex-col items-center gap-2">
          <Avatar src={avatar} name={displayName} size="lg" />
          <span className="text-dim text-[10px] font-mono tracking-wide">
            {isCameraOff ? 'Camera off' : 'Audio only'}
          </span>
        </div>
      )}

      {/* Bottom bar — name + mute badge */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5
                       flex items-center justify-between
                       bg-gradient-to-t from-void/80 to-transparent">
        <span className="text-bright text-[11px] font-medium truncate max-w-[75%] drop-shadow">
          {isLocal ? 'You' : displayName}
        </span>
        {isMuted && (
          <span className="bg-danger/80 text-white text-[10px] font-mono
                            px-1.5 py-0.5 rounded leading-none">
            🔇
          </span>
        )}
      </div>
    </div>
  );
}
