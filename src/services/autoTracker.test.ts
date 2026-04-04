import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Location, CallbackError } from "@capgo/background-geolocation";
import { AutoTracker } from "./autoTracker";
import { BackgroundGeolocation } from "@capgo/background-geolocation";
import { ClassicBluetooth } from "@/services/classicBluetooth";
import { useTripStore } from "@/stores/useTripStore";
import type { AutoTrackerCallbacks } from "@/types/autoTracker";

const mockLocationCallback = vi.fn();

const createMockLocation = (overrides: Partial<Location> = {}): Location => ({
  latitude: -23.5505,
  longitude: -46.6333,
  accuracy: 5,
  altitude: null,
  altitudeAccuracy: null,
  simulated: false,
  bearing: null,
  speed: null,
  time: Date.now(),
  ...overrides,
});

vi.mock("@capgo/background-geolocation", () => ({
  BackgroundGeolocation: {
    start: vi.fn(
      (
        _options: Parameters<typeof BackgroundGeolocation.start>[0],
        callback: (
          location: Location | undefined,
          error: CallbackError | undefined,
        ) => void,
      ) => {
        mockLocationCallback.mockImplementation(callback);
        return Promise.resolve();
      },
    ),
    stop: vi.fn().mockResolvedValue(undefined),
    openSettings: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@squareetlabs/capacitor-dont-kill-my-app", () => ({
  DontKillMyApp: {
    requestKeepAppActive: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/services/classicBluetooth", () => ({
  ClassicBluetooth: {
    isAvailable: vi.fn(),
    isEnabled: vi.fn(),
    startMonitoring: vi.fn().mockResolvedValue(undefined),
    stopMonitoring: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn(),
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
  },
}));

vi.mock("@/stores/useTripStore", () => ({
  useTripStore: {
    getState: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  getSettings: vi.fn().mockResolvedValue({
    fuelPrice: 5.5,
    fuelCapacity: 50,
    currentFuel: 50,
    manualCityKmPerLiter: 10,
  }),
}));

describe("AutoTracker", () => {
  let autoTracker: AutoTracker;
  let mockCallbacks: AutoTrackerCallbacks;

  beforeEach(() => {
    vi.clearAllMocks();
    autoTracker = new AutoTracker();
    mockCallbacks = {
      onDeviceConnected: vi.fn(),
      onDeviceDisconnected: vi.fn(),
      onLocationUpdate: vi.fn(),
      onError: vi.fn(),
      onTripComplete: vi.fn(),
    };

    vi.mocked(ClassicBluetooth.isAvailable).mockResolvedValue({
      available: true,
    });
    vi.mocked(ClassicBluetooth.isEnabled).mockResolvedValue({ enabled: true });
    vi.mocked(ClassicBluetooth.isConnected).mockResolvedValue({
      connected: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initialize", () => {
    it("should initialize successfully when bluetooth is available and enabled", async () => {
      await autoTracker.initialize(
        { carBluetoothName: "Test", distanceFilter: 10 },
        mockCallbacks,
      );

      expect(ClassicBluetooth.isAvailable).toHaveBeenCalled();
      expect(ClassicBluetooth.isEnabled).toHaveBeenCalled();
    });

    it("should throw error when bluetooth is not available", async () => {
      vi.mocked(ClassicBluetooth.isAvailable).mockResolvedValue({
        available: false,
      });

      await expect(
        autoTracker.initialize(
          { carBluetoothName: "Test", distanceFilter: 10 },
          mockCallbacks,
        ),
      ).rejects.toThrow("Bluetooth not available");
    });

    it("should throw error when bluetooth is not enabled", async () => {
      vi.mocked(ClassicBluetooth.isEnabled).mockResolvedValue({
        enabled: false,
      });

      await expect(
        autoTracker.initialize(
          { carBluetoothName: "Test", distanceFilter: 10 },
          mockCallbacks,
        ),
      ).rejects.toThrow("Bluetooth not enabled");
    });
  });

  describe("startMonitoring", () => {
    beforeEach(async () => {
      await autoTracker.initialize(
        { carBluetoothName: "Test", distanceFilter: 10 },
        mockCallbacks,
      );
    });

    it("should throw error if not initialized", async () => {
      const newTracker = new AutoTracker();
      await expect(
        newTracker.startMonitoring("00:11:22:33:44:55"),
      ).rejects.toThrow("AutoTracker not initialized");
    });

    it("should setup bluetooth listeners", async () => {
      await autoTracker.startMonitoring("00:11:22:33:44:55", "TestCar");

      expect(ClassicBluetooth.addListener).toHaveBeenCalledWith(
        "deviceConnected",
        expect.any(Function),
      );
      expect(ClassicBluetooth.addListener).toHaveBeenCalledWith(
        "deviceDisconnected",
        expect.any(Function),
      );
    });

    it("should start monitoring bluetooth device", async () => {
      await autoTracker.startMonitoring("00:11:22:33:44:55", "TestCar");

      expect(ClassicBluetooth.startMonitoring).toHaveBeenCalledWith({
        deviceAddress: "00:11:22:33:44:55",
        deviceName: "TestCar",
      });
    });

    it("should trigger onCarConnected if already connected", async () => {
      vi.mocked(ClassicBluetooth.isConnected).mockResolvedValue({
        connected: true,
      });

      const mockStartTrip = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useTripStore.getState).mockReturnValue({
        startTrip: mockStartTrip,
        addPosition: vi.fn(),
      } as unknown as ReturnType<typeof useTripStore.getState>);

      await autoTracker.startMonitoring("00:11:22:33:44:55");

      expect(mockStartTrip).toHaveBeenCalled();
      expect(mockCallbacks.onDeviceConnected).toHaveBeenCalled();
    });
  });

  describe("onCarDisconnected", () => {
    beforeEach(async () => {
      await autoTracker.initialize(
        { carBluetoothName: "Test", distanceFilter: 10 },
        mockCallbacks,
      );

      vi.mocked(ClassicBluetooth.isConnected).mockResolvedValue({
        connected: true,
      });

      const mockStartTrip = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useTripStore.getState).mockReturnValue({
        startTrip: mockStartTrip,
        addPosition: vi.fn(),
      } as unknown as ReturnType<typeof useTripStore.getState>);

      await autoTracker.startMonitoring("00:11:22:33:44:55");
    });

    it("should stop GPS tracking when car disconnects", async () => {
      const calls = vi.mocked(ClassicBluetooth.addListener).mock.calls;
      const disconnectCall = calls.find(
        (call) => call[0] === "deviceDisconnected",
      );
      expect(disconnectCall).toBeDefined();

      const disconnectListener = disconnectCall![1] as () => void;

      disconnectListener();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(BackgroundGeolocation.stop).toHaveBeenCalled();
    });

    it("should call stopTrip with totalFuelUsed from store when disconnecting", async () => {
      const mockStopTrip = vi.fn().mockResolvedValue("trip-123");
      const mockTotalFuelUsed = 2.5;
      const mockTrip = {
        distanceMeters: 25000,
        fuelUsed: 2.0,
      };

      vi.mocked(useTripStore.getState).mockReturnValue({
        stopTrip: mockStopTrip,
        totalFuelUsed: mockTotalFuelUsed,
        trip: mockTrip,
      } as unknown as ReturnType<typeof useTripStore.getState>);

      const calls = vi.mocked(ClassicBluetooth.addListener).mock.calls;
      const disconnectCall = calls.find(
        (call) => call[0] === "deviceDisconnected",
      );
      const disconnectListener = disconnectCall![1] as () => void;

      disconnectListener();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockStopTrip).toHaveBeenCalledWith(
        mockTotalFuelUsed,
        mockTotalFuelUsed * 5.5,
        undefined,
        12.5,
      );
    });

    it("should call stopTrip with zero totalFuelUsed when no fuel was used", async () => {
      const mockStopTrip = vi.fn().mockResolvedValue("trip-456");
      const mockTrip = {
        distanceMeters: 0,
        fuelUsed: 0,
      };

      vi.mocked(useTripStore.getState).mockReturnValue({
        stopTrip: mockStopTrip,
        totalFuelUsed: 0,
        trip: mockTrip,
      } as unknown as ReturnType<typeof useTripStore.getState>);

      const calls = vi.mocked(ClassicBluetooth.addListener).mock.calls;
      const disconnectCall = calls.find(
        (call) => call[0] === "deviceDisconnected",
      );
      const disconnectListener = disconnectCall![1] as () => void;

      disconnectListener();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockStopTrip).toHaveBeenCalledWith(
        0,
        0,
        undefined,
        expect.any(Number),
      );
    });

    it("should call stopTrip with zero totalFuelUsed when no fuel was used", async () => {
      const mockStopTrip = vi.fn().mockResolvedValue("trip-456");
      const mockTrip = {
        distanceMeters: 0,
        fuelUsed: 0,
      };

      vi.mocked(useTripStore.getState).mockReturnValue({
        stopTrip: mockStopTrip,
        totalFuelUsed: 0,
        trip: mockTrip,
      } as unknown as ReturnType<typeof useTripStore.getState>);

      const calls = vi.mocked(ClassicBluetooth.addListener).mock.calls;
      const disconnectCall = calls.find(
        (call) => call[0] === "deviceDisconnected",
      );
      const disconnectListener = disconnectCall![1] as () => void;

      disconnectListener();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockStopTrip).toHaveBeenCalledWith(
        0,
        0,
        undefined,
        expect.any(Number),
      );
    });

    it("should trigger onTripComplete callback with trip ID when trip is saved", async () => {
      const mockStopTrip = vi.fn().mockResolvedValue("trip-789");

      vi.mocked(useTripStore.getState).mockReturnValue({
        stopTrip: mockStopTrip,
        totalFuelUsed: 1.5,
      } as unknown as ReturnType<typeof useTripStore.getState>);

      const calls = vi.mocked(ClassicBluetooth.addListener).mock.calls;
      const disconnectCall = calls.find(
        (call) => call[0] === "deviceDisconnected",
      );
      const disconnectListener = disconnectCall![1] as () => void;

      disconnectListener();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockCallbacks.onTripComplete).toHaveBeenCalledWith("trip-789");
    });

    it("should not trigger onTripComplete if trip ID is empty", async () => {
      const mockStopTrip = vi.fn().mockResolvedValue("");

      vi.mocked(useTripStore.getState).mockReturnValue({
        stopTrip: mockStopTrip,
        totalFuelUsed: 1.5,
      } as unknown as ReturnType<typeof useTripStore.getState>);

      const calls = vi.mocked(ClassicBluetooth.addListener).mock.calls;
      const disconnectCall = calls.find(
        (call) => call[0] === "deviceDisconnected",
      );
      const disconnectListener = disconnectCall![1] as () => void;

      disconnectListener();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockCallbacks.onTripComplete).not.toHaveBeenCalled();
    });

    it("should call onError callback if stopTrip throws an error", async () => {
      const mockStopTrip = vi
        .fn()
        .mockRejectedValue(new Error("Database error"));

      vi.mocked(useTripStore.getState).mockReturnValue({
        stopTrip: mockStopTrip,
        totalFuelUsed: 1.5,
      } as unknown as ReturnType<typeof useTripStore.getState>);

      const calls = vi.mocked(ClassicBluetooth.addListener).mock.calls;
      const disconnectCall = calls.find(
        (call) => call[0] === "deviceDisconnected",
      );
      const disconnectListener = disconnectCall![1] as () => void;

      disconnectListener();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockCallbacks.onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("getTrackingState", () => {
    it("should return initial state", () => {
      const state = autoTracker.getTrackingState();
      expect(state).toEqual({ isTracking: false, isInitialized: false });
    });
  });

  describe("stop", () => {
    beforeEach(async () => {
      await autoTracker.initialize(
        { carBluetoothName: "Test", distanceFilter: 10 },
        mockCallbacks,
      );
      await autoTracker.startMonitoring("00:11:22:33:44:55");
    });

    it("should remove all listeners", async () => {
      const newTracker = new AutoTracker();
      await newTracker.initialize(
        { carBluetoothName: "Test", distanceFilter: 10 },
        mockCallbacks,
      );
      await newTracker.startMonitoring("00:11:22:33:44:55");
      await newTracker.stop();

      expect(ClassicBluetooth.stopMonitoring).toHaveBeenCalled();
    });

    it("should stop GPS if running", async () => {
      vi.mocked(ClassicBluetooth.isConnected).mockResolvedValue({
        connected: true,
      });

      const mockStartTrip = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useTripStore.getState).mockReturnValue({
        startTrip: mockStartTrip,
        addPosition: vi.fn(),
      } as unknown as ReturnType<typeof useTripStore.getState>);

      const newTracker = new AutoTracker();
      await newTracker.initialize(
        { carBluetoothName: "Test", distanceFilter: 10 },
        mockCallbacks,
      );
      await newTracker.startMonitoring("00:11:22:33:44:55");
      await newTracker.stop();

      expect(BackgroundGeolocation.stop).toHaveBeenCalled();
    });
  });

  describe("Background Location Tracking", () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      await autoTracker.initialize(
        { carBluetoothName: "Test", distanceFilter: 10 },
        mockCallbacks,
      );

      vi.mocked(ClassicBluetooth.isConnected).mockResolvedValue({
        connected: true,
      });

      const mockStartTrip = vi.fn().mockResolvedValue(undefined);
      const mockAddPosition = vi.fn();
      vi.mocked(useTripStore.getState).mockReturnValue({
        startTrip: mockStartTrip,
        addPosition: mockAddPosition,
        stopTrip: vi.fn().mockResolvedValue("trip-123"),
        totalFuelUsed: 1.5,
      } as unknown as ReturnType<typeof useTripStore.getState>);

      await autoTracker.startMonitoring("00:11:22:33:44:55");
    });

    it("should call BackgroundGeolocation.start with correct config", () => {
      expect(BackgroundGeolocation.start).toHaveBeenCalledWith(
        expect.objectContaining({
          backgroundMessage:
            "Rastreamento ativo - cancele para economizar bateria.",
          backgroundTitle: "Car Tracker",
          requestPermissions: true,
          stale: false,
          distanceFilter: 10,
        }),
        expect.any(Function),
      );
    });

    it("should use custom distanceFilter from config", async () => {
      vi.clearAllMocks();
      const newTracker = new AutoTracker();
      await newTracker.initialize(
        { carBluetoothName: "Test", distanceFilter: 25 },
        mockCallbacks,
      );

      vi.mocked(ClassicBluetooth.isConnected).mockResolvedValue({
        connected: true,
      });

      const mockStartTrip = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useTripStore.getState).mockReturnValue({
        startTrip: mockStartTrip,
        addPosition: vi.fn(),
        stopTrip: vi.fn().mockResolvedValue("trip-123"),
        totalFuelUsed: 1.5,
      } as unknown as ReturnType<typeof useTripStore.getState>);

      await newTracker.startMonitoring("00:11:22:33:44:55");

      expect(BackgroundGeolocation.start).toHaveBeenCalledWith(
        expect.objectContaining({
          distanceFilter: 25,
        }),
        expect.any(Function),
      );
    });

    it("should request DontKillMyApp when car connects", async () => {
      const { DontKillMyApp } =
        await import("@squareetlabs/capacitor-dont-kill-my-app");
      expect(DontKillMyApp.requestKeepAppActive).toHaveBeenCalled();
    });
  });

  describe("Location Callback Handling", () => {
    let mockAddPosition: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      vi.clearAllMocks();
      await autoTracker.initialize(
        { carBluetoothName: "Test", distanceFilter: 10 },
        mockCallbacks,
      );

      vi.mocked(ClassicBluetooth.isConnected).mockResolvedValue({
        connected: true,
      });

      mockAddPosition = vi.fn();
      vi.mocked(useTripStore.getState).mockReturnValue({
        startTrip: vi.fn().mockResolvedValue(undefined),
        addPosition: mockAddPosition,
        stopTrip: vi.fn().mockResolvedValue("trip-123"),
        totalFuelUsed: 1.5,
      } as unknown as ReturnType<typeof useTripStore.getState>);

      await autoTracker.startMonitoring("00:11:22:33:44:55");

      const calls = vi.mocked(ClassicBluetooth.addListener).mock
        .calls as unknown as Array<[string, () => void]>;
      const connectCall = calls.find((call) => call[0] === "deviceConnected");
      const connectListener = connectCall![1];
      connectListener();
    });

    it("should add position to store when receiving location update", () => {
      const location = createMockLocation({
        latitude: -23.5505,
        longitude: -46.6333,
        speed: 13.89,
        accuracy: 5,
      });

      mockLocationCallback(location, undefined);

      expect(mockAddPosition).toHaveBeenCalledWith({
        lat: -23.5505,
        lng: -46.6333,
        timestamp: expect.any(Number),
        accuracy: 5,
        speed: 13.89,
      });
    });

    it("should call onLocationUpdate callback when receiving location", () => {
      const location = createMockLocation({
        latitude: -23.5505,
        longitude: -46.6333,
        speed: 8.33,
        accuracy: 10,
      });

      mockLocationCallback(location, undefined);

      expect(mockCallbacks.onLocationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          lat: -23.5505,
          lng: -46.6333,
          speed: 8.33,
          timestamp: expect.any(Number),
        }),
      );
    });

    it("should handle location with null speed", () => {
      const location = createMockLocation({
        latitude: -23.5505,
        longitude: -46.6333,
        speed: null,
        accuracy: 5,
      });

      mockLocationCallback(location, undefined);

      expect(mockAddPosition).toHaveBeenCalledWith(
        expect.objectContaining({
          lat: -23.5505,
          lng: -46.6333,
          speed: undefined,
        }),
      );
      expect(mockCallbacks.onLocationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          speed: 0,
        }),
      );
    });

    it("should handle location with null time", () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const location = createMockLocation({
        latitude: -23.5505,
        longitude: -46.6333,
        speed: 10,
        accuracy: 5,
        time: null,
      });

      mockLocationCallback(location, undefined);

      expect(mockAddPosition).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: now,
        }),
      );
    });

    it("should handle multiple rapid location updates", () => {
      const locations = [
        createMockLocation({
          latitude: -23.5505,
          longitude: -46.6333,
          speed: 10,
          accuracy: 5,
          time: Date.now(),
        }),
        createMockLocation({
          latitude: -23.551,
          longitude: -46.634,
          speed: 12,
          accuracy: 4,
          time: Date.now() + 1000,
        }),
        createMockLocation({
          latitude: -23.5515,
          longitude: -46.6345,
          speed: 15,
          accuracy: 3,
          time: Date.now() + 2000,
        }),
      ];

      locations.forEach((location) => {
        mockLocationCallback(location, undefined);
      });

      expect(mockAddPosition).toHaveBeenCalledTimes(3);
      expect(mockCallbacks.onLocationUpdate).toHaveBeenCalledTimes(3);
    });
  });

  describe("GPS Error Handling", () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      await autoTracker.initialize(
        { carBluetoothName: "Test", distanceFilter: 10 },
        mockCallbacks,
      );

      vi.mocked(ClassicBluetooth.isConnected).mockResolvedValue({
        connected: true,
      });

      vi.mocked(useTripStore.getState).mockReturnValue({
        startTrip: vi.fn().mockResolvedValue(undefined),
        addPosition: vi.fn(),
        stopTrip: vi.fn().mockResolvedValue("trip-123"),
        totalFuelUsed: 1.5,
      } as unknown as ReturnType<typeof useTripStore.getState>);

      await autoTracker.startMonitoring("00:11:22:33:44:55");

      const calls = vi.mocked(ClassicBluetooth.addListener).mock
        .calls as unknown as Array<[string, () => void]>;
      const connectCall = calls.find((call) => call[0] === "deviceConnected");
      const connectListener = connectCall![1];
      connectListener();
    });

    it("should call onError when receiving location error", () => {
      const error: CallbackError = {
        name: "LocationError",
        code: "GENERAL_ERROR",
        message: "Location service unavailable",
      };

      mockLocationCallback(undefined, error);

      expect(mockCallbacks.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Location service unavailable",
        }),
      );
    });

    it("should open settings when NOT_AUTHORIZED error occurs", () => {
      const error: CallbackError = {
        name: "AuthError",
        code: "NOT_AUTHORIZED",
        message: "Location permission denied",
      };

      mockLocationCallback(undefined, error);

      expect(BackgroundGeolocation.openSettings).toHaveBeenCalled();
      expect(mockCallbacks.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Location permission denied",
        }),
      );
    });

    it("should continue tracking after non-authorization error", () => {
      const authError: CallbackError = {
        name: "AuthError",
        code: "NOT_AUTHORIZED",
        message: "Location permission denied",
      };

      mockLocationCallback(undefined, authError);

      const validLocation = createMockLocation({
        latitude: -23.5505,
        longitude: -46.6333,
        speed: 10,
        accuracy: 5,
      });

      mockLocationCallback(validLocation, undefined);

      expect(mockCallbacks.onLocationUpdate).toHaveBeenCalled();
    });
  });

  describe("onCarConnected Edge Cases", () => {
    it("should handle startTrip failure gracefully", async () => {
      vi.clearAllMocks();
      const newTracker = new AutoTracker();
      await newTracker.initialize(
        { carBluetoothName: "Test", distanceFilter: 10 },
        mockCallbacks,
      );

      vi.mocked(ClassicBluetooth.isConnected).mockResolvedValue({
        connected: true,
      });

      const startTripError = new Error("Database error");
      vi.mocked(useTripStore.getState).mockReturnValue({
        startTrip: vi.fn().mockRejectedValue(startTripError),
        addPosition: vi.fn(),
        stopTrip: vi.fn().mockResolvedValue("trip-123"),
        totalFuelUsed: 1.5,
      } as unknown as ReturnType<typeof useTripStore.getState>);

      await newTracker.startMonitoring("00:11:22:33:44:55");

      expect(mockCallbacks.onError).toHaveBeenCalledWith(startTripError);
      expect(BackgroundGeolocation.start).not.toHaveBeenCalled();
    });

    it("should handle BackgroundGeolocation.start failure", async () => {
      vi.clearAllMocks();
      vi.mocked(BackgroundGeolocation.start).mockImplementation(
        (
          _options: Parameters<typeof BackgroundGeolocation.start>[0],
          callback: (
            location: Location | undefined,
            error: CallbackError | undefined,
          ) => void,
        ) => {
          callback(undefined, {
            name: "GPSError",
            message: "GPS service failed",
          });
          return Promise.resolve();
        },
      );

      const newTracker = new AutoTracker();
      await newTracker.initialize(
        { carBluetoothName: "Test", distanceFilter: 10 },
        mockCallbacks,
      );

      vi.mocked(ClassicBluetooth.isConnected).mockResolvedValue({
        connected: true,
      });

      vi.mocked(useTripStore.getState).mockReturnValue({
        startTrip: vi.fn().mockResolvedValue(undefined),
        addPosition: vi.fn(),
        stopTrip: vi.fn().mockResolvedValue("trip-123"),
        totalFuelUsed: 1.5,
      } as unknown as ReturnType<typeof useTripStore.getState>);

      await newTracker.startMonitoring("00:11:22:33:44:55");

      expect(mockCallbacks.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "GPS service failed",
        }),
      );
    });

    it("should not duplicate tracking if connected twice", async () => {
      vi.clearAllMocks();
      const newTracker = new AutoTracker();
      await newTracker.initialize(
        { carBluetoothName: "Test", distanceFilter: 10 },
        mockCallbacks,
      );

      vi.mocked(ClassicBluetooth.isConnected).mockResolvedValue({
        connected: true,
      });

      vi.mocked(useTripStore.getState).mockReturnValue({
        startTrip: vi.fn().mockResolvedValue(undefined),
        addPosition: vi.fn(),
        stopTrip: vi.fn().mockResolvedValue("trip-123"),
        totalFuelUsed: 1.5,
      } as unknown as ReturnType<typeof useTripStore.getState>);

      await newTracker.startMonitoring("00:11:22:33:44:55");

      vi.mocked(BackgroundGeolocation.start).mockClear();

      vi.mocked(ClassicBluetooth.isConnected).mockResolvedValue({
        connected: true,
      });

      const calls = vi.mocked(ClassicBluetooth.addListener).mock
        .calls as unknown as Array<[string, () => void]>;
      const connectCall = calls.find((call) => call[0] === "deviceConnected");
      const connectListener = connectCall![1];
      connectListener();

      expect(BackgroundGeolocation.start).not.toHaveBeenCalled();
    });
  });

  describe("Rapid Connect/Disconnect Cycles", () => {
    it("should handle rapid disconnect after connect", async () => {
      await autoTracker.initialize(
        { carBluetoothName: "Test", distanceFilter: 10 },
        mockCallbacks,
      );

      vi.mocked(ClassicBluetooth.isConnected).mockResolvedValue({
        connected: true,
      });

      const mockStartTrip = vi.fn().mockResolvedValue(undefined);
      const mockStopTrip = vi.fn().mockResolvedValue("trip-123");
      vi.mocked(useTripStore.getState).mockReturnValue({
        startTrip: mockStartTrip,
        addPosition: vi.fn(),
        stopTrip: mockStopTrip,
        totalFuelUsed: 0,
      } as unknown as ReturnType<typeof useTripStore.getState>);

      await autoTracker.startMonitoring("00:11:22:33:44:55");

      mockStartTrip.mockClear();
      mockStopTrip.mockClear();

      const calls = vi.mocked(ClassicBluetooth.addListener).mock
        .calls as unknown as Array<[string, () => void]>;
      const connectCall = calls.find((call) => call[0] === "deviceConnected");
      const disconnectCall = calls.find(
        (call) => call[0] === "deviceDisconnected",
      );

      const connectListener = connectCall![1];
      const disconnectListener = disconnectCall![1];

      connectListener();
      await new Promise((resolve) => setTimeout(resolve, 5));
      disconnectListener();
      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(mockStartTrip).toHaveBeenCalledTimes(1);
      expect(mockStopTrip).toHaveBeenCalledTimes(1);
    });

    it("should clean up GPS when disconnecting", async () => {
      vi.clearAllMocks();

      const newTracker = new AutoTracker();
      await newTracker.initialize(
        { carBluetoothName: "Test", distanceFilter: 10 },
        mockCallbacks,
      );

      vi.mocked(ClassicBluetooth.isConnected).mockResolvedValue({
        connected: true,
      });

      vi.mocked(useTripStore.getState).mockReturnValue({
        startTrip: vi.fn().mockResolvedValue(undefined),
        addPosition: vi.fn(),
        stopTrip: vi.fn().mockResolvedValue("trip-456"),
        totalFuelUsed: 2.0,
      } as unknown as ReturnType<typeof useTripStore.getState>);

      await newTracker.startMonitoring("00:11:22:33:44:55");

      expect(BackgroundGeolocation.start).toHaveBeenCalled();
      expect(newTracker.getTrackingState().isTracking).toBe(true);

      vi.mocked(BackgroundGeolocation.stop).mockClear();

      const calls = vi.mocked(ClassicBluetooth.addListener).mock
        .calls as unknown as Array<[string, () => void]>;
      const disconnectCall = calls.find(
        (call) => call[0] === "deviceDisconnected",
      );
      expect(disconnectCall).toBeDefined();
      const disconnectListener = disconnectCall![1];

      vi.clearAllMocks();

      disconnectListener();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(newTracker.getTrackingState().isTracking).toBe(false);
    });
  });

  describe("State Management", () => {
    it("should update tracking state on connect", async () => {
      vi.clearAllMocks();
      await autoTracker.initialize(
        { carBluetoothName: "Test", distanceFilter: 10 },
        mockCallbacks,
      );

      let trackingState = autoTracker.getTrackingState();
      expect(trackingState.isTracking).toBe(false);

      vi.mocked(ClassicBluetooth.isConnected).mockResolvedValue({
        connected: true,
      });

      vi.mocked(useTripStore.getState).mockReturnValue({
        startTrip: vi.fn().mockResolvedValue(undefined),
        addPosition: vi.fn(),
        stopTrip: vi.fn().mockResolvedValue("trip-123"),
        totalFuelUsed: 1.5,
      } as unknown as ReturnType<typeof useTripStore.getState>);

      await autoTracker.startMonitoring("00:11:22:33:44:55");

      trackingState = autoTracker.getTrackingState();
      expect(trackingState.isTracking).toBe(true);
    });

    it("should update tracking state on disconnect", async () => {
      vi.clearAllMocks();
      await autoTracker.initialize(
        { carBluetoothName: "Test", distanceFilter: 10 },
        mockCallbacks,
      );

      vi.mocked(ClassicBluetooth.isConnected).mockResolvedValue({
        connected: true,
      });

      vi.mocked(useTripStore.getState).mockReturnValue({
        startTrip: vi.fn().mockResolvedValue(undefined),
        addPosition: vi.fn(),
        stopTrip: vi.fn().mockResolvedValue("trip-123"),
        totalFuelUsed: 1.5,
      } as unknown as ReturnType<typeof useTripStore.getState>);

      await autoTracker.startMonitoring("00:11:22:33:44:55");

      let trackingState = autoTracker.getTrackingState();
      expect(trackingState.isTracking).toBe(true);

      const calls = vi.mocked(ClassicBluetooth.addListener).mock.calls;
      const disconnectCall = calls.find(
        (call) => call[0] === "deviceDisconnected",
      );
      const disconnectListener = disconnectCall![1] as () => void;

      disconnectListener();
      await new Promise((resolve) => setTimeout(resolve, 10));

      trackingState = autoTracker.getTrackingState();
      expect(trackingState.isTracking).toBe(false);
    });

    it("should reset state when stop() is called", async () => {
      vi.clearAllMocks();
      const newTracker = new AutoTracker();
      await newTracker.initialize(
        { carBluetoothName: "Test", distanceFilter: 10 },
        mockCallbacks,
      );

      vi.mocked(ClassicBluetooth.isConnected).mockResolvedValue({
        connected: true,
      });

      vi.mocked(useTripStore.getState).mockReturnValue({
        startTrip: vi.fn().mockResolvedValue(undefined),
        addPosition: vi.fn(),
        stopTrip: vi.fn().mockResolvedValue("trip-123"),
        totalFuelUsed: 1.5,
      } as unknown as ReturnType<typeof useTripStore.getState>);

      await newTracker.startMonitoring("00:11:22:33:44:55");

      let state = newTracker.getTrackingState();
      expect(state.isTracking).toBe(true);
      expect(state.isInitialized).toBe(true);

      await newTracker.stop();

      state = newTracker.getTrackingState();
      expect(state.isTracking).toBe(false);
      expect(state.isInitialized).toBe(false);
    });
  });
});
