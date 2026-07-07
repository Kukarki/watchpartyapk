/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        void:    '#080a0f',
        surface: '#0e1118',
        raised:  '#141820',
        border:  '#1e2433',
        muted:   '#2a3347',
        dim:     '#4d5d7a',
        sub:     '#8896b0',
        base:    '#c8d6f0',
        bright:  '#eef2fc',
        amber:   { DEFAULT: '#f5a623', dark: '#c4851b', glow: '#f5a62340' },
        online:  '#22d3a0',
        danger:  '#ff4757',
        info:    '#3b82f6',
      },
      backgroundImage: {
        'cinema-grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
        'screen-glow': 'radial-gradient(ellipse 80% 50% at 50% 0%, #f5a62318 0%, transparent 70%)',
      },
      boxShadow: {
        'glow-amber': '0 0 24px 2px #f5a62340',
        'glow-sm':    '0 0 12px 1px #f5a62330',
        'cinema':     '0 32px 64px -16px #00000080',
      },
      animation: {
        'fade-in':    'fadeIn 0.25s ease-out both',
        'slide-up':   'slideUp 0.3s cubic-bezier(0.16,1,0.3,1) both',
        'slide-right':'slideRight 0.3s cubic-bezier(0.16,1,0.3,1) both',
        'pulse-dot':  'pulseDot 1.4s ease-in-out infinite',
        'typing':     'typing 1.2s steps(3) infinite',
        'float-up':   'floatUp 2.8s ease-out forwards',
        'ring-pulse': 'ringPulse 1s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideRight:{ from: { opacity: '0', transform: 'translateX(-12px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        pulseDot:  { '0%,80%,100%': { transform: 'scale(0.6)', opacity: '0.4' }, '40%': { transform: 'scale(1)', opacity: '1' } },
        typing:    { from: { width: '0' }, to: { width: '100%' } },
        floatUp: {
          '0%':   { opacity: '0', transform: 'translateY(0) scale(0.6)' },
          '15%':  { opacity: '1', transform: 'translateY(-16px) scale(1.1)' },
          '70%':  { opacity: '1', transform: 'translateY(-56px) scale(1)' },
          '100%': { opacity: '0', transform: 'translateY(-80px) scale(0.8)' },
        },
        ringPulse: {
          '0%,100%': { transform: 'scale(1)',   boxShadow: '0 0 0 0 rgba(59,130,246,0.5)' },
          '50%':     { transform: 'scale(1.05)', boxShadow: '0 0 0 8px rgba(59,130,246,0)' },
        },
      },
    },
  },
  plugins: [],
};