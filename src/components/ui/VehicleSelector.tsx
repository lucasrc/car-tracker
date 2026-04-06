import { useVehicleStore } from "@/stores/useVehicleStore";

interface VehicleSelectorProps {
  selectedVehicleId: string;
  onSelect: (vehicleId: string) => void;
}

export function VehicleSelector({
  selectedVehicleId,
  onSelect,
}: VehicleSelectorProps) {
  const vehicles = useVehicleStore((s) => s.vehicles);

  if (vehicles.length === 0) {
    return (
      <div className="rounded-xl bg-yellow-50 p-4 text-yellow-800">
        <p className="font-medium">Nenhum veículo cadastrado</p>
        <p className="text-sm">
          Cadastre um veículo nas Configurações para fazer abastecimentos.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">
        Selecione o Veículo
      </label>
      <select
        value={selectedVehicleId}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-lg font-medium text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
      >
        <option value="">Selecione um veículo...</option>
        {vehicles.map((vehicle) => (
          <option key={vehicle.id} value={vehicle.id}>
            {vehicle.name}
          </option>
        ))}
      </select>
    </div>
  );
}
