interface FuelBarProps {
  currentFuel: number;
  fuelCapacity: number;
  className?: string;
}

export function FuelBar({
  currentFuel,
  fuelCapacity,
  className = "",
}: FuelBarProps) {
  const percentage = Math.min(
    100,
    Math.max(0, (currentFuel / fuelCapacity) * 100),
  );

  const getColor = () => {
    if (percentage > 50) return "#22c55e";
    if (percentage > 20) return "#eab308";
    return "#ef4444";
  };

  return (
    <div className={`h-[5px] w-full bg-slate-300/50 ${className}`}>
      <div
        className="h-full transition-all duration-300"
        style={{
          width: `${percentage}%`,
          backgroundColor: getColor(),
        }}
      />
    </div>
  );
}
