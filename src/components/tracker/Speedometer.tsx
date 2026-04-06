interface SpeedometerProps {
  currentSpeed: number;
  maxSpeed?: number;
  isSpeeding?: boolean;
  currentGear?: number;
  currentRpm?: number;
  hasTransmissionData?: boolean;
}

export function Speedometer({
  currentSpeed,
  maxSpeed,
  isSpeeding = false,
  currentGear,
  currentRpm,
  hasTransmissionData,
}: SpeedometerProps) {
  const displayValue = currentSpeed === 0 ? "--" : Math.round(currentSpeed);

  const borderColor = isSpeeding
    ? "border-red-500 animate-pulse"
    : maxSpeed && currentSpeed > maxSpeed
      ? "border-yellow-500"
      : "border-white/60";

  const bgColor = isSpeeding ? "bg-red-600/80" : "bg-black/50";

  const displayGear =
    hasTransmissionData && currentGear !== undefined
      ? currentGear === 0
        ? "N"
        : `${currentGear}ª`
      : null;

  const displayRpm =
    hasTransmissionData && currentRpm !== undefined && currentSpeed > 0
      ? Math.round(currentRpm)
      : null;

  return (
    <div
      className={`flex h-[120px] w-[120px] items-center justify-center rounded-full border-2 ${borderColor} ${bgColor} shadow-lg backdrop-blur-sm transition-colors duration-200`}
    >
      <div className="flex flex-col items-center justify-center gap-0.5">
        <span className="text-3xl font-bold text-white leading-none">
          {displayValue}
        </span>
        <span className="text-[10px] font-medium text-white/70 uppercase tracking-wide">
          km/h
        </span>
        {maxSpeed !== undefined && (
          <span className="text-[10px] font-medium text-white/50 mt-0.5">
            máx: {maxSpeed}
          </span>
        )}
        {displayGear !== null && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs font-bold text-green-400">
              {displayGear}
            </span>
            {displayRpm !== null && (
              <span className="text-[10px] font-medium text-white/60">
                {displayRpm} RPM
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
