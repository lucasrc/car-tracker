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
  getAllTrips,
  saveTrip,
} from "@/lib/db";
import { calibrateVehicle } from "@/lib/vehicle-calibration-service";
import { generateId } from "@/lib/utils";
import { debugLog } from "@/lib/debug";
import { useFuelInventoryStore } from "@/stores/useFuelInventoryStore";
import type { VehicleCalibration, DataSource } from "@/types";

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
    vehicleInput: Parameters<typeof calibrateVehicle>[0],
    preCalibratedData?: VehicleCalibration & { dataSource?: DataSource },
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

    let vehicles = await getVehicles();
    const settings = await getSettings();

    for (const v of vehicles) {
      let needsUpdate = false;
      let updatedVehicle = { ...v };

      if (updatedVehicle.fuelCapacity <= 0) {
        updatedVehicle.fuelCapacity = 50;
        needsUpdate = true;
      }

      if (updatedVehicle.currentFuel < 0) {
        updatedVehicle.currentFuel = 0;
        needsUpdate = true;
      }

      if (updatedVehicle.currentFuel > updatedVehicle.fuelCapacity) {
        updatedVehicle.currentFuel = updatedVehicle.fuelCapacity;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await saveVehicle(updatedVehicle);
      }
    }

    vehicles = await getVehicles();

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

    const { loadBatches } = useFuelInventoryStore.getState();
    await loadBatches(vehicleId);
  },

  createVehicle: async (
    name: string,
    data: Parameters<typeof calibrateVehicle>[0],
    preCalibratedData?: VehicleCalibration & { dataSource?: DataSource },
  ) => {
    set({
      calibrationState: {
        isCalibrating: true,
        progress: "",
        error: null,
      },
    });

    let result: {
      data: VehicleCalibration;
      confidence: "high" | "medium" | "low";
      dataSource?: DataSource;
    } | null = null;

    try {
      if (preCalibratedData) {
        result = {
          data: preCalibratedData,
          confidence: preCalibratedData.confidence,
          dataSource: preCalibratedData.dataSource,
        };
      } else {
        result = await calibrateVehicle(data, (progress) => {
          set((state) => ({
            calibrationState: {
              ...state.calibrationState,
              progress,
            },
          }));
        });
      }

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
        calibrationInput: preCalibratedData
          ? (data as string)
          : (data as string),
        calibratedAt: now,
        createdAt: now,
        fuelCapacity: 50,
        currentFuel: 0,
        dataSource: result.dataSource,
        inmetroCityKmpl: result.data.inmetroCityKmpl,
        inmetroHighwayKmpl: result.data.inmetroHighwayKmpl,
        userAvgCityKmpl: result.data.userAvgCityKmpl,
        userAvgHighwayKmpl: result.data.userAvgHighwayKmpl,
        inmetroEthanolCityKmpl: result.data.inmetroEthanolCityKmpl,
        inmetroEthanolHighwayKmpl: result.data.inmetroEthanolHighwayKmpl,
        userAvgEthanolCityKmpl: result.data.userAvgEthanolCityKmpl,
        userAvgEthanolHighwayKmpl: result.data.userAvgEthanolHighwayKmpl,
        crr: result.data.crr,
        idleLph: result.data.idleLph,
        baseBsfc: result.data.baseBsfc,
        weightInmetro: result.data.weightInmetro ?? 0.6,
        weightUser: result.data.weightUser ?? 0.4,
        isHybrid: result.data.isHybrid ?? false,
        gnvCylinderWeightKg: result.data.gnvCylinderWeightKg ?? 80,
        gnvEfficiencyFactor: result.data.gnvEfficiencyFactor ?? 1.32,
        transmission: result.data.transmission,
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
    const allTrips = await getAllTrips();
    const vehicleTrips = allTrips.filter((t) => t.vehicleId === vehicleId);

    for (const trip of vehicleTrips) {
      await saveTrip({
        ...trip,
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

    return { hasTrips: vehicleTrips.length > 0 };
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
      const result = await calibrateVehicle(vehicleInput, (progress) => {
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
        inmetroCityKmpl: result.data.inmetroCityKmpl,
        inmetroHighwayKmpl: result.data.inmetroHighwayKmpl,
        userAvgCityKmpl: result.data.userAvgCityKmpl,
        userAvgHighwayKmpl: result.data.userAvgHighwayKmpl,
        inmetroEthanolCityKmpl: result.data.inmetroEthanolCityKmpl,
        inmetroEthanolHighwayKmpl: result.data.inmetroEthanolHighwayKmpl,
        userAvgEthanolCityKmpl: result.data.userAvgEthanolCityKmpl,
        userAvgEthanolHighwayKmpl: result.data.userAvgEthanolHighwayKmpl,
        crr: result.data.crr,
        idleLph: result.data.idleLph,
        baseBsfc: result.data.baseBsfc,
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
    debugLog(
      `[VEHICLE] updateVehicleFuelLevel called: vehicleId=${vehicleId}, currentFuel=${currentFuel.toFixed(2)}`,
    );
    await updateVehicleFuel(vehicleId, currentFuel);

    // Atualizar estado local se for o veículo ativo
    const { activeVehicle, vehicles } = get();
    debugLog(
      `[VEHICLE] Current activeVehicle: ${activeVehicle?.id}, currentFuel: ${activeVehicle?.currentFuel}`,
    );
    if (activeVehicle?.id === vehicleId) {
      debugLog(
        `[VEHICLE] Updating activeVehicle.currentFuel to ${currentFuel.toFixed(2)}`,
      );
      set({
        activeVehicle: { ...activeVehicle, currentFuel },
      });
    }

    // Atualizar na lista de veículos
    const updatedVehicles = vehicles.map((v) =>
      v.id === vehicleId ? { ...v, currentFuel } : v,
    );
    debugLog(
      `[VEHICLE] Updated ${updatedVehicles.filter((v) => v.id === vehicleId).length} vehicle(s) in list`,
    );
    set({ vehicles: updatedVehicles });
    debugLog(`[VEHICLE] Store update complete`);
  },
}));
