import { useRef, useCallback } from "react";

interface SpeedFilterConfig {
  windowSize?: number;
  smoothingFactor?: number;
}

interface SpeedReading {
  speed: number;
  timestamp: number;
}

export function useSpeedFilter(config: SpeedFilterConfig = {}) {
  const { windowSize = 5, smoothingFactor = 0.7 } = config;

  const readingsRef = useRef<SpeedReading[]>([]);

  const addSpeedReading = useCallback(
    (speed: number, timestamp: number): number => {
      readingsRef.current.push({ speed, timestamp });

      if (readingsRef.current.length > windowSize) {
        readingsRef.current.shift();
      }

      if (readingsRef.current.length === 1) {
        return speed;
      }

      let weightedSum = 0;
      let weightTotal = 0;

      for (let i = 0; i < readingsRef.current.length; i++) {
        const weight = Math.pow(
          smoothingFactor,
          readingsRef.current.length - 1 - i,
        );
        weightedSum += readingsRef.current[i].speed * weight;
        weightTotal += weight;
      }

      return weightedSum / weightTotal;
    },
    [windowSize, smoothingFactor],
  );

  const reset = useCallback(() => {
    readingsRef.current = [];
  }, []);

  return {
    addSpeedReading,
    reset,
  };
}
