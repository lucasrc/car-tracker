import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "./useAppStore";

describe("useAppStore", () => {
  beforeEach(() => {
    useAppStore.getState().setTheme("system");
    useAppStore.getState().setSidebarOpen(true);
    useAppStore.getState().setAutoTrackingEnabled(false);
    useAppStore.getState().setDebugModeEnabled(false);
    useAppStore.getState().setDebugModeShowRadars(false);
  });

  describe("theme", () => {
    it("has default theme system", () => {
      expect(useAppStore.getState().theme).toBe("system");
    });

    it("setTheme changes theme", () => {
      useAppStore.getState().setTheme("dark");
      expect(useAppStore.getState().theme).toBe("dark");
    });
  });

  describe("sidebar", () => {
    it("toggleSidebar toggles open state", () => {
      const initial = useAppStore.getState().sidebarOpen;
      useAppStore.getState().toggleSidebar();
      expect(useAppStore.getState().sidebarOpen).toBe(!initial);
    });

    it("setSidebarOpen sets open state", () => {
      useAppStore.getState().setSidebarOpen(false);
      expect(useAppStore.getState().sidebarOpen).toBe(false);
    });
  });

  describe("bluetooth", () => {
    it("setSelectedCarBluetooth sets name and address", () => {
      useAppStore
        .getState()
        .setSelectedCarBluetooth("MyCar", "AA:BB:CC:DD:EE:FF");
      const state = useAppStore.getState();
      expect(state.selectedCarBluetoothName).toBe("MyCar");
      expect(state.selectedCarBluetoothAddress).toBe("AA:BB:CC:DD:EE:FF");
    });

    it("can set null bluetooth", () => {
      useAppStore.getState().setSelectedCarBluetooth(null, null);
      const state = useAppStore.getState();
      expect(state.selectedCarBluetoothName).toBeNull();
      expect(state.selectedCarBluetoothAddress).toBeNull();
    });
  });

  describe("auto tracking", () => {
    it("setAutoTrackingEnabled toggles tracking", () => {
      useAppStore.getState().setAutoTrackingEnabled(true);
      expect(useAppStore.getState().autoTrackingEnabled).toBe(true);
    });
  });

  describe("debug mode", () => {
    it("setDebugModeEnabled toggles debug mode", () => {
      useAppStore.getState().setDebugModeEnabled(true);
      expect(useAppStore.getState().debugModeEnabled).toBe(true);
    });

    it("setDebugModeShowRadars toggles radar visibility", () => {
      useAppStore.getState().setDebugModeShowRadars(true);
      expect(useAppStore.getState().debugModeShowRadars).toBe(true);
    });
  });
});
