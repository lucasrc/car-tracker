import {
  useEffect,
  useState,
  useCallback,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { autoTracker } from "@/services/autoTracker";
import { useTripStore } from "@/stores/useTripStore";
import { useWakeLock } from "@/hooks/useWakeLock";
import type { Coordinates } from "@/types";

interface UseAutoTrackerReturn {
  isTracking: boolean;
  isCarConnected: boolean;
  isInitialized: boolean;
  points: Coordinates[];
  error: string | null;
  onTripComplete: ((tripId: string) => void) | null;
  setOnTripComplete: Dispatch<
    SetStateAction<((tripId: string) => void) | null>
  >;
  initialize: (deviceAddress: string) => Promise<void>;
  startMonitoring: (
    deviceAddress: string,
    deviceName?: string,
  ) => Promise<void>;
  stop: () => Promise<void>;
}

export function useAutoTracker(): UseAutoTrackerReturn {
  const [isTracking, setIsTracking] = useState(false);
  const [isCarConnected, setIsCarConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onTripComplete, setOnTripComplete] = useState<
    ((tripId: string) => void) | null
  >(null);
  const onTripCompleteRef = useRef<((tripId: string) => void) | null>(null);
  const deviceAddressRef = useRef<string | null>(null);
  const { request: requestWakeLock, release: releaseWakeLock } = useWakeLock();

  const trip = useTripStore((state) => state.trip);
  const points = trip?.path ?? [];

  useEffect(() => {
    onTripCompleteRef.current = onTripComplete;
  }, [onTripComplete]);

  const initialize = useCallback(
    async (_deviceAddress: string) => {
      deviceAddressRef.current = _deviceAddress;
      try {
        await autoTracker.initialize(
          { carBluetoothName: "", distanceFilter: 10 },
          {
            onDeviceConnected: async () => {
              await requestWakeLock();
              setIsCarConnected(true);
              setIsTracking(true);
            },
            onDeviceDisconnected: async () => {
              await releaseWakeLock();
              setIsCarConnected(false);
              setIsTracking(false);
            },
            onLocationUpdate: () => {},
            onError: (err) => setError(err.message),
            onTripComplete: (tripId) => onTripCompleteRef.current?.(tripId),
          },
        );
        setIsInitialized(true);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [requestWakeLock, releaseWakeLock],
  );

  const startMonitoring = useCallback(
    async (deviceAddress: string, deviceName?: string) => {
      try {
        await autoTracker.startMonitoring(deviceAddress, deviceName);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [],
  );

  const stop = useCallback(async () => {
    try {
      await autoTracker.stop();
      await releaseWakeLock();
      setIsTracking(false);
      setIsCarConnected(false);
      setIsInitialized(false);
      deviceAddressRef.current = null;
    } catch (err) {
      setError((err as Error).message);
    }
  }, [releaseWakeLock]);

  useEffect(() => {
    return () => {
      autoTracker.stop().catch(() => {});
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  return {
    isTracking,
    isCarConnected,
    isInitialized,
    points,
    error,
    onTripComplete,
    setOnTripComplete,
    initialize,
    startMonitoring,
    stop,
  };
}
