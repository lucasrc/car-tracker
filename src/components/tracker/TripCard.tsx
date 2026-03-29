import { formatDate, formatDistance } from "@/lib/utils";
import type { Trip } from "@/types";

interface TripCardProps {
  trip: Trip;
  onClick: () => void;
  onDelete: () => void;
}

export function TripCard({ trip, onClick, onDelete }: TripCardProps) {
  const durationMinutes = trip.endTime
    ? Math.round(
        (new Date(trip.endTime).getTime() -
          new Date(trip.startTime).getTime()) /
          60000,
      )
    : 0;

  const fuelUsed = trip.fuelUsed || 0;

  const formatTimeDisplay = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const startTime = formatTimeDisplay(trip.startTime);
  const endTime = trip.endTime ? formatTimeDisplay(trip.endTime) : "--:--:--";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-md transition-all hover:shadow-xl">
      <button
        onClick={onClick}
        className="absolute inset-0 z-10 cursor-pointer"
      />

      <div className="relative">
        <div className="mb-3 flex items-center gap-2">
          <svg
            className="h-4 w-4 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-sm text-gray-500">
            {formatDate(trip.startTime)} &mdash; {startTime} — {endTime}
          </span>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <div className="flex gap-4">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-400">
                Distância
              </span>
              <span className="text-lg font-bold text-gray-900">
                {formatDistance(trip.distanceMeters)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-400">Duração</span>
              <span className="text-lg font-bold text-gray-900">
                {durationMinutes} min
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <div className="flex gap-4">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-400">Consumo</span>
              <span className="text-sm font-bold text-gray-900">
                {fuelUsed.toFixed(2)} L
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-400">Gasto</span>
              <span className="text-sm font-bold text-gray-900">
                R$ {(trip.totalCost || 0).toFixed(2)}
              </span>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="relative z-20 flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-500 transition-colors hover:bg-red-100"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
