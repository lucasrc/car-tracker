import { registerPlugin } from "@capacitor/core";

export interface ClassicBluetoothDevice {
  name: string;
  address: string;
  type: "classic" | "le" | "dual" | "unknown";
  bonded: boolean;
}

export interface ClassicBluetoothConnectionEvent {
  address: string;
  name: string;
  status: "connected" | "disconnected";
}

interface ClassicBluetoothPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  isEnabled(): Promise<{ enabled: boolean }>;
  checkPermissions(): Promise<{ bluetooth_connect: string }>;
  requestPermissions(): Promise<void>;
  getBondedDevices(): Promise<{ devices: ClassicBluetoothDevice[] }>;
  startMonitoring(options: {
    deviceAddress: string;
    deviceName?: string;
  }): Promise<{ monitoring: boolean }>;
  stopMonitoring(): Promise<void>;
  setAutoTracking(options: {
    enabled: boolean;
    deviceAddress: string | null;
    deviceName: string | null;
  }): Promise<void>;
  isConnected(options: {
    deviceAddress: string;
  }): Promise<{ connected: boolean }>;
  addListener(
    eventName: "deviceConnected",
    listenerFunc: (event: ClassicBluetoothConnectionEvent) => void,
  ): Promise<{ remove: () => void }>;
  addListener(
    eventName: "deviceDisconnected",
    listenerFunc: (event: ClassicBluetoothConnectionEvent) => void,
  ): Promise<{ remove: () => void }>;
  removeAllListeners(): Promise<void>;
}

export const ClassicBluetooth =
  registerPlugin<ClassicBluetoothPlugin>("ClassicBluetooth");
