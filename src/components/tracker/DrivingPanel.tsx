import { formatDistance } from "@/lib/utils";

interface DrivingPanelProps {
  currentSpeed: number;
  distance: number;
  elapsedTime: number;
  fuelUsed: number;
  cost: number;
  currentFuelLiters: number;
  range: number;
  currentConsumption?: number;
  avgConsumption?: number;
  radarMaxSpeed?: number;
  isSpeeding?: boolean;
  gradePercent?: number;
  inclinationConfidence?: number;
  batterySocPct?: number;
  isHybrid?: boolean;
  isGnv?: boolean;
}

function formatTimeHms(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h.toString().padStart(2, "0"), m.toString().padStart(2, "0"), s.toString().padStart(2, "0")].join(":");
}

function formatInclination(gradePercent: number, confidence: number): { arrow: string; color: string; showValue: boolean } {
  if (confidence < 0.1) {
    return { arrow: "—", color: "text-slate-400", showValue: false };
  }
  if (Math.abs(gradePercent) < 0.3) {
    return { arrow: "→", color: "text-slate-500", showValue: true };
  }
  if (gradePercent > 0.5) {
    return { arrow: "↗", color: "text-green-600", showValue: true };
  }
  if (gradePercent < -0.5) {
    return { arrow: "↘", color: "text-red-600", showValue: true };
  }
  return { arrow: "→", color: "text-slate-500", showValue: true };
}

export function DrivingPanel({
  currentSpeed,
  distance,
  elapsedTime,
  fuelUsed,
  cost,
  currentFuelLiters,
  range,
  currentConsumption,
  avgConsumption,
  radarMaxSpeed,
  isSpeeding = false,
  gradePercent = 0,
  inclinationConfidence = 0,
  batterySocPct,
  isHybrid = false,
  isGnv = false,
}: DrivingPanelProps) {
  const { arrow, color, showValue } = formatInclination(gradePercent, inclinationConfidence);

  return (
    <div className="mx-1 rounded-2xl border border-white/50 bg-[#d8e8ec]/80 px-1 py-2 shadow-[0_10px_26px_rgba(15,23,42,0.1)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-1">
        <div className="flex flex-1 flex-col items-center">
          <span className="text-xs font-medium uppercase text-slate-600">Tempo</span>
          <span className="text-2xl font-bold font-mono tabular-nums text-slate-800">{formatTimeHms(elapsedTime)}</span>
        </div>

        <div className="h-10 w-px bg-slate-400/20" />

        <div className="flex flex-1 flex-col items-center">
          <span className="text-xs font-medium uppercase text-slate-600">Distância</span>
          <span className="text-2xl font-bold tabular-nums text-slate-800">{formatDistance(distance)}</span>
        </div>

        <div className="h-10 w-px bg-slate-400/20" />

        <div className="flex flex-1 flex-col items-center">
          <span className="text-xs font-medium uppercase text-slate-600">Autonomia</span>
          <span className="text-xl font-bold tabular-nums text-slate-800">{Math.round(range)} km</span>
          <span className="text-xs text-slate-500">{currentFuelLiters.toFixed(1)} L</span>
        </div>
      </div>

      <div className="mt-2 h-px w-full bg-slate-400/15" />

      <div className="mt-2 flex items-center justify-between gap-1">
        <div className="flex flex-1 flex-col items-center">
          <span className="text-xs font-medium uppercase text-slate-500">Inclinação</span>
          <span className={`text-lg font-bold tabular-nums ${color}`}>
            {arrow} {showValue ? Math.abs(gradePercent).toFixed(1) + "%" : "—"}
          </span>
          {showValue && <span className="text-xs text-slate-500">{gradePercent >= 0 ? "+" : ""}{gradePercent.toFixed(1)}%</span>}
        </div>

        <div className="h-8 w-px bg-slate-400/15" />

        <div className="flex flex-1 flex-col items-center">
          <span className="text-xs font-medium uppercase text-slate-500">Consumo instantâneo</span>
          <span className="text-lg font-bold tabular-nums text-green-700">
            {currentConsumption !== undefined && currentConsumption > 0 ? currentConsumption.toFixed(1) : "--"}
          </span>
          <span className="text-[0.65rem] text-slate-500">
            Méd: {avgConsumption !== undefined && avgConsumption > 0 ? avgConsumption.toFixed(1) : "--"} km/l
          </span>
        </div>

        <div className="h-8 w-px bg-slate-400/15" />

        <div className="flex flex-1 flex-col items-center rounded-lg bg-slate-800/10 px-1 py-0.5">
          <span className="text-xs font-bold uppercase text-slate-600">Gasto</span>
          <span className="text-xl font-extrabold tabular-nums text-slate-900">R$ {cost.toFixed(2)}</span>
          <span className="text-xs font-medium text-slate-500">{fuelUsed.toFixed(1)} L</span>
        </div>
      </div>

      {isSpeeding && radarMaxSpeed && (
        <div className="mt-2 flex items-center justify-center rounded-lg border-2 border-red-500 bg-red-50/90 px-2 py-1">
          <span className="text-base font-bold text-red-600">Excesso: +{Math.round(currentSpeed - radarMaxSpeed)} km/h</span>
        </div>
      )}

      {isHybrid && batterySocPct !== undefined && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs font-medium uppercase text-slate-500">Bateria</span>
          <div className="flex-1 h-2 bg-slate-300/30 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                batterySocPct > 50 ? "bg-green-500" : batterySocPct > 20 ? "bg-yellow-500" : "bg-red-500"
              }`}
              style={{ width: `${batterySocPct}%` }}
            />
          </div>
          <span className="text-xs font-bold tabular-nums text-slate-700">{batterySocPct}%</span>
        </div>
      )}

      {isGnv && (
        <div className="mt-1 flex justify-center">
          <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[0.6rem] font-bold text-white">GNV · km/m³</span>
        </div>
      )}
    </div>
  );
}