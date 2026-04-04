import { formatDistance } from "@/lib/utils";
import type { ConsumptionFactors } from "@/hooks/useConsumptionModel";
import type { DriveMode, TripConsumptionBreakdown } from "@/types";

interface TripInfoProps {
  distance: number;
  elapsedTime: number;
  fuelUsed?: number;
  fuelPrice?: number;
  actualCost?: number;
  range?: number;
  currentConsumption?: number;
  cityKmPerLiter?: number;
  highwayKmPerLiter?: number;
  mixedKmPerLiter?: number;
  driveMode?: DriveMode;
  useWorstCaseCity?: boolean;
  consumptionFactors?: ConsumptionFactors;
  consumptionBreakdown?: TripConsumptionBreakdown | null;
}

function formatTimeHms(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [
    h.toString().padStart(2, "0"),
    m.toString().padStart(2, "0"),
    s.toString().padStart(2, "0"),
  ].join(":");
}

export function TripInfo({
  distance,
  elapsedTime,
  fuelUsed = 0,
  fuelPrice = 5.0,
  actualCost,
  range = 0,
  currentConsumption,
}: TripInfoProps) {
  const estimatedCost = fuelUsed * fuelPrice;
  const displayCost = actualCost ?? estimatedCost;
  const formattedCost = displayCost.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/50 bg-[#d8e8ec]/74 px-2 py-2 shadow-[0_10px_26px_rgba(15,23,42,0.1)] backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <svg
            className="h-4 w-4 shrink-0 text-slate-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M12 7v5l3 3"
            />
          </svg>
          <div className="min-w-0">
            <p className="text-[0.5rem] font-medium leading-none text-slate-700">
              Tempo
            </p>
            <p className="text-2xl font-semibold leading-none tracking-[-0.02em] text-slate-950">
              {formatTimeHms(elapsedTime)}
            </p>
          </div>
        </div>

        <div className="mx-1 h-8 w-px bg-slate-500/20" />

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <svg
            className="h-4 w-4 shrink-0 text-slate-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M12 14a2 2 0 100-4 2 2 0 000 4z"
              fill="currentColor"
              stroke="none"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M4 13a8 8 0 1116 0"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M12 12l4-3"
            />
          </svg>
          <div className="min-w-0">
            <p className="text-[0.5rem] font-medium leading-none text-slate-700">
              Distância
            </p>
            <p className="text-2xl font-semibold leading-none tracking-[-0.02em] text-slate-950">
              {formatDistance(distance)}
            </p>
          </div>
        </div>

        <div className="mx-1 h-8 w-px bg-slate-500/20" />

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <svg
            className="h-4 w-4 shrink-0 text-slate-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M6 4h9a1 1 0 011 1v12a1 1 0 01-1 1H6a1 1 0 01-1-1V5a1 1 0 011-1z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M8 4v4h5V4"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M16 8h1a2 2 0 012 2v4a1 1 0 01-1 1h-2"
            />
          </svg>
          <div className="min-w-0">
            <p className="text-[0.5rem] font-medium leading-none text-slate-700">
              Autonomia
            </p>
            <p className="text-xl font-semibold leading-none tracking-[-0.02em] text-slate-950">
              {Math.round(range)} km
            </p>
            {currentConsumption && (
              <p className="text-[0.45rem] font-medium text-slate-600">
                {currentConsumption.toFixed(1)} km/l
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-1.5 h-px w-full bg-slate-500/20" />

      <div className="mt-1.5 flex items-center justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <svg
            className="h-4 w-4 shrink-0 text-slate-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="min-w-0 rounded-lg bg-slate-800/10 px-2 py-1">
            <p className="text-[0.5rem] font-medium leading-none text-slate-700">
              Gasto
            </p>
            <p className="text-xl font-bold leading-none tracking-[-0.02em] text-slate-950">
              R${formattedCost}
            </p>
            <p className="text-[0.45rem] font-medium text-slate-600">
              {fuelUsed.toFixed(1)} L
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
