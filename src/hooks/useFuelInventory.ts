import { useCallback, useRef } from "react";
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

export function useFuelInventory(vehicleId: string) {
  const batchesRef = useRef<FuelBatch[]>([]);

  const loadInventory = useCallback(async (): Promise<FuelBatch[]> => {
    const refuels = await getRefuelsByVehicle(vehicleId);
    const batches: FuelBatch[] = refuels.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      amount: r.amount,
      fuelPrice: r.fuelPrice,
      fuelType: r.fuelType,
      totalCost: r.totalCost,
      consumedAmount: r.consumedAmount ?? 0,
    }));
    batchesRef.current = batches;
    return batches;
  }, [vehicleId]);

  const addBatch = useCallback(
    async (
      amount: number,
      price: number,
      fuelType: FuelType,
    ): Promise<void> => {
      const refuel = await dbAddRefuel(amount, price, fuelType, vehicleId);
      batchesRef.current.push({
        id: refuel.id,
        timestamp: refuel.timestamp,
        amount: refuel.amount,
        fuelPrice: refuel.fuelPrice,
        fuelType: refuel.fuelType,
        totalCost: refuel.totalCost,
        consumedAmount: 0,
      });
    },
    [vehicleId],
  );

  const consumeFuel = useCallback(
    async (
      liters: number,
      filterFuelType?: FuelType,
    ): Promise<ConsumptionResult> => {
      const sortedBatches = [...batchesRef.current].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

      const availableBatches = filterFuelType
        ? sortedBatches.filter(
            (b) => b.fuelType === filterFuelType && getRemainingAmount(b) > 0,
          )
        : sortedBatches.filter((b) => getRemainingAmount(b) > 0);

      let remaining = liters;
      let totalCost = 0;
      const consumedBatches: Array<{
        amount: number;
        price: number;
        fuelType: FuelType;
      }> = [];

      for (const batch of availableBatches) {
        if (remaining <= 0) break;

        const available = getRemainingAmount(batch);
        const toConsume = Math.min(available, remaining);
        const batchCost = toConsume * batch.fuelPrice;

        totalCost += batchCost;
        batch.consumedAmount += toConsume;
        remaining -= toConsume;

        dbUpdateRefuelConsumed(batch.id, batch.consumedAmount);

        consumedBatches.push({
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

      return { cost: totalCost, batches: consumedBatches };
    },
    [],
  );

  const getWeightedAveragePrice = useCallback(
    (filterFuelType?: FuelType): number => {
      return calculateWeightedAverage(batchesRef.current, filterFuelType);
    },
    [],
  );

  const getInventory = useCallback((): FuelBatch[] => {
    return batchesRef.current;
  }, []);

  const getTotalLiters = useCallback((filterFuelType?: FuelType): number => {
    const batches = filterFuelType
      ? batchesRef.current.filter((b) => b.fuelType === filterFuelType)
      : batchesRef.current;

    return batches.reduce((sum, b) => sum + getRemainingAmount(b), 0);
  }, []);

  const deleteBatch = useCallback(async (id: string): Promise<void> => {
    await dbDeleteRefuel(id);
    batchesRef.current = batchesRef.current.filter((b) => b.id !== id);
  }, []);

  return {
    loadInventory,
    addBatch,
    consumeFuel,
    getWeightedAveragePrice,
    getInventory,
    getTotalLiters,
    deleteBatch,
  };
}
