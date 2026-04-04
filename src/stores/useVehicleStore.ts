import { create } from "zustand";
import type { Vehicle, InclinationCalibration } from "@/types";
import {
  getVehicles,
  getVehicle,
  saveVehicle,
  deleteVehicle as dbDeleteVehicle,
  getSettings,
  saveSettings,
  migrateLegacyCalibration,
  getInclinationCalibration,
  saveInclinationCalibration,
  clearInclinationCalibration,
  updateVehicleFuel,
  unlinkVehicleRefuels,
  db,
} from "@/lib/db";
import { calibrateCopert } from "@/lib/copert-calibration-service";
import { generateId } from "@/lib/utils";

interface CalibrationState {
  isCalibrating: boolean;
  progress: string;
  error: string | null;
}

interface VehicleStore {
  vehicles: Vehicle[];
  activeVehicle: Vehicle | null;
  calibrationState: CalibrationState;
  inclinationCalibration: InclinationCalibration | null;
  isLoading: boolean;

  initialize: () => Promise<void>;
  loadVehicles: () => Promise<void>;
  setActiveVehicle: (vehicleId: string) => Promise<void>;
  createVehicle: (
    name: string,
    data: Parameters<typeof calibrateCopert>[0],
  ) => Promise<Vehicle | null>;
  updateVehicle: (vehicle: Vehicle) => Promise<void>;
  deleteVehicle: (vehicleId: string) => Promise<{ hasTrips: boolean }>;
  calibrateVehicle: (
    vehicleId: string,
    vehicleInput: string,
    onProgress?: (status: string) => void,
  ) => Promise<boolean>;
  setInclinationCalibration: (offsetDegrees: number) => Promise<void>;
  clearInclinationCalibration: () => Promise<void>;
  getVehicleCalibration: (vehicleId: string) => Vehicle | undefined;
  updateVehicleFuelLevel: (
    vehicleId: string,
    currentFuel: number,
  ) => Promise<void>;
}

export const useVehicleStore = create<VehicleStore>((set, get) => ({
  vehicles: [],
  activeVehicle: null,
  calibrationState: {
    isCalibrating: false,
    progress: "",
    error: null,
  },
  inclinationCalibration: null,
  isLoading: true,

  initialize: async () => {
    set({ isLoading: true });

    await migrateLegacyCalibration();

    const vehicles = await getVehicles();
    const settings = await getSettings();

    let activeVehicle: Vehicle | null = null;
    if (settings.activeVehicleId) {
      activeVehicle =
        vehicles.find((v) => v.id === settings.activeVehicleId) || null;
    }

    let inclinationCalibration: InclinationCalibration | null = null;
    if (activeVehicle) {
      const inc = await getInclinationCalibration(activeVehicle.id);
      inclinationCalibration = inc || null;
    }

    set({
      vehicles,
      activeVehicle,
      inclinationCalibration,
      isLoading: false,
    });
  },

  loadVehicles: async () => {
    const vehicles = await getVehicles();
    set({ vehicles });
  },

  setActiveVehicle: async (vehicleId: string) => {
    const vehicle = await getVehicle(vehicleId);
    if (!vehicle) return;

    const settings = await getSettings();
    await saveSettings({ ...settings, activeVehicleId: vehicleId });

    let inclinationCalibration: InclinationCalibration | null = null;
    const inc = await getInclinationCalibration(vehicleId);
    if (inc) {
      inclinationCalibration = inc;
    }

    set({
      activeVehicle: vehicle,
      inclinationCalibration,
    });
  },

  createVehicle: async (name, vehicleInput) => {
    set({
      calibrationState: {
        isCalibrating: true,
        progress: "",
        error: null,
      },
    });

    try {
      const result = await calibrateCopert(vehicleInput, (progress) => {
        set((state) => ({
          calibrationState: {
            ...state.calibrationState,
            progress,
          },
        }));
      });

      if (!result) {
        set({
          calibrationState: {
            isCalibrating: false,
            progress: "",
            error: "Falha na calibração",
          },
        });
        return null;
      }

      const now = new Date().toISOString();
      const vehicle: Vehicle = {
        id: generateId(),
        name,
        make: result.data.make,
        model: result.data.model,
        year: result.data.year,
        displacement: result.data.displacement,
        fuelType: result.data.fuelType,
        euroNorm: result.data.euroNorm,
        segment: result.data.segment,
        urbanKmpl: result.data.urbanKmpl,
        highwayKmpl: result.data.highwayKmpl,
        combinedKmpl: result.data.combinedKmpl,
        mass: result.data.mass,
        grossWeight: result.data.grossWeight,
        frontalArea: result.data.frontalArea,
        dragCoefficient: result.data.dragCoefficient,
        f0: result.data.f0,
        f1: result.data.f1,
        f2: result.data.f2,
        fuelConversionFactor: result.data.fuelConversionFactor,
        peakPowerKw: result.data.peakPowerKw,
        peakTorqueNm: result.data.peakTorqueNm,
        co2_gkm: result.data.co2_gkm,
        nox_mgkm: result.data.nox_mgkm,
        confidence: result.confidence,
        calibrationInput: vehicleInput,
        calibratedAt: now,
        createdAt: now,
        fuelCapacity: 50,
        currentFuel: 0,
        dataSource: result.dataSource,
      };

      await saveVehicle(vehicle);

      const vehicles = await getVehicles();
      const settings = await getSettings();

      if (!settings.activeVehicleId) {
        await saveSettings({ ...settings, activeVehicleId: vehicle.id });
      }

      const isNowActive =
        settings.activeVehicleId === vehicle.id || vehicles.length === 0;

      set({
        vehicles,
        activeVehicle: isNowActive ? vehicle : get().activeVehicle,
        calibrationState: {
          isCalibrating: false,
          progress: "",
          error: null,
        },
      });

      return vehicle;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      set({
        calibrationState: {
          isCalibrating: false,
          progress: "",
          error: errorMsg,
        },
      });
      return null;
    }
  },

  updateVehicle: async (vehicle: Vehicle) => {
    await saveVehicle(vehicle);

    const vehicles = await getVehicles();
    const activeVehicle = get().activeVehicle;

    set({
      vehicles,
      activeVehicle: activeVehicle?.id === vehicle.id ? vehicle : activeVehicle,
    });
  },

  deleteVehicle: async (vehicleId: string) => {
    const settings = await getSettings();
    const vehicles = get().vehicles;
    const vehicle = vehicles.find((v) => v.id === vehicleId);

    // Desvincular abastecimentos (mantém no histórico sem referência)
    await unlinkVehicleRefuels(vehicleId);

    // Desvincular viagens (atualiza vehicleSnapshot e limpa vehicleId)
    const trips = await db
      .table("trips")
      .filter((t: { vehicleId: string }) => t.vehicleId === vehicleId)
      .toArray();

    for (const trip of trips) {
      await db.table("trips").update(trip.id, {
        vehicleId: "",
        vehicleSnapshot: vehicle
          ? {
              make: vehicle.make,
              model: vehicle.model,
              year: vehicle.year,
            }
          : undefined,
      });
    }

    await dbDeleteVehicle(vehicleId);

    let newActiveVehicle: Vehicle | null = null;

    if (settings.activeVehicleId === vehicleId) {
      const remainingVehicles = vehicles.filter((v) => v.id !== vehicleId);
      const newActiveId = remainingVehicles[0]?.id;
      if (newActiveId) {
        await saveSettings({ ...settings, activeVehicleId: newActiveId });
        newActiveVehicle = remainingVehicles[0];
      } else {
        await saveSettings({ ...settings, activeVehicleId: undefined });
      }
    } else {
      newActiveVehicle = get().activeVehicle;
    }

    const updatedVehicles = await getVehicles();
    set({
      vehicles: updatedVehicles,
      activeVehicle: newActiveVehicle,
    });

    return { hasTrips: trips.length > 0 };
  },

  calibrateVehicle: async (vehicleId, vehicleInput, onProgress) => {
    set({
      calibrationState: {
        isCalibrating: true,
        progress: "",
        error: null,
      },
    });

    try {
      const result = await calibrateCopert(vehicleInput, (progress) => {
        set((state) => ({
          calibrationState: {
            ...state.calibrationState,
            progress,
          },
        }));
        onProgress?.(progress);
      });

      if (!result) {
        set({
          calibrationState: {
            isCalibrating: false,
            progress: "",
            error: "Falha na calibração",
          },
        });
        return false;
      }

      const vehicle = await getVehicle(vehicleId);
      if (!vehicle) {
        set({
          calibrationState: {
            isCalibrating: false,
            progress: "",
            error: "Veículo não encontrado",
          },
        });
        return false;
      }

      const now = new Date().toISOString();
      const updatedVehicle: Vehicle = {
        ...vehicle,
        name: `${result.data.make} ${result.data.model}`,
        make: result.data.make,
        model: result.data.model,
        year: result.data.year,
        displacement: result.data.displacement,
        fuelType: result.data.fuelType,
        euroNorm: result.data.euroNorm,
        segment: result.data.segment,
        urbanKmpl: result.data.urbanKmpl,
        highwayKmpl: result.data.highwayKmpl,
        combinedKmpl: result.data.combinedKmpl,
        mass: result.data.mass,
        grossWeight: result.data.grossWeight,
        frontalArea: result.data.frontalArea,
        dragCoefficient: result.data.dragCoefficient,
        f0: result.data.f0,
        f1: result.data.f1,
        f2: result.data.f2,
        fuelConversionFactor: result.data.fuelConversionFactor,
        peakPowerKw: result.data.peakPowerKw,
        peakTorqueNm: result.data.peakTorqueNm,
        co2_gkm: result.data.co2_gkm,
        nox_mgkm: result.data.nox_mgkm,
        confidence: result.confidence,
        calibrationInput: vehicleInput,
        calibratedAt: now,
        dataSource: result.dataSource,
      };

      await saveVehicle(updatedVehicle);

      const vehicles = await getVehicles();
      const activeVehicle = get().activeVehicle;

      set({
        vehicles,
        activeVehicle:
          activeVehicle?.id === vehicleId ? updatedVehicle : activeVehicle,
        calibrationState: {
          isCalibrating: false,
          progress: "",
          error: null,
        },
      });

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      set({
        calibrationState: {
          isCalibrating: false,
          progress: "",
          error: errorMsg,
        },
      });
      return false;
    }
  },

  setInclinationCalibration: async (offsetDegrees: number) => {
    const { activeVehicle } = get();
    if (!activeVehicle) return;

    const calibration: InclinationCalibration = {
      vehicleId: activeVehicle.id,
      offsetDegrees,
      calibratedAt: new Date().toISOString(),
    };

    await saveInclinationCalibration(calibration);
    set({ inclinationCalibration: calibration });
  },

  clearInclinationCalibration: async () => {
    const { activeVehicle } = get();
    if (!activeVehicle) return;

    await clearInclinationCalibration(activeVehicle.id);
    set({ inclinationCalibration: null });
  },

  getVehicleCalibration: (vehicleId: string) => {
    return get().vehicles.find((v) => v.id === vehicleId);
  },

  updateVehicleFuelLevel: async (vehicleId: string, currentFuel: number) => {
    await updateVehicleFuel(vehicleId, currentFuel);

    // Atualizar estado local se for o veículo ativo
    const { activeVehicle, vehicles } = get();
    if (activeVehicle?.id === vehicleId) {
      set({
        activeVehicle: { ...activeVehicle, currentFuel },
      });
    }

    // Atualizar na lista de veículos
    const updatedVehicles = vehicles.map((v) =>
      v.id === vehicleId ? { ...v, currentFuel } : v,
    );
    set({ vehicles: updatedVehicles });
  },
}));
