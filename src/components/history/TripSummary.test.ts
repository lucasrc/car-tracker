import { describe, it, expect } from "vitest";
import type { Trip, Refuel } from "@/types";

interface SummaryData {
  totalTrips: number;
  totalDistance: number;
  totalFuelUsed: number;
  totalRefuels: number;
  totalLitersRefueled: number;
  tripActualCost: number;
  refuelCost: number;
  avgKmPerLiter: number;
  costPerKm: number;
  avgCostPerTrip: number;
  avgPenalty: number;
  totalPenalty: number;
}

function calculateSummary(trips: Trip[], refuels: Refuel[]): SummaryData {
  const totalDistance = trips.reduce(
    (acc, t) => acc + (t.distanceMeters || 0),
    0,
  );
  const totalFuelUsed = trips.reduce((acc, t) => acc + (t.fuelUsed || 0), 0);
  const totalLitersRefueled = refuels.reduce(
    (acc, r) => acc + (r.amount || 0),
    0,
  );
  const tripActualCost = trips.reduce((acc, t) => acc + (t.actualCost || 0), 0);
  const refuelCost = refuels.reduce((acc, r) => acc + (r.totalCost || 0), 0);
  const totalDistanceKm = totalDistance / 1000;
  const avgKmPerLiter =
    totalFuelUsed > 0 && totalDistanceKm > 0
      ? totalDistanceKm / totalFuelUsed
      : 0;
  const costPerKm = totalDistanceKm > 0 ? tripActualCost / totalDistanceKm : 0;
  const avgCostPerTrip = trips.length > 0 ? tripActualCost / trips.length : 0;

  const tripsWithPenalty = trips.filter(
    (t) =>
      t.consumptionBreakdown &&
      typeof t.consumptionBreakdown.extraCost === "number" &&
      t.consumptionBreakdown.extraCost > 0,
  );
  const totalPenalty = tripsWithPenalty.reduce(
    (acc, t) => acc + (t.consumptionBreakdown?.extraCost || 0),
    0,
  );
  const avgPenalty =
    tripsWithPenalty.length > 0 ? totalPenalty / tripsWithPenalty.length : 0;

  return {
    totalTrips: trips.length,
    totalDistance,
    totalFuelUsed,
    totalRefuels: refuels.length,
    totalLitersRefueled,
    tripActualCost,
    refuelCost,
    avgKmPerLiter,
    costPerKm,
    avgCostPerTrip,
    avgPenalty,
    totalPenalty,
  };
}

describe("TripSummary - calculateSummary", () => {
  const createTrip = (overrides: Partial<Trip> = {}): Trip => ({
    id: "trip-1",
    vehicleId: "vehicle-1",
    startTime: new Date().toISOString(),
    distanceMeters: 10000,
    maxSpeed: 80,
    avgSpeed: 50,
    path: [],
    status: "completed",
    driveMode: "city",
    consumption: 10,
    fuelCapacity: 50,
    fuelUsed: 10,
    actualCost: 50,
    fuelPrice: 5,
    elapsedTime: 3600,
    movingTime: 3000,
    stopTime: 600,
    totalFuelUsed: 10,
    ...overrides,
  });

  const createRefuel = (overrides: Partial<Refuel> = {}): Refuel => ({
    id: "refuel-1",
    vehicleId: "vehicle-1",
    timestamp: new Date().toISOString(),
    amount: 50,
    fuelPrice: 5,
    fuelType: "gasolina",
    totalCost: 250,
    consumedAmount: 0,
    ...overrides,
  });

  describe("dados básicos", () => {
    it("deve calcular totais corretamente com dados válidos", () => {
      const trips = [
        createTrip({ distanceMeters: 10000, fuelUsed: 10, actualCost: 50 }),
      ];
      const refuels = [createRefuel({ amount: 50, totalCost: 250 })];

      const summary = calculateSummary(trips, refuels);

      expect(summary.totalTrips).toBe(1);
      expect(summary.totalDistance).toBe(10000);
      expect(summary.totalFuelUsed).toBe(10);
      expect(summary.totalRefuels).toBe(1);
      expect(summary.totalLitersRefueled).toBe(50);
      expect(summary.tripActualCost).toBe(50);
      expect(summary.refuelCost).toBe(250);
    });

    it("deve retornar zeros com arrays vazios", () => {
      const summary = calculateSummary([], []);

      expect(summary.totalTrips).toBe(0);
      expect(summary.totalDistance).toBe(0);
      expect(summary.totalFuelUsed).toBe(0);
      expect(summary.totalRefuels).toBe(0);
      expect(summary.totalLitersRefueled).toBe(0);
      expect(summary.tripActualCost).toBe(0);
      expect(summary.refuelCost).toBe(0);
    });
  });

  describe("tratamento de undefined/null", () => {
    it("deve tratar trip sem fuelUsed como 0", () => {
      const trips = [createTrip({ fuelUsed: undefined })];
      const summary = calculateSummary(trips, []);

      expect(summary.totalFuelUsed).toBe(0);
      expect(summary.avgKmPerLiter).toBe(0);
    });

    it("deve tratar trip sem actualCost como 0", () => {
      const trips = [createTrip({ actualCost: undefined })];
      const summary = calculateSummary(trips, []);

      expect(summary.tripActualCost).toBe(0);
      expect(summary.costPerKm).toBe(0);
      expect(summary.avgCostPerTrip).toBe(0);
    });

    it("deve tratar trip sem distanceMeters como 0", () => {
      const trips = [createTrip({ distanceMeters: undefined })];
      const summary = calculateSummary(trips, []);

      expect(summary.totalDistance).toBe(0);
      expect(summary.avgKmPerLiter).toBe(0);
      expect(summary.costPerKm).toBe(0);
    });

    it("deve tratar refuel sem amount como 0", () => {
      const refuels = [createRefuel({ amount: undefined })];
      const summary = calculateSummary([], refuels);

      expect(summary.totalLitersRefueled).toBe(0);
    });

    it("deve tratar refuel sem totalCost como 0", () => {
      const refuels = [createRefuel({ totalCost: undefined })];
      const summary = calculateSummary([], refuels);

      expect(summary.refuelCost).toBe(0);
    });

    it("deve tratar trip com valores null como 0", () => {
      const trips = [
        createTrip({
          distanceMeters: null as unknown as undefined,
          fuelUsed: null as unknown as undefined,
          actualCost: null as unknown as undefined,
        }),
      ];
      const summary = calculateSummary(trips, []);

      expect(summary.totalDistance).toBe(0);
      expect(summary.totalFuelUsed).toBe(0);
      expect(summary.tripActualCost).toBe(0);
    });
  });

  describe("cálculos de média", () => {
    it("deve calcular avgKmPerLiter corretamente", () => {
      const trips = [createTrip({ distanceMeters: 100000, fuelUsed: 100 })];
      const summary = calculateSummary(trips, []);

      expect(summary.avgKmPerLiter).toBe(1);
    });

    it("deve retornar 0 para avgKmPerLiter quando fuelUsed é 0", () => {
      const trips = [createTrip({ distanceMeters: 10000, fuelUsed: 0 })];
      const summary = calculateSummary(trips, []);

      expect(summary.avgKmPerLiter).toBe(0);
    });

    it("deve calcular costPerKm corretamente", () => {
      const trips = [createTrip({ distanceMeters: 10000, actualCost: 10 })];
      const summary = calculateSummary(trips, []);

      expect(summary.costPerKm).toBe(1);
    });

    it("deve retornar 0 para costPerKm quando distance é 0", () => {
      const trips = [createTrip({ distanceMeters: 0, actualCost: 10 })];
      const summary = calculateSummary(trips, []);

      expect(summary.costPerKm).toBe(0);
    });

    it("deve calcular avgCostPerTrip corretamente", () => {
      const trips = [
        createTrip({ actualCost: 50 }),
        createTrip({ actualCost: 100 }),
      ];
      const summary = calculateSummary(trips, []);

      expect(summary.avgCostPerTrip).toBe(75);
    });

    it("deve retornar 0 para avgCostPerTrip sem trips", () => {
      const summary = calculateSummary([], []);

      expect(summary.avgCostPerTrip).toBe(0);
    });
  });

  describe("cálculos de penalidades", () => {
    it("deve calcular totalPenalty corretamente", () => {
      const trips = [
        createTrip({ consumptionBreakdown: { extraCost: 10 } as never }),
        createTrip({ consumptionBreakdown: { extraCost: 20 } as never }),
      ];
      const summary = calculateSummary(trips, []);

      expect(summary.totalPenalty).toBe(30);
      expect(summary.avgPenalty).toBe(15);
    });

    it("deve retornar 0 para penalidades sem trips com breakdown", () => {
      const trips = [createTrip()];
      const summary = calculateSummary(trips, []);

      expect(summary.totalPenalty).toBe(0);
      expect(summary.avgPenalty).toBe(0);
    });

    it("deve ignorar trips com extraCost undefined", () => {
      const trips = [
        createTrip({ consumptionBreakdown: { extraCost: undefined } as never }),
        createTrip({ consumptionBreakdown: { extraCost: 10 } as never }),
      ];
      const summary = calculateSummary(trips, []);

      expect(summary.totalPenalty).toBe(10);
    });

    it("deve ignorar trips com extraCost = 0", () => {
      const trips = [
        createTrip({ consumptionBreakdown: { extraCost: 0 } as never }),
        createTrip({ consumptionBreakdown: { extraCost: 10 } as never }),
      ];
      const summary = calculateSummary(trips, []);

      expect(summary.totalPenalty).toBe(10);
    });
  });

  describe("múltiplos items", () => {
    it("deve agregar múltiplos trips corretamente", () => {
      const trips = [
        createTrip({ distanceMeters: 10000, fuelUsed: 10, actualCost: 50 }),
        createTrip({ distanceMeters: 20000, fuelUsed: 20, actualCost: 100 }),
        createTrip({ distanceMeters: 15000, fuelUsed: 15, actualCost: 75 }),
      ];
      const summary = calculateSummary(trips, []);

      expect(summary.totalTrips).toBe(3);
      expect(summary.totalDistance).toBe(45000);
      expect(summary.totalFuelUsed).toBe(45);
      expect(summary.tripActualCost).toBe(225);
    });

    it("deve agregar múltiplos refuels corretamente", () => {
      const refuels = [
        createRefuel({ amount: 50, totalCost: 250 }),
        createRefuel({ amount: 30, totalCost: 150 }),
        createRefuel({ amount: 20, totalCost: 100 }),
      ];
      const summary = calculateSummary([], refuels);

      expect(summary.totalRefuels).toBe(3);
      expect(summary.totalLitersRefueled).toBe(100);
      expect(summary.refuelCost).toBe(500);
    });
  });

  describe("edge cases", () => {
    it("deve handle trip com dados zerados mas válidos", () => {
      const trips = [
        createTrip({ distanceMeters: 0, fuelUsed: 0, actualCost: 0 }),
      ];
      const summary = calculateSummary(trips, []);

      expect(summary.totalDistance).toBe(0);
      expect(summary.totalFuelUsed).toBe(0);
      expect(summary.tripActualCost).toBe(0);
      expect(summary.avgKmPerLiter).toBe(0);
      expect(summary.costPerKm).toBe(0);
    });

    it("deve handle trip com campos faltando completamente", () => {
      const trips = [
        {
          ...createTrip(),
          fuelUsed: 0,
          actualCost: 0,
          distanceMeters: 0,
        },
      ];
      const summary = calculateSummary(trips, []);

      expect(summary.totalFuelUsed).toBe(0);
      expect(summary.tripActualCost).toBe(0);
      expect(summary.totalDistance).toBe(0);
    });
  });
});
