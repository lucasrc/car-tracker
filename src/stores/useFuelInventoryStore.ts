import { create } from "zustand";
import {
  getRefuelsByVehicle,
  addRefuel as dbAddRefuel,
  deleteRefuel as dbDeleteRefuel,
  updateRefuelConsumed as dbUpdateRefuelConsumed,
} from "@/lib/db";
import type { FuelType } from "@/types";

export interface FuelBatch {
  id: string;
  timestamp: string;
  amount: number;
  fuelPrice: number;
  fuelType: FuelType;
  totalCost: number;
  consumedAmount: number;
}

export interface ConsumptionResult {
  cost: number;
  batches: Array<{
    amount: number;
    price: number;
    fuelType: FuelType;
  }>;
}

interface FuelInventoryState {
  batches: FuelBatch[];
  vehicleId: string | null;
  isLoading: boolean;
  isLoaded: boolean;
  loadBatches: (vehicleId: string) => Promise<void>;
  addBatch: (
    amount: number,
    price: number,
    fuelType: FuelType,
    vehicleId: string,
  ) => Promise<void>;
  consumeFuel: (
    liters: number,
    filterFuelType?: FuelType,
    vehicleId?: string,
  ) => Promise<ConsumptionResult>;
  deleteBatch: (id: string) => Promise<void>;
  getTotalLiters: (filterFuelType?: FuelType) => number;
  getWeightedAveragePrice: (filterFuelType?: FuelType) => number;
  reset: () => void;
}

function getRemainingAmount(batch: FuelBatch): number {
  return batch.amount - batch.consumedAmount;
}

function calculateWeightedAverage(
  batches: FuelBatch[],
  filterFuelType?: FuelType,
): number {
  const filtered = filterFuelType
    ? batches.filter((b) => b.fuelType === filterFuelType)
    : batches;

  if (filtered.length === 0) return 0;

  const totalLiters = filtered.reduce(
    (sum, b) => sum + getRemainingAmount(b),
    0,
  );
  if (totalLiters === 0) return 0;

  const totalCost = filtered.reduce(
    (sum, b) => sum + getRemainingAmount(b) * b.fuelPrice,
    0,
  );

  return totalCost / totalLiters;
}

export const useFuelInventoryStore = create<FuelInventoryState>((set, get) => ({
  batches: [],
  vehicleId: null,
  isLoading: false,
  isLoaded: false,

  loadBatches: async (vehicleId: string) => {
    console.log(`[FUEL] loadBatches called for vehicleId: ${vehicleId}`);
    // Reset inventory when switching vehicles
    set({ batches: [], vehicleId: null, isLoading: true, isLoaded: false });

    const refuels = await getRefuelsByVehicle(vehicleId);
    console.log(
      `[FUEL] Found ${refuels.length} refuels in DB for vehicle ${vehicleId}`,
    );
    const batches: FuelBatch[] = refuels.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      amount: r.amount,
      fuelPrice: r.fuelPrice,
      fuelType: r.fuelType,
      totalCost: r.totalCost,
      consumedAmount: r.consumedAmount ?? 0,
    }));
    console.log(`[FUEL] Created ${batches.length} batches, setting state`);
    set({ batches, vehicleId, isLoading: false, isLoaded: true });
    console.log(
      `[FUEL] State updated: batches=${batches.length}, vehicleId=${vehicleId}`,
    );
  },

  addBatch: async (
    amount: number,
    price: number,
    fuelType: FuelType,
    vehicleId: string,
  ) => {
    const refuel = await dbAddRefuel(amount, price, fuelType, vehicleId);
    const newBatch: FuelBatch = {
      id: refuel.id,
      timestamp: refuel.timestamp,
      amount: refuel.amount,
      fuelPrice: refuel.fuelPrice,
      fuelType: refuel.fuelType,
      totalCost: refuel.totalCost,
      consumedAmount: 0,
    };
    set((state) => ({ batches: [...state.batches, newBatch] }));
  },

  consumeFuel: async (
    liters: number,
    filterFuelType?: FuelType,
    forceLoadVehicleId?: string,
  ) => {
    const state = get();
    const { batches, vehicleId } = state;

    const targetVehicleId = forceLoadVehicleId || vehicleId;

    console.log(
      `[FUEL] consumeFuel called: ${liters}L, filter=${filterFuelType}, vehicleId=${targetVehicleId}, batches=${batches.length}, isLoaded=${state.isLoaded}`,
    );

    // Auto-load if no batches and we have a vehicleId
    if (batches.length === 0 && targetVehicleId && !state.isLoaded) {
      console.log(`[FUEL] Auto-loading batches for vehicle ${targetVehicleId}`);
      await state.loadBatches(targetVehicleId);
    }

    // Map original indices to track consumption
    const consumptionById = new Map<string, number>();
    const consumedBatchDetails: Array<{
      amount: number;
      price: number;
      fuelType: FuelType;
    }> = [];

    let remaining = liters;
    let totalCost = 0;

    // Sort batches by timestamp (FIFO - oldest first)
    const sortedBatches = [...batches].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    console.log(`[FUEL] Processing ${sortedBatches.length} sorted batches`);
    for (const batch of sortedBatches) {
      const remainingFuel = getRemainingAmount(batch);
      console.log(
        `[FUEL] Batch ${batch.id}: amount=${batch.amount}, consumed=${batch.consumedAmount}, remaining=${remainingFuel}, type=${batch.fuelType}, filterFuelType=${filterFuelType}`,
      );
    }

    for (const batch of sortedBatches) {
      if (remaining <= 0) break;

      const filterMatch = !filterFuelType || batch.fuelType === filterFuelType;
      const remainingFuel = getRemainingAmount(batch);
      const hasFuel = remainingFuel > 0;

      console.log(
        `[FUEL] Checking batch ${batch.id}: filterMatch=${filterMatch}, hasFuel=${hasFuel}, remainingFuel=${remainingFuel}`,
      );
      if (!filterMatch || !hasFuel) continue;

      const toConsume = Math.min(remainingFuel, remaining);
      const batchCost = toConsume * batch.fuelPrice;

      console.log(`[FUEL] Consuming ${toConsume}L from batch ${batch.id}`);
      totalCost += batchCost;
      consumptionById.set(batch.id, toConsume);
      remaining -= toConsume;

      consumedBatchDetails.push({
        amount: toConsume,
        price: batch.fuelPrice,
        fuelType: batch.fuelType,
      });
    }

    if (remaining > 0) {
      console.warn(
        `consumeFuel: requested ${liters}L but only ${liters - remaining}L available`,
      );
    }

    // Update state with new batch objects
    const updatedBatches = batches.map((batch) => {
      const consumed = consumptionById.get(batch.id);
      if (consumed !== undefined) {
        const newConsumed = batch.consumedAmount + consumed;
        dbUpdateRefuelConsumed(batch.id, newConsumed);
        return { ...batch, consumedAmount: newConsumed };
      }
      return batch;
    });

    set({ batches: updatedBatches });
    return { cost: totalCost, batches: consumedBatchDetails };
  },

  deleteBatch: async (id: string) => {
    await dbDeleteRefuel(id);
    set((state) => ({
      batches: state.batches.filter((b) => b.id !== id),
    }));
  },

  getTotalLiters: (filterFuelType?: FuelType) => {
    const { batches } = get();
    const filtered = filterFuelType
      ? batches.filter((b) => b.fuelType === filterFuelType)
      : batches;

    return filtered.reduce((sum, b) => sum + getRemainingAmount(b), 0);
  },

  getWeightedAveragePrice: (filterFuelType?: FuelType) => {
    return calculateWeightedAverage(get().batches, filterFuelType);
  },

  reset: () => {
    set({ batches: [], vehicleId: null, isLoaded: false, isLoading: false });
  },
}));
