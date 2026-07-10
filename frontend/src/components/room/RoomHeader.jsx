import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoomStore } from '@/store/roomStore.js';
import { useRoomActions } from '@/contexts/RoomContext.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import toast from 'react-hot-toast';

export default function RoomHeader() {
  const navigate = useNavigate();
  const { room, members, isChatOpen, isVoicePanelOpen, toggleChat, toggleVoicePanel } = useRoomStore();
  const { sendChangeUrl } = useRoomActions();
  const { user } = useAuth();
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const copyInvite = () => {
    const url = `${window.location.origin}/join/${room?.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Invite link copied!');
  };

  const handleChangeUrl = (e) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    sendChangeUrl(urlInput.trim());
    setUrlInput('');
    setShowUrlInput(false);
    toast.success('Video updated for everyone');
  };

  return (
    <header className="bg-surface border-b border-border shrink-0 z-10">
      <div className="flex items-center justify-between px-4 py-3 gap-4">
        {/* Left: room info */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/home')}
            className="text-dim hover:text-sub transition-colors"
            title="Back to home"
          >
            ←
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-display font-semibold text-bright truncate">{room?.name}</h2>
              <span className="text-xs font-mono text-dim bg-raised border border-border
                               px-2 py-0.5 rounded shrink-0">
                {room?.id}
              </span>
            </div>
            <p className="text-dim text-xs badge-online">
              {members.length} {room?.roomType === 'music' ? 'listening' : 'watching'}
            </p>
          </div>
        </div>

        {/* Center: change video */}
        <div className="hidden md:flex flex-1 max-w-lg">
          {showUrlInput ? (
            <form onSubmit={handleChangeUrl} className="flex gap-2 w-full">
              <input
                type="url"
                className="input-base text-sm py-1.5"
                placeholder="Enter video URL..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn-primary py-1.5 px-4 text-sm shrink-0">
                Set
              </button>
              <button
                type="button"
                onClick={() => setShowUrlInput(false)}
                className="btn-ghost py-1.5 px-3 text-sm"
              >
                ✕
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowUrlInput(true)}
              className="btn-ghost text-sm w-full justify-start text-dim"
            >
              {room?.roomType === 'music' ? '🎵 Change track URL...' : '🎬 Change video URL...'}
            </button>
          )}
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={copyInvite}
            className="btn-ghost text-xs px-3 py-1.5 hidden sm:flex"
            title="Copy invite link"
          >
            🔗 Invite
          </button>

          <button
            onClick={toggleVoicePanel}
            className={`btn-ghost text-xs px-3 py-1.5 ${isVoicePanelOpen ? 'text-online' : ''}`}
            title="Toggle voice panel"
          >
            🎙️
          </button>

          <button
            onClick={toggleChat}
            className={`btn-ghost text-xs px-3 py-1.5 ${isChatOpen ? 'text-amber' : ''}`}
            title="Toggle chat"
          >
            💬
          </button>

          {/* User avatar */}
          <img
            src={user?.avatar || `https://api.dicebear.com/8.x/avataaars/svg?seed=${encodeURIComponent(user?.displayName || 'guest')}`}
            alt={user?.displayName || 'User'}
            className="w-8 h-8 rounded-full border border-border ml-1 bg-raised"
            onError={(e) => { e.target.src = `https://api.dicebear.com/8.x/avataaars/svg?seed=${encodeURIComponent(user?.displayName || 'guest')}`; }}
          />
        </div>
      </div>
    </header>
  );
}