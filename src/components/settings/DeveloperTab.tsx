"use client";

import { useAppStore } from "@/stores/useAppStore";

export function DeveloperTab() {
  const debugModeEnabled = useAppStore((s) => s.debugModeEnabled);
  const setDebugModeEnabled = useAppStore((s) => s.setDebugModeEnabled);
  const debugModeShowRadars = useAppStore((s) => s.debugModeShowRadars);
  const setDebugModeShowRadars = useAppStore(
    (s) => s.setDebugModeShowRadars,
  );

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Modo Simulador
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Ative para testar o modelo de consumo com velocidade e inclinação
              simulados
            </p>
          </div>
          <button
            onClick={() => setDebugModeEnabled(!debugModeEnabled)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              debugModeEnabled ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                debugModeEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {debugModeEnabled && (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
              <p className="text-sm text-blue-700 font-medium">
                Modo simulador ativado
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Durante o rastreamento, controles de simulação aparecerão no canto
                direito da tela
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 border border-gray-200">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  Mostrar radares
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Exibir câmeras de velocidade no mapa durante simulação
                </p>
              </div>
              <button
                onClick={() => setDebugModeShowRadars(!debugModeShowRadars)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  debugModeShowRadars ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    debugModeShowRadars ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}