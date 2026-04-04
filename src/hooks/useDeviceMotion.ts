import { useEffect, useRef, useState, useCallback } from "react";

export interface DeviceMotionData {
  acceleration: { x: number; y: number; z: number };
  accelerationIncludingGravity: { x: number; y: number; z: number };
  rotationRate: { alpha: number; beta: number; gamma: number };
  interval: number;
}

interface UseDeviceMotionReturn {
  motion: DeviceMotionData | null;
  isAvailable: boolean;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
}

export function useDeviceMotion(): UseDeviceMotionReturn {
  const [motion, setMotion] = useState<DeviceMotionData | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const lastUpdateRef = useRef<number>(0);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof DeviceMotionEvent === "undefined") {
      return false;
    }

    const deviceMotionEvent = DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };

    if (typeof deviceMotionEvent.requestPermission === "function") {
      try {
        const permission = await deviceMotionEvent.requestPermission();
        const granted = permission === "granted";
        setHasPermission(granted);
        return granted;
      } catch {
        setHasPermission(false);
        return false;
      }
    }

    setHasPermission(true);
    return true;
  }, []);

  useEffect(() => {
    if (typeof DeviceMotionEvent === "undefined") {
      setIsAvailable(false);
      return;
    }

    setIsAvailable(true);

    const handleMotion = (event: DeviceMotionEvent) => {
      const now = Date.now();
      if (now - lastUpdateRef.current < 16) {
        return;
      }
      lastUpdateRef.current = now;

      const {
        acceleration,
        accelerationIncludingGravity,
        rotationRate,
        interval,
      } = event;

      if (!accelerationIncludingGravity && !rotationRate && !acceleration) {
        return;
      }

      setMotion({
        acceleration: {
          x: acceleration?.x ?? 0,
          y: acceleration?.y ?? 0,
          z: acceleration?.z ?? 0,
        },
        accelerationIncludingGravity: {
          x: accelerationIncludingGravity?.x ?? 0,
          y: accelerationIncludingGravity?.y ?? 0,
          z: accelerationIncludingGravity?.z ?? 0,
        },
        rotationRate: {
          alpha: rotationRate?.alpha ?? 0,
          beta: rotationRate?.beta ?? 0,
          gamma: rotationRate?.gamma ?? 0,
        },
        interval: interval ?? 0,
      });
    };

    window.addEventListener("devicemotion", handleMotion);

    return () => {
      window.removeEventListener("devicemotion", handleMotion);
    };
  }, []);

  return {
    motion,
    isAvailable,
    hasPermission,
    requestPermission,
  };
}
