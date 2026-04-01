export interface AutoTrackerPoint {
  lat: number;
  lng: number;
  speed: number;
  timestamp: number;
}

export interface AutoTrackerConfig {
  carBluetoothName: string;
  distanceFilter: number;
}

export interface AutoTrackerCallbacks {
  onDeviceConnected?: () => void;
  onDeviceDisconnected?: () => void;
  onLocationUpdate?: (point: AutoTrackerPoint) => void;
  onError?: (error: Error) => void;
  onTripComplete?: (tripId: string) => void;
}

export interface AutoTrackerState {
  isTracking: boolean;
  isCarConnected: boolean;
  isInitialized: boolean;
  points: AutoTrackerPoint[];
  error: string | null;
}
