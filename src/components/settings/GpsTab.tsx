"use client";

import { useAppStore } from "@/stores/useAppStore";

export function GpsTab() {
  const gpsMode = useAppStore((s) => s.gpsMode);
  const setGpsMode = useAppStore((s) => s.setGpsMode);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Modo GPS</h3>
            <p className="text-sm text-gray-500 mt-1">
              Escolha como obter a localização
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setGpsMode("hybrid")}
            className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
              gpsMode === "hybrid"
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-blue-300"
            }`}
          >
            <p className="font-semibold text-gray-900">
              GPS + Sensores (Híbrido)
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Combina GPS com sensores de movimento para melhor precisão
            </p>
          </button>

          <button
            onClick={() => setGpsMode("gps-only")}
            className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
              gpsMode === "gps-only"
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-blue-300"
            }`}
          >
            <p className="font-semibold text-gray-900">GPS Apenas</p>
            <p className="text-xs text-gray-500 mt-1">
              Usa apenas o GPS do dispositivo
            </p>
          </button>

          <button
            onClick={() => setGpsMode("sensor-only")}
            className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
              gpsMode === "sensor-only"
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-blue-300"
            }`}
          >
            <p className="font-semibold text-gray-900">Sensores Apenas</p>
            <p className="text-xs text-gray-500 mt-1">
              Usa apenas acelerômetro e giroscópio (modo offline)
            </p>
          </button>
        </div>

        {gpsMode === "sensor-only" && (
          <div className="mt-4 rounded-xl bg-yellow-50 p-4 border border-yellow-200">
            <p className="text-sm text-yellow-700">
              <strong>Modo sensor:</strong> A posição será estimada usando
              sensores de movimento. A precisão pode diminuir com o tempo
              devido ao acúmulo de erro.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}