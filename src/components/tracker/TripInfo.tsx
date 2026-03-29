import { formatDistance } from "@/lib/utils";
import type { ConsumptionFactors } from "@/hooks/useConsumptionModel";
import type { DriveMode } from "@/types";

interface TripInfoProps {
  distance: number;
  elapsedTime: number;
  fuelUsed?: number;
  fuelPrice?: number;
  range?: number;
  cityKmPerLiter?: number;
  highwayKmPerLiter?: number;
  mixedKmPerLiter?: number;
  driveMode?: DriveMode;
  useWorstCaseCity?: boolean;
  consumptionFactors?: ConsumptionFactors;
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
  range = 0,
  cityKmPerLiter = 8,
  highwayKmPerLiter = 12,
  mixedKmPerLiter = 10,
  driveMode,
  useWorstCaseCity = false,
  consumptionFactors,
}: TripInfoProps) {
  const cost = fuelUsed * fuelPrice;
  const formattedCost = cost.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const speedFactorPct = consumptionFactors
    ? Math.round((consumptionFactors.speedFactor - 1) * 100)
    : 0;
  const aggressionFactorPct = consumptionFactors
    ? Math.round((consumptionFactors.aggressionFactor - 1) * 100)
    : 0;

  const getModeLabel = (mode?: DriveMode) => {
    switch (mode) {
      case "city":
        return "Cidade";
      case "highway":
        return "Estrada";
      case "mixed":
        return "Misto";
      default:
        return "Cidade";
    }
  };

  const getBaseConsumption = (mode?: DriveMode) => {
    switch (mode) {
      case "city":
        return cityKmPerLiter;
      case "highway":
        return highwayKmPerLiter;
      case "mixed":
        return mixedKmPerLiter;
      default:
        return cityKmPerLiter;
    }
  };

  return (
    <div className="space-y-2 px-3 pb-2">
      <div className="flex items-center rounded-3xl border border-white/65 bg-[#d8e8ec]/74 px-4 py-3 shadow-[0_10px_26px_rgba(15,23,42,0.1)] backdrop-blur-xl">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <svg
            className="h-7 w-7 shrink-0 text-slate-700"
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
            <p className="text-xs font-medium leading-none text-slate-700">
              Tempo:
            </p>
            <p className="mt-1 truncate font-semibold leading-none tracking-[-0.02em] text-slate-950 [font-size:clamp(1.25rem,4.3vw,1.95rem)]">
              {formatTimeHms(elapsedTime)}
            </p>
          </div>
        </div>

        <div className="mx-2 h-12 w-px bg-slate-500/20" />

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <svg
            className="h-7 w-7 shrink-0 text-slate-700"
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
            <p className="text-xs font-medium leading-none text-slate-700">
              Distância:
            </p>
            <p className="mt-1 truncate font-semibold leading-none tracking-[-0.02em] text-slate-950 [font-size:clamp(1.25rem,4.3vw,1.95rem)]">
              {formatDistance(distance)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center rounded-3xl border border-white/65 bg-[#d8e8ec]/74 px-4 py-3 shadow-[0_10px_26px_rgba(15,23,42,0.1)] backdrop-blur-xl">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <svg
            className="h-7 w-7 shrink-0 text-slate-700"
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
            <p className="text-xs font-medium leading-none text-slate-700">
              Autonomia:
            </p>
            <p className="mt-1 truncate font-semibold leading-none tracking-[-0.02em] text-slate-950 [font-size:clamp(1.25rem,4.3vw,1.95rem)]">
              {Math.round(range)} km
            </p>
            <p className="mt-1 truncate text-[11px] font-medium leading-none text-slate-700">
              {getModeLabel(driveMode)}:{" "}
              {getBaseConsumption(driveMode).toFixed(1)} km/l
            </p>
            <p className="mt-1 truncate text-[10px] font-medium leading-none text-slate-500">
              Cidade/Estrada/Misto: {cityKmPerLiter.toFixed(1)}/
              {highwayKmPerLiter.toFixed(1)}/{mixedKmPerLiter.toFixed(1)}
            </p>
            {consumptionFactors &&
              (speedFactorPct > 0 || aggressionFactorPct > 0) && (
                <p className="mt-1 truncate text-[10px] font-medium leading-none text-orange-600">
                  {speedFactorPct > 0 && `Velocidade: +${speedFactorPct}%`}
                  {speedFactorPct > 0 && aggressionFactorPct > 0 && " | "}
                  {aggressionFactorPct > 0 &&
                    `Aceleração: +${aggressionFactorPct}%`}
                </p>
              )}
            {consumptionFactors && consumptionFactors.isAggressive && (
              <p className="mt-1 text-[10px] font-semibold leading-none text-red-600">
                Condução agressiva
              </p>
            )}
            {useWorstCaseCity && (
              <p className="mt-1 text-[10px] font-semibold leading-none text-amber-700">
                Baseado em cidade (pior caso)
              </p>
            )}
          </div>
        </div>

        <div className="mx-2 h-12 w-px bg-slate-500/20" />

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="shrink-0 font-semibold leading-none tracking-[-0.02em] text-slate-900 [font-size:clamp(1.25rem,4.3vw,1.95rem)]">
            R$
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium leading-none text-slate-700">
              Custo:
            </p>
            <p className="mt-1 truncate font-semibold leading-none tracking-[-0.02em] text-slate-950 [font-size:clamp(1.25rem,4.3vw,1.95rem)]">
              {formattedCost}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
