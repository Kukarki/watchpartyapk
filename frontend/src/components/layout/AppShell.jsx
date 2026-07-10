import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useFriendsStore } from '@/store/friendsStore.js';

const NAV_ITEMS = [
  { to: '/home',    label: 'Home',    icon: '🏠' },
  { to: '/music',   label: 'Music',   icon: '🎵' },
  { to: '/friends', label: 'Friends', icon: '👥' },
];

export default function AppShell({ children }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { incomingRequests } = useFriendsStore();
  const badgeCount = incomingRequests.length;

  const avatarUrl = user?.avatar
    || `https://api.dicebear.com/8.x/avataaars/svg?seed=${encodeURIComponent(user?.displayName || 'guest')}`;

  return (
    <div className="min-h-screen bg-void text-base font-body antialiased flex flex-col">
      {/* Top bar */}
      <nav className="sticky top-0 z-20 border-b border-border bg-surface/50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <button onClick={() => navigate('/home')} className="flex items-center gap-2 shrink-0">
            <span className="text-xl">🎬</span>
            <span className="font-display font-bold text-lg text-bright">
              Watch<span className="text-gradient">Party</span>
            </span>
          </button>

          <div className="hidden sm:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                   ${isActive ? 'text-amber bg-amber/10' : 'text-sub hover:text-bright hover:bg-raised'}`
                }
              >
                {item.label}
                {item.to === '/friends' && badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full bg-danger
                                     text-[10px] font-bold text-white flex items-center justify-center">
                    {badgeCount}
                  </span>
                )}
              </NavLink>
            ))}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <NavLink
              to="/profile"
              title="Edit your profile"
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
            >
              <img
                src={avatarUrl}
                alt={user?.displayName || 'User'}
                className="w-8 h-8 rounded-full border border-border bg-raised"
                onError={(e) => { e.target.src = `https://api.dicebear.com/8.x/avataaars/svg?seed=${encodeURIComponent(user?.displayName || 'guest')}`; }}
              />
              <span className="text-sub text-sm hidden md:block">{user?.displayName}</span>
            </NavLink>
            <button onClick={logout} className="btn-ghost text-xs px-3 py-1.5">
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* pb-16 keeps content clear of the fixed mobile bottom tab bar */}
      <div className="flex-1 pb-16 sm:pb-0">
        {children}
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-20 border-t border-border bg-surface/90 backdrop-blur-xl">
        <div className="flex items-stretch">
          {[...NAV_ITEMS, { to: '/profile', label: 'Profile', icon: '👤' }].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5
                 text-[11px] font-medium transition-colors
                 ${isActive ? 'text-amber' : 'text-dim'}`
              }
            >
              <span className="relative">
                <span className="text-lg leading-none">{item.icon}</span>
                {item.to === '/friends' && badgeCount > 0 && (
                  <span className="absolute -top-1 -right-2 w-3.5 h-3.5 rounded-full bg-danger
                                     text-[9px] font-bold text-white flex items-center justify-center">
                    {badgeCount}
                  </span>
                )}
              </span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
