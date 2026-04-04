import { useRef, useState, useCallback } from "react";
import AHRS from "ahrs";

interface SensorData {
  gyro: { x: number; y: number; z: number };
  accel: { x: number; y: number; z: number };
  mag?: { x: number; y: number; z: number };
}

interface UseMadgwickFilterOptions {
  sampleInterval?: number;
  beta?: number;
}

interface UseMadgwickFilterReturn {
  heading: number | null;
  pitch: number | null;
  roll: number | null;
  isReady: boolean;
  update: (data: SensorData) => void;
  reset: () => void;
}

const DEFAULT_SAMPLE_INTERVAL = 50;
const DEGREES_TO_RADIANS = Math.PI / 180;
const G_FORCE = 9.81;

export function useMadgwickFilter(
  options: UseMadgwickFilterOptions = {},
): UseMadgwickFilterReturn {
  const { sampleInterval = DEFAULT_SAMPLE_INTERVAL, beta = 0.1 } = options;

  const [heading, setHeading] = useState<number | null>(null);
  const [pitch, setPitch] = useState<number | null>(null);
  const [roll, setRoll] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);

  const ahrsRef = useRef<AHRS | null>(null);
  const lastTimeRef = useRef<number>(0);
  const initializedRef = useRef(false);
  const pendingMagRef = useRef<{ x: number; y: number; z: number } | null>(
    null,
  );

  const initFilter = useCallback(() => {
    ahrsRef.current = new AHRS({
      sampleInterval: sampleInterval,
      algorithm: "Madgwick",
      beta: beta,
      doInitialisation: true,
    });
  }, [sampleInterval, beta]);

  const reset = useCallback(() => {
    initFilter();
    setHeading(null);
    setPitch(null);
    setRoll(null);
    setIsReady(false);
    initializedRef.current = false;
    pendingMagRef.current = null;
  }, [initFilter]);

  const update = useCallback(
    (data: SensorData) => {
      if (!ahrsRef.current) {
        initFilter();
        if (!ahrsRef.current) return;
      }

      if (data.mag) {
        pendingMagRef.current = data.mag;
      }

      const now = Date.now();
      let deltaTime = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      if (deltaTime <= 0 || deltaTime > 1) {
        deltaTime = sampleInterval / 1000;
      }

      const gyroX = data.gyro.x * DEGREES_TO_RADIANS;
      const gyroY = data.gyro.y * DEGREES_TO_RADIANS;
      const gyroZ = data.gyro.z * DEGREES_TO_RADIANS;

      const accelX = data.accel.x / G_FORCE;
      const accelY = data.accel.y / G_FORCE;
      const accelZ = data.accel.z / G_FORCE;

      if (!initializedRef.current) {
        initializedRef.current = true;
        setIsReady(true);
      }

      try {
        const mag = pendingMagRef.current;

        // eslint-disable-next-line no-console
        console.log("Madgwick update:", {
          gyro: {
            x: gyroX.toFixed(3),
            y: gyroY.toFixed(3),
            z: gyroZ.toFixed(3),
          },
          accel: {
            x: accelX.toFixed(3),
            y: accelY.toFixed(3),
            z: accelZ.toFixed(3),
          },
          mag: mag ? { x: mag.x.toFixed(0), y: mag.y, z: mag.z } : null,
          deltaTime: deltaTime.toFixed(3),
        });

        if (mag) {
          ahrsRef.current.update(
            gyroX,
            gyroY,
            gyroZ,
            accelX,
            accelY,
            accelZ,
            mag.x,
            mag.y,
            mag.z,
            deltaTime,
          );
        } else {
          ahrsRef.current.update(
            gyroX,
            gyroY,
            gyroZ,
            accelX,
            accelY,
            accelZ,
            undefined,
            undefined,
            undefined,
            deltaTime,
          );
        }

        const euler = ahrsRef.current.getEulerAnglesDegrees();

        // eslint-disable-next-line no-console
        console.log("Raw Euler:", JSON.stringify(euler));

        if (
          typeof euler.heading !== "number" ||
          typeof euler.pitch !== "number" ||
          typeof euler.roll !== "number" ||
          isNaN(euler.heading) ||
          isNaN(euler.pitch) ||
          isNaN(euler.roll)
        ) {
          // eslint-disable-next-line no-console
          console.log("NaN detected in euler, skipping");
          return;
        }

        let headingDegrees = euler.heading;
        if (headingDegrees < 0) {
          headingDegrees += 360;
        }
        headingDegrees = headingDegrees % 360;

        setHeading(headingDegrees);
        setPitch(euler.pitch);
        setRoll(euler.roll);
        // eslint-disable-next-line no-console
        console.log("Madgwick result:", {
          heading: headingDegrees.toFixed(0),
          pitch: euler.pitch.toFixed(0),
          roll: euler.roll.toFixed(0),
        });
      } catch {
        // Silently ignore errors during filter update
      }
    },
    [sampleInterval, initFilter],
  );

  return {
    heading,
    pitch,
    roll,
    isReady,
    update,
    reset,
  };
}
