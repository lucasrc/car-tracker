import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addRefuel,
  getRefuels,
  getRefuelsInPeriod,
  getRefuelsByVehicle,
  deleteRefuel,
  updateRefuelConsumed,
} from "@/lib/db";

vi.mock("@/lib/db", () => ({
  addRefuel: vi.fn(
    (amount, fuelPrice, fuelType = "gasolina", vehicleId = "test-vehicle") =>
      Promise.resolve({
        id: "test-id",
        vehicleId,
        amount,
        fuelPrice,
        fuelType,
        totalCost: amount * fuelPrice,
        timestamp: new Date().toISOString(),
        consumedAmount: 0,
      }),
  ),
  getRefuels: vi.fn(() => Promise.resolve([])),
  getRefuelsInPeriod: vi.fn(() => Promise.resolve([])),
  getRefuelsByVehicle: vi.fn(() => Promise.resolve([])),
  deleteRefuel: vi.fn(() => Promise.resolve()),
  updateRefuelConsumed: vi.fn(() => Promise.resolve()),
}));

describe("db - refuel operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("addRefuel", () => {
    it("should create refuel with fuelType", async () => {
      const result = await addRefuel(30, 5.5, "gasolina", "test-vehicle");

      expect(result).toMatchObject({
        amount: 30,
        fuelPrice: 5.5,
        fuelType: "gasolina",
        totalCost: 30 * 5.5,
      });
      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it("should default fuelType to gasoline when not specified", async () => {
      const result = await addRefuel(20, 5.0, "gasolina", "test-vehicle");

      expect(result.fuelType).toBe("gasolina");
    });

    it("should calculate totalCost correctly", async () => {
      const result = await addRefuel(25, 4.8, "etanol", "test-vehicle");

      expect(result.totalCost).toBe(25 * 4.8);
    });
  });

  describe("getRefuels", () => {
    it("should return refuels in reverse chronological order", async () => {
      await getRefuels();

      expect(getRefuels).toHaveBeenCalled();
    });

    it("should filter by date range when provided", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-12-31");

      await getRefuels(startDate, endDate);

      expect(getRefuels).toHaveBeenCalledWith(startDate, endDate);
    });
  });

  describe("getRefuelsInPeriod", () => {
    it("should query refuels between dates", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-06-30");

      await getRefuelsInPeriod(startDate, endDate);

      expect(getRefuelsInPeriod).toHaveBeenCalledWith(startDate, endDate);
    });
  });

  describe("deleteRefuel", () => {
    it("should delete refuel by id", async () => {
      await deleteRefuel("refuel-123");

      expect(deleteRefuel).toHaveBeenCalledWith("refuel-123");
    });
  });

  describe("getRefuelsByVehicle", () => {
    it("should return refuels for specific vehicle", async () => {
      const vehicleId = "vehicle-123";
      await getRefuelsByVehicle(vehicleId);

      expect(getRefuelsByVehicle).toHaveBeenCalledWith(vehicleId);
    });

    it("should filter by vehicleId and date range", async () => {
      const vehicleId = "vehicle-123";
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-06-30");

      await getRefuelsByVehicle(vehicleId, startDate, endDate);

      expect(getRefuelsByVehicle).toHaveBeenCalledWith(
        vehicleId,
        startDate,
        endDate,
      );
    });

    it("should return empty array for vehicle with no refuels", async () => {
      const result = await getRefuelsByVehicle("non-existent-vehicle");

      expect(result).toEqual([]);
    });
  });

  describe("updateRefuelConsumed", () => {
    it("should update consumedAmount for a refuel", async () => {
      await updateRefuelConsumed("refuel-123", 15.5);

      expect(updateRefuelConsumed).toHaveBeenCalledWith("refuel-123", 15.5);
    });

    it("should allow setting consumedAmount to zero", async () => {
      await updateRefuelConsumed("refuel-123", 0);

      expect(updateRefuelConsumed).toHaveBeenCalledWith("refuel-123", 0);
    });
  });
});
