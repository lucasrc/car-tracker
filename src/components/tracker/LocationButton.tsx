interface LocationButtonProps {
  onClick: () => void;
  className?: string;
}

export function LocationButton({
  onClick,
  className = "",
}: LocationButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/70 shadow-md transition-all duration-300 hover:scale-105 active:scale-95 ${className}`}
      aria-label="Centralizar no mapa"
    >
      <svg
        className="h-4 w-4 text-white/80"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" />
        <line x1="12" y1="2" x2="12" y2="6" />
        <line x1="12" y1="18" x2="12" y2="22" />
        <line x1="2" y1="12" x2="6" y2="12" />
        <line x1="18" y1="12" x2="22" y2="12" />
      </svg>
    </button>
  );
}
