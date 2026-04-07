export type DrivingStyle = "eco" | "normal" | "sport";

export interface DrivingStyleState {
  currentStyle: DrivingStyle;
  accelerations: number[];
  lastStyleChangeTime: number;
  tripStartTime: number;
}

export interface DrivingStyleParams {
  optimalMin: number;
  optimalMax: number;
  upshiftAccelThreshold: number;
  upshiftRpmThreshold: number;
  upshiftBoost: number;
  belowOptimalBoost: number;
  redlinePenalty: number;
  memoryWeight: number;
  forceTopGearAbove: number | null;
  topGearBoost: number;
}

export const DRIVING_STYLE_PARAMS: Record<DrivingStyle, DrivingStyleParams> = {
  eco: {
    optimalMin: 0.75,
    optimalMax: 1.0,
    upshiftAccelThreshold: 1.5,
    upshiftRpmThreshold: 0.85,
    upshiftBoost: 3.0,
    belowOptimalBoost: 5.0,
    redlinePenalty: 0.1,
    memoryWeight: 0.08,
    forceTopGearAbove: 50,
    topGearBoost: 4.0,
  },
  normal: {
    optimalMin: 0.65,
    optimalMax: 1.1,
    upshiftAccelThreshold: 2.0,
    upshiftRpmThreshold: 0.9,
    upshiftBoost: 2.0,
    belowOptimalBoost: 2.5,
    redlinePenalty: 0.2,
    memoryWeight: 0.2,
    forceTopGearAbove: 60,
    topGearBoost: 2.5,
  },
  sport: {
    optimalMin: 0.55,
    optimalMax: 1.2,
    upshiftAccelThreshold: 3.0,
    upshiftRpmThreshold: 1.0,
    upshiftBoost: 1.2,
    belowOptimalBoost: 1.3,
    redlinePenalty: 0.5,
    memoryWeight: 0.35,
    forceTopGearAbove: null,
    topGearBoost: 1.0,
  },
};

const WINDOW_SIZE = 100;
const COOLDOWN_MS = 30000;
const SPORT_ACCEL_THRESHOLD = 4.0;
const NORMAL_ACCEL_THRESHOLD = 2.5;
const MIN_EVENTS_FOR_DETECTION = 20;

export function detectDrivingStyle(state: DrivingStyleState): DrivingStyle {
  const accel = state.accelerations;
  if (accel.length < MIN_EVENTS_FOR_DETECTION) {
    return "eco";
  }

  const aggressiveCount = accel.filter(
    (a) => a > NORMAL_ACCEL_THRESHOLD,
  ).length;
  const sportCount = accel.filter((a) => a > SPORT_ACCEL_THRESHOLD).length;
  const ratio = aggressiveCount / accel.length;

  if (sportCount >= 5 || ratio > 0.4) {
    return "sport";
  }

  if (ratio > 0.2) {
    return "normal";
  }

  return "eco";
}

export function shouldChangeStyle(
  state: DrivingStyleState,
  newStyle: DrivingStyle,
): boolean {
  if (state.currentStyle === newStyle) return false;

  const timeSinceLastChange = Date.now() - state.lastStyleChangeTime;
  if (timeSinceLastChange < COOLDOWN_MS) return false;

  return true;
}

export function createDrivingStyleState(): DrivingStyleState {
  return {
    currentStyle: "eco",
    accelerations: [],
    lastStyleChangeTime: 0,
    tripStartTime: Date.now(),
  };
}

export function addAccelerationObservation(
  state: DrivingStyleState,
  accel: number,
  speed: number,
): DrivingStyleState {
  if (speed < 10) {
    return state;
  }

  const newAccelerations = [...state.accelerations, accel];
  if (newAccelerations.length > WINDOW_SIZE) {
    newAccelerations.shift();
  }

  return {
    ...state,
    accelerations: newAccelerations,
  };
}

export function updateDrivingStyle(
  state: DrivingStyleState,
): DrivingStyleState {
  const detectedStyle = detectDrivingStyle(state);

  if (shouldChangeStyle(state, detectedStyle)) {
    return {
      ...state,
      currentStyle: detectedStyle,
      lastStyleChangeTime: Date.now(),
    };
  }

  return state;
}

export function resetDrivingStyleForTrip(
  state: DrivingStyleState,
): DrivingStyleState {
  return {
    ...state,
    currentStyle: "eco",
    accelerations: [],
    lastStyleChangeTime: 0,
    tripStartTime: Date.now(),
  };
}

export function getParamsForStyle(style: DrivingStyle): DrivingStyleParams {
  return DRIVING_STYLE_PARAMS[style];
}
