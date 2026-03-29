import type { BatteryState, TripStatus } from "@/types";

interface TripControlsProps {
  status: TripStatus;
  battery: BatteryState | null;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function TripControls({
  status,
  battery,
  onStart,
  onPause,
  onResume,
  onStop,
}: TripControlsProps) {
  const showLowBattery =
    battery !== null && !battery.charging && battery.level < 0.2;

  return (
    <div className="flex flex-col items-center gap-3">
      {showLowBattery && (
        <div className="rounded-full bg-amber-500/90 px-4 py-1.5 text-xs font-medium text-white shadow-lg">
          Bateria baixa ({Math.round(battery.level * 100)}%)
        </div>
      )}

      <div className="flex w-full items-center justify-center gap-4">
        {status === "idle" && (
          <button
            onClick={onStart}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-green-200/70 bg-gradient-to-b from-emerald-300/95 to-emerald-500/95 px-7 py-3.5 text-white shadow-[0_12px_34px_rgba(34,197,94,0.55)] backdrop-blur-sm transition-all hover:scale-[1.02] hover:brightness-105 active:scale-95"
          >
            <svg className="h-6 w-6 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span className="font-bold tracking-[0.03em] [font-size:clamp(0.98rem,3.7vw,1.25rem)]">
              INICIAR
            </span>
          </button>
        )}

        {status === "recording" && (
          <>
            <button
              onClick={onPause}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            </button>
            <button
              onClick={onStop}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              <div className="flex flex-col items-center">
                <svg
                  className="h-8 w-8"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 6h12v12H6z" />
                </svg>
                <span className="text-[10px] font-medium">PARAR</span>
              </div>
            </button>
          </>
        )}

        {status === "paused" && (
          <>
            <button
              onClick={onResume}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500 text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
            <button
              onClick={onStop}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              <div className="flex flex-col items-center">
                <svg
                  className="h-8 w-8"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 6h12v12H6z" />
                </svg>
                <span className="text-[10px] font-medium">SALVAR</span>
              </div>
            </button>
          </>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 text-xs font-medium">
        {status === "paused" && (
          <span className="rounded-full bg-amber-500/80 px-3 py-1 text-white">
            Rastreamento pausado
          </span>
        )}
      </div>
    </div>
  );
}
