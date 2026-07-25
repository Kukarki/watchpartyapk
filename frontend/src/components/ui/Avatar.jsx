import { getUserColorHex, getUserColorTint } from '@/utils/userColor.js';

const SIZE_MAP = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
};

function getInitials(name = '') {
  return name
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
}

export default function Avatar({ src, name = '', size = 'md', className = '' }) {
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;
  const colorHex = getUserColorHex(name);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClass} rounded-full object-cover border-2 ${className}`}
        style={{ borderColor: colorHex }}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full border-2 flex items-center justify-center
                   font-display font-semibold shrink-0 ${getUserColorTint(name)} ${className}`}
      style={{ borderColor: colorHex }}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}