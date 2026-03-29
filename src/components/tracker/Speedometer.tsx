interface SpeedometerProps {
  currentSpeed: number;
}

export function Speedometer({ currentSpeed }: SpeedometerProps) {
  const displayValue = currentSpeed === 0 ? "--" : Math.round(currentSpeed);

  return (
    <div className="flex h-[100px] w-[100px] items-center justify-center rounded-full border-2 border-white/60 bg-black/50 shadow-lg backdrop-blur-sm">
      <div className="flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{displayValue}</span>
        <span className="text-xs font-medium text-white/70">km/h</span>
      </div>
    </div>
  );
}
