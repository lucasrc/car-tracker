import { useMemo } from "react";

interface SpeedometerProps {
  currentSpeed: number;
  maxSpeed: number;
}

export function Speedometer({ currentSpeed }: SpeedometerProps) {
  const speedPercent = Math.min(currentSpeed / 120, 1);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - speedPercent);

  const speedColor = useMemo(() => {
    if (currentSpeed <= 60) return "#22c55e";
    if (currentSpeed <= 80) return "#eab308";
    if (currentSpeed <= 100) return "#f97316";
    return "#ef4444";
  }, [currentSpeed]);

  return (
    <div className="flex items-center justify-center">
      <div className="relative">
        <svg
          className="h-36 w-36 -rotate-90 drop-shadow-2xl"
          viewBox="0 0 140 140"
        >
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="rgba(0, 0, 0, 0.6)"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth="10"
          />
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={speedColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-300 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-4xl font-bold tabular-nums text-white drop-shadow-lg"
            style={{ color: speedColor }}
          >
            {Math.round(currentSpeed)}
          </span>
          <span className="text-xs font-medium text-white/70">km/h</span>
        </div>
      </div>
    </div>
  );
}
