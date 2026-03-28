import { useEffect, useRef, useState, useCallback } from "react";
import type { Coordinates, BatteryState } from "@/types";

interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
}

interface GeolocationState {
  position: Coordinates | null;
  error: GeolocationPositionError | null;
  isWatching: boolean;
  battery: BatteryState | null;
}

interface UseGeolocationReturn extends GeolocationState {
  startWatching: (options?: GeolocationOptions) => void;
  stopWatching: () => void;
  getCurrentPosition: (
    options?: GeolocationOptions,
  ) => Promise<Coordinates | null>;
}

export function useGeolocation(): UseGeolocationReturn {
  const watchId = useRef<number | null>(null);
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [error, setError] = useState<GeolocationPositionError | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [battery, setBattery] = useState<BatteryState | null>(null);

  const startWatching = useCallback((options?: GeolocationOptions) => {
    if (!navigator.geolocation) {
      setError({
        code: 1,
        message: "Geolocation not supported",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError);
      return;
    }

    if (watchId.current !== null) {
      return;
    }

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords: Coordinates = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: pos.timestamp,
          accuracy: pos.coords.accuracy ?? undefined,
          speed: pos.coords.speed ?? undefined,
        };
        setPosition(coords);
        setError(null);
      },
      (err) => {
        setError(err);
      },
      {
        enableHighAccuracy: options?.enableHighAccuracy ?? true,
        maximumAge: options?.maximumAge ?? 0,
        timeout: options?.timeout ?? 10000,
      },
    );

    setIsWatching(true);
  }, []);

  const stopWatching = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      setIsWatching(false);
    }
  }, []);

  const getCurrentPosition = useCallback(
    async (options?: GeolocationOptions): Promise<Coordinates | null> => {
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve(null);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const coords: Coordinates = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              timestamp: pos.timestamp,
              accuracy: pos.coords.accuracy ?? undefined,
              speed: pos.coords.speed ?? undefined,
            };
            setPosition(coords);
            resolve(coords);
          },
          (err) => {
            setError(err);
            resolve(null);
          },
          {
            enableHighAccuracy: options?.enableHighAccuracy ?? true,
            maximumAge: options?.maximumAge ?? 0,
            timeout: options?.timeout ?? 10000,
          },
        );
      });
    },
    [],
  );

  useEffect(() => {
    if (!("getBattery" in navigator)) return;

    type BatteryManagerType = {
      charging: boolean;
      level: number;
      addEventListener: (type: string, listener: () => void) => void;
      removeEventListener: (type: string, listener: () => void) => void;
    };

    (navigator as Navigator & { getBattery: () => Promise<BatteryManagerType> })
      .getBattery()
      .then((bat) => {
        setBattery({
          charging: bat.charging,
          level: bat.level,
        });

        const updateBattery = () => {
          setBattery({
            charging: bat.charging,
            level: bat.level,
          });
        };

        bat.addEventListener("chargingchange", updateBattery);
        bat.addEventListener("levelchange", updateBattery);

        return () => {
          bat.removeEventListener("chargingchange", updateBattery);
          bat.removeEventListener("levelchange", updateBattery);
        };
      });
  }, []);

  useEffect(() => {
    return () => {
      stopWatching();
    };
  }, [stopWatching]);

  return {
    position,
    error,
    isWatching,
    battery,
    startWatching,
    stopWatching,
    getCurrentPosition,
  };
}
