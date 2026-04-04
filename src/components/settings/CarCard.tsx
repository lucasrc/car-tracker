import { type Vehicle } from "@/types";
import { TrashIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";

interface CarCardProps {
  vehicle: Vehicle;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (vehicle: Vehicle) => void;
}

const fuelTypeLabels: Record<string, string> = {
  gasoline: "Gasolina",
  diesel: "Diesel",
  ethanol: "Etanol",
  flex: "Flex",
};

const confidenceColors: Record<string, string> = {
  high: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-red-100 text-red-700",
};

const confidenceLabels: Record<string, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export function CarCard({
  vehicle,
  isActive,
  onSelect,
  onDelete,
  onEdit,
}: CarCardProps) {
  const tankPercent = vehicle.fuelCapacity
    ? (vehicle.currentFuel / vehicle.fuelCapacity) * 100
    : 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(vehicle.id)}
      className={`w-full rounded-2xl border-2 p-4 text-left transition-all ${
        isActive
          ? "border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/10"
          : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-gray-900">
              {vehicle.name}
            </h3>
            {isActive && <CheckCircleIcon className="h-5 w-5 text-blue-600" />}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {vehicle.make} {vehicle.model} {vehicle.year}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(vehicle);
            }}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            title="Editar"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(vehicle.id);
            }}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
            title="Excluir"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white/60 p-2">
          <p className="text-xs text-gray-500">Cidade</p>
          <p className="text-sm font-semibold text-gray-900">
            {vehicle.urbanKmpl.toFixed(1)} km/l
          </p>
        </div>
        <div className="rounded-xl bg-white/60 p-2">
          <p className="text-xs text-gray-500">Misto</p>
          <p className="text-sm font-semibold text-gray-900">
            {vehicle.combinedKmpl.toFixed(1)} km/l
          </p>
        </div>
        <div className="rounded-xl bg-white/60 p-2">
          <p className="text-xs text-gray-500">Estrada</p>
          <p className="text-sm font-semibold text-gray-900">
            {vehicle.highwayKmpl.toFixed(1)} km/l
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              confidenceColors[vehicle.confidence] ||
              "bg-gray-100 text-gray-700"
            }`}
          >
            {confidenceLabels[vehicle.confidence] || vehicle.confidence}
          </span>
          <span className="text-xs text-gray-500">
            {fuelTypeLabels[vehicle.fuelType] || vehicle.fuelType}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full transition-all ${
                tankPercent < 20
                  ? "bg-red-500"
                  : tankPercent < 50
                    ? "bg-yellow-500"
                    : "bg-green-500"
              }`}
              style={{ width: `${tankPercent}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">
            {vehicle.currentFuel.toFixed(1)}L
          </span>
        </div>
      </div>
    </button>
  );
}
