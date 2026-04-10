import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Dexie, { type EntityTable } from "dexie";
import type { Trip, Refuel, Vehicle, Settings } from "@/types";

const TEST_DB_NAME = "CarTelemetryDB-Test";

class TestDatabase extends Dexie {
  trips!: EntityTable<Trip, "id">;
  currentTrip!: EntityTable<Trip, "id">;
  settings!: EntityTable<Settings, "id">;
  refuels!: EntityTable<Refuel, "id">;
  vehicles!: EntityTable<Vehicle, "id">;

  constructor() {
    super(TEST_DB_NAME);
    this.version(1).stores({
      trips: "id, startTime, endTime, status, vehicleId",
      currentTrip: "id, vehicleId",
      settings: "id",
      refuels: "id, timestamp, vehicleId",
      vehicles: "id, createdAt",
    });
  }
}

let testDb: TestDatabase;

const DEFAULT_SETTINGS: Settings = {
  id: "default",
  cityKmPerLiter: 8,
  highwayKmPerLiter: 12,
  mixedKmPerLiter: 10,
  manualCityKmPerLiter: 10,
  manualHighwayKmPerLiter: 14,
  manualMixedKmPerLiter: 12,
  fuelCapacity: 50,
  currentFuel: 0,
  fuelPrice: 5,
  engineDisplacement: 1000,
  fuelType: "gasolina",
};

const createVehicle = (overrides: Partial<Vehicle> = {}): Vehicle => ({
  id: "vehicle-1",
  name: "Honda Civic",
  make: "Honda",
  model: "Civic",
  year: 2020,
  displacement: 1500,
  fuelType: "flex",
  euroNorm: "Euro 6",
  segment: "medium",
  urbanKmpl: 11.5,
  highwayKmpl: 16.5,
  combinedKmpl: 13.5,
  mass: 1240,
  grossWeight: 1700,
  frontalArea: 2.2,
  dragCoefficient: 0.28,
  f0: 8.5,
  f1: 0.05,
  f2: 0.0015,
  fuelConversionFactor: 0.8,
  peakPowerKw: 118,
  peakTorqueNm: 145,
  confidence: "high",
  calibrationInput: "",
  calibratedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  fuelCapacity: 50,
  currentFuel: 0,
  inmetroCityKmpl: 11.5,
  inmetroHighwayKmpl: 16.5,
  userAvgCityKmpl: 10,
  userAvgHighwayKmpl: 14,
  crr: 0.013,
  idleLph: 0.9,
  baseBsfc: 265,
  weightInmetro: 0.6,
  weightUser: 0.4,
  isHybrid: false,
  gnvCylinderWeightKg: 80,
  gnvEfficiencyFactor: 1.32,
  ...overrides,
});

const createTrip = (overrides: Partial<Trip> = {}): Trip => ({
  id: `trip-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  vehicleId: "vehicle-1",
  startTime: new Date().toISOString(),
  endTime: new Date().toISOString(),
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
  totalFuelUsed: 10,
  ...overrides,
});

const createRefuel = (overrides: Partial<Refuel> = {}): Refuel => ({
  id: `refuel-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  vehicleId: "vehicle-1",
  timestamp: new Date().toISOString(),
  amount: 50,
  fuelPrice: 5,
  fuelType: "gasolina",
  totalCost: 250,
  consumedAmount: 0,
  ...overrides,
});

function calculateSummary(trips: Trip[], refuels: Refuel[]) {
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

describe("Integração: Vehicle + Trip + Refuel + Summary", () => {
  beforeEach(async () => {
    testDb = new TestDatabase();
    await testDb.open();
  });

  afterEach(async () => {
    try {
      await testDb.delete();
    } catch {
      // Ignore delete errors in test environment
    }
  });

  describe("Fluxo: Veículo → Trip → Resumo", () => {
    it("deve calcular resumo corretamente com trips e abastecimentos", async () => {
      await testDb.vehicles.put(createVehicle());
      await testDb.settings.put(DEFAULT_SETTINGS);

      await testDb.trips.put(
        createTrip({
          distanceMeters: 100000,
          fuelUsed: 100,
          actualCost: 500,
        }),
      );
      await testDb.trips.put(
        createTrip({
          distanceMeters: 50000,
          fuelUsed: 50,
          actualCost: 250,
        }),
      );

      await testDb.refuels.put(
        createRefuel({
          amount: 50,
          fuelPrice: 5,
          totalCost: 250,
        }),
      );
      await testDb.refuels.put(
        createRefuel({
          amount: 30,
          fuelPrice: 5.5,
          totalCost: 165,
        }),
      );

      const trips = await testDb.trips.toArray();
      const refuels = await testDb.refuels.toArray();

      const summary = calculateSummary(trips, refuels);

      expect(summary.totalTrips).toBe(2);
      expect(summary.totalDistance).toBe(150000);
      expect(summary.totalFuelUsed).toBe(150);
      expect(summary.totalRefuels).toBe(2);
      expect(summary.totalLitersRefueled).toBe(80);
      expect(summary.tripActualCost).toBe(750);
      expect(summary.refuelCost).toBe(415);
      expect(summary.avgKmPerLiter).toBe(1);
      expect(summary.costPerKm).toBe(5);
    });

    it("deve filtrar trips por período", async () => {
      await testDb.vehicles.put(createVehicle());

      const oldDate = new Date("2024-01-01");
      const newDate = new Date("2024-06-01");

      await testDb.trips.put(
        createTrip({
          startTime: oldDate.toISOString(),
          endTime: oldDate.toISOString(),
          distanceMeters: 10000,
          fuelUsed: 10,
          actualCost: 50,
        }),
      );
      await testDb.trips.put(
        createTrip({
          startTime: newDate.toISOString(),
          endTime: newDate.toISOString(),
          distanceMeters: 20000,
          fuelUsed: 20,
          actualCost: 100,
        }),
      );

      const startFilter = new Date("2024-03-01");
      const endFilter = new Date("2024-12-31");

      const trips = await testDb.trips
        .where("startTime")
        .between(startFilter.toISOString(), endFilter.toISOString())
        .toArray();

      const summary = calculateSummary(trips, []);

      expect(summary.totalTrips).toBe(1);
      expect(summary.totalDistance).toBe(20000);
    });

    it("deve filtrar abastecimentos por período", async () => {
      await testDb.vehicles.put(createVehicle());

      const oldDate = new Date("2024-01-01");
      const newDate = new Date("2024-06-01");

      await testDb.refuels.put(
        createRefuel({
          timestamp: oldDate.toISOString(),
          amount: 30,
          fuelPrice: 5,
          totalCost: 150,
        }),
      );
      await testDb.refuels.put(
        createRefuel({
          timestamp: newDate.toISOString(),
          amount: 50,
          fuelPrice: 5.5,
          totalCost: 275,
        }),
      );

      const startFilter = new Date("2024-03-01");
      const endFilter = new Date("2024-12-31");

      const refuels = await testDb.refuels
        .where("timestamp")
        .between(startFilter.toISOString(), endFilter.toISOString())
        .toArray();

      const summary = calculateSummary([], refuels);

      expect(summary.totalRefuels).toBe(1);
      expect(summary.totalLitersRefueled).toBe(50);
      expect(summary.refuelCost).toBe(275);
    });
  });

  describe("Consistência: Consumo vs Abastecimento", () => {
    it("deve detectar quando consumo é maior que abastecimento", async () => {
      await testDb.vehicles.put(createVehicle());

      await testDb.trips.put(
        createTrip({
          fuelUsed: 100,
          actualCost: 500,
        }),
      );
      await testDb.trips.put(
        createTrip({
          fuelUsed: 80,
          actualCost: 400,
        }),
      );

      await testDb.refuels.put(
        createRefuel({
          amount: 100,
          fuelPrice: 5,
          totalCost: 500,
        }),
      );

      const trips = await testDb.trips.toArray();
      const refuels = await testDb.refuels.toArray();

      const totalFuelUsed = trips.reduce(
        (acc, t) => acc + (t.fuelUsed || 0),
        0,
      );
      const totalLitersRefueled = refuels.reduce(
        (acc, r) => acc + (r.amount || 0),
        0,
      );

      expect(totalFuelUsed).toBe(180);
      expect(totalLitersRefueled).toBe(100);
      expect(totalFuelUsed).toBeGreaterThan(totalLitersRefueled);
    });

    it("deve calcular custo médio por km corretamente", async () => {
      await testDb.vehicles.put(createVehicle());

      const trips = [
        createTrip({ distanceMeters: 10000, actualCost: 50 }),
        createTrip({ distanceMeters: 20000, actualCost: 80 }),
        createTrip({ distanceMeters: 15000, actualCost: 70 }),
      ];

      for (const trip of trips) {
        await testDb.trips.put(trip);
      }

      const allTrips = await testDb.trips.toArray();
      const summary = calculateSummary(allTrips, []);

      const totalDistanceKm = (10000 + 20000 + 15000) / 1000;
      const totalCost = 50 + 80 + 70;

      expect(summary.costPerKm).toBeCloseTo(totalCost / totalDistanceKm, 2);
    });
  });

  describe("Múltiplos Veículos", () => {
    it("deve consolidar dados de todos os veículos quando não filtrado", async () => {
      await testDb.vehicles.put(
        createVehicle({ id: "vehicle-1", name: "Honda Civic" }),
      );
      await testDb.vehicles.put(
        createVehicle({
          id: "vehicle-2",
          name: "Ford Focus",
          inmetroCityKmpl: 10,
          inmetroHighwayKmpl: 14,
          userAvgCityKmpl: 9,
          userAvgHighwayKmpl: 13,
        }),
      );

      await testDb.trips.put(
        createTrip({
          vehicleId: "vehicle-1",
          distanceMeters: 100000,
          fuelUsed: 100,
          actualCost: 500,
        }),
      );
      await testDb.trips.put(
        createTrip({
          vehicleId: "vehicle-2",
          distanceMeters: 50000,
          fuelUsed: 50,
          actualCost: 250,
        }),
      );

      await testDb.refuels.put(
        createRefuel({ vehicleId: "vehicle-1", amount: 50, totalCost: 250 }),
      );
      await testDb.refuels.put(
        createRefuel({ vehicleId: "vehicle-2", amount: 30, totalCost: 150 }),
      );

      const trips = await testDb.trips.toArray();
      const refuels = await testDb.refuels.toArray();

      const summary = calculateSummary(trips, refuels);

      expect(summary.totalTrips).toBe(2);
      expect(summary.totalDistance).toBe(150000);
      expect(summary.totalFuelUsed).toBe(150);
      expect(summary.totalLitersRefueled).toBe(80);
    });

    it("deve filtrar dados por veículo específico", async () => {
      await testDb.vehicles.put(
        createVehicle({ id: "vehicle-1", name: "Honda Civic" }),
      );
      await testDb.vehicles.put(
        createVehicle({ id: "vehicle-2", name: "Ford Focus" }),
      );

      await testDb.trips.put(
        createTrip({
          vehicleId: "vehicle-1",
          distanceMeters: 100000,
          fuelUsed: 100,
          actualCost: 500,
        }),
      );
      await testDb.trips.put(
        createTrip({
          vehicleId: "vehicle-2",
          distanceMeters: 50000,
          fuelUsed: 50,
          actualCost: 250,
        }),
      );

      await testDb.refuels.put(
        createRefuel({ vehicleId: "vehicle-1", amount: 50, totalCost: 250 }),
      );
      await testDb.refuels.put(
        createRefuel({ vehicleId: "vehicle-2", amount: 30, totalCost: 150 }),
      );

      const trips = await testDb.trips
        .where("vehicleId")
        .equals("vehicle-1")
        .toArray();
      const refuels = await testDb.refuels
        .where("vehicleId")
        .equals("vehicle-1")
        .toArray();

      const summary = calculateSummary(trips, refuels);

      expect(summary.totalTrips).toBe(1);
      expect(summary.totalDistance).toBe(100000);
      expect(summary.totalFuelUsed).toBe(100);
      expect(summary.totalLitersRefueled).toBe(50);
    });
  });

  describe("Casos Edge", () => {
    it("deve retornar zeros quando não há dados", async () => {
      await testDb.vehicles.put(createVehicle());
      await testDb.settings.put(DEFAULT_SETTINGS);

      const trips = await testDb.trips.toArray();
      const refuels = await testDb.refuels.toArray();

      const summary = calculateSummary(trips, refuels);

      expect(summary.totalTrips).toBe(0);
      expect(summary.totalDistance).toBe(0);
      expect(summary.totalFuelUsed).toBe(0);
      expect(summary.totalRefuels).toBe(0);
      expect(summary.totalLitersRefueled).toBe(0);
      expect(summary.tripActualCost).toBe(0);
      expect(summary.refuelCost).toBe(0);
      expect(summary.avgKmPerLiter).toBe(0);
      expect(summary.costPerKm).toBe(0);
    });

    it("deve lidar com trip incompleto (status não completed)", async () => {
      await testDb.vehicles.put(createVehicle());

      await testDb.trips.put(
        createTrip({ status: "recording", distanceMeters: 5000 }),
      );
      await testDb.trips.put(
        createTrip({ status: "completed", distanceMeters: 10000 }),
      );

      const allTrips = await testDb.trips.toArray();
      const completedTrips = allTrips.filter((t) => t.status === "completed");

      const summary = calculateSummary(completedTrips, []);

      expect(summary.totalTrips).toBe(1);
      expect(summary.totalDistance).toBe(10000);
    });

    it("deve lidar com trip com dados inválidos/undefined", async () => {
      await testDb.vehicles.put(createVehicle());

      await testDb.trips.put({
        id: "trip-invalid",
        vehicleId: "vehicle-1",
        startTime: new Date().toISOString(),
        distanceMeters: undefined as never,
        maxSpeed: 0,
        avgSpeed: 0,
        path: [],
        status: "completed",
        driveMode: "city",
        consumption: 0,
        fuelCapacity: 50,
        fuelUsed: undefined as never,
        actualCost: undefined as never,
        elapsedTime: 0,
        totalFuelUsed: 0,
      });

      const trips = await testDb.trips.toArray();
      const summary = calculateSummary(trips, []);

      expect(summary.totalDistance).toBe(0);
      expect(summary.totalFuelUsed).toBe(0);
      expect(summary.tripActualCost).toBe(0);
    });
  });

  describe("Penalidades de Consumo", () => {
    it("deve calcular penalidades corretamente", async () => {
      await testDb.vehicles.put(createVehicle());

      await testDb.trips.put(
        createTrip({
          consumptionBreakdown: {
            speedPenaltyPct: 0,
            aggressionPenaltyPct: 0,
            idlePenaltyPct: 0,
            stabilityPenaltyPct: 0,
            totalPenaltyPct: 0,
            speedBonusPct: 0,
            accelerationBonusPct: 0,
            coastingBonusPct: 0,
            stabilityBonusPct: 0,
            idleBonusPct: 0,
            totalBonusPct: 0,
            isEcoDriving: false,
            baseFuelUsed: 10,
            extraFuelUsed: 2,
            savedFuel: 0,
            extraCost: 10,
            savedCost: 0,
          },
        }),
      );
      await testDb.trips.put(
        createTrip({
          consumptionBreakdown: {
            speedPenaltyPct: 0,
            aggressionPenaltyPct: 0,
            idlePenaltyPct: 0,
            stabilityPenaltyPct: 0,
            totalPenaltyPct: 0,
            speedBonusPct: 0,
            accelerationBonusPct: 0,
            coastingBonusPct: 0,
            stabilityBonusPct: 0,
            idleBonusPct: 0,
            totalBonusPct: 0,
            isEcoDriving: true,
            baseFuelUsed: 10,
            extraFuelUsed: 0,
            savedFuel: 1,
            extraCost: 0,
            savedCost: 5,
          },
        }),
      );

      const trips = await testDb.trips.toArray();
      const summary = calculateSummary(trips, []);

      expect(summary.totalPenalty).toBe(10);
      expect(summary.avgPenalty).toBe(10);
    });
  });
});
