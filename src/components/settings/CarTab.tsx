"use client";

import { useEffect, useState } from "react";
import type { Vehicle } from "@/types";
import { useAppStore } from "@/stores/useAppStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { TruckIcon, PlusIcon } from "@heroicons/react/24/outline";
import { CarCard } from "./CarCard";
import { AddCarModal } from "./AddCarModal";
import { EditCarModal } from "./EditCarModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function CarTab() {
  const debugModeEnabled = useAppStore((s) => s.debugModeEnabled);
  const {
    vehicles,
    activeVehicle,
    setActiveVehicle,
    deleteVehicle,
    loadVehicles,
  } = useVehicleStore();

  const [showAddCarModal, setShowAddCarModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicleId, setDeletingVehicleId] = useState<string | null>(null);
  const [selectedDebugVehicleId, setSelectedDebugVehicleId] = useState<string | null>(null);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const handleSelectCar = async (id: string) => {
    await setActiveVehicle(id);
    if (debugModeEnabled) {
      setSelectedDebugVehicleId(id);
    }
  };

  const handleDeleteCar = async () => {
    if (!deletingVehicleId) return;
    await deleteVehicle(deletingVehicleId);
    setDeletingVehicleId(null);
  };

  const deletingVehicle = vehicles.find((v) => v.id === deletingVehicleId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Meus Carros</h3>
          <p className="text-sm text-gray-500">
            {vehicles.length}{" "}
            {vehicles.length === 1
              ? "veículo cadastrado"
              : "veículos cadastrados"}
          </p>
        </div>
        <button
          onClick={() => setShowAddCarModal(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02]"
        >
          <PlusIcon className="h-4 w-4" />
          Adicionar
        </button>
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center shadow-lg">
          <TruckIcon className="mx-auto h-12 w-12 text-gray-300" />
          <h4 className="mt-4 text-base font-semibold text-gray-900">
            Nenhum carro cadastrado
          </h4>
          <p className="mt-2 text-sm text-gray-500">
            Adicione seu primeiro carro para começar a rastrear viagens com
            precisão.
          </p>
          <button
            onClick={() => setShowAddCarModal(true)}
            className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02] mx-auto"
          >
            <PlusIcon className="h-4 w-4" />
            Adicionar Carro
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((vehicle) => (
            <CarCard
              key={vehicle.id}
              vehicle={vehicle}
              isActive={activeVehicle?.id === vehicle.id}
              onSelect={handleSelectCar}
              onDelete={(id) => setDeletingVehicleId(id)}
              onEdit={(v) => setEditingVehicle(v)}
            />
          ))}
        </div>
      )}
      {debugModeEnabled &&
        selectedDebugVehicleId &&
        (() => {
          const vehicle = vehicles.find((v) => v.id === selectedDebugVehicleId);
          if (!vehicle) return null;
          return (
            <div className="mt-4 rounded-xl bg-slate-900 p-4 text-xs font-mono text-green-400 overflow-auto max-h-96">
              <div className="flex items-center justify-between mb-2 border-b border-slate-700 pb-2">
                <span className="text-yellow-400">
                  🔧 Debug: Dados de Calibração do Veículo
                </span>
                <button
                  onClick={() => setSelectedDebugVehicleId(null)}
                  className="text-slate-500 hover:text-slate-300"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-slate-400">Prompt:</span>{" "}
                  {vehicle.calibrationInput || "—"}
                </div>
                <div>
                  <span className="text-slate-400">Fonte:</span>{" "}
                  {vehicle.dataSource || "manual"}
                </div>
                <div>
                  <span className="text-slate-400">Confiança:</span>{" "}
                  {vehicle.confidence}
                </div>
                <div className="border-t border-slate-700 pt-2 mt-2">
                  <pre className="whitespace-pre-wrap break-all">
                    {JSON.stringify(
                      {
                        make: vehicle.make,
                        model: vehicle.model,
                        year: vehicle.year,
                        displacement: vehicle.displacement,
                        fuelType: vehicle.fuelType,
                        euroNorm: vehicle.euroNorm,
                        segment: vehicle.segment,
                        urbanKmpl: vehicle.urbanKmpl,
                        highwayKmpl: vehicle.highwayKmpl,
                        combinedKmpl: vehicle.combinedKmpl,
                        mass: vehicle.mass,
                        grossWeight: vehicle.grossWeight,
                        frontalArea: vehicle.frontalArea,
                        dragCoefficient: vehicle.dragCoefficient,
                        f0: vehicle.f0,
                        f1: vehicle.f1,
                        f2: vehicle.f2,
                        fuelConversionFactor: vehicle.fuelConversionFactor,
                        peakPowerKw: vehicle.peakPowerKw,
                        peakTorqueNm: vehicle.peakTorqueNm,
                        co2_gkm: vehicle.co2_gkm,
                        nox_mgkm: vehicle.nox_mgkm,
                        confidence: vehicle.confidence,
                        inmetroCityKmpl: vehicle.inmetroCityKmpl,
                        inmetroHighwayKmpl: vehicle.inmetroHighwayKmpl,
                        userAvgCityKmpl: vehicle.userAvgCityKmpl,
                        userAvgHighwayKmpl: vehicle.userAvgHighwayKmpl,
                        inmetroEthanolCityKmpl: vehicle.inmetroEthanolCityKmpl,
                        inmetroEthanolHighwayKmpl:
                          vehicle.inmetroEthanolHighwayKmpl,
                        userAvgEthanolCityKmpl: vehicle.userAvgEthanolCityKmpl,
                        userAvgEthanolHighwayKmpl:
                          vehicle.userAvgEthanolHighwayKmpl,
                        inmetroGnvCityKmpl: vehicle.inmetroGnvCityKmpl,
                        inmetroGnvHighwayKmpl: vehicle.inmetroGnvHighwayKmpl,
                        userAvgGnvCityKmpl: vehicle.userAvgGnvCityKmpl,
                        userAvgGnvHighwayKmpl: vehicle.userAvgGnvHighwayKmpl,
                        crr: vehicle.crr,
                        idleLph: vehicle.idleLph,
                        baseBsfc: vehicle.baseBsfc,
                        weightInmetro: vehicle.weightInmetro,
                        weightUser: vehicle.weightUser,
                        isHybrid: vehicle.isHybrid,
                        gnvCylinderWeightKg: vehicle.gnvCylinderWeightKg,
                        gnvEfficiencyFactor: vehicle.gnvEfficiencyFactor,
                        fuelCapacity: vehicle.fuelCapacity,
                        transmission: vehicle.transmission,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              </div>
            </div>
          );
        })()}

      <AddCarModal
        open={showAddCarModal}
        onClose={() => setShowAddCarModal(false)}
      />

      <EditCarModal
        vehicle={editingVehicle}
        onClose={() => setEditingVehicle(null)}
      />

      <ConfirmDialog
        open={!!deletingVehicle}
        title="Excluir Carro"
        message={
          deletingVehicle ? (
            <>
              Tem certeza que deseja excluir{" "}
              <strong>{deletingVehicle.name}</strong>? As viagens associadas
              serão mantidas no histórico sem referência ao veículo.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDeleteCar}
        onCancel={() => setDeletingVehicleId(null)}
      />
    </div>
  );
}