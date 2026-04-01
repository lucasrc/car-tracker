import { useState, useMemo } from "react";
import type { SpeedingEvent } from "@/types";

interface SpeedingEventsCardProps {
  events: SpeedingEvent[];
}

function formatEventTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSeverityColor(excessKmh: number): {
  bg: string;
  text: string;
  border: string;
} {
  if (excessKmh > 25) {
    return { bg: "bg-red-100", text: "text-red-700", border: "border-red-300" };
  } else if (excessKmh > 15) {
    return {
      bg: "bg-orange-100",
      text: "text-orange-700",
      border: "border-orange-300",
    };
  }
  return {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    border: "border-yellow-300",
  };
}

function getExcessBadgeColor(excessKmh: number): string {
  if (excessKmh > 25) {
    return "bg-red-500 text-white";
  } else if (excessKmh > 15) {
    return "bg-orange-500 text-white";
  }
  return "bg-yellow-500 text-white";
}

const INITIAL_DISPLAY_COUNT = 10;

export function SpeedingEventsCard({ events }: SpeedingEventsCardProps) {
  const [showAll, setShowAll] = useState(false);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => b.timestamp - a.timestamp);
  }, [events]);

  const displayedEvents = showAll
    ? sortedEvents
    : sortedEvents.slice(0, INITIAL_DISPLAY_COUNT);

  const maxSpeed = Math.max(...events.map((e) => e.currentSpeed));

  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-red-50 px-4 py-3 border-b border-red-100">
        <div className="flex items-center gap-2">
          <span className="text-lg">📸</span>
          <p className="text-sm font-semibold text-red-800">
            Excesso de Velocidade ({events.length}x)
          </p>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {displayedEvents.map((event, idx) => {
          const excess = event.currentSpeed - event.radarMaxSpeed;
          const severity = getSeverityColor(excess);
          const badgeColor = getExcessBadgeColor(excess);

          return (
            <div
              key={`${event.radarId}-${event.timestamp}-${idx}`}
              className={`px-4 py-3 ${severity.bg}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">
                    {formatEventTime(event.timestamp)}
                  </span>
                  <span className="text-sm text-gray-600">
                    {event.currentSpeed.toFixed(0)} km/h
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    Limite: {event.radarMaxSpeed} km/h
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badgeColor}`}
                  >
                    +{excess.toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {events.length > INITIAL_DISPLAY_COUNT && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            {showAll
              ? "Mostrar menos"
              : `Ver mais ${events.length - INITIAL_DISPLAY_COUNT} eventos`}
          </button>
        </div>
      )}

      <div className="px-4 py-2 bg-gray-100 border-t border-gray-200">
        <p className="text-xs text-gray-600">
          <span className="font-medium">Máxima detectada:</span>{" "}
          {maxSpeed.toFixed(0)} km/h
        </p>
      </div>
    </div>
  );
}
