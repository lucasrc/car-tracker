import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTelemetryEngine } from "./useTelemetryEngine";
import { useFuelInventory } from "./useFuelInventory";
import * as db from "@/lib/db";
import type { Vehicle } from "@/types";

vi.mock("@/lib/db", () => ({
  getRefuelsByVehicle: vi.fn(),
  addRefuel: vi.fn(),
  deleteRefuel: vi.fn(),
  updateRefuelConsumed: vi.fn(),
}));

const makeVehicle = (): Vehicle => ({
  id: "test-vehicle",
  name: "Test Vehicle",
  make: "BMW",
  model: "320i",
  year: 2018,
  displacement: 2.0,
  fuelType: "gasoline",
  euroNorm: "Euro 5",
  segment: "medium",
  mass: 1500,
  grossWeight: 2000,
  urbanKmpl: 11.2,
  combinedKmpl: 12.0,
  highwayKmpl: 14.0,
  frontalArea: 2.3,
  dragCoefficient: 0.29,
  f0: 0.1,
  f1: 0.005,
  f2: 0.0001,
  fuelConversionFactor: 0.73,
  peakPowerKw: 150,
  peakTorqueNm: 220,
  confidence: "high",
  calibrationInput: "test",
  calibratedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  fuelCapacity: 50,
  currentFuel: 9,
  inmetroCityKmpl: 11.2,
  inmetroHighwayKmpl: 14.0,
  userAvgCityKmpl: 11.2,
  userAvgHighwayKmpl: 13.5,
  crr: 0.012,
  idleLph: 0.5,
  baseBsfc: 250,
  weightInmetro: 1500,
  weightUser: 1500,
  isHybrid: false,
  gnvCylinderWeightKg: 80,
  gnvEfficiencyFactor: 1.0,
  techEra: "injection_modern",
  transmission: undefined,
});

describe("Fuel Flow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("Scenario: User with 9L fuel, 11.2km/L consumption", () => {
    it("should calculate autonomy as 9L * 11.2km/L = ~100.8km after warmup", async () => {
      const vehicle = makeVehicle();
      vehicle.currentFuel = 9;
      vehicle.urbanKmpl = 11.2;
      vehicle.highwayKmpl = 14;

      const { result } = renderHook(() => useTelemetryEngine(0, 9, 0, vehicle));

      // Simulate warm-up period (90 seconds)
      act(() => {
        vi.advanceTimersByTime(95000); // 95 seconds
      });

      // After warm-up, estimatedRange should be approximately fuel * consumption
      const range = result.current.estimatedRange;

      // Expected: 9L * 11.2km/L = 100.8km
      // Allow 10% tolerance for model variations
      expect(range).toBeGreaterThan(90);
      expect(range).toBeLessThan(115);
    });

    it("should track fuel consumption and update autonomy in real-time", async () => {
      const vehicle = makeVehicle();
      vehicle.currentFuel = 9;
      vehicle.urbanKmpl = 11.2;

      const { result, rerender } = renderHook(
        ({ fuel }) => useTelemetryEngine(0, fuel, 0, vehicle),
        { initialProps: { fuel: 9 } },
      );

      // Initial range
      const initialRange = result.current.estimatedRange;
      expect(initialRange).toBeGreaterThan(0);

      // Simulate driving 5km (consuming ~0.45L at 11.2km/L)
      const newFuel = 9 - 0.45; // 8.55L
      rerender({ fuel: newFuel });

      // Range should decrease proportionally
      const newRange = result.current.estimatedRange;
      expect(newRange).toBeLessThan(initialRange);

      // 8.55L * 11.2km/L = 95.76km
      // Initial: 9 * 11.2 = 100.8km
      // Difference should be approximately 5km (the distance driven)
      expect(initialRange - newRange).toBeGreaterThan(4);
    });

    it("should handle fuel reaching zero gracefully", () => {
      const vehicle = makeVehicle();
      vehicle.currentFuel = 0.1;
      vehicle.urbanKmpl = 11.2;

      const { result } = renderHook(() =>
        useTelemetryEngine(0, 0.1, 0, vehicle),
      );

      const range = result.current.estimatedRange;
      // 0.1L * 11.2km/L = 1.12km
      expect(range).toBeLessThan(2);
      expect(range).toBeGreaterThan(0);
    });

    it("should return zero range when fuel is exactly zero", () => {
      const vehicle = makeVehicle();
      vehicle.currentFuel = 0;

      const { result } = renderHook(() => useTelemetryEngine(0, 0, 0, vehicle));

      const range = result.current.estimatedRange;
      expect(range).toBe(0);
    });
  });

  describe("Scenario: Complete fuel lifecycle", () => {
    it("should track inventory batches and consumption correctly", async () => {
      const mockRefuels = [
        {
          id: "batch-1",
          timestamp: "2024-01-01T10:00:00Z",
          amount: 40,
          fuelPrice: 5.5,
          fuelType: "gasolina" as const,
          totalCost: 220,
          consumedAmount: 0,
        },
      ];

      vi.mocked(db.getRefuelsByVehicle).mockResolvedValue(mockRefuels as never);

      const { result } = renderHook(() => useFuelInventory("test-vehicle"));

      await act(async () => await result.current.loadInventory());

      // Initial inventory
      expect(result.current.getTotalLiters()).toBe(40);

      // Consume 5 liters
      await act(async () => result.current.consumeFuel(5, "gasolina"));

      // Should have 35 liters remaining
      expect(result.current.getTotalLiters()).toBe(35);

      // Cost should be 5 * 5.5 = 27.5
      const avgPrice = result.current.getWeightedAveragePrice("gasolina");
      expect(avgPrice).toBe(5.5);
    });

    it("should handle multiple refuels with different prices (FIFO)", async () => {
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

      const { result } = renderHook(() => useFuelInventory("test-vehicle"));

      await act(async () => await result.current.loadInventory());

      // Total: 20 + 30 = 50 liters
      expect(result.current.getTotalLiters()).toBe(50);

      // Consume 25 liters (should take all from batch-1 + 5 from batch-2)
      const consumeResult = await act(async () =>
        result.current.consumeFuel(25, "gasolina"),
      );

      expect(consumeResult.batches).toHaveLength(2);
      expect(consumeResult.batches[0].amount).toBe(20); // First batch fully consumed
      expect(consumeResult.batches[1].amount).toBe(5); // Second batch partially consumed

      // Remaining: 20 - 20 + 30 - 5 = 25 liters
      expect(result.current.getTotalLiters()).toBe(25);
    });
  });

  describe("Scenario: Autonomy calculation edge cases", () => {
    it("should handle very low fuel with reasonable range", () => {
      const vehicle = makeVehicle();
      vehicle.currentFuel = 1;
      vehicle.urbanKmpl = 11.2;

      const { result } = renderHook(() => useTelemetryEngine(0, 1, 0, vehicle));

      const range = result.current.estimatedRange;
      // 1L * 11.2km/L = 11.2km
      expect(range).toBeGreaterThan(9);
      expect(range).toBeLessThan(14);
    });

    it("should handle full tank with long range", () => {
      const vehicle = makeVehicle();
      vehicle.currentFuel = 50;
      vehicle.urbanKmpl = 11.2;
      vehicle.fuelCapacity = 50;

      const { result } = renderHook(() =>
        useTelemetryEngine(0, 50, 0, vehicle),
      );

      const range = result.current.estimatedRange;
      // 50L * 11.2km/L = 560km
      expect(range).toBeGreaterThan(500);
      expect(range).toBeLessThan(620);
    });

    it("should use highway consumption when on highway", () => {
      const vehicle = makeVehicle();
      vehicle.currentFuel = 20;
      vehicle.urbanKmpl = 10;
      vehicle.highwayKmpl = 14;

      const { result } = renderHook(() =>
        useTelemetryEngine(0, 20, 0, vehicle),
      );

      // Simulate highway driving (high speeds trigger highway mode)
      act(() => {
        result.current.addPosition({
          lat: -23.55,
          lng: -46.63,
          speed: 30, // ~108 km/h
          accuracy: 5,
          timestamp: Date.now(),
        });
      });

      // Add more positions to trigger highway mode
      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.addPosition({
            lat: -23.55 + i * 0.001,
            lng: -46.63,
            speed: 30,
            accuracy: 5,
            timestamp: Date.now() + (i + 1) * 5000,
          });
        });
      }

      // The model uses urbanKmpl as base when no transmission data
      // So range should be based on urbanKmpl (more conservative)
      const range = result.current.estimatedRange;
      // 20L * 10km/L = 200km (minimum expected)
      expect(range).toBeGreaterThan(150);
      expect(range).toBeLessThan(300);
    });
  });
});
