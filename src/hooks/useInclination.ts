import { useRef, useState, useCallback, useEffect } from "react";
import { KalmanFilter1D } from "@/lib/kalman-filter-1d";

const CALIBRATION_STORAGE_KEY = "inclination-calibration";

interface UseInclinationOptions {
  enabled?: boolean;
}

export interface InclinationData {
  gradePercent: number;
  angleDegrees: number;
  confidence: number;
  isCalibrated: boolean;
}

export interface UseInclinationReturn extends InclinationData {
  addPitchReading: (pitchDegrees: number, timestamp: number) => void;
  addGpsReading: (
    altitudeM: number | undefined,
    distanceFromLastM: number,
  ) => void;
  calibrate: () => void;
  resetCalibration: () => void;
}

interface CalibrationData {
  offsetDegrees: number;
  calibratedAt: string;
}

const PITCH_Q = 0.01;
const PITCH_R = 0.5;
const GPS_Q = 0.1;
const GPS_R = 5.0;
const PITCH_WEIGHT = 0.85;
const GPS_WEIGHT = 0.15;
const CALIBRATION_SAMPLES = 60;

function loadCalibration(): CalibrationData | null {
  try {
    const raw = localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CalibrationData;
  } catch {
    return null;
  }
}

function saveCalibration(data: CalibrationData): void {
  localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(data));
}

function clearCalibrationData(): void {
  localStorage.removeItem(CALIBRATION_STORAGE_KEY);
}

export function useInclination(
  options: UseInclinationOptions = {},
): UseInclinationReturn {
  const { enabled = true } = options;

  const pitchKalmanRef = useRef<KalmanFilter1D | null>(null);
  const gpsKalmanRef = useRef<KalmanFilter1D | null>(null);
  const calibrationOffsetRef = useRef<number>(0);
  const isCalibratedRef = useRef<boolean>(false);

  const calibratingRef = useRef(false);
  const calibrationSamplesRef = useRef<number[]>([]);
  const lastAltitudeRef = useRef<number | null>(null);

  const [gradePercent, setGradePercent] = useState(0);
  const [angleDegrees, setAngleDegrees] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [isCalibrated, setIsCalibrated] = useState(false);

  useEffect(() => {
    const saved = loadCalibration();
    if (saved) {
      calibrationOffsetRef.current = saved.offsetDegrees;
      isCalibratedRef.current = true;
      setIsCalibrated(true);
    }

    pitchKalmanRef.current = new KalmanFilter1D(0, PITCH_Q, PITCH_R);
    gpsKalmanRef.current = new KalmanFilter1D(0, GPS_Q, GPS_R);
  }, []);

  const pitchReadingCountRef = useRef(0);

  const updateOutput = useCallback(() => {
    const pitchKf = pitchKalmanRef.current;
    const gpsKf = gpsKalmanRef.current;
    if (!pitchKf) return;

    const pitchEstimate = pitchKf.getEstimate() - calibrationOffsetRef.current;
    const gpsEstimate = gpsKf?.getEstimate() ?? pitchEstimate;

    const hasGpsData = gpsKf !== null && lastAltitudeRef.current !== null;
    const finalAngle = hasGpsData
      ? PITCH_WEIGHT * pitchEstimate + GPS_WEIGHT * gpsEstimate
      : pitchEstimate;

    const pitchConvergence = Math.min(pitchReadingCountRef.current / 30, 0.8);
    const gpsConfidence = hasGpsData ? 0.15 : 0;
    const calibBonus = isCalibratedRef.current ? 0.2 : 0;
    const totalConfidence = Math.min(
      pitchConvergence + gpsConfidence + calibBonus,
      1,
    );

    const grade = Math.tan((finalAngle * Math.PI) / 180) * 100;

    setAngleDegrees(finalAngle);
    setGradePercent(grade);
    setConfidence(totalConfidence);
  }, []);

  const addPitchReading = useCallback(
    (pitchDegrees: number, timestamp: number) => {
      void timestamp;
      if (!enabled) return;

      if (calibratingRef.current) {
        calibrationSamplesRef.current.push(pitchDegrees);
        if (calibrationSamplesRef.current.length >= CALIBRATION_SAMPLES) {
          const samples = calibrationSamplesRef.current;
          const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
          calibrationOffsetRef.current = avg;
          isCalibratedRef.current = true;
          setIsCalibrated(true);
          saveCalibration({
            offsetDegrees: avg,
            calibratedAt: new Date().toISOString(),
          });
          calibratingRef.current = false;
          calibrationSamplesRef.current = [];
        }
        return;
      }

      const kf = pitchKalmanRef.current;
      if (!kf) return;

      kf.update(pitchDegrees);
      pitchReadingCountRef.current++;
      updateOutput();
    },
    [enabled, updateOutput],
  );

  const addGpsReading = useCallback(
    (altitudeM: number | undefined, distanceFromLastM: number) => {
      if (!enabled || altitudeM === undefined) return;

      if (lastAltitudeRef.current !== null && distanceFromLastM > 5) {
        const deltaAlt = altitudeM - lastAltitudeRef.current;
        const gradeDeg =
          Math.atan2(deltaAlt, distanceFromLastM) * (180 / Math.PI);

        const kf = gpsKalmanRef.current;
        if (kf && Math.abs(gradeDeg) < 30) {
          kf.update(gradeDeg);
          updateOutput();
        }
      }

      lastAltitudeRef.current = altitudeM;
    },
    [enabled, updateOutput],
  );

  const calibrate = useCallback(() => {
    calibratingRef.current = true;
    calibrationSamplesRef.current = [];
  }, []);

  const resetCalibration = useCallback(() => {
    calibratingRef.current = false;
    calibrationSamplesRef.current = [];
    calibrationOffsetRef.current = 0;
    isCalibratedRef.current = false;
    setIsCalibrated(false);
    clearCalibrationData();
  }, []);

  return {
    gradePercent,
    angleDegrees,
    confidence,
    isCalibrated,
    addPitchReading,
    addGpsReading,
    calibrate,
    resetCalibration,
  };
}
