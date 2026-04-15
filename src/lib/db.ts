import Dexie, { type EntityTable } from "dexie";
import type {
  Trip,
  Settings,
  Refuel,
  FuelType,
  Vehicle,
  InclinationCalibration,
  FuelConsumptionEvent,
} from "@/types";
import { generateId } from "@/lib/utils";

const LEGACY_CALIBRATION_KEY = "copert-calibration";
const LEGACY_INCLINATION_KEY = "inclination-calibration";

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
  fuelPrice: 0,
  engineDisplacement: 1000,
  fuelType: "gasolina",
};

const db = new Dexie("CarTelemetryDB") as Dexie & {
  trips: EntityTable<Trip, "id">;
  currentTrip: EntityTable<Trip, "id">;
  settings: EntityTable<Settings, "id">;
  refuels: EntityTable<Refuel, "id">;
  vehicles: EntityTable<Vehicle, "id">;
  inclinationCalibrations: EntityTable<InclinationCalibration, "vehicleId">;
  fuelEvents: EntityTable<FuelConsumptionEvent, "id">;
};

db.version(4)
  .stores({
    trips: "id, startTime, endTime, status",
    currentTrip: "id",
    settings: "id",
  })
  .upgrade((tx) => {
    return tx.table("settings").put(DEFAULT_SETTINGS);
  });

db.version(5).stores({
  trips: "id, startTime, endTime, status",
  currentTrip: "id",
  settings: "id",
  refuels: "id, timestamp",
});

db.version(6)
  .stores({
    trips: "id, startTime, endTime, status",
    currentTrip: "id",
    settings: "id",
    refuels: "id, timestamp",
  })
  .upgrade((tx) => {
    return tx
      .table("settings")
      .toCollection()
      .modify((s) => {
        if (typeof s.engineDisplacement === "undefined") {
          s.engineDisplacement = 1000;
        }
        if (typeof s.fuelType === "undefined") {
          s.fuelType = "gasolina";
        }
      });
  });

db.version(7)
  .stores({
    trips: "id, startTime, endTime, status",
    currentTrip: "id",
    settings: "id",
    refuels: "id, timestamp",
  })
  .upgrade((tx) => {
    return tx
      .table("refuels")
      .toCollection()
      .modify((r) => {
        if (typeof r.fuelType === "undefined") {
          r.fuelType = "gasolina";
        }
      });
  });

db.version(8)
  .stores({
    trips: "id, startTime, endTime, status",
    currentTrip: "id",
    settings: "id",
    refuels: "id, timestamp",
  })
  .upgrade((tx) => {
    return tx
      .table("refuels")
      .toCollection()
      .modify((r) => {
        if (typeof r.consumedAmount === "undefined") {
          r.consumedAmount = 0;
        }
      });
  });

db.version(9).stores({
  trips: "id, startTime, endTime, status",
  currentTrip: "id",
  settings: "id",
  refuels: "id, timestamp",
  vehicles: "id, createdAt",
  inclinationCalibrations: "vehicleId",
});

db.version(10)
  .stores({
    trips: "id, startTime, endTime, status, vehicleId",
    currentTrip: "id, vehicleId",
    settings: "id",
    refuels: "id, timestamp",
    vehicles: "id, createdAt",
    inclinationCalibrations: "vehicleId",
  })
  .upgrade((tx) => {
    return tx
      .table("trips")
      .toCollection()
      .modify((t) => {
        if (typeof t.vehicleId === "undefined") {
          t.vehicleId = "";
        }
      });
  });

db.version(11)
  .stores({
    trips: "id, startTime, endTime, status, vehicleId",
    currentTrip: "id, vehicleId",
    settings: "id",
    refuels: "id, timestamp, vehicleId",
    vehicles: "id, createdAt",
    inclinationCalibrations: "vehicleId",
  })
  .upgrade(async (tx) => {
    const settings = await tx.table("settings").get("default");
    const activeVehicleId = settings?.activeVehicleId || "";

    await tx
      .table("refuels")
      .toCollection()
      .modify((r) => {
        if (typeof r.vehicleId === "undefined") {
          r.vehicleId = activeVehicleId;
        }
      });

    await tx
      .table("vehicles")
      .toCollection()
      .modify((v) => {
        if (typeof v.fuelCapacity === "undefined") {
          v.fuelCapacity = settings?.fuelCapacity || 50;
        }
        if (typeof v.currentFuel === "undefined") {
          v.currentFuel = 0;
        }
      });
  });

db.version(12)
  .stores({
    trips: "id, startTime, endTime, status, vehicleId",
    currentTrip: "id, vehicleId",
    settings: "id",
    refuels: "id, timestamp, vehicleId",
    vehicles: "id, createdAt",
    inclinationCalibrations: "vehicleId",
  })
  .upgrade(async (_tx) => {
    await _tx
      .table("vehicles")
      .toCollection()
      .modify((v) => {
        if (typeof v.weightInmetro === "undefined") {
          v.weightInmetro = 0.6;
        }
        if (typeof v.weightUser === "undefined") {
          v.weightUser = 0.4;
        }
        if (typeof v.isHybrid === "undefined") {
          v.isHybrid = false;
        }
        if (typeof v.gnvCylinderWeightKg === "undefined") {
          v.gnvCylinderWeightKg = 80;
        }
        if (typeof v.gnvEfficiencyFactor === "undefined") {
          v.gnvEfficiencyFactor = 1.32;
        }
        if (typeof v.inmetroGnvCityKmpl === "undefined") {
          v.inmetroGnvCityKmpl = v.inmetroCityKmpl;
        }
        if (typeof v.inmetroGnvHighwayKmpl === "undefined") {
          v.inmetroGnvHighwayKmpl = v.inmetroHighwayKmpl;
        }
        if (typeof v.userAvgGnvCityKmpl === "undefined") {
          v.userAvgGnvCityKmpl = v.userAvgCityKmpl;
        }
        if (typeof v.userAvgGnvHighwayKmpl === "undefined") {
          v.userAvgGnvHighwayKmpl = v.userAvgHighwayKmpl;
        }
      });
  });

db.version(13).stores({
  trips: "id, startTime, endTime, status, vehicleId",
  currentTrip: "id, vehicleId",
  settings: "id",
  refuels: "id, timestamp, vehicleId",
  vehicles: "id, createdAt",
  inclinationCalibrations: "vehicleId",
  fuelEvents: "id, tripId, timestamp",
});

db.version(14)
  .stores({
    trips: "id, startTime, endTime, status, vehicleId",
    currentTrip: "id, vehicleId",
    settings: "id",
    refuels: "id, timestamp, vehicleId",
    vehicles: "id, createdAt",
    inclinationCalibrations: "vehicleId",
    fuelEvents: "id, tripId, timestamp",
  })
  .upgrade(async (tx) => {
    const settings = await tx.table("settings").get("default");
    const activeVehicleId = settings?.activeVehicleId;

    if (activeVehicleId) {
      const vehicle = await tx.table("vehicles").get(activeVehicleId);
      if (vehicle) {
        const fuelCapacity = settings?.fuelCapacity || 50;
        const currentFuel = settings?.currentFuel || 0;
        await tx.table("vehicles").update(activeVehicleId, {
          fuelCapacity,
          currentFuel: Math.min(currentFuel, fuelCapacity),
        });
      }
    }

    await tx
      .table("vehicles")
      .toCollection()
      .modify((v) => {
        if (typeof v.fuelCapacity === "undefined") {
          v.fuelCapacity = 50;
        }
        if (typeof v.currentFuel === "undefined") {
          v.currentFuel = 0;
        }
        if (v.currentFuel > v.fuelCapacity) {
          v.currentFuel = v.fuelCapacity;
        }
        if (v.currentFuel < 0) {
          v.currentFuel = 0;
        }
      });
  });

export async function getSettings(): Promise<Settings> {
  try {
    const settings = await db.settings.get("default");

    if (!settings) {
      await db.settings.put(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }

    const s = settings as unknown as Partial<Settings>;
    if (typeof s.currentFuel === "undefined") {
      const fuelCapacity = s.fuelCapacity || 50;
      const updated = {
        ...DEFAULT_SETTINGS,
        ...s,
        currentFuel: 0,
        fuelCapacity,
      } as Settings;
      await db.settings.put(updated);
      return updated;
    }
    if (typeof s.mixedKmPerLiter === "undefined") {
      const city = s.cityKmPerLiter || 8;
      const highway = s.highwayKmPerLiter || 12;
      const updated = {
        ...settings,
        mixedKmPerLiter: (city + highway) / 2,
      } as Settings;
      await db.settings.put(updated);
      return updated;
    }
    if (typeof s.manualCityKmPerLiter === "undefined") {
      const updated = {
        ...settings,
        manualCityKmPerLiter: s.cityKmPerLiter || 10,
        manualHighwayKmPerLiter: s.highwayKmPerLiter || 14,
        manualMixedKmPerLiter: s.mixedKmPerLiter || 12,
      } as Settings;
      await db.settings.put(updated);
      return updated;
    }
    if (typeof s.engineDisplacement === "undefined") {
      const updated = {
        ...settings,
        engineDisplacement: 1000,
        fuelType: "gasolina" as const,
      } as Settings;
      await db.settings.put(updated);
      return updated;
    }
    if (typeof s.fuelType === "undefined") {
      const updated = {
        ...settings,
        fuelType: "gasolina" as const,
      } as Settings;
      await db.settings.put(updated);
      return updated;
    }
    return settings as Settings;
  } catch (err) {
    console.error("getSettings error:", err);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await db.settings.put(settings);
}

export async function refuel(amount: number): Promise<Settings> {
  if (amount < 0) {
    throw new Error("refuel: amount cannot be negative");
  }
  const settings = await getSettings();

  const newFuel = Math.min(
    settings.currentFuel + amount,
    settings.fuelCapacity,
  );

  const updated = { ...settings, currentFuel: newFuel };
  await saveSettings(updated);
  return updated;
}

export async function consumeFuel(liters: number): Promise<Settings> {
  if (liters < 0) {
    throw new Error("consumeFuel: liters cannot be negative");
  }
  const settings = await getSettings();
  const newFuel = Math.max(settings.currentFuel - liters, 0);
  const cappedFuel = Math.min(newFuel, settings.fuelCapacity);
  const updated = { ...settings, currentFuel: cappedFuel };
  await saveSettings(updated);
  return updated;
}

export async function saveCurrentTrip(trip: Trip): Promise<void> {
  await db.currentTrip.put(trip);
}

export async function getCurrentTrip(): Promise<Trip | undefined> {
  return await db.currentTrip.toCollection().first();
}

export async function clearCurrentTrip(): Promise<void> {
  await db.currentTrip.clear();
}

export async function saveTrip(trip: Trip): Promise<void> {
  await db.trips.put(trip);
}

export async function getAllTrips(): Promise<Trip[]> {
  return await db.trips.orderBy("startTime").reverse().toArray();
}

export async function getTripById(id: string): Promise<Trip | undefined> {
  return await db.trips.get(id);
}

export async function deleteTrip(id: string): Promise<void> {
  await Promise.all([db.trips.delete(id), deleteFuelEventsByTrip(id)]);
}

export async function addRefuel(
  amount: number,
  fuelPrice: number,
  fuelType: FuelType,
  vehicleId: string,
): Promise<Refuel> {
  const refuel: Refuel = {
    id: generateId(),
    vehicleId,
    timestamp: new Date().toISOString(),
    amount,
    fuelPrice,
    fuelType,
    totalCost: amount * fuelPrice,
    consumedAmount: 0,
  };
  await db.refuels.put(refuel);
  return refuel;
}

export async function updateRefuelConsumed(
  id: string,
  consumedAmount: number,
): Promise<void> {
  await db.refuels.update(id, { consumedAmount });
}

export async function getRefuels(
  startDate?: Date,
  endDate?: Date,
): Promise<Refuel[]> {
  const query = db.refuels.orderBy("timestamp").reverse();

  if (startDate && endDate) {
    const start = startDate.toISOString();
    const end = endDate.toISOString();
    return await query
      .filter((r) => r.timestamp >= start && r.timestamp <= end)
      .toArray();
  }

  return await query.toArray();
}

export async function getRefuelsInPeriod(
  startDate: Date,
  endDate: Date,
): Promise<Refuel[]> {
  const start = startDate.toISOString();
  const end = endDate.toISOString();
  return await db.refuels.where("timestamp").between(start, end).toArray();
}

export async function getRefuelsByVehicle(
  vehicleId?: string,
  startDate?: Date,
  endDate?: Date,
): Promise<Refuel[]> {
  let query = db.refuels.orderBy("timestamp").reverse();

  if (vehicleId !== undefined) {
    query = query.filter((r) => r.vehicleId === vehicleId);
  }

  if (startDate && endDate) {
    const start = startDate.toISOString();
    const end = endDate.toISOString();
    return await query
      .filter((r) => r.timestamp >= start && r.timestamp <= end)
      .toArray();
  }

  return await query.toArray();
}

export async function deleteRefuel(id: string): Promise<void> {
  await db.refuels.delete(id);
}

export async function updateVehicleFuel(
  vehicleId: string,
  currentFuel: number,
): Promise<void> {
  await db.vehicles.update(vehicleId, { currentFuel });
}

export async function unlinkVehicleRefuels(vehicleId: string): Promise<void> {
  const refuels = await db.refuels
    .filter((r) => r.vehicleId === vehicleId)
    .toArray();

  for (const refuel of refuels) {
    await db.refuels.update(refuel.id, { vehicleId: "" });
  }
}

export async function getTripsInPeriod(
  startDate: Date,
  endDate: Date,
): Promise<Trip[]> {
  const start = startDate.toISOString();
  const end = endDate.toISOString();
  return await db.trips
    .where("startTime")
    .between(start, end)
    .filter((t) => t.status === "completed")
    .reverse()
    .toArray();
}

export async function getVehicles(): Promise<Vehicle[]> {
  return await db.vehicles.orderBy("createdAt").reverse().toArray();
}

export async function getVehicle(id: string): Promise<Vehicle | undefined> {
  return await db.vehicles.get(id);
}

export async function saveVehicle(vehicle: Vehicle): Promise<void> {
  await db.vehicles.put(vehicle);
}

export async function deleteVehicle(id: string): Promise<void> {
  await db.vehicles.delete(id);
}

export async function getInclinationCalibration(
  vehicleId: string,
): Promise<InclinationCalibration | undefined> {
  return await db.inclinationCalibrations.get(vehicleId);
}

export async function saveInclinationCalibration(
  calibration: InclinationCalibration,
): Promise<void> {
  await db.inclinationCalibrations.put(calibration);
}

export async function clearInclinationCalibration(
  vehicleId: string,
): Promise<void> {
  await db.inclinationCalibrations.delete(vehicleId);
}

export async function addFuelEvent(event: FuelConsumptionEvent): Promise<void> {
  await db.fuelEvents.put(event);
}

export async function addFuelEvents(
  events: FuelConsumptionEvent[],
): Promise<void> {
  await db.fuelEvents.bulkPut(events);
}

export async function getFuelEventsByTrip(
  tripId: string,
): Promise<FuelConsumptionEvent[]> {
  return await db.fuelEvents.where("tripId").equals(tripId).toArray();
}

export async function deleteFuelEventsByTrip(tripId: string): Promise<void> {
  await db.fuelEvents.where("tripId").equals(tripId).delete();
}

export async function deleteFuelEventsByBatch(batchId: string): Promise<void> {
  const events = await db.fuelEvents.toArray();
  const toDelete = events.filter((e) =>
    e.batchAllocations.some((a) => a.batchId === batchId),
  );
  const ids = toDelete.map((e) => e.id);
  await db.fuelEvents.bulkDelete(ids);
}

export async function migrateLegacyCalibration(): Promise<void> {
  const rawCalibration = localStorage.getItem(LEGACY_CALIBRATION_KEY);
  if (!rawCalibration) return;

  const existingVehicles = await db.vehicles.count();
  if (existingVehicles > 0) return;

  try {
    const legacyData = JSON.parse(rawCalibration);

    const vehicle: Vehicle = {
      id: generateId(),
      name: `${legacyData.make} ${legacyData.model}`,
      make: legacyData.make,
      model: legacyData.model,
      year: legacyData.year,
      displacement: legacyData.displacement,
      fuelType: legacyData.fuelType,
      euroNorm: legacyData.euroNorm,
      segment: legacyData.segment,
      urbanKmpl: legacyData.urbanKmpl,
      highwayKmpl: legacyData.highwayKmpl,
      combinedKmpl: legacyData.combinedKmpl,
      mass: legacyData.mass,
      grossWeight: legacyData.grossWeight,
      frontalArea: legacyData.frontalArea,
      dragCoefficient: legacyData.dragCoefficient,
      f0: legacyData.f0,
      f1: legacyData.f1,
      f2: legacyData.f2,
      fuelConversionFactor: legacyData.fuelConversionFactor,
      peakPowerKw: legacyData.peakPowerKw,
      peakTorqueNm: legacyData.peakTorqueNm,
      co2_gkm: legacyData.co2_gkm,
      nox_mgkm: legacyData.nox_mgkm,
      confidence: legacyData.confidence,
      calibrationInput: legacyData.vehicleInput,
      calibratedAt: legacyData.savedAt,
      createdAt: new Date().toISOString(),
      fuelCapacity: 50,
      currentFuel: 0,
      inmetroCityKmpl: legacyData.inmetroCityKmpl || legacyData.urbanKmpl,
      inmetroHighwayKmpl:
        legacyData.inmetroHighwayKmpl || legacyData.highwayKmpl,
      userAvgCityKmpl: legacyData.userAvgCityKmpl || legacyData.urbanKmpl,
      userAvgHighwayKmpl:
        legacyData.userAvgHighwayKmpl || legacyData.highwayKmpl,
      inmetroEthanolCityKmpl: legacyData.inmetroEthanolCityKmpl,
      inmetroEthanolHighwayKmpl: legacyData.inmetroEthanolHighwayKmpl,
      userAvgEthanolCityKmpl: legacyData.userAvgEthanolCityKmpl,
      userAvgEthanolHighwayKmpl: legacyData.userAvgEthanolHighwayKmpl,
      inmetroGnvCityKmpl:
        legacyData.inmetroGnvCityKmpl || legacyData.inmetroCityKmpl,
      inmetroGnvHighwayKmpl:
        legacyData.inmetroGnvHighwayKmpl || legacyData.inmetroHighwayKmpl,
      userAvgGnvCityKmpl:
        legacyData.userAvgGnvCityKmpl || legacyData.userAvgCityKmpl,
      userAvgGnvHighwayKmpl:
        legacyData.userAvgGnvHighwayKmpl || legacyData.userAvgHighwayKmpl,
      crr: legacyData.crr || 0.013,
      idleLph: legacyData.idleLph || 0.9,
      baseBsfc: legacyData.baseBsfc || 265,
      weightInmetro: 0.6,
      weightUser: 0.4,
      isHybrid: false,
      gnvCylinderWeightKg: 80,
      gnvEfficiencyFactor: 1.32,
    };

    await db.vehicles.put(vehicle);

    const settings = await getSettings();
    if (!settings.activeVehicleId) {
      await saveSettings({ ...settings, activeVehicleId: vehicle.id });
    }

    localStorage.removeItem(LEGACY_CALIBRATION_KEY);

    const rawInclination = localStorage.getItem(LEGACY_INCLINATION_KEY);
    if (rawInclination) {
      try {
        const inclinationData = JSON.parse(rawInclination);
        const inclinationCalibration: InclinationCalibration = {
          vehicleId: vehicle.id,
          offsetDegrees: inclinationData.offsetDegrees,
          calibratedAt: inclinationData.calibratedAt,
        };
        await saveInclinationCalibration(inclinationCalibration);
        localStorage.removeItem(LEGACY_INCLINATION_KEY);
      } catch {
        // Ignore invalid inclination data
      }
    }
  } catch {
    // Ignore invalid calibration data
  }
}

export { db };
