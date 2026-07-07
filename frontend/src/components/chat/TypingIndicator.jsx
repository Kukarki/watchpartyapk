export default function TypingIndicator({ names }) {
  if (!names.length) return null;

  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
      ? `${names[0]} and ${names[1]} are typing`
      : `${names[0]} and ${names.length - 1} others are typing`;

  return (
    <div className="flex items-center gap-2 px-2 py-1 animate-fade-in">
      <div className="flex items-center gap-1 bg-raised border border-border
                       px-3 py-2 rounded-2xl rounded-bl-sm w-fit">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span className="text-dim text-xs">{label}</span>
    </div>
  );
}