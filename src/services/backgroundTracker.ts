import { registerPlugin } from "@capacitor/core";

export interface BackgroundTrackingState {
  isTracking: boolean;
  startTime: number | null;
  deviceAddress: string | null;
  deviceName: string | null;
}

interface BackgroundTrackerPlugin {
  getTrackingState(): Promise<BackgroundTrackingState>;
  clearTrackingState(): Promise<void>;
}

export const BackgroundTracker =
  registerPlugin<BackgroundTrackerPlugin>("BackgroundTracker");
