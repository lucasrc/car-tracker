import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface AppState {
  theme: "light" | "dark" | "system";
  sidebarOpen: boolean;
  selectedCarBluetoothName: string | null;
  selectedCarBluetoothAddress: string | null;
  autoTrackingEnabled: boolean;
  debugModeEnabled: boolean;
  debugModeShowRadars: boolean;
  gpsMode: "gps-only" | "sensor-only" | "hybrid";
}

interface AppActions {
  setTheme: (theme: AppState["theme"]) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSelectedCarBluetooth: (
    name: string | null,
    address: string | null,
  ) => void;
  setAutoTrackingEnabled: (enabled: boolean) => void;
  setDebugModeEnabled: (enabled: boolean) => void;
  setDebugModeShowRadars: (enabled: boolean) => void;
  setGpsMode: (mode: AppState["gpsMode"]) => void;
}

export const useAppStore = create<AppState & AppActions>()(
  devtools(
    persist(
      (set) => ({
        theme: "system",
        sidebarOpen: true,
        selectedCarBluetoothName: null,
        selectedCarBluetoothAddress: null,
        autoTrackingEnabled: false,
        debugModeEnabled: false,
        debugModeShowRadars: false,
        gpsMode: "hybrid",
        setTheme: (theme) => set({ theme }),
        toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
        setSidebarOpen: (open) => set({ sidebarOpen: open }),
        setSelectedCarBluetooth: (name, address) =>
          set({
            selectedCarBluetoothName: name,
            selectedCarBluetoothAddress: address,
          }),
        setAutoTrackingEnabled: (enabled) =>
          set({ autoTrackingEnabled: enabled }),
        setDebugModeEnabled: (enabled) => set({ debugModeEnabled: enabled }),
        setDebugModeShowRadars: (enabled) =>
          set({ debugModeShowRadars: enabled }),
        setGpsMode: (mode) => set({ gpsMode: mode }),
      }),
      { name: "app-store" },
    ),
  ),
);
