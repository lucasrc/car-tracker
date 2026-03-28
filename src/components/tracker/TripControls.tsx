import type { TripStatus, BatteryState } from "@/types";

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

      <div className="flex items-center justify-center gap-6">
        {status === "idle" && (
          <button
            onClick={onStart}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500 text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
          >
            <div className="flex flex-col items-center">
              <svg
                className="h-10 w-10"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              <span className="text-xs font-medium">INICIAR</span>
            </div>
          </button>
        )}

        {status === "recording" && (
          <>
            <button
              onClick={onPause}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            </button>
            <button
              onClick={onStop}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              <div className="flex flex-col items-center">
                <svg
                  className="h-10 w-10"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 6h12v12H6z" />
                </svg>
                <span className="text-xs font-medium">PARAR</span>
              </div>
            </button>
          </>
        )}

        {status === "paused" && (
          <>
            <button
              onClick={onResume}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
            <button
              onClick={onStop}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              <div className="flex flex-col items-center">
                <svg
                  className="h-10 w-10"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 6h12v12H6z" />
                </svg>
                <span className="text-xs font-medium">SALVAR</span>
              </div>
            </button>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs font-medium text-white/70">
        {status === "idle" && (
          <span className="rounded-full bg-black/30 px-3 py-1">
            Toque para iniciar o rastreamento
          </span>
        )}
        {status === "recording" && (
          <span className="flex items-center gap-2 rounded-full bg-green-500/80 px-3 py-1 text-white">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white"></span>
            </span>
            Gravando trajectory
          </span>
        )}
        {status === "paused" && (
          <span className="rounded-full bg-amber-500/80 px-3 py-1 text-white">
            Rastreamento pausado
          </span>
        )}
      </div>
    </div>
  );
}
