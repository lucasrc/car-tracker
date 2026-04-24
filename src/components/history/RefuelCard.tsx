import { formatDate } from "@/lib/utils";
import type { Refuel } from "@/types";

interface RefuelCardProps {
  refuel: Refuel;
  vehicleName?: string;
  onDelete: () => void;
}

const fuelTypeLabels: Record<Refuel["fuelType"], string> = {
  gasolina: "Gasolina",
  etanol: "Etanol",
  flex: "Flex",
  gnv: "GNV",
  diesel: "Diesel",
};

const fuelTypeColors: Record<Refuel["fuelType"], string> = {
  gasolina: "bg-blue-100 text-blue-700",
  etanol: "bg-green-100 text-green-700",
  flex: "bg-purple-100 text-purple-700",
  gnv: "bg-orange-100 text-orange-700",
  diesel: "bg-gray-100 text-gray-700",
};

export function RefuelCard({ refuel, vehicleName, onDelete }: RefuelCardProps) {
  // Calcular valores de consumo (FIFO)
  const consumedAmount = refuel.consumedAmount || 0;
  const remainingAmount = Math.max(0, refuel.amount - consumedAmount);
  const consumedPercent = Math.min(100, (consumedAmount / refuel.amount) * 100);
  const remainingPercent = Math.max(0, 100 - consumedPercent);
  const isExhausted = consumedAmount >= refuel.amount;
  const isPartiallyConsumed = consumedAmount > 0 && !isExhausted;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-md transition-all hover:shadow-xl">
      {/* Header: Veículo, Data e Tipo de Combustível */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
            />
          </svg>
          <span className="text-sm text-gray-500">
            {formatDate(refuel.timestamp)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {vehicleName ? (
            <span className="text-xs text-gray-400">{vehicleName}</span>
          ) : refuel.vehicleId === "" ? (
            <span className="text-xs text-gray-400 italic">
              Veículo excluído
            </span>
          ) : null}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${fuelTypeColors[refuel.fuelType]}`}
          >
            {fuelTypeLabels[refuel.fuelType]}
          </span>
        </div>
      </div>

      {/* Valores do Abastecimento */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg bg-gray-50 p-3">
          <span className="text-xs font-medium text-gray-400 block">Total</span>
          <span className="text-lg font-bold text-gray-900">
            {refuel.amount.toFixed(1)} L
          </span>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <span className="text-xs font-medium text-gray-400 block">
            Preço/L
          </span>
          <span className="text-lg font-bold text-gray-900">
            R$ {refuel.fuelPrice.toFixed(2)}
          </span>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <span className="text-xs font-medium text-gray-400 block">
            Custo Total
          </span>
          <span className="text-lg font-bold text-green-600">
            R$ {refuel.totalCost.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Barra de Progresso */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-500">
            Status do Combustível
          </span>
          <span
            className={`text-xs font-bold ${
              isExhausted
                ? "text-red-600"
                : isPartiallyConsumed
                  ? "text-yellow-600"
                  : "text-green-600"
            }`}
          >
            {isExhausted
              ? "🔴 Esgotado"
              : isPartiallyConsumed
                ? `⚠️ ${consumedPercent.toFixed(0)}% consumido`
                : "✅ Disponível"}
          </span>
        </div>

        {/* Barra de Progresso */}
        <div className="h-4 w-full overflow-hidden rounded-full bg-gray-200 shadow-inner">
          <div
            className={`h-full transition-all duration-500 ${
              isExhausted
                ? "bg-gray-400"
                : isPartiallyConsumed
                  ? "bg-gradient-to-r from-yellow-400 to-orange-500"
                  : "bg-gradient-to-r from-green-400 to-green-500"
            }`}
            style={{ width: `${remainingPercent}%` }}
          />
        </div>

        {/* Legendas */}
        <div className="mt-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="text-gray-500">
              Consumido:{" "}
              <span className="font-semibold text-gray-700">
                {consumedAmount.toFixed(1)}L
              </span>
            </span>
            <span className="text-gray-500">
              Restante:{" "}
              <span
                className={`font-semibold ${isExhausted ? "text-gray-400" : "text-green-600"}`}
              >
                {remainingAmount.toFixed(1)}L
              </span>
            </span>
          </div>
          {!isExhausted && (
            <span className="text-gray-400">
              {remainingPercent.toFixed(0)}% disponível
            </span>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center justify-end border-t border-gray-100 pt-3">
        <button
          onClick={onDelete}
          className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-100"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          Excluir
        </button>
      </div>
    </div>
  );
}
