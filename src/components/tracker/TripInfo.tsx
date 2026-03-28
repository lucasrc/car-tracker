import { formatDistance, formatTime } from "@/lib/utils";

interface TripInfoProps {
  distance: number;
  elapsedTime: number;
  maxSpeed: number;
  fuelUsed?: number;
  fuelPrice?: number;
  range?: number;
}

export function TripInfo({
  distance,
  elapsedTime,
  maxSpeed,
  fuelUsed = 0,
  fuelPrice = 5.0,
  range = 0,
}: TripInfoProps) {
  const averageSpeed =
    elapsedTime > 0 ? Math.round(distance / 1000 / (elapsedTime / 3600)) : 0;
  const spentValue = fuelUsed * fuelPrice;

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-black/50 px-4 py-3 backdrop-blur-md">
      <div className="flex items-center justify-center gap-4">
        <div className="flex flex-col items-center">
          <span className="text-xs font-medium text-white/60">DISTÂNCIA</span>
          <span className="text-lg font-bold text-white tabular-nums">
            {formatDistance(distance)}
          </span>
        </div>

        <div className="h-8 w-px bg-white/20" />

        <div className="flex flex-col items-center">
          <span className="text-xs font-medium text-white/60">TEMPO</span>
          <span className="text-lg font-bold text-white tabular-nums">
            {formatTime(elapsedTime)}
          </span>
        </div>

        <div className="h-8 w-px bg-white/20" />

        <div className="flex flex-col items-center">
          <span className="text-xs font-medium text-white/60">MÁX</span>
          <span className="text-lg font-bold text-white tabular-nums">
            {Math.round(maxSpeed)} km/h
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 border-t border-white/10 pt-2">
        <div className="flex flex-col items-center">
          <span className="text-xs font-medium text-white/60">MÉDIA</span>
          <span className="text-lg font-bold text-white tabular-nums">
            {averageSpeed} km/h
          </span>
        </div>

        <div className="h-8 w-px bg-white/20" />

        <div className="flex flex-col items-center">
          <span className="text-xs font-medium text-white/60">GASTO</span>
          <span className="text-lg font-bold text-green-400 tabular-nums">
            {fuelUsed.toFixed(2)} L
          </span>
          <span className="text-xs font-medium text-green-300 tabular-nums">
            R$ {spentValue.toFixed(2)}
          </span>
        </div>

        <div className="h-8 w-px bg-white/20" />

        <div className="flex flex-col items-center">
          <span className="text-xs font-medium text-white/60">AUTONOMIA</span>
          <span className="text-lg font-bold text-blue-400 tabular-nums">
            {Math.round(range)} km
          </span>
        </div>
      </div>
    </div>
  );
}
