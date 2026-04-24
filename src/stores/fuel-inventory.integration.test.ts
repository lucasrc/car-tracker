import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useFuelInventoryStore } from "./useFuelInventoryStore";
import * as db from "@/lib/db";

vi.mock("@/lib/db", () => ({
  getRefuelsByVehicle: vi.fn(),
  addRefuel: vi.fn(
    (
      amount: number,
      fuelPrice: number,
      fuelType: string,
      vehicleId: string,
    ) => ({
      id: `db-refuel-${Date.now()}-${Math.random()}`,
      vehicleId,
      timestamp: new Date().toISOString(),
      amount,
      fuelPrice,
      fuelType,
      totalCost: amount * fuelPrice,
      consumedAmount: 0,
    }),
  ),
  deleteRefuel: vi.fn(),
  updateRefuelConsumed: vi.fn(() => Promise.resolve()),
  updateVehicleFuel: vi.fn(() => Promise.resolve()),
  getVehicles: vi.fn(() => Promise.resolve([])),
  getVehicle: vi.fn(() => Promise.resolve(null)),
  saveVehicle: vi.fn(),
  getSettings: vi.fn(() =>
    Promise.resolve({ id: "default", fuelCapacity: 50 }),
  ),
  saveSettings: vi.fn(),
}));

describe("Fuel Inventory + Vehicle Store Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getRefuelsByVehicle).mockResolvedValue([]);
    useFuelInventoryStore.getState().reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getFuelState = () => useFuelInventoryStore.getState();

  describe("Scenario: Complete Trip Lifecycle", () => {
    it("1. Refuel: Add batch → verify batches updated → verify getTotalLiters works", async () => {
      const fuelStore = getFuelState();

      // Add first refuel
      await fuelStore.addBatch(30, 5.0, "gasolina", "vehicle-1");
      let state = getFuelState();
      expect(state.batches).toHaveLength(1);
      expect(state.batches[0].amount).toBe(30);
      expect(state.getTotalLiters()).toBe(30);

      // Add second refuel
      await fuelStore.addBatch(20, 5.5, "gasolina", "vehicle-1");
      state = getFuelState();
      expect(state.batches).toHaveLength(2);
      expect(state.getTotalLiters()).toBe(50);
    });

    it("2. Load Batches: Reset FIFO cost on new trip start", async () => {
      const fuelStore = getFuelState();

      // Add refuel and consume some
      await fuelStore.addBatch(50, 5.0, "gasolina", "vehicle-1");
      await fuelStore.consumeFuel(10, "gasolina");
      let state = getFuelState();
      expect(state.getCumulativeFifoCost()).toBe(50);

      // Simulate loading batches for new trip (like in Tracker.handleStart)
      vi.mocked(db.getRefuelsByVehicle).mockResolvedValue([]);
      await fuelStore.loadBatches("vehicle-1");

      state = getFuelState();
      expect(state.getCumulativeFifoCost()).toBe(0);
      expect(state.batches).toHaveLength(0);
    });

    it("3. Consume Fuel: FIFO consumption → update batches → track cumulative cost", async () => {
      const fuelStore = getFuelState();

      // Setup: 2 batches at different prices
      await fuelStore.addBatch(20, 5.0, "gasolina", "vehicle-1");
      await fuelStore.addBatch(30, 6.0, "gasolina", "vehicle-1");

      // Sort to ensure FIFO (manually set timestamps)
      let state = getFuelState();
      state.batches[0].timestamp = "2024-01-01T10:00:00Z";
      state.batches[1].timestamp = "2024-01-02T10:00:00Z";

      // First consumption: 15L from batch 1 (R$5.00)
      const result1 = await fuelStore.consumeFuel(15, "gasolina");
      state = getFuelState();
      expect(result1.cost).toBe(75);
      expect(state.getCumulativeFifoCost()).toBe(75);
      expect(state.getTotalLiters()).toBe(35);

      // Second consumption: 25L
      const result2 = await fuelStore.consumeFuel(25, "gasolina");
      state = getFuelState();
      expect(result2.cost).toBe(145);
      expect(state.getCumulativeFifoCost()).toBe(220);
      expect(state.getTotalLiters()).toBe(10);
    });

    it("4. Partial Batch: Consuming across batch boundaries correctly", async () => {
      const fuelStore = getFuelState();

      await fuelStore.addBatch(10, 5.0, "gasolina", "vehicle-1");
      await fuelStore.addBatch(20, 6.0, "gasolina", "vehicle-1");

      let state = getFuelState();
      state.batches[0].timestamp = "2024-01-01T10:00:00Z";
      state.batches[1].timestamp = "2024-01-02T10:00:00Z";

      const result = await fuelStore.consumeFuel(30, "gasolina");
      state = getFuelState();

      expect(result.cost).toBe(170);
      expect(state.getTotalLiters()).toBe(0);
      expect(state.batches[0].consumedAmount).toBe(10);
      expect(state.batches[1].consumedAmount).toBe(20);
    });

    it("5. Weighted Average Price: Calculates correctly across batches", async () => {
      const fuelStore = getFuelState();

      await fuelStore.addBatch(30, 5.0, "gasolina", "vehicle-1");
      await fuelStore.addBatch(20, 6.0, "gasolina", "vehicle-1");

      const state = getFuelState();
      expect(state.getWeightedAveragePrice()).toBe(5.4);
    });

    it("6. Mixed Fuel Types: Separate tracking per type", async () => {
      const fuelStore = getFuelState();

      await fuelStore.addBatch(30, 5.0, "gasolina", "vehicle-1");
      await fuelStore.addBatch(20, 3.5, "etanol", "vehicle-1");

      let state = getFuelState();
      expect(state.getTotalLiters()).toBe(50);
      expect(state.getTotalLiters("gasolina")).toBe(30);
      expect(state.getTotalLiters("etanol")).toBe(20);

      await fuelStore.consumeFuel(10, "gasolina");
      state = getFuelState();
      expect(state.getTotalLiters()).toBe(40);
      expect(state.getTotalLiters("gasolina")).toBe(20);
      expect(state.getTotalLiters("etanol")).toBe(20);
    });
  });

  describe("Scenario: Edge Cases", () => {
    it("Consume more than available: Only consumes available amount", async () => {
      const fuelStore = getFuelState();

      await fuelStore.addBatch(10, 5.0, "gasolina", "vehicle-1");
      const result = await fuelStore.consumeFuel(20, "gasolina");

      expect(result.cost).toBe(50);
      expect(getFuelState().getTotalLiters()).toBe(0);
    });

    it("Consume when no batches: Returns 0 cost, no error", async () => {
      const fuelStore = getFuelState();

      const result = await fuelStore.consumeFuel(10, "gasolina");

      expect(result.cost).toBe(0);
      expect(getFuelState().getCumulativeFifoCost()).toBe(0);
    });

    it("Reset: Clears all state including FIFO cost", async () => {
      const fuelStore = getFuelState();

      await fuelStore.addBatch(50, 5.0, "gasolina", "vehicle-1");
      await fuelStore.consumeFuel(20, "gasolina");

      fuelStore.reset();

      const state = getFuelState();
      expect(state.getCumulativeFifoCost()).toBe(0);
      expect(state.batches).toHaveLength(0);
      expect(state.isLoaded).toBe(false);
      expect(state.vehicleId).toBeNull();
    });
  });

  describe("Scenario: Vehicle Fuel Type Filtering (FIFO)", () => {
    it("Flex vehicle: consumes from ALL batches regardless of fuel type", async () => {
      const fuelStore = getFuelState();

      await fuelStore.addBatch(20, 5.0, "gasolina", "vehicle-flex");
      await fuelStore.addBatch(10, 3.5, "etanol", "vehicle-flex");

      let state = getFuelState();
      state.batches[0].timestamp = "2024-01-01T10:00:00Z";
      state.batches[1].timestamp = "2024-01-02T10:00:00Z";

      // Flex vehicles: no filter (undefined) = consume from all batches
      const result = await fuelStore.consumeFuel(25, undefined);

      state = getFuelState();
      expect(result.cost).toBe(20 * 5.0 + 5 * 3.5);
      expect(state.getCumulativeFifoCost()).toBe(20 * 5.0 + 5 * 3.5);
      expect(state.getTotalLiters()).toBe(5);
      expect(state.batches[0].consumedAmount).toBe(20);
      expect(state.batches[1].consumedAmount).toBe(5);
    });

    it("Flex vehicle: cumulative cost combines gasolina and etanol batches", async () => {
      const fuelStore = getFuelState();

      await fuelStore.addBatch(30, 5.5, "gasolina", "vehicle-flex");
      await fuelStore.addBatch(20, 3.89, "etanol", "vehicle-flex");

      let state = getFuelState();
      state.batches[0].timestamp = "2024-01-01T10:00:00Z";
      state.batches[1].timestamp = "2024-01-02T10:00:00Z";

      await fuelStore.consumeFuel(10, undefined);
      state = getFuelState();
      expect(state.getCumulativeFifoCost()).toBe(10 * 5.5);

      await fuelStore.consumeFuel(30, undefined);
      state = getFuelState();
      expect(state.getCumulativeFifoCost()).toBe(30 * 5.5 + 10 * 3.89);
    });

    it("Diesel vehicle: only consumes from diesel batches, skips gasolina", async () => {
      const fuelStore = getFuelState();

      await fuelStore.addBatch(30, 5.0, "gasolina", "vehicle-diesel");
      await fuelStore.addBatch(40, 6.2, "diesel", "vehicle-diesel");

      let state = getFuelState();
      state.batches[0].timestamp = "2024-01-01T10:00:00Z";
      state.batches[1].timestamp = "2024-01-02T10:00:00Z";

      const result = await fuelStore.consumeFuel(15, "diesel");

      state = getFuelState();
      expect(result.cost).toBe(15 * 6.2);
      expect(state.batches[0].consumedAmount).toBe(0);
      expect(state.batches[1].consumedAmount).toBe(15);
      expect(state.getTotalLiters()).toBe(55);
    });

    it("GNV vehicle: only consumes from gnv batches", async () => {
      const fuelStore = getFuelState();

      await fuelStore.addBatch(30, 5.0, "gasolina", "vehicle-gnv");
      await fuelStore.addBatch(20, 4.5, "gnv", "vehicle-gnv");

      let state = getFuelState();
      state.batches[0].timestamp = "2024-01-01T10:00:00Z";
      state.batches[1].timestamp = "2024-01-02T10:00:00Z";

      const result = await fuelStore.consumeFuel(10, "gnv");

      state = getFuelState();
      expect(result.cost).toBe(10 * 4.5);
      expect(state.batches[0].consumedAmount).toBe(0);
      expect(state.batches[1].consumedAmount).toBe(10);
    });

    it("Gasolina vehicle: only consumes from gasolina batches", async () => {
      const fuelStore = getFuelState();

      await fuelStore.addBatch(30, 5.0, "gasolina", "vehicle-gas");
      await fuelStore.addBatch(20, 3.5, "etanol", "vehicle-gas");

      let state = getFuelState();
      state.batches[0].timestamp = "2024-01-01T10:00:00Z";
      state.batches[1].timestamp = "2024-01-02T10:00:00Z";

      const result = await fuelStore.consumeFuel(10, "gasolina");

      state = getFuelState();
      expect(result.cost).toBe(10 * 5.0);
      expect(state.batches[0].consumedAmount).toBe(10);
      expect(state.batches[1].consumedAmount).toBe(0);
      expect(state.getTotalLiters("gasolina")).toBe(20);
      expect(state.getTotalLiters("etanol")).toBe(20);
    });

    it("Consume with undefined filter (flex) on single-type batches still works", async () => {
      const fuelStore = getFuelState();

      await fuelStore.addBatch(40, 5.8, "gasolina", "vehicle-flex-only-gas");

      const result = await fuelStore.consumeFuel(10, undefined);

      expect(result.cost).toBe(10 * 5.8);
      expect(getFuelState().getTotalLiters()).toBe(30);
    });
  });

  describe("Scenario: Database Persistence", () => {
    it("addBatch: Calls DB with correct parameters", async () => {
      const fuelStore = getFuelState();

      await fuelStore.addBatch(40, 5.5, "gasolina", "vehicle-123");

      expect(db.addRefuel).toHaveBeenCalledWith(
        40,
        5.5,
        "gasolina",
        "vehicle-123",
      );
    });

    it("consumeFuel: Updates consumedAmount in DB", async () => {
      const fuelStore = getFuelState();

      await fuelStore.addBatch(50, 5.0, "gasolina", "vehicle-1");
      const batchId = getFuelState().batches[0].id;

      await fuelStore.consumeFuel(15, "gasolina");

      expect(db.updateRefuelConsumed).toHaveBeenCalledWith(batchId, 15);
    });

    it("loadBatches: Loads from DB with vehicleId filter", async () => {
      const mockRefuels = [
        {
          id: "refuel-1",
          vehicleId: "vehicle-1",
          timestamp: "2024-01-01T10:00:00Z",
          amount: 30,
          fuelPrice: 5.0,
          fuelType: "gasolina" as const,
          totalCost: 150,
          consumedAmount: 5,
        },
        {
          id: "refuel-2",
          vehicleId: "vehicle-1",
          timestamp: "2024-01-02T10:00:00Z",
          amount: 40,
          fuelPrice: 5.5,
          fuelType: "gasolina" as const,
          totalCost: 220,
          consumedAmount: 10,
        },
      ];

      vi.mocked(db.getRefuelsByVehicle).mockResolvedValue(mockRefuels);

      const fuelStore = getFuelState();
      await fuelStore.loadBatches("vehicle-1");

      expect(db.getRefuelsByVehicle).toHaveBeenCalledWith("vehicle-1");
      const state = getFuelState();
      expect(state.batches).toHaveLength(2);
      expect(state.batches[0].consumedAmount).toBe(5);
      expect(state.batches[1].consumedAmount).toBe(10);
    });
  });
});
