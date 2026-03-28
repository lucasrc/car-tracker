import { formatDateTime, formatDistance } from "@/lib/utils";
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
  const consumption = trip.consumption || 0;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-md transition-all hover:shadow-xl">
      <button
        onClick={onClick}
        className="absolute inset-0 z-10 cursor-pointer"
      />

      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2 font-semibold text-gray-900">
            <svg
              className="h-5 w-5 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            {formatDateTime(trip.startTime)}
          </span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600">
            {trip.path.length} pts
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
              <span className="text-xs font-medium text-gray-400">Média</span>
              <span className="text-sm font-bold text-gray-900">
                {consumption.toFixed(1)} km/L
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
