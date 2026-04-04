import { type CopertCalibration } from "@/types";
import {
  XMarkIcon,
  CheckCircleIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/24/solid";

interface ImportDetailsModalProps {
  data: CopertCalibration;
  vehicleInput: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const fuelTypeLabels: Record<string, string> = {
  gasoline: "Gasolina",
  diesel: "Diesel",
  ethanol: "Etanol",
  flex: "Flex",
};

const confidenceLabels: Record<string, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const dataSourceLabels: Record<string, string> = {
  web: "Busca na Web",
  ai_inferred: "Inferência IA",
};

export function ImportDetailsModal({
  data,
  vehicleInput,
  onConfirm,
  onCancel,
}: ImportDetailsModalProps) {
  const isFlex = data.fuelType === "flex" || data.fuelType === "ethanol";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <CheckIcon className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Dados Importados
              </h2>
              <p className="text-xs text-gray-500">{vehicleInput}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-gray-50 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <SparklesIcon className="h-4 w-4 text-blue-500" />
              {data.make} {data.model} {data.year}
            </h3>

            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Consumo (Gasolina)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white p-2.5">
                    <p className="text-xs text-gray-400">Cidade</p>
                    <p className="text-base font-bold text-gray-900">
                      {data.userAvgCityKmpl.toFixed(1)}{" "}
                      <span className="text-xs font-normal text-gray-400">
                        km/l
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      INMETRO: {data.inmetroCityKmpl.toFixed(1)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-2.5">
                    <p className="text-xs text-gray-400">Estrada</p>
                    <p className="text-base font-bold text-gray-900">
                      {data.userAvgHighwayKmpl.toFixed(1)}{" "}
                      <span className="text-xs font-normal text-gray-400">
                        km/l
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      INMETRO: {data.inmetroHighwayKmpl.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>

              {isFlex && data.inmetroEthanolCityKmpl && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Consumo (Etanol)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-white p-2.5">
                      <p className="text-xs text-gray-400">Cidade</p>
                      <p className="text-base font-bold text-gray-900">
                        {(
                          data.userAvgEthanolCityKmpl ??
                          data.inmetroEthanolCityKmpl * 0.7
                        ).toFixed(1)}{" "}
                        <span className="text-xs font-normal text-gray-400">
                          km/l
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        INMETRO: {data.inmetroEthanolCityKmpl.toFixed(1)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-2.5">
                      <p className="text-xs text-gray-400">Estrada</p>
                      <p className="text-base font-bold text-gray-900">
                        {(
                          data.userAvgEthanolHighwayKmpl ??
                          data.inmetroEthanolHighwayKmpl! * 0.7
                        ).toFixed(1)}{" "}
                        <span className="text-xs font-normal text-gray-400">
                          km/l
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        INMETRO: {data.inmetroEthanolHighwayKmpl!.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-gray-50 p-3 text-center">
              <p className="text-xs text-gray-400">Motor</p>
              <p className="text-sm font-bold text-gray-900">
                {(data.displacement / 1000).toFixed(1)}L
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 text-center">
              <p className="text-xs text-gray-400">Potência</p>
              <p className="text-sm font-bold text-gray-900">
                {data.peakPowerKw} kW
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 text-center">
              <p className="text-xs text-gray-400">Massa</p>
              <p className="text-sm font-bold text-gray-900">{data.mass} kg</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Combustível:</span>
              <span className="text-sm font-medium text-gray-900">
                {fuelTypeLabels[data.fuelType]}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                Fonte: {dataSourceLabels[data.dataSource ?? "ai_inferred"]}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  data.confidence === "high"
                    ? "bg-green-100 text-green-700"
                    : data.confidence === "medium"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                }`}
              >
                {confidenceLabels[data.confidence]}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 rounded-xl border-2 border-gray-200 bg-white py-3.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02]"
            >
              <CheckCircleIcon className="h-5 w-5" />
              Adicionar Carro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
