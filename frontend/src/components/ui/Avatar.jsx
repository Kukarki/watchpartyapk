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

function getColor(name = '') {
  const colors = [
    'bg-amber/20 text-amber border-amber/30',
    'bg-info/20 text-info border-info/30',
    'bg-online/20 text-online border-online/30',
    'bg-danger/20 text-danger border-danger/30',
    'bg-sub/20 text-sub border-sub/30',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function Avatar({ src, name = '', size = 'md', className = '' }) {
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;
  const colorClass = getColor(name);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClass} rounded-full object-cover border border-border ${className}`}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full border flex items-center justify-center
                   font-display font-semibold shrink-0 ${colorClass} ${className}`}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}