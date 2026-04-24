import { useEffect, useState, useCallback } from "react";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { useFuelInventoryStore } from "@/stores/useFuelInventoryStore";
import { getRefuelsByVehicle, deleteRefuel } from "@/lib/db";
import { VehicleSelector } from "@/components/ui/VehicleSelector";
import { RefuelModal } from "@/components/ui/RefuelModal";
import { RefuelCard } from "@/components/history/RefuelCard";
import type { Refuel, FuelType } from "@/types";

export function RefuelPage() {
  const { vehicles, activeVehicle, setActiveVehicle, updateVehicleFuelLevel } =
    useVehicleStore();

  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [refuels, setRefuels] = useState<Refuel[]>([]);
  const [showModal, setShowModal] = useState(false);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const currentVehicleFuel =
    activeVehicle?.id === selectedVehicleId
      ? (activeVehicle?.currentFuel ?? 0)
      : (selectedVehicle?.currentFuel ?? 0);

  const loadRefuels = useCallback(async (vehicleId: string) => {
    try {
      console.log(`[REFUEL] loadRefuels called with vehicleId: ${vehicleId}`);
      const data = await getRefuelsByVehicle(vehicleId);
      console.log(`[REFUEL] loadRefuels got ${data.length} refuels`);
      setRefuels(data);
    } catch (err) {
      console.error("Error loading refuels:", err);
    }
  }, []);

  useEffect(() => {
    if (selectedVehicleId) {
      loadRefuels(selectedVehicleId);
    } else {
      setRefuels([]);
    }
  }, [selectedVehicleId, loadRefuels]);

  useEffect(() => {
    if (activeVehicle?.id && !selectedVehicleId) {
      setSelectedVehicleId(activeVehicle.id);
    } else if (vehicles.length > 0 && !selectedVehicleId) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [vehicles, selectedVehicleId, activeVehicle]);

  const handleSelectVehicle = async (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    if (vehicleId) {
      await setActiveVehicle(vehicleId);
    }
  };

  const { loadBatches, addBatch, getTotalLiters } = useFuelInventoryStore();

  useEffect(() => {
    if (selectedVehicleId) {
      loadBatches(selectedVehicleId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicleId]);

  const handleRefuel = async (
    liters: number,
    pricePerLiter: number,
    fuelType: FuelType,
  ) => {
    if (!selectedVehicle) return;

    setShowModal(false);

    try {
      console.log(
        `[REFUEL] handleRefuel: adding ${liters}L at R$${pricePerLiter}/L for vehicle ${selectedVehicle.id}`,
      );
      await addBatch(liters, pricePerLiter, fuelType, selectedVehicle.id);
      const totalRemaining = getTotalLiters();
      const newFuel = Math.min(totalRemaining, selectedVehicle.fuelCapacity);
      await updateVehicleFuelLevel(selectedVehicle.id, newFuel);
      console.log(
        `[REFUEL] handleRefuel: calling loadRefuels for ${selectedVehicle.id}`,
      );
      await loadRefuels(selectedVehicle.id);
      console.log(
        `[FUEL] Refuel sync: added ${liters}L, total remaining=${totalRemaining.toFixed(2)}L, vehicle.currentFuel=${newFuel.toFixed(2)}L`,
      );
    } catch (err) {
      console.error("Error refueling:", err);
      alert("Erro ao registrar abastecimento. Tente novamente.");
    }
  };

  const handleDeleteRefuel = async (refuelId: string) => {
    if (window.confirm("Tem certeza que deseja excluir este abastecimento?")) {
      await deleteRefuel(refuelId);
      if (selectedVehicleId) {
        await loadRefuels(selectedVehicleId);
      }
    }
  };

  const getVehicleName = (vehicleId: string): string | undefined => {
    return vehicles.find((v) => v.id === vehicleId)?.name;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white">
        <h1 className="text-2xl font-bold">Abastecimento</h1>
        <p className="text-sm text-white/80">
          Registre e acompanhe seus abastecimento por veículo
        </p>
      </div>

      <div className="p-4 space-y-4">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <VehicleSelector
            selectedVehicleId={selectedVehicleId}
            onSelect={handleSelectVehicle}
          />
        </div>

        {selectedVehicle && (
          <>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {selectedVehicle.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Capacidade: {selectedVehicle.fuelCapacity}L
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Abastecer
                </button>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Tanque atual</span>
                  <span className="font-semibold text-gray-900">
                    {currentVehicleFuel.toFixed(1)} /{" "}
                    {selectedVehicle.fuelCapacity}L (
                    {(
                      (currentVehicleFuel / selectedVehicle.fuelCapacity) *
                      100
                    ).toFixed(0)}
                    %)
                  </span>
                </div>
                <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full bg-gradient-to-r from-green-400 to-green-500"
                    style={{
                      width: `${Math.min(
                        (selectedVehicle.currentFuel /
                          selectedVehicle.fuelCapacity) *
                          100,
                        100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-lg font-semibold text-gray-900">
                Histórico de Abastecimentos
              </h3>
              {refuels.length === 0 ? (
                <div className="rounded-xl bg-white p-8 text-center shadow-sm">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                    />
                  </svg>
                  <p className="mt-2 text-gray-500">
                    Nenhum abastecimento registrado
                  </p>
                  <p className="text-sm text-gray-400">
                    Abasteça o veículo para registrar aqui
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {refuels.map((refuel) => (
                    <RefuelCard
                      key={refuel.id}
                      refuel={refuel}
                      vehicleName={getVehicleName(refuel.vehicleId)}
                      onDelete={() => handleDeleteRefuel(refuel.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <RefuelModal
        open={showModal}
        defaultFuelType={
          selectedVehicle?.fuelType === "flex"
            ? "gasolina"
            : (selectedVehicle?.fuelType as FuelType) || "gasolina"
        }
        currentFuel={currentVehicleFuel}
        fuelCapacity={selectedVehicle?.fuelCapacity || 50}
        onConfirm={handleRefuel}
        onCancel={() => setShowModal(false)}
      />
    </div>
  );
}
