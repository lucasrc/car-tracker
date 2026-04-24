import { useRef, useState, useCallback, useEffect } from "react";

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
  addGpsReading: (altitudeM: number, distanceM: number) => void;
  calibrate: () => void;
  resetCalibration: () => void;
}

interface CalibrationData {
  offsetDegrees: number;
  calibratedAt: string;
}

const MIN_DISTANCE_FOR_GRADE = 10;
const MAX_ALTITUDE_JUMP = 20;
const GRADE_WINDOW_DISTANCE = 80;
const LOW_PASS_ALPHA = 0.08;
const MAX_REASONABLE_GRADE = 25;
const CONFIDENCE_PER_SAMPLE = 0.05;
const MAX_CONFIDENCE = 0.9;

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

interface AltitudeSample {
  altitudeM: number;
  cumulativeDistanceM: number;
}

export function useInclination(
  options: UseInclinationOptions = {},
): UseInclinationReturn {
  const { enabled = true } = options;

  const calibrationOffsetRef = useRef<number>(0);
  const isCalibratedRef = useRef<boolean>(false);
  const calibratingRef = useRef(false);
  const calibrationSamplesRef = useRef<number[]>([]);

  const samplesRef = useRef<AltitudeSample[]>([]);
  const cumulativeDistanceRef = useRef(0);
  const lastGradeRef = useRef(0);
  const sampleCountRef = useRef(0);

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
  }, []);

  const computeGradeFromWindow = useCallback(() => {
    const samples = samplesRef.current;
    if (samples.length < 2) return 0;

    const windowStart = samples[samples.length - 1].cumulativeDistanceM - GRADE_WINDOW_DISTANCE;

    let firstSample: AltitudeSample | null = null;
    for (let i = samples.length - 1; i >= 0; i--) {
      if (samples[i].cumulativeDistanceM <= windowStart) {
        firstSample = samples[i];
        break;
      }
    }

    if (!firstSample) {
      firstSample = samples[0];
    }

    const lastSample = samples[samples.length - 1];
    const distanceDelta = lastSample.cumulativeDistanceM - firstSample.cumulativeDistanceM;

    if (distanceDelta < MIN_DISTANCE_FOR_GRADE) return 0;

    const altitudeDelta = lastSample.altitudeM - firstSample.altitudeM;
    const gradeRad = Math.atan2(altitudeDelta, distanceDelta);
    const gradePercent = Math.tan(gradeRad) * 100;

    if (Math.abs(gradePercent) > MAX_REASONABLE_GRADE) return 0;

    return gradePercent;
  }, []);

  const updateOutput = useCallback(() => {
    const rawGrade = computeGradeFromWindow();
    const smoothed = lastGradeRef.current + LOW_PASS_ALPHA * (rawGrade - lastGradeRef.current);
    lastGradeRef.current = smoothed;

    const angleDeg = (Math.atan(smoothed / 100) * 180) / Math.PI;
    const calibratedAngle = angleDeg - calibrationOffsetRef.current;

    const conf = Math.min(sampleCountRef.current * CONFIDENCE_PER_SAMPLE, MAX_CONFIDENCE);
    const calibBonus = isCalibratedRef.current ? 0.1 : 0;
    const totalConfidence = Math.min(conf + calibBonus, 1);

    setGradePercent(Math.round(smoothed * 100) / 100);
    setAngleDegrees(Math.round(calibratedAngle * 100) / 100);
    setConfidence(Math.round(totalConfidence * 100) / 100);
  }, [computeGradeFromWindow]);

  const addGpsReading = useCallback(
    (altitudeM: number, distanceM: number) => {
      if (!enabled || distanceM < MIN_DISTANCE_FOR_GRADE) return;

      if (calibratingRef.current) {
        calibrationSamplesRef.current.push(altitudeM);
        if (calibrationSamplesRef.current.length >= 30) {
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

      const lastSample = samplesRef.current[samplesRef.current.length - 1];
      if (lastSample) {
        const altJump = Math.abs(altitudeM - lastSample.altitudeM);
        if (altJump > MAX_ALTITUDE_JUMP) {
          return;
        }
      }

      cumulativeDistanceRef.current += distanceM;
      samplesRef.current.push({
        altitudeM,
        cumulativeDistanceM: cumulativeDistanceRef.current,
      });

      const windowStart = cumulativeDistanceRef.current - GRADE_WINDOW_DISTANCE * 1.5;
      samplesRef.current = samplesRef.current.filter(
        (s) => s.cumulativeDistanceM >= windowStart,
      );

      sampleCountRef.current++;
      updateOutput();
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
    addGpsReading,
    calibrate,
    resetCalibration,
  };
}
