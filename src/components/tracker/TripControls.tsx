import { useEffect, useState } from "react";
import type { BatteryState, TripStatus } from "@/types";

interface TripControlsProps {
  status: TripStatus;
  battery: BatteryState | null;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onCancel?: () => void;
  isGpsWarming?: boolean;
  gpsAccuracy?: number;
}

export function TripControls({
  status,
  battery,
  onStart,
  onPause,
  onResume,
  onStop,
  onCancel,
  isGpsWarming = false,
  gpsAccuracy,
}: TripControlsProps) {
  const showLowBattery =
    battery !== null && !battery.charging && battery.level < 0.2;

  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (!isGpsWarming) {
      setCountdown(10);
      return;
    }
    setCountdown(10);
    const timer = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isGpsWarming]);

  const targetAccuracy = 15;
  const accuracyMet = gpsAccuracy !== undefined && gpsAccuracy < targetAccuracy;

  return (
    <div className="flex flex-col items-center gap-2 -mt-2">
      {showLowBattery && (
        <div className="rounded-full bg-amber-500/90 px-3 py-1 text-xs font-medium text-white shadow-lg">
          Bateria baixa ({Math.round(battery.level * 100)}%)
        </div>
      )}

      {isGpsWarming && (
        <div className="flex w-full items-center justify-between gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-white">
          <span className="flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-pulse"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            {gpsAccuracy !== undefined
              ? accuracyMet
                ? "GPS estável!"
                : `Precisão: ${Math.round(gpsAccuracy)}m`
              : "Buscando..."}{" "}
            ({countdown}s)
          </span>
          <button
            onClick={onCancel}
            className="rounded bg-red-600 px-2 py-1 font-medium hover:bg-red-500"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        {status === "idle" && (
          <button
            onClick={onStart}
            disabled={isGpsWarming}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-green-200/70 bg-gradient-to-b from-emerald-300/95 to-emerald-500/95 text-white shadow-[0_12px_34px_rgba(34,197,94,0.55)] backdrop-blur-sm transition-all hover:scale-[1.02] hover:brightness-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="h-6 w-6 shrink-0"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        )}

        {status === "recording" && (
          <>
            <button
              onClick={onPause}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-500 text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            </button>
            <button
              onClick={onStop}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              <div className="flex flex-col items-center">
                <svg
                  className="h-7 w-7"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 6h12v12H6z" />
                </svg>
                <span className="text-[9px] font-medium">PARAR</span>
              </div>
            </button>
          </>
        )}

        {status === "paused" && (
          <>
            <button
              onClick={onResume}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-green-500 text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
            <button
              onClick={onStop}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              <div className="flex flex-col items-center">
                <svg
                  className="h-7 w-7"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 6h12v12H6z" />
                </svg>
                <span className="text-[9px] font-medium">SALVAR</span>
              </div>
            </button>
          </>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 text-xs font-medium">
        {status === "paused" && (
          <span className="rounded-full bg-amber-500/80 px-3 py-0.5 text-white">
            Rastreamento pausado
          </span>
        )}
      </div>
    </div>
  );
}
