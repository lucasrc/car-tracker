import { formatSpeed, formatDistance, formatTime } from "@/lib/utils";

interface DashboardProps {
  currentSpeed: number;
  distance: number;
  elapsedTime: number;
  maxSpeed: number;
  radarMaxSpeed?: number;
  isSpeeding?: boolean;
  gradePercent?: number;
}

export function Dashboard({
  currentSpeed,
  distance,
  elapsedTime,
  maxSpeed,
  radarMaxSpeed,
  isSpeeding = false,
  gradePercent = 0,
}: DashboardProps) {
  const speedPercent = Math.min(currentSpeed / 200, 1);
  const strokeDasharray = 2 * Math.PI * 45;
  const strokeDashoffset = strokeDasharray * (1 - speedPercent);

  const speedColor = isSpeeding
    ? "#DC2626"
    : radarMaxSpeed && currentSpeed > radarMaxSpeed
      ? "#F59E0B"
      : "#3B82F6";

  return (
    <div className="flex flex-col gap-4 rounded-t-3xl bg-gray-900 p-6 text-white">
      <div className="flex items-center justify-between">
        <div className="flex flex-col items-center">
          <span className="text-xs uppercase text-gray-400">Velocidade</span>
          <div className="relative flex items-center justify-center">
            <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#374151"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={speedColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-300"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className={`text-3xl font-bold tabular-nums ${isSpeeding ? "animate-pulse text-red-400" : ""}`}
              >
                {formatSpeed(currentSpeed)}
              </span>
              <span className="text-xs text-gray-400">km/h</span>
              {radarMaxSpeed && (
                <span className="mt-1 text-xs font-medium text-yellow-400">
                  radar: {radarMaxSpeed}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-xs uppercase text-gray-400">Tempo</span>
          <span className="text-2xl font-mono font-bold tabular-nums">
            {formatTime(elapsedTime)}
          </span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-xs uppercase text-gray-400">Distância</span>
          <span className="text-2xl font-bold tabular-nums">
            {formatDistance(distance)}
          </span>
        </div>
      </div>

      <div className="flex justify-between rounded-lg bg-gray-800 px-4 py-2">
        <div className="flex flex-col items-center">
          <span className="text-xs text-gray-400">Máx</span>
          <span className="font-semibold">{Math.round(maxSpeed)} km/h</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-gray-400">Média</span>
          <span className="font-semibold">
            {elapsedTime > 0
              ? Math.round(distance / 1000 / (elapsedTime / 3600))
              : 0}{" "}
            km/h
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-gray-400">Inclinação</span>
          <span
            className={`font-semibold ${
              Math.abs(gradePercent) < 0.3
                ? "text-gray-300"
                : gradePercent > 0
                  ? "text-green-400"
                  : "text-red-400"
            }`}
          >
            {Math.abs(gradePercent) < 0.3 ? "→" : gradePercent >= 0 ? "↗" : "↘"}{" "}
            {Math.abs(gradePercent).toFixed(1)}%
          </span>
        </div>
        {isSpeeding && (
          <div className="flex flex-col items-center">
            <span className="text-xs text-red-400">INFRAÇÃO</span>
            <span className="font-semibold text-red-400">
              {Math.round(currentSpeed - (radarMaxSpeed ?? 0))} km/h
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
