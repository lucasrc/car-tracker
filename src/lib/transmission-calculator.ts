import type { Vehicle, TransmissionData } from "@/types";

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export interface EngineLoadInput {
  vehicle: Vehicle;
  speedKmh: number;
  accelerationMps2: number;
  slopePercent: number;
  gearIndex: number; // 0-based index (0 = 1st gear)
}

export interface EngineLoadResult {
  engineLoadPercent: number;
  requiredPowerKw: number;
  availablePowerKw: number;
  currentRpm: number;
  availableTorqueNm: number;
  isLugging: boolean;
  isOverRev: boolean;
  powerBreakdown: {
    rollingResistanceKw: number;
    aerodynamicDragKw: number;
    slopeKw: number;
    accelerationKw: number;
    totalKw: number;
  };
}

export interface GearEstimationResult {
  gear: number;
  rpm: number;
  confidence: number;
  engineLoad: number;
  reason: string;
}

// ============================================================================
// CONSTANTES FÍSICAS
// ============================================================================

const PHYSICS = {
  G: 9.81, // m/s²
  AIR_DENSITY: 1.225, // kg/m³ at sea level
} as const;

// RPM mínimos operacionais por tipo de motor
const MIN_OPERATING_RPM = {
  NA: 1300,
  turbo: 1100,
  "turbo-diesel": 1000,
} as const;

// ============================================================================
// FUNÇÕES PRINCIPAIS DE CÁLCULO DE RPM
// ============================================================================

/**
 * Validate and correct transmission data using rpmAt100Kmh as the source of truth.
 * If rpmAt100Kmh exists and is inconsistent with other parameters,
 * it takes precedence and tireRadiusM is adjusted.
 */
export function validateTransmission(
  transmission: TransmissionData,
): TransmissionData {
  const { gearRatios, finalDrive, tireRadiusM, rpmAt100Kmh } = transmission;

  // If rpmAt100Kmh is not provided, return as-is (will use physical calculations)
  if (!rpmAt100Kmh || rpmAt100Kmh <= 0) {
    return transmission;
  }

  const topGearIndex = gearRatios.length - 1;
  const topGearRatio = gearRatios[topGearIndex];

  // Calculate what the RPM should be with current parameters
  const speedMs = 100 / 3.6; // 100 km/h in m/s
  const wheelRpsCalculated = speedMs / (2 * Math.PI * tireRadiusM);
  const rpmCalculated = Math.round(
    wheelRpsCalculated * topGearRatio * finalDrive * 60,
  );

  // Allow 3% tolerance for rounding errors
  const tolerance = rpmAt100Kmh * 0.03;
  const difference = Math.abs(rpmCalculated - rpmAt100Kmh);

  if (difference <= tolerance) {
    // Data is consistent, no correction needed
    return transmission;
  }

  // Data is inconsistent - rpmAt100Kmh is the source of truth
  // Calculate the correct tireRadiusM that would produce rpmAt100Kmh
  // Formula: rpm = (100/3.6) / (2π * r) * gearRatio * finalDrive * 60
  // Solving for r: r = (100/3.6) * gearRatio * finalDrive * 60 / (2π * rpm)
  const correctedTireRadiusM =
    (speedMs * topGearRatio * finalDrive * 60) / (2 * Math.PI * rpmAt100Kmh);

  console.log(
    `[Transmission] Correcting transmission data: calculated RPM=${rpmCalculated}, ` +
      `expected RPM=${rpmAt100Kmh}, correcting tireRadiusM from ${tireRadiusM.toFixed(3)} to ${correctedTireRadiusM.toFixed(3)}`,
  );

  return {
    ...transmission,
    tireRadiusM: Math.round(correctedTireRadiusM * 1000) / 1000,
  };
}

/**
 * Calculate RPM for a given speed, gear, and transmission.
 * Uses rpmAt100Kmh as source of truth when available.
 */
export function calculateRpm(
  speedKmh: number,
  gearIndex: number,
  transmission: TransmissionData,
): number {
  // Validate and correct transmission data if needed
  const correctedTransmission = validateTransmission(transmission);

  // Calculate RPM proportionally based on speed
  // If rpmAt100Kmh is available, use it as reference
  if (
    correctedTransmission.rpmAt100Kmh &&
    correctedTransmission.rpmAt100Kmh > 0
  ) {
    const topGearIndex = correctedTransmission.gearRatios.length - 1;
    const currentGearRatio = correctedTransmission.gearRatios[gearIndex];
    const topGearRatio = correctedTransmission.gearRatios[topGearIndex];

    // RPM is proportional to speed and gear ratio
    // RPM = rpmAt100Kmh * (speed / 100) * (currentGearRatio / topGearRatio)
    const rpm = Math.round(
      correctedTransmission.rpmAt100Kmh *
        (speedKmh / 100) *
        (currentGearRatio / topGearRatio),
    );

    return rpm;
  }

  // Fallback: physical calculation
  const speedMs = speedKmh / 3.6;
  const wheelRps = speedMs / (2 * Math.PI * correctedTransmission.tireRadiusM);
  const gearRatio = correctedTransmission.gearRatios[gearIndex];
  const engineRps = wheelRps * gearRatio * correctedTransmission.finalDrive;
  return Math.round(engineRps * 60);
}

// ============================================================================
// CÁLCULO DE CARGA DO MOTOR
// ============================================================================

/**
 * Determine engine aspiration type from vehicle data
 */
export function getAspirationType(
  vehicle: Vehicle,
): "NA" | "turbo" | "turbo-diesel" {
  // Check if vehicle has turbo characteristics
  if (vehicle.peakPowerKw > 0 && vehicle.peakTorqueNm > 0) {
    const powerToDisplacement =
      vehicle.peakPowerKw / (vehicle.displacement / 1000);
    // High power/displacement ratio indicates turbo
    if (powerToDisplacement > 55) {
      return vehicle.fuelType === "diesel" ? "turbo-diesel" : "turbo";
    }
  }

  // Check transmission data for hints
  if (vehicle.transmission?.torqueCurve) {
    const curve = vehicle.transmission.torqueCurve;
    const rpms = Object.keys(curve)
      .map(Number)
      .sort((a, b) => a - b);
    if (rpms.length > 0) {
      const torqueAt1000 = curve[1000] ?? curve[rpms[0]];
      const maxTorque = Math.max(...Object.values(curve));
      // If torque is already high at low RPM, likely turbo
      if (torqueAt1000 > maxTorque * 0.8 && rpms[0] <= 1500) {
        return vehicle.fuelType === "diesel" ? "turbo-diesel" : "turbo";
      }
    }
  }

  return "NA";
}

/**
 * Estimate torque curve based on engine characteristics
 */
export function estimateTorqueCurve(
  displacement: number,
  peakTorqueNm: number,
  aspiration: "NA" | "turbo" | "turbo-diesel" = "NA",
  idleRpm: number = 800,
  redlineRpm: number = 6000,
): Record<number, number> {
  const curve: Record<number, number> = {};
  const rpms = [
    idleRpm,
    1000,
    1250,
    1500,
    1750,
    2000,
    2250,
    2500,
    2750,
    3000,
    3250,
    3500,
    3750,
    4000,
    4500,
    5000,
    5500,
    6000,
    redlineRpm,
  ].filter((rpm) => rpm >= idleRpm && rpm <= redlineRpm);

  // Define torque curve profiles based on aspiration type
  const profiles = {
    NA: {
      idleFactor: 0.75,
      peakRpm: 3500 + displacement * 0.5,
      dropOffStart: 5000,
      redlineFactor: 0.72,
    },
    turbo: {
      idleFactor: 0.45,
      peakRpm: 2000 + displacement * 0.3,
      dropOffStart: 4500,
      redlineFactor: 0.78,
    },
    "turbo-diesel": {
      idleFactor: 0.55,
      peakRpm: 1750 + displacement * 0.15,
      dropOffStart: 3000,
      redlineFactor: 0.65,
    },
  };

  const profile = profiles[aspiration];

  for (const rpm of rpms) {
    let torqueFactor: number;

    if (rpm <= profile.peakRpm) {
      const progress = (rpm - idleRpm) / (profile.peakRpm - idleRpm);
      torqueFactor =
        profile.idleFactor +
        (1.0 - profile.idleFactor) * Math.sin((progress * Math.PI) / 2);
    } else if (rpm <= profile.dropOffStart) {
      torqueFactor = 1.0;
    } else {
      const progress =
        (rpm - profile.dropOffStart) / (redlineRpm - profile.dropOffStart);
      torqueFactor = 1.0 - (1.0 - profile.redlineFactor) * progress;
    }

    curve[rpm] = Math.round(peakTorqueNm * torqueFactor);
  }

  return curve;
}

/**
 * Get torque at a specific RPM by interpolating the torque curve
 */
export function getTorqueAtRpm(
  rpm: number,
  torqueCurve: Record<number, number>,
  peakTorqueNm: number,
  idleRpm: number,
  redlineRpm: number,
): number {
  const rpms = Object.keys(torqueCurve)
    .map(Number)
    .sort((a, b) => a - b);

  if (rpms.length === 0) return peakTorqueNm;

  if (rpm <= idleRpm) return torqueCurve[rpms[0]] ?? peakTorqueNm * 0.7;
  if (rpm >= redlineRpm)
    return torqueCurve[rpms[rpms.length - 1]] ?? peakTorqueNm * 0.7;

  for (let i = 0; i < rpms.length - 1; i++) {
    if (rpm >= rpms[i] && rpm <= rpms[i + 1]) {
      const t1 = torqueCurve[rpms[i]];
      const t2 = torqueCurve[rpms[i + 1]];
      const ratio = (rpm - rpms[i]) / (rpms[i + 1] - rpms[i]);
      return t1 + (t2 - t1) * ratio;
    }
  }

  return torqueCurve[rpms[0]] ?? peakTorqueNm;
}

/**
 * Calculate engine load for a given driving condition
 */
export function calculateEngineLoad(input: EngineLoadInput): EngineLoadResult {
  const { vehicle, speedKmh, accelerationMps2, slopePercent, gearIndex } =
    input;
  const transmission = vehicle.transmission;

  if (!transmission) {
    throw new Error(
      "Vehicle must have transmission data to calculate engine load",
    );
  }

  if (gearIndex < 0 || gearIndex >= transmission.gearRatios.length) {
    throw new Error(
      `Invalid gear index ${gearIndex}. Vehicle has ${transmission.gearRatios.length} gears.`,
    );
  }

  // Calculate current RPM (uses validated transmission)
  const currentRpm = calculateRpm(speedKmh, gearIndex, transmission);

  // Get or estimate torque curve
  let torqueCurve = transmission.torqueCurve;
  if (!torqueCurve || Object.keys(torqueCurve).length < 3) {
    const aspiration = getAspirationType(vehicle);
    torqueCurve = estimateTorqueCurve(
      vehicle.displacement,
      vehicle.peakTorqueNm,
      aspiration,
      transmission.idleRpm,
      transmission.redlineRpm,
    );
  }

  // Get available torque at current RPM
  const availableTorqueNm = getTorqueAtRpm(
    currentRpm,
    torqueCurve,
    vehicle.peakTorqueNm,
    transmission.idleRpm,
    transmission.redlineRpm,
  );

  // Calculate available power (kW): P = τ × ω
  const availablePowerKw =
    (availableTorqueNm * currentRpm * 2 * Math.PI) / 60000;

  // Calculate required power components
  const speedMs = speedKmh / 3.6;
  const massTotal = vehicle.mass + 75; // Add driver weight
  const cda = vehicle.frontalArea * vehicle.dragCoefficient;

  // 1. Rolling resistance power
  const rollingResistanceKw =
    (massTotal * PHYSICS.G * vehicle.crr * speedMs) / 1000;

  // 2. Aerodynamic drag power (scales with velocity cubed)
  const aerodynamicDragKw =
    (0.5 * PHYSICS.AIR_DENSITY * cda * Math.pow(speedMs, 3)) / 1000;

  // 3. Slope power - CRITICAL: this is where slope affects load!
  const slopeRadians = Math.atan(slopePercent / 100);
  const slopeForce = massTotal * PHYSICS.G * Math.sin(slopeRadians);
  const slopeKw = (slopeForce * speedMs) / 1000;

  // 4. Acceleration power
  const accelerationForce = massTotal * accelerationMps2;
  const accelerationKw = (accelerationForce * speedMs) / 1000;

  // Total required power
  const requiredPowerKw =
    rollingResistanceKw + aerodynamicDragKw + slopeKw + accelerationKw;

  // Calculate engine load percentage
  const minPowerKw = 1.0;
  const effectiveAvailablePower = Math.max(availablePowerKw, minPowerKw);
  const engineLoadPercent = (requiredPowerKw / effectiveAvailablePower) * 100;

  // Determine operating conditions
  const aspiration = getAspirationType(vehicle);
  const minOperatingRpm = MIN_OPERATING_RPM[aspiration] || 1300;
  const isLugging = currentRpm < minOperatingRpm && speedKmh > 5;
  const isOverRev = currentRpm > transmission.redlineRpm * 0.9;

  return {
    engineLoadPercent: Math.round(engineLoadPercent * 10) / 10,
    requiredPowerKw: Math.round(requiredPowerKw * 100) / 100,
    availablePowerKw: Math.round(availablePowerKw * 100) / 100,
    currentRpm,
    availableTorqueNm: Math.round(availableTorqueNm * 10) / 10,
    isLugging,
    isOverRev,
    powerBreakdown: {
      rollingResistanceKw: Math.round(rollingResistanceKw * 100) / 100,
      aerodynamicDragKw: Math.round(aerodynamicDragKw * 100) / 100,
      slopeKw: Math.round(slopeKw * 100) / 100,
      accelerationKw: Math.round(accelerationKw * 100) / 100,
      totalKw: Math.round(requiredPowerKw * 100) / 100,
    },
  };
}

/**
 * Calculate engine load for all possible gears
 */
export function calculateEngineLoadForAllGears(
  vehicle: Vehicle,
  speedKmh: number,
  accelerationMps2: number,
  slopePercent: number,
): Array<EngineLoadResult & { gearIndex: number; gearNumber: number }> {
  if (!vehicle.transmission) {
    return [];
  }

  const results: Array<
    EngineLoadResult & { gearIndex: number; gearNumber: number }
  > = [];

  for (let i = 0; i < vehicle.transmission.gearRatios.length; i++) {
    try {
      const result = calculateEngineLoad({
        vehicle,
        speedKmh,
        accelerationMps2,
        slopePercent,
        gearIndex: i,
      });

      results.push({
        ...result,
        gearIndex: i,
        gearNumber: i + 1,
      });
    } catch {
      continue;
    }
  }

  return results;
}

// ============================================================================
// SELEÇÃO DE MARCHA BASEADA EM CARGA DO MOTOR
// ============================================================================

export interface GearSelectionParams {
  maxLoadPercent: number; // Maximum acceptable load (e.g., 85%)
  minLoadPercent: number; // Minimum acceptable load (e.g., 25%)
  preferHigherGear: boolean; // true for cruising, false for power
  downshiftOnUphill: boolean; // true to downshift on slopes > 5%
}

/**
 * Select the best gear based on engine load and driving conditions
 * This is the key function that should be used by telemetry-engine
 */
export function selectOptimalGear(
  vehicle: Vehicle,
  speedKmh: number,
  accelerationMps2: number,
  slopePercent: number,
  currentGear?: number,
): GearEstimationResult {
  if (!vehicle.transmission) {
    return {
      gear: 1,
      rpm: 800,
      confidence: 0.5,
      engineLoad: 0,
      reason: "No transmission data",
    };
  }

  // Special case: zero or very low speed - return idle in gear 1
  if (speedKmh < 1) {
    return {
      gear: 1,
      rpm: vehicle.transmission.idleRpm,
      confidence: 0.95,
      engineLoad: 0,
      reason: "Vehicle stationary",
    };
  }

  const allGears = calculateEngineLoadForAllGears(
    vehicle,
    speedKmh,
    accelerationMps2,
    slopePercent,
  );

  if (allGears.length === 0) {
    return {
      gear: 1,
      rpm: vehicle.transmission.idleRpm,
      confidence: 0.5,
      engineLoad: 0,
      reason: "No valid gears",
    };
  }

  // Determine driving scenario
  const isUphill = slopePercent > 3;
  const isSteepUphill = slopePercent > 8;
  const isAccelerating = accelerationMps2 > 0.5;
  const isHardAcceleration = accelerationMps2 > 2.0;

  // RULE 1: Filter out gears that are definitely wrong
  // - Never use a gear that causes lugging (RPM too low)
  // - Never use a gear that causes over-rev
  let validGears = allGears.filter((g) => !g.isLugging && !g.isOverRev);

  // If no gears pass the filter, relax constraints
  if (validGears.length === 0) {
    validGears = allGears.filter((g) => !g.isOverRev);
  }
  if (validGears.length === 0) {
    validGears = allGears;
  }

  // RULE 2: Special case for very low speeds - always use low gears
  // Below 15 km/h, only use gears 1 or 2 to ensure enough torque and avoid lugging
  if (speedKmh < 15) {
    const lowGears = validGears.filter((g) => g.gearNumber <= 2);
    if (lowGears.length > 0) {
      let selectedGear: (typeof validGears)[0];
      let reason: string;

      // At very low speeds with acceleration, use gear 1
      // Otherwise use gear 2 if available
      if (accelerationMps2 > 0.3 && lowGears.some((g) => g.gearNumber === 1)) {
        selectedGear = lowGears.find((g) => g.gearNumber === 1) || lowGears[0];
        reason = "Very low speed - first gear";
      } else {
        // Prefer gear 2 for smoother driving
        selectedGear = lowGears.find((g) => g.gearNumber === 2) || lowGears[0];
        reason = "Very low speed - second gear";
      }

      return {
        gear: selectedGear.gearNumber,
        rpm: selectedGear.currentRpm,
        confidence: 0.9,
        engineLoad: selectedGear.engineLoadPercent,
        reason,
      };
    }
  }

  // RULE 3: Different logic based on driving scenario
  let selectedGear: (typeof validGears)[0];
  let reason: string;

  if (isHardAcceleration) {
    // Hard acceleration: Need power! Pick gear with load 70-85%
    const powerGears = validGears.filter(
      (g) => g.engineLoadPercent >= 60 && g.engineLoadPercent <= 90,
    );
    if (powerGears.length > 0) {
      // Among power gears, pick the highest one (better efficiency)
      selectedGear = powerGears.reduce((prev, curr) =>
        curr.gearNumber > prev.gearNumber ? curr : prev,
      );
      reason = "Power mode - high acceleration";
    } else {
      // No gear gives ideal load, pick lowest gear (most torque)
      selectedGear = validGears.reduce((prev, curr) =>
        curr.gearNumber < prev.gearNumber ? curr : prev,
      );
      reason = "Power mode - maximum torque";
    }
  } else if (isSteepUphill) {
    // Steep uphill: Need torque! Pick gear with load 65-90%
    const climbGears = validGears.filter(
      (g) => g.engineLoadPercent >= 65 && g.engineLoadPercent <= 95,
    );
    if (climbGears.length > 0) {
      selectedGear = climbGears.reduce((prev, curr) =>
        curr.gearNumber > prev.gearNumber ? curr : prev,
      );
      reason = "Uphill - steep gradient";
    } else {
      selectedGear = validGears.reduce((prev, curr) =>
        curr.gearNumber < prev.gearNumber ? curr : prev,
      );
      reason = "Uphill - maximum torque needed";
    }
  } else if (isAccelerating || isUphill) {
    // Moderate acceleration or mild uphill: Pick gear with load 50-80%
    const moderateGears = validGears.filter(
      (g) => g.engineLoadPercent >= 50 && g.engineLoadPercent <= 85,
    );
    if (moderateGears.length > 0) {
      selectedGear = moderateGears.reduce((prev, curr) =>
        curr.gearNumber > prev.gearNumber ? curr : prev,
      );
      reason = isUphill ? "Uphill - moderate gradient" : "Accelerating";
    } else {
      // If load is too low in all gears, pick a lower gear
      selectedGear = validGears.reduce((prev, curr) =>
        curr.engineLoadPercent > prev.engineLoadPercent ? curr : prev,
      );
      reason = isUphill
        ? "Uphill - increasing load"
        : "Accelerating - increasing load";
    }
  } else {
    // CRUISING (flat or downhill): Pick the HIGHEST gear that doesn't lug and load < 90%
    // This is the key fix - we want efficiency!

    // First, filter gears that are definitely good for cruising
    const cruiseGears = validGears.filter((g) => g.engineLoadPercent < 90);

    if (cruiseGears.length > 0) {
      // Pick the highest gear number (most efficient)
      selectedGear = cruiseGears.reduce((prev, curr) =>
        curr.gearNumber > prev.gearNumber ? curr : prev,
      );

      if (selectedGear.engineLoadPercent < 30) {
        reason = "Cruising - very light load";
      } else if (selectedGear.engineLoadPercent > 70) {
        reason = "Cruising - moderate load";
      } else {
        reason = "Cruising - optimal efficiency";
      }
    } else {
      // All gears have high load (>90%), need to downshift
      selectedGear = validGears.reduce((prev, curr) =>
        curr.gearNumber < prev.gearNumber ? curr : prev,
      );
      reason = "High load - downshift recommended";
    }
  }

  // RULE 3: Fast reaction for uphill slopes (>5%)
  // When climbing, downshift immediately if load is too high
  if (slopePercent > 5 && currentGear && currentGear > 1) {
    const currentGearData = allGears.find((g) => g.gearNumber === currentGear);
    if (currentGearData && currentGearData.engineLoadPercent > 75) {
      // Reduz imediatamente sem histerese para subidas
      const lowerGearNum = currentGear - 1;
      const lowerGear = allGears.find((g) => g.gearNumber === lowerGearNum);
      if (
        lowerGear &&
        !lowerGear.isLugging &&
        lowerGear.engineLoadPercent < 95
      ) {
        return {
          gear: lowerGear.gearNumber,
          rpm: lowerGear.currentRpm,
          confidence: 0.9,
          engineLoad: lowerGear.engineLoadPercent,
          reason: "Redução rápida - subida detectada",
        };
      }
    }
  }

  // RULE 4: Reação rápida para aceleração forte
  // Para aceleração > 2.0 m/s², permite redução direta sem restrição de 1 marcha
  if (isHardAcceleration && currentGear && currentGear > 1) {
    const currentGearData = allGears.find((g) => g.gearNumber === currentGear);
    if (currentGearData && currentGearData.engineLoadPercent > 70) {
      // Encontra a melhor marcha para aceleração (mais torque possível)
      const powerGears = validGears.filter(
        (g) =>
          g.engineLoadPercent >= 50 &&
          g.engineLoadPercent <= 95 &&
          !g.isLugging,
      );

      if (powerGears.length > 0) {
        // Para aceleração forte, escolhe marcha mais baixa possível (mais torque)
        const bestPowerGear = powerGears.reduce((prev, curr) =>
          curr.gearNumber < prev.gearNumber ? curr : prev,
        );

        // Só reduz se for significativamente melhor (pelo menos 2 marchas abaixo ou carga muito menor)
        const shouldDownshift =
          currentGear - bestPowerGear.gearNumber >= 2 ||
          (currentGearData.engineLoadPercent > 100 &&
            bestPowerGear.engineLoadPercent < 90);

        if (shouldDownshift) {
          return {
            gear: bestPowerGear.gearNumber,
            rpm: bestPowerGear.currentRpm,
            confidence: 0.9,
            engineLoad: bestPowerGear.engineLoadPercent,
            reason: "Redução aceleração - máxima potência",
          };
        }
      }
    }
  }

  // RULE 5: Golden Rule - Always shift 1 gear at a time (exceto aceleração forte ou cruzeiro distante)
  // Never skip gears (e.g., 1→3 or 4→2). Always 1→2→3→4→5 or reverse.
  // NOTA: Esta regra NÃO se aplica quando:
  //  - isHardAcceleration = true (aceleração forte precisa de potência imediata)
  //  - Cruzeiro com mudança > 2 marchas e velocidade > 40 km/h (mudança significativa de velocidade)
  const isSignificantCruiseChange =
    !isHardAcceleration &&
    !isAccelerating &&
    !isUphill &&
    speedKmh > 40 &&
    currentGear !== undefined;

  const skipGoldenRule = isHardAcceleration || isSignificantCruiseChange;

  if (!skipGoldenRule && currentGear !== undefined && currentGear >= 1) {
    const gearDiff = Math.abs(selectedGear.gearNumber - currentGear);

    if (gearDiff > 1) {
      // Calculate intermediate gear (always move 1 step)
      const step = selectedGear.gearNumber > currentGear ? 1 : -1;
      const intermediateGearNum = currentGear + step;
      const intermediateGear = allGears.find(
        (g) => g.gearNumber === intermediateGearNum,
      );

      // Check if intermediate gear is valid
      if (
        intermediateGear &&
        !intermediateGear.isLugging &&
        !intermediateGear.isOverRev &&
        intermediateGear.engineLoadPercent < 95
      ) {
        selectedGear = intermediateGear;
        reason = `Transição ${currentGear}→${intermediateGearNum}`;
      } else {
        // Intermediate gear not valid, stay in current gear
        const currentGearData = allGears.find(
          (g) => g.gearNumber === currentGear,
        );
        if (
          currentGearData &&
          !currentGearData.isLugging &&
          !currentGearData.isOverRev
        ) {
          selectedGear = currentGearData;
          reason = "Aguardando condições";
        }
        // If current gear is also invalid, use the best valid gear we found earlier
      }
    }
  }

  return {
    gear: selectedGear.gearNumber,
    rpm: selectedGear.currentRpm,
    confidence: 0.85,
    engineLoad: selectedGear.engineLoadPercent,
    reason,
  };
}

/**
 * Score a gear based on engine load and operating conditions
 * Returns a score from 0-100 where higher is better
 * @deprecated Use selectOptimalGear instead which includes this logic internally
 */
export function scoreGear(
  result: EngineLoadResult,
  accelerationMps2: number,
  slopePercent: number,
): number {
  let score = 100;

  // Penalize lugging (RPM too low)
  if (result.isLugging) {
    score -= 50;
  }

  // Penalize over-rev
  if (result.isOverRev) {
    score -= 100;
  }

  // Ideal load is 50-70% for cruising, 60-85% for acceleration
  const isAccelerating = accelerationMps2 > 0.5;
  const isClimbing = slopePercent > 3;

  if (isAccelerating || isClimbing) {
    // For acceleration/climbing, prefer higher load but not maxed out
    if (result.engineLoadPercent < 50) {
      score -= (50 - result.engineLoadPercent) * 0.5;
    } else if (result.engineLoadPercent > 90) {
      score -= (result.engineLoadPercent - 90) * 2;
    }
  } else {
    // For cruising, prefer moderate load for efficiency
    if (result.engineLoadPercent < 30) {
      score -= (30 - result.engineLoadPercent) * 0.8;
    } else if (result.engineLoadPercent > 75) {
      score -= (result.engineLoadPercent - 75) * 1.5;
    }
  }

  // Prefer RPM in comfortable range
  const minComfortableRpm = 1400;
  const optimalRpm = 2500;

  if (result.currentRpm < minComfortableRpm) {
    score -= (minComfortableRpm - result.currentRpm) * 0.05;
  }

  // Bonus for being near optimal RPM
  const rpmDiff = Math.abs(result.currentRpm - optimalRpm);
  if (rpmDiff < 500) {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================================================
// FUNÇÕES LEGADAS (para compatibilidade)
// ============================================================================

/**
 * Legacy function for backward compatibility
 * @deprecated Use selectOptimalGear instead
 */
export function estimateGearAndRpm(
  vehicle: Vehicle,
  speedKmh: number,
  accelerationMps2: number,
  slopePercent: number,
): GearEstimationResult {
  return selectOptimalGear(vehicle, speedKmh, accelerationMps2, slopePercent);
}
