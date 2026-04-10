import type {
  Trip,
  Settings,
  Refuel,
  FuelType,
  Vehicle,
  InclinationCalibration,
} from "@/types";

export interface DbAdapter {
  name: string;

  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;

  saveTrip(trip: Trip): Promise<void>;
  getAllTrips(): Promise<Trip[]>;
  getTripById(id: string): Promise<Trip | undefined>;
  getTripsInPeriod(
    startDate: Date,
    endDate: Date,
    vehicleId?: string,
  ): Promise<Trip[]>;
  deleteTrip(id: string): Promise<void>;

  addRefuel(
    vehicleId: string,
    amount: number,
    fuelPrice: number,
    fuelType?: FuelType,
  ): Promise<Refuel>;
  getRefuels(startDate?: Date, endDate?: Date): Promise<Refuel[]>;
  getRefuelsInPeriod(startDate: Date, endDate: Date): Promise<Refuel[]>;
  getRefuelsByVehicle(
    vehicleId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<Refuel[]>;
  deleteRefuel(id: string): Promise<void>;

  saveCurrentTrip(trip: Trip): Promise<void>;
  getCurrentTrip(): Promise<Trip | undefined>;
  clearCurrentTrip(): Promise<void>;

  refuel(amount: number): Promise<Settings>;
  consumeFuel(liters: number): Promise<Settings>;

  getVehicles(): Promise<Vehicle[]>;
  getVehicle(id: string): Promise<Vehicle | undefined>;
  saveVehicle(vehicle: Vehicle): Promise<void>;
  deleteVehicle(id: string): Promise<void>;
  updateVehicleFuel(vehicleId: string, currentFuel: number): Promise<void>;
  unlinkVehicleRefuels(vehicleId: string): Promise<void>;

  getInclinationCalibration(
    vehicleId: string,
  ): Promise<InclinationCalibration | undefined>;
  saveInclinationCalibration(
    calibration: InclinationCalibration,
  ): Promise<void>;
  clearInclinationCalibration(vehicleId: string): Promise<void>;

  migrateLegacyCalibration(): Promise<void>;

  isReady(): Promise<boolean>;
  close(): Promise<void>;
}

export interface DbAdapterConstructor {
  new (): DbAdapter;
  isSupported(): Promise<boolean>;
}

export type DbAdapterType = "sqlite";
