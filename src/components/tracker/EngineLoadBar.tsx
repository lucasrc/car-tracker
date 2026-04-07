interface EngineLoadBarProps {
  engineLoad?: number; // 0-100%
}

export function EngineLoadBar({ engineLoad }: EngineLoadBarProps) {
  // Don't show if no data
  if (engineLoad === undefined) {
    return null;
  }

  // Clamp load between 0 and 100
  const load = Math.max(0, Math.min(100, engineLoad));

  // Color based on load:
  // 0-30%: green (light load - efficient)
  // 30-60%: lime (moderate load)
  // 60-80%: yellow (normal load)
  // 80-90%: orange (high load)
  // 90-100%: red (very high load)
  const getColor = (value: number): string => {
    if (value < 30) return "bg-green-500";
    if (value < 60) return "bg-lime-500";
    if (value < 80) return "bg-yellow-500";
    if (value < 90) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div className="fixed bottom-4 left-[76px] -translate-x-1/2 z-50 w-32 pointer-events-auto">
      <div className="bg-black/80 backdrop-blur-md rounded-full px-2.5 py-1.5 border border-white/20 shadow-lg">
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-2 bg-slate-600/70 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-out ${getColor(load)}`}
              style={{ width: `${load}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-white tabular-nums">
            {Math.round(load)}%
          </span>
        </div>
      </div>
    </div>
  );
}
