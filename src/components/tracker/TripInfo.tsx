import { formatDistance, formatTime } from "@/lib/utils";

interface TripInfoProps {
  distance: number;
  elapsedTime: number;
  maxSpeed: number;
}

export function TripInfo({ distance, elapsedTime, maxSpeed }: TripInfoProps) {
  const averageSpeed =
    elapsedTime > 0 ? Math.round(distance / 1000 / (elapsedTime / 3600)) : 0;

  return (
    <div className="flex items-center justify-center gap-4 rounded-2xl bg-black/50 px-4 py-3 backdrop-blur-md">
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
        <span className="text-xs font-medium text-white/60">MÉDIA</span>
        <span className="text-lg font-bold text-white tabular-nums">
          {averageSpeed} km/h
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
  );
}
