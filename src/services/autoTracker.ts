import { BackgroundGeolocation } from "@capgo/background-geolocation";
import type { Location, CallbackError } from "@capgo/background-geolocation";
import { DontKillMyApp } from "@squareetlabs/capacitor-dont-kill-my-app";
import { ClassicBluetooth } from "@/services/classicBluetooth";
import type {
  AutoTrackerConfig,
  AutoTrackerCallbacks,
  AutoTrackerPoint,
} from "@/types/autoTracker";
import { useTripStore } from "@/stores/useTripStore";
import { getSettings } from "@/lib/db";

class AutoTracker {
  private config: AutoTrackerConfig | null = null;
  private callbacks: AutoTrackerCallbacks = {};
  private isGpsRunning = false;
  private isInitialized = false;
  private isTracking = false;
  private listeners: Array<{ remove: () => void }> = [];

  async initialize(
    config: AutoTrackerConfig,
    callbacks: AutoTrackerCallbacks = {},
  ): Promise<void> {
    if (this.isInitialized) return;

    this.config = config;
    this.callbacks = callbacks;

    try {
      const { available } = await ClassicBluetooth.isAvailable();
      if (!available) {
        throw new Error("Bluetooth not available");
      }

      const { enabled } = await ClassicBluetooth.isEnabled();
      if (!enabled) {
        throw new Error("Bluetooth not enabled");
      }

      this.isInitialized = true;
    } catch (error) {
      callbacks.onError?.(error as Error);
      throw error;
    }
  }

  async startMonitoring(
    deviceAddress: string,
    deviceName?: string,
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("AutoTracker not initialized");
    }

    for (const l of this.listeners) l.remove();
    this.listeners = [];

    const connListener = await ClassicBluetooth.addListener(
      "deviceConnected",
      () => {
        this.onCarConnected();
        this.callbacks.onDeviceConnected?.();
      },
    );
    this.listeners.push(connListener);

    const disconnListener = await ClassicBluetooth.addListener(
      "deviceDisconnected",
      () => {
        this.onCarDisconnected();
        this.callbacks.onDeviceDisconnected?.();
      },
    );
    this.listeners.push(disconnListener);

    await ClassicBluetooth.startMonitoring({ deviceAddress, deviceName });

    const { connected } = await ClassicBluetooth.isConnected({
      deviceAddress,
    });
    if (connected) {
      this.onCarConnected();
      this.callbacks.onDeviceConnected?.();
    }
  }

  private async onCarConnected(): Promise<void> {
    this.isTracking = true;

    try {
      const { startTrip } = useTripStore.getState();
      await startTrip();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      if (
        message.includes("COPERT") ||
        message.includes("calibration") ||
        message.includes("calibrar")
      ) {
        this.callbacks.onError?.(
          new Error(
            "Calibração COPERT necessária. O rastreamento automático foi bloqueado. Calibre o veículo em Configurações.",
          ),
        );
        this.isTracking = false;
        return;
      }
      this.callbacks.onError?.(err as Error);
      this.isTracking = false;
      return;
    }

    const { addPosition } = useTripStore.getState();
    await BackgroundGeolocation.start(
      {
        backgroundMessage:
          "Rastreamento ativo - cancele para economizar bateria.",
        backgroundTitle: "Car Tracker",
        requestPermissions: true,
        stale: false,
        distanceFilter: this.config?.distanceFilter ?? 10,
      },
      (location: Location | undefined, error: CallbackError | undefined) => {
        if (error) {
          if (error.code === "NOT_AUTHORIZED") {
            BackgroundGeolocation.openSettings();
          }
          this.callbacks.onError?.(new Error(error.message));
          return;
        }

        if (location) {
          const point: AutoTrackerPoint = {
            lat: location.latitude,
            lng: location.longitude,
            speed: location.speed ?? 0,
            timestamp: location.time ?? Date.now(),
          };

          const coords = {
            lat: location.latitude,
            lng: location.longitude,
            timestamp: location.time ?? Date.now(),
            accuracy: location.accuracy,
            speed: location.speed ?? undefined,
          };

          addPosition(coords);
          this.callbacks.onLocationUpdate?.(point);
        }
      },
    );

    this.isGpsRunning = true;
    await DontKillMyApp.requestKeepAppActive();
  }

  private async onCarDisconnected(): Promise<void> {
    this.isTracking = false;

    try {
      if (this.isGpsRunning) {
        await BackgroundGeolocation.stop();
        this.isGpsRunning = false;
      }

      const { stopTrip, totalFuelUsed, trip } = useTripStore.getState();
      const settings = await getSettings();
      const distanceKm = trip ? trip.distanceMeters / 1000 : 0;
      const avgConsumption =
        trip && trip.fuelUsed > 0
          ? distanceKm / trip.fuelUsed
          : settings.manualCityKmPerLiter;
      const tripId = await stopTrip(
        totalFuelUsed,
        totalFuelUsed * settings.fuelPrice,
        undefined,
        avgConsumption,
      );
      if (tripId) {
        this.callbacks.onTripComplete?.(tripId);
      }
    } catch (error) {
      this.callbacks.onError?.(error as Error);
    }
  }

  async stop(): Promise<void> {
    for (const l of this.listeners) l.remove();
    this.listeners = [];

    await ClassicBluetooth.stopMonitoring();

    if (this.isGpsRunning) {
      await BackgroundGeolocation.stop();
      this.isGpsRunning = false;
    }

    this.isInitialized = false;
    this.isTracking = false;
  }

  getTrackingState(): { isTracking: boolean; isInitialized: boolean } {
    return {
      isTracking: this.isTracking,
      isInitialized: this.isInitialized,
    };
  }
}

export const autoTracker = new AutoTracker();
export { AutoTracker };
