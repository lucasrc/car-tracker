import { create } from "zustand";
import {
  getRefuelsByVehicle,
  addRefuel as dbAddRefuel,
  deleteRefuel as dbDeleteRefuel,
  updateRefuelConsumed as dbUpdateRefuelConsumed,
  addFuelEvents as dbAddFuelEvents,
  deleteFuelEventsByBatch,
} from "@/lib/db";
import type {
  FuelType,
  FuelConsumptionEvent,
  DriveMode,
  BatchAllocation,
} from "@/types";
import { generateId } from "@/lib/utils";

const WAL_KEY = "fuel-event-wal";
const EVENT_FLUSH_THRESHOLD_LITERS = 0.1;

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
  eventQueue: FuelConsumptionEvent[];
  accumulatedFuelForFlush: number;
  cumulativeFifoCost: number;
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
  emitFuelEvent: (
    tripId: string,
    fuelLiters: number,
    cumulativeFuelUsed: number,
    tankLevelBefore: number,
    tankLevelAfter: number,
    position: { lat: number; lng: number; altitude?: number },
    speedKmh: number,
    driveMode: DriveMode,
    gradePercent: number,
    instantConsumption: number,
    avgConsumptionSoFar: number,
    source: "gps" | "simulation",
  ) => void;
  flushEventsToDb: () => Promise<void>;
  replayWal: () => Promise<void>;
  clearWal: () => void;
  deleteBatch: (id: string) => Promise<void>;
  getTotalLiters: (filterFuelType?: FuelType) => number;
  getWeightedAveragePrice: (filterFuelType?: FuelType) => number;
  getCumulativeFifoCost: () => number;
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

function loadWal(): FuelConsumptionEvent[] {
  try {
    const raw = localStorage.getItem(WAL_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FuelConsumptionEvent[];
  } catch {
    return [];
  }
}

function saveWal(events: FuelConsumptionEvent[]): void {
  try {
    localStorage.setItem(WAL_KEY, JSON.stringify(events));
  } catch (e) {
    console.warn("[FUEL] Failed to save WAL:", e);
  }
}

export const useFuelInventoryStore = create<FuelInventoryState>((set, get) => ({
  batches: [],
  vehicleId: null,
  isLoading: false,
  isLoaded: false,
  eventQueue: [],
  accumulatedFuelForFlush: 0,
  cumulativeFifoCost: 0,

  loadBatches: async (vehicleId: string) => {
    console.log(`[FUEL] loadBatches called for vehicleId: ${vehicleId}`);
    // Reset inventory when switching vehicles
    // Also reset FIFO cost tracker for new trip
    set({
      batches: [],
      vehicleId: null,
      isLoading: true,
      isLoaded: false,
      cumulativeFifoCost: 0,
    });

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

    // Update state with new batch objects and await DB updates
    const updatePromises: Promise<void>[] = [];
    const updatedBatches = batches.map((batch) => {
      const consumed = consumptionById.get(batch.id);
      if (consumed !== undefined) {
        const newConsumed = batch.consumedAmount + consumed;
        updatePromises.push(
          dbUpdateRefuelConsumed(batch.id, newConsumed).catch((err) => {
            console.error(`[FUEL] Failed to update batch ${batch.id}:`, err);
          }),
        );
        return { ...batch, consumedAmount: newConsumed };
      }
      return batch;
    });

    await Promise.all(updatePromises);
    set((state) => ({
      batches: updatedBatches,
      cumulativeFifoCost: state.cumulativeFifoCost + totalCost,
    }));
    console.log(
      `[FUEL] consumeFuel: totalCost=${totalCost.toFixed(2)}, cumulativeFifoCost=${state.cumulativeFifoCost + totalCost}`,
    );
    return { cost: totalCost, batches: consumedBatchDetails };
  },

  emitFuelEvent: (
    tripId,
    fuelLiters,
    cumulativeFuelUsed,
    tankLevelBefore,
    tankLevelAfter,
    position,
    speedKmh,
    driveMode,
    gradePercent,
    instantConsumption,
    avgConsumptionSoFar,
    source,
  ) => {
    const state = get();
    const batchAllocations: BatchAllocation[] = state.batches
      .filter((b) => b.consumedAmount > 0 || b.amount > 0)
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      )
      .slice(0, 3)
      .map((b) => ({
        batchId: b.id,
        amountFromBatch: 0,
        batchPricePerLiter: b.fuelPrice,
        batchFuelType: b.fuelType,
      }));

    const lastSequence =
      state.eventQueue.length > 0
        ? state.eventQueue[state.eventQueue.length - 1].sequenceNumber
        : 0;

    const event: FuelConsumptionEvent = {
      id: generateId(),
      tripId,
      vehicleId: state.vehicleId || "",
      timestamp: new Date().toISOString(),
      sequenceNumber: lastSequence + 1,
      position,
      fuelLiters,
      cumulativeFuelUsed,
      tankLevelBefore,
      tankLevelAfter,
      speedKmh,
      driveMode,
      gradePercent,
      instantConsumption,
      avgConsumptionSoFar,
      batchAllocations,
      eventCost: 0,
      source,
    };

    const newQueue = [...state.eventQueue, event];
    const newAccumulated = state.accumulatedFuelForFlush + fuelLiters;

    saveWal(newQueue);
    set({
      eventQueue: newQueue,
      accumulatedFuelForFlush: newAccumulated,
    });

    if (newAccumulated >= EVENT_FLUSH_THRESHOLD_LITERS) {
      get().flushEventsToDb();
    }
  },

  flushEventsToDb: async () => {
    const { eventQueue } = get();
    if (eventQueue.length === 0) return;

    try {
      await dbAddFuelEvents(eventQueue);
      saveWal([]);
      set({ eventQueue: [], accumulatedFuelForFlush: 0 });
      console.log(`[FUEL] Flushed ${eventQueue.length} events to DB`);
    } catch (err) {
      console.error("[FUEL] Failed to flush events:", err);
    }
  },

  replayWal: async () => {
    const walEvents = loadWal();
    if (walEvents.length === 0) return;

    const lastEvent = walEvents[walEvents.length - 1];
    const tripId = lastEvent.tripId;

    console.log(
      `[FUEL] Replaying ${walEvents.length} events from WAL for trip ${tripId}`,
    );
    set({
      eventQueue: walEvents,
      accumulatedFuelForFlush: walEvents.reduce(
        (sum, e) => sum + e.fuelLiters,
        0,
      ),
    });
  },

  clearWal: () => {
    localStorage.removeItem(WAL_KEY);
    set({ eventQueue: [], accumulatedFuelForFlush: 0 });
  },

  deleteBatch: async (id: string) => {
    await Promise.all([dbDeleteRefuel(id), deleteFuelEventsByBatch(id)]);
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

  getCumulativeFifoCost: () => {
    return get().cumulativeFifoCost;
  },

  reset: () => {
    set({
      batches: [],
      vehicleId: null,
      isLoaded: false,
      isLoading: false,
      eventQueue: [],
      accumulatedFuelForFlush: 0,
      cumulativeFifoCost: 0,
    });
  },
}));
