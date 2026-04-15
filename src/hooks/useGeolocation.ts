import { useEffect, useRef, useState, useCallback } from "react";
import type { Coordinates, BatteryState } from "@/types";
import { useDeviceMotion } from "./useDeviceMotion";
import { useMadgwickFilter } from "./useMadgwickFilter";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

declare global {
  interface Window {
    Capacitor?: typeof Capacitor;
  }
}

async function requestLocationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    if (typeof navigator === "undefined") return false;

    if (
      typeof (
        navigator as unknown as {
          permissions?: {
            query: (params: { name: string }) => Promise<{ state: string }>;
          };
        }
      ).permissions !== "undefined"
    ) {
      try {
        const result = await (
          navigator as unknown as {
            permissions: {
              query: (params: { name: string }) => Promise<{ state: string }>;
            };
          }
        ).permissions.query({
          name: "geolocation",
        });
        if (result.state === "granted") return true;
        if (result.state === "denied") return false;
      } catch {
        // API não suportada, continuar
      }
    }

    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        (err) => {
          console.warn("Geolocation permission error:", err.code, err.message);
          resolve(err.code !== 1);
        },
        { maximumAge: Infinity, timeout: 0 },
      );
    });
  }

  try {
    const result = await Geolocation.requestPermissions();
    return result.location === "granted";
  } catch (err) {
    console.warn("Capacitor Geolocation permission error:", err);
    return false;
  }
}

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
  deviceOrientation: number | null;
  filteredHeading: number | null;
  filteredPitch: number | null;
  filteredRoll: number | null;
  orientationReady: boolean;
  hasPermission: boolean | null;
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
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [battery, setBattery] = useState<BatteryState | null>(null);
  const [deviceOrientation, setDeviceOrientation] = useState<number | null>(
    null,
  );

  const deviceOrientationRef = useRef<number | null>(null);

  const {
    motion,
    isAvailable: motionAvailable,
    requestPermission: requestMotionPermission,
  } = useDeviceMotion();
  const {
    heading: filteredHeading,
    pitch: filteredPitch,
    roll: filteredRoll,
    isReady: orientationReady,
    update: updateMadgwick,
  } = useMadgwickFilter({ sampleInterval: 50, beta: 0.1 });

  useEffect(() => {
    if (!motion) {
      return;
    }

    const { rotationRate, accelerationIncludingGravity } = motion;

    const currentDeviceOrientation = deviceOrientationRef.current;

    updateMadgwick({
      gyro: {
        x: rotationRate.alpha,
        y: rotationRate.beta,
        z: rotationRate.gamma,
      },
      accel: {
        x: accelerationIncludingGravity.x,
        y: accelerationIncludingGravity.y,
        z: accelerationIncludingGravity.z,
      },
      mag:
        currentDeviceOrientation !== null
          ? {
              x: currentDeviceOrientation,
              y: 0,
              z: 0,
            }
          : undefined,
    });
  }, [motion, updateMadgwick]);

  const startWatching = useCallback((options?: GeolocationOptions) => {
    console.log(
      "[GPS] startWatching called, isNativePlatform:",
      Capacitor.isNativePlatform(),
    );
    if (Capacitor.isNativePlatform()) {
      requestLocationPermission().then(async (granted) => {
        setHasPermission(granted);

        if (!granted) {
          setError({
            code: 1,
            message: "Location permission denied",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
          return;
        }

        if (watchId.current !== null) {
          return;
        }

        try {
          const watchIdValue = await Geolocation.watchPosition(
            {
              enableHighAccuracy: options?.enableHighAccuracy ?? true,
              maximumAge: options?.maximumAge ?? 0,
              timeout: options?.timeout ?? 10000,
            },
            (pos, err) => {
              if (err) {
                setError(err);
                return;
              }
              if (!pos) return;
              const coords: Coordinates = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                timestamp: pos.timestamp,
                accuracy: pos.coords.accuracy ?? undefined,
                speed: pos.coords.speed ?? undefined,
                heading:
                  pos.coords.heading !== null &&
                  !Number.isNaN(pos.coords.heading)
                    ? pos.coords.heading
                    : undefined,
                altitude: pos.coords.altitude ?? undefined,
                altitudeAccuracy: pos.coords.altitudeAccuracy ?? undefined,
              };
              setPosition(coords);
              setError(null);
              console.log("[GPS] Position updated:", JSON.stringify(coords));
            },
          );
          watchId.current = watchIdValue as unknown as number;
          setIsWatching(true);
        } catch (err) {
          console.error("Geolocation.watchPosition error:", err);
          setError(err as GeolocationPositionError);
        }
      });
      return;
    }

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

    requestLocationPermission().then((granted) => {
      setHasPermission(granted);

      if (!granted) {
        setError({
          code: 1,
          message: "Location permission denied",
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
            heading:
              pos.coords.heading !== null && !Number.isNaN(pos.coords.heading)
                ? pos.coords.heading
                : undefined,
            altitude: pos.coords.altitude ?? undefined,
            altitudeAccuracy: pos.coords.altitudeAccuracy ?? undefined,
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
    });
  }, []);

  const stopWatching = useCallback(() => {
    if (watchId.current !== null) {
      if (Capacitor.isNativePlatform()) {
        Geolocation.clearWatch({
          id: watchId.current as unknown as string,
        }).catch(() => {});
      } else {
        navigator.geolocation.clearWatch(watchId.current);
      }
      watchId.current = null;
      setIsWatching(false);
    }
  }, []);

  const getCurrentPosition = useCallback(
    async (options?: GeolocationOptions): Promise<Coordinates | null> => {
      const hasPerm = await requestLocationPermission();
      setHasPermission(hasPerm);

      if (!hasPerm) {
        return null;
      }

      if (Capacitor.isNativePlatform()) {
        try {
          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: options?.enableHighAccuracy ?? true,
            maximumAge: options?.maximumAge ?? 0,
            timeout: options?.timeout ?? 10000,
          });
          const coords: Coordinates = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            timestamp: pos.timestamp,
            accuracy: pos.coords.accuracy ?? undefined,
            speed: pos.coords.speed ?? undefined,
            heading:
              pos.coords.heading !== null && !Number.isNaN(pos.coords.heading)
                ? pos.coords.heading
                : undefined,
            altitude: pos.coords.altitude ?? undefined,
            altitudeAccuracy: pos.coords.altitudeAccuracy ?? undefined,
          };
          setPosition(coords);
          return coords;
        } catch (err) {
          console.error("Geolocation.getCurrentPosition error:", err);
          setError(err as GeolocationPositionError);
          return null;
        }
      }

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

  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        setDeviceOrientation(event.alpha);
        deviceOrientationRef.current = event.alpha;
      }
    };

    if (typeof DeviceOrientationEvent !== "undefined") {
      if (
        typeof (
          DeviceOrientationEvent as unknown as {
            requestPermission?: () => Promise<string>;
          }
        ).requestPermission === "function"
      ) {
        (
          DeviceOrientationEvent as unknown as {
            requestPermission: () => Promise<string>;
          }
        )
          .requestPermission()
          .then((permission) => {
            if (permission === "granted") {
              window.addEventListener("deviceorientation", handleOrientation);
            }
          })
          .catch(console.error);
      } else {
        window.addEventListener("deviceorientation", handleOrientation);
      }
    }

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, []);

  useEffect(() => {
    if (!motionAvailable) return;

    requestMotionPermission();
  }, [motionAvailable, requestMotionPermission]);

  return {
    position,
    error,
    isWatching,
    hasPermission,
    battery,
    deviceOrientation,
    filteredHeading,
    filteredPitch,
    filteredRoll,
    orientationReady,
    startWatching,
    stopWatching,
    getCurrentPosition,
  };
}
