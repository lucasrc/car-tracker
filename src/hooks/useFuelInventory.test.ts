import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFuelInventory } from "@/hooks/useFuelInventory";
import * as db from "@/lib/db";

vi.mock("@/lib/db", () => ({
  getRefuelsByVehicle: vi.fn(),
  addRefuel: vi.fn(),
  deleteRefuel: vi.fn(),
  updateRefuelConsumed: vi.fn(),
}));

describe("useFuelInventory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("loadInventory", () => {
    it("should load refuels from DB and convert to batches", async () => {
      const mockRefuels = [
        {
          id: "refuel-1",
          timestamp: "2024-01-01T10:00:00Z",
          amount: 20,
          fuelPrice: 5.0,
          fuelType: "gasolina" as const,
          totalCost: 100,
          consumedAmount: 0,
        },
        {
          id: "refuel-2",
          timestamp: "2024-01-02T10:00:00Z",
          amount: 30,
          fuelPrice: 6.0,
          fuelType: "etanol" as const,
          totalCost: 180,
          consumedAmount: 0,
        },
      ];

      vi.mocked(db.getRefuelsByVehicle).mockResolvedValue(mockRefuels as never);

      const { result } = renderHook(() => useFuelInventory("test-vehicle-id"));
      const batches = await act(
        async () => await result.current.loadInventory(),
      );

      expect(db.getRefuelsByVehicle).toHaveBeenCalledTimes(1);
      expect(batches).toHaveLength(2);
      expect(batches[0]).toMatchObject({
        id: "refuel-1",
        amount: 20,
        fuelPrice: 5.0,
        fuelType: "gasolina",
        consumedAmount: 0,
      });
      expect(batches[1]).toMatchObject({
        id: "refuel-2",
        amount: 30,
        fuelPrice: 6.0,
        fuelType: "etanol",
        consumedAmount: 0,
      });
    });

    it("should return empty array when no refuels exist", async () => {
      vi.mocked(db.getRefuelsByVehicle).mockResolvedValue([]);

      const { result } = renderHook(() => useFuelInventory("test-vehicle-id"));
      const batches = await act(
        async () => await result.current.loadInventory(),
      );

      expect(batches).toHaveLength(0);
    });
  });

  describe("consumeFuel", () => {
    it("should consume from oldest batch first (FIFO)", async () => {
      const mockRefuels = [
        {
          id: "batch-1",
          timestamp: "2024-01-01T10:00:00Z",
          amount: 20,
          fuelPrice: 5.0,
          fuelType: "gasolina" as const,
          totalCost: 100,
          consumedAmount: 0,
        },
        {
          id: "batch-2",
          timestamp: "2024-01-02T10:00:00Z",
          amount: 30,
          fuelPrice: 6.0,
          fuelType: "gasolina" as const,
          totalCost: 180,
          consumedAmount: 0,
        },
      ];

      vi.mocked(db.getRefuelsByVehicle).mockResolvedValue(mockRefuels as never);

      const { result } = renderHook(() => useFuelInventory("test-vehicle-id"));
      await act(async () => await result.current.loadInventory());

      const consumptionResult = await act(async () =>
        result.current.consumeFuel(25, "gasolina"),
      );

      expect(consumptionResult.cost).toBe(20 * 5.0 + 5 * 6.0);
      expect(consumptionResult.batches).toHaveLength(2);
      expect(consumptionResult.batches[0].amount).toBe(20);
      expect(consumptionResult.batches[1].amount).toBe(5);
    });

    it("should consume from multiple batches when first is exhausted", async () => {
      const mockRefuels = [
        {
          id: "batch-1",
          timestamp: "2024-01-01T10:00:00Z",
          amount: 20,
          fuelPrice: 5.0,
          fuelType: "gasolina" as const,
          totalCost: 100,
          consumedAmount: 0,
        },
        {
          id: "batch-2",
          timestamp: "2024-01-02T10:00:00Z",
          amount: 30,
          fuelPrice: 6.0,
          fuelType: "gasolina" as const,
          totalCost: 180,
          consumedAmount: 0,
        },
      ];

      vi.mocked(db.getRefuelsByVehicle).mockResolvedValue(mockRefuels as never);

      const { result } = renderHook(() => useFuelInventory("test-vehicle-id"));
      await act(async () => await result.current.loadInventory());

      const consumptionResult = await act(async () =>
        result.current.consumeFuel(35, "gasolina"),
      );

      expect(consumptionResult.cost).toBe(20 * 5.0 + 15 * 6.0);
      expect(consumptionResult.batches).toHaveLength(2);
      expect(consumptionResult.batches[0].amount).toBe(20);
      expect(consumptionResult.batches[1].amount).toBe(15);
    });

    it("should filter by fuel type when specified", async () => {
      const mockRefuels = [
        {
          id: "batch-1",
          timestamp: "2024-01-01T10:00:00Z",
          amount: 20,
          fuelPrice: 5.0,
          fuelType: "gasolina" as const,
          totalCost: 100,
          consumedAmount: 0,
        },
        {
          id: "batch-2",
          timestamp: "2024-01-02T10:00:00Z",
          amount: 30,
          fuelPrice: 3.5,
          fuelType: "etanol" as const,
          totalCost: 105,
        },
      ];

      vi.mocked(db.getRefuelsByVehicle).mockResolvedValue(mockRefuels as never);

      const { result } = renderHook(() => useFuelInventory("test-vehicle-id"));
      await act(async () => await result.current.loadInventory());

      const consumptionResult = await act(async () =>
        result.current.consumeFuel(10, "etanol"),
      );

      expect(consumptionResult.cost).toBe(10 * 3.5);
      expect(consumptionResult.batches).toHaveLength(1);
      expect(consumptionResult.batches[0].fuelType).toBe("etanol");
    });

    it("should warn when requested amount exceeds available fuel", async () => {
      const mockRefuels = [
        {
          id: "batch-1",
          timestamp: "2024-01-01T10:00:00Z",
          amount: 20,
          fuelPrice: 5.0,
          fuelType: "gasolina" as const,
          totalCost: 100,
          consumedAmount: 0,
        },
      ];

      vi.mocked(db.getRefuelsByVehicle).mockResolvedValue(mockRefuels as never);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { result } = renderHook(() => useFuelInventory("test-vehicle-id"));
      await act(async () => await result.current.loadInventory());

      const consumptionResult = await act(async () =>
        result.current.consumeFuel(30, "gasolina"),
      );

      expect(consumptionResult.cost).toBe(20 * 5.0);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("should return zero cost when no batches available", async () => {
      vi.mocked(db.getRefuelsByVehicle).mockResolvedValue([]);

      const { result } = renderHook(() => useFuelInventory("test-vehicle-id"));
      await act(async () => await result.current.loadInventory());

      const consumptionResult = await act(async () =>
        result.current.consumeFuel(10, "gasolina"),
      );

      expect(consumptionResult.cost).toBe(0);
      expect(consumptionResult.batches).toHaveLength(0);
    });
  });

  describe("getWeightedAveragePrice", () => {
    it("should calculate weighted average price correctly for gasoline", async () => {
      const mockRefuels = [
        {
          id: "batch-1",
          timestamp: "2024-01-01T10:00:00Z",
          amount: 20,
          fuelPrice: 5.0,
          fuelType: "gasolina" as const,
          totalCost: 100,
          consumedAmount: 0,
        },
        {
          id: "batch-2",
          timestamp: "2024-01-02T10:00:00Z",
          amount: 30,
          fuelPrice: 6.0,
          fuelType: "gasolina" as const,
          totalCost: 180,
          consumedAmount: 0,
        },
        {
          id: "batch-3",
          timestamp: "2024-01-03T10:00:00Z",
          amount: 50,
          fuelPrice: 3.5,
          fuelType: "etanol" as const,
          totalCost: 175,
        },
      ];

      vi.mocked(db.getRefuelsByVehicle).mockResolvedValue(mockRefuels as never);

      const { result } = renderHook(() => useFuelInventory("test-vehicle-id"));
      await act(async () => await result.current.loadInventory());

      const avgGasolina = result.current.getWeightedAveragePrice("gasolina");

      expect(avgGasolina).toBeCloseTo((20 * 5.0 + 30 * 6.0) / 50, 2);
    });

    it("should calculate average for all fuel types when no filter", async () => {
      const mockRefuels = [
        {
          id: "batch-1",
          timestamp: "2024-01-01T10:00:00Z",
          amount: 20,
          fuelPrice: 5.0,
          fuelType: "gasolina" as const,
          totalCost: 100,
          consumedAmount: 0,
        },
        {
          id: "batch-2",
          timestamp: "2024-01-02T10:00:00Z",
          amount: 30,
          fuelPrice: 6.0,
          fuelType: "gasolina" as const,
          totalCost: 180,
          consumedAmount: 0,
        },
        {
          id: "batch-3",
          timestamp: "2024-01-03T10:00:00Z",
          amount: 50,
          fuelPrice: 3.5,
          fuelType: "etanol" as const,
          totalCost: 175,
        },
      ];

      vi.mocked(db.getRefuelsByVehicle).mockResolvedValue(mockRefuels as never);

      const { result } = renderHook(() => useFuelInventory("test-vehicle-id"));
      await act(async () => await result.current.loadInventory());

      const avgAll = result.current.getWeightedAveragePrice();

      expect(avgAll).toBeCloseTo((20 * 5.0 + 30 * 6.0 + 50 * 3.5) / 100, 2);
    });

    it("should return 0 when no batches exist", async () => {
      vi.mocked(db.getRefuelsByVehicle).mockResolvedValue([]);

      const { result } = renderHook(() => useFuelInventory("test-vehicle-id"));
      await act(async () => await result.current.loadInventory());

      const avg = result.current.getWeightedAveragePrice();
      expect(avg).toBe(0);
    });
  });

  describe("getTotalLiters", () => {
    it("should return total remaining liters across all batches", async () => {
      const mockRefuels = [
        {
          id: "batch-1",
          timestamp: "2024-01-01T10:00:00Z",
          amount: 20,
          fuelPrice: 5.0,
          fuelType: "gasolina" as const,
          totalCost: 100,
          consumedAmount: 0,
        },
        {
          id: "batch-2",
          timestamp: "2024-01-02T10:00:00Z",
          amount: 30,
          fuelPrice: 6.0,
          fuelType: "gasolina" as const,
          totalCost: 180,
          consumedAmount: 0,
        },
      ];

      vi.mocked(db.getRefuelsByVehicle).mockResolvedValue(mockRefuels as never);

      const { result } = renderHook(() => useFuelInventory("test-vehicle-id"));
      await act(async () => await result.current.loadInventory());

      const total = result.current.getTotalLiters();
      expect(total).toBe(50);
    });

    it("should filter by fuel type when specified", async () => {
      const mockRefuels = [
        {
          id: "batch-1",
          timestamp: "2024-01-01T10:00:00Z",
          amount: 20,
          fuelPrice: 5.0,
          fuelType: "gasolina" as const,
          totalCost: 100,
          consumedAmount: 0,
        },
        {
          id: "batch-2",
          timestamp: "2024-01-02T10:00:00Z",
          amount: 30,
          fuelPrice: 3.5,
          fuelType: "etanol" as const,
          totalCost: 105,
        },
      ];

      vi.mocked(db.getRefuelsByVehicle).mockResolvedValue(mockRefuels as never);

      const { result } = renderHook(() => useFuelInventory("test-vehicle-id"));
      await act(async () => await result.current.loadInventory());

      const totalGasolina = result.current.getTotalLiters("gasolina");
      const totalEtanol = result.current.getTotalLiters("etanol");

      expect(totalGasolina).toBe(20);
      expect(totalEtanol).toBe(30);
    });
  });

  describe("addBatch", () => {
    it("should add refuel to DB and update local inventory", async () => {
      const mockRefuel = {
        id: "refuel-new",
        timestamp: "2024-01-03T10:00:00Z",
        amount: 25,
        fuelPrice: 5.5,
        fuelType: "gasolina" as const,
        totalCost: 137.5,
      };

      vi.mocked(db.getRefuelsByVehicle).mockResolvedValue([]);
      vi.mocked(db.addRefuel).mockResolvedValue(mockRefuel as never);

      const { result } = renderHook(() => useFuelInventory("test-vehicle-id"));
      await act(async () => await result.current.loadInventory());
      await act(async () => result.current.addBatch(25, 5.5, "gasolina"));

      expect(db.addRefuel).toHaveBeenCalledWith(
        25,
        5.5,
        "gasolina",
        "test-vehicle-id",
      );
    });
  });

  describe("deleteBatch", () => {
    it("should delete refuel from DB and remove from local inventory", async () => {
      const mockRefuels = [
        {
          id: "batch-1",
          timestamp: "2024-01-01T10:00:00Z",
          amount: 20,
          fuelPrice: 5.0,
          fuelType: "gasolina" as const,
          totalCost: 100,
          consumedAmount: 0,
        },
      ];

      vi.mocked(db.getRefuelsByVehicle).mockResolvedValue(mockRefuels as never);
      vi.mocked(db.deleteRefuel).mockResolvedValue(undefined);

      const { result } = renderHook(() => useFuelInventory("test-vehicle-id"));
      await act(async () => await result.current.loadInventory());

      expect(result.current.getInventory()).toHaveLength(1);

      await act(async () => result.current.deleteBatch("batch-1"));

      expect(db.deleteRefuel).toHaveBeenCalledWith("batch-1");
      expect(result.current.getInventory()).toHaveLength(0);
    });
  });
});
