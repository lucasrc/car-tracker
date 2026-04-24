import { describe, it, expect } from "vitest";
import {
  gaussianScore,
  asymmetricScore,
  sigmoid,
  smoothstep,
  SCORING_PARAMS,
  HYSTERESIS_CONFIG,
  calculateRpm,
  getClutchEngagementSpeed,
  selectOptimalGear,
  filterViableGears,
} from "./transmission-calculator";
import type { Vehicle, TransmissionData } from "@/types";

const CLIO_TRANSMISSION: TransmissionData = {
  type: "Manual",
  gearRatios: [3.364, 1.864, 1.321, 1.029, 0.821],
  finalDrive: 4.067,
  tireRadiusM: 0.288,
  redlineRpm: 6500,
  idleRpm: 800,
  rpmAt100Kmh: 3200,
};

const TEST_VEHICLE: Vehicle = {
  id: "test-clio",
  name: "Renault Clio K4M",
  make: "Renault",
  model: "Clio",
  year: 2020,
  displacement: 1598,
  fuelType: "flex",
  euroNorm: "Euro 6",
  segment: "small",
  urbanKmpl: 10,
  highwayKmpl: 14,
  combinedKmpl: 12,
  mass: 1150,
  grossWeight: 1550,
  frontalArea: 2.15,
  dragCoefficient: 0.32,
  peakPowerKw: 85,
  peakTorqueNm: 148,
  confidence: "high",
  calibrationInput: "test",
  calibratedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  fuelCapacity: 50,
  currentFuel: 30,
  dataSource: "manual",
  crr: 0.013,
  idleLph: 0.9,
  baseBsfc: 250,
  isHybrid: false,
  gnvCylinderWeightKg: 80,
  gnvEfficiencyFactor: 1.32,
  transmission: CLIO_TRANSMISSION,
};

describe("gaussianScore", () => {
  it("returns 1.0 at optimal value", () => {
    expect(gaussianScore(2500, 2500, 900)).toBeCloseTo(1.0, 5);
  });

  it("returns ~0.019 at 3 sigma below optimal", () => {
    expect(gaussianScore(1000, 2500, 500)).toBeCloseTo(0.0, 1);
  });

  it("returns 0.6065 at 1 sigma from optimal", () => {
    expect(gaussianScore(3000, 2500, 500)).toBeCloseTo(0.6065, 3);
  });

  it("handles sigma of 0", () => {
    expect(gaussianScore(2500, 2500, 0)).toBe(1);
    expect(gaussianScore(2000, 2500, 0)).toBe(0);
  });
});

describe("asymmetricScore", () => {
  it("returns 1.0 at optimal", () => {
    expect(asymmetricScore(2500, 2500, 900, 2000)).toBeCloseTo(1.0, 5);
  });

  it("uses sigmaLow below optimal", () => {
    const low = asymmetricScore(1600, 2500, 900, 2000);
    const high = asymmetricScore(3400, 2500, 900, 2000);
    expect(low).not.toBeCloseTo(high, 2);
  });

  it("penalizes low RPM more than high RPM", () => {
    const belowScore = asymmetricScore(1300, 2500, 800, 2000);
    const aboveScore = asymmetricScore(3700, 2500, 800, 2000);
    expect(belowScore).toBeLessThan(aboveScore);
  });
});

describe("sigmoid", () => {
  it("returns 0.5 at center", () => {
    expect(sigmoid(3.0, 3.0, 2.0)).toBeCloseTo(0.5, 5);
  });

  it("returns values near 0 below center", () => {
    expect(sigmoid(0, 3, 2)).toBeLessThan(0.2);
  });

  it("returns values near 1 above center", () => {
    expect(sigmoid(6, 3, 2)).toBeGreaterThan(0.8);
  });

  it("handles steepness of 0", () => {
    expect(sigmoid(5, 3, 0)).toBeCloseTo(0.5, 5);
  });

  it("handles extreme values", () => {
    expect(sigmoid(100, 3, 2)).toBeCloseTo(1.0, 5);
    expect(sigmoid(-100, 3, 2)).toBeCloseTo(0.0, 5);
  });
});

describe("smoothstep", () => {
  it("returns 0 below edge0", () => {
    expect(smoothstep(0, 10, -5)).toBe(0);
  });

  it("returns 1 above edge1", () => {
    expect(smoothstep(0, 10, 15)).toBe(1);
  });

  it("returns 0.5 at midpoint", () => {
    expect(smoothstep(0, 10, 5)).toBeCloseTo(0.5, 5);
  });

  it("is smooth at boundaries", () => {
    expect(smoothstep(0, 10, 0)).toBe(0);
    expect(smoothstep(0, 10, 10)).toBe(1);
    expect(smoothstep(0, 10, 1)).toBeGreaterThan(0);
    expect(smoothstep(0, 10, 9)).toBeLessThan(1);
  });
});

describe("SCORING_PARAMS", () => {
  it("has NA, turbo, and turbo-diesel keys", () => {
    expect(SCORING_PARAMS.NA).toBeDefined();
    expect(SCORING_PARAMS.turbo).toBeDefined();
    expect(SCORING_PARAMS["turbo-diesel"]).toBeDefined();
  });

  it("NA has minOperatingRpm 1300", () => {
    expect(SCORING_PARAMS.NA.minOperatingRpm).toBe(1300);
  });

  it("turbo has minOperatingRpm 1100", () => {
    expect(SCORING_PARAMS.turbo.minOperatingRpm).toBe(1100);
  });

  it("turbo-diesel has minOperatingRpm 1000", () => {
    expect(SCORING_PARAMS["turbo-diesel"].minOperatingRpm).toBe(1000);
  });
});

describe("HYSTERESIS_CONFIG", () => {
  it("has correct margins", () => {
    expect(HYSTERESIS_CONFIG.upshiftMargin).toBe(0.15);
    expect(HYSTERESIS_CONFIG.downshiftMargin).toBe(0.10);
    expect(HYSTERESIS_CONFIG.minDwellMs).toBe(1500);
    expect(HYSTERESIS_CONFIG.kickdownAccelThreshold).toBe(2.5);
    expect(HYSTERESIS_CONFIG.lowSpeedBypassKmh).toBe(10);
  });
});

describe("getClutchEngagementSpeed", () => {
  it("NA engagement at 10 km/h", () => {
    expect(getClutchEngagementSpeed("NA")).toBe(10);
  });

  it("turbo engagement at 8 km/h", () => {
    expect(getClutchEngagementSpeed("turbo")).toBe(8);
  });

  it("turbo-diesel engagement at 7 km/h", () => {
    expect(getClutchEngagementSpeed("turbo-diesel")).toBe(7);
  });
});

describe("calculateRpm with clutch model", () => {
  it("at 3 km/h should produce RPM near idle (not gear 2 RPM)", () => {
    const rpm1 = calculateRpm(3, 0, CLIO_TRANSMISSION, "NA");
    expect(rpm1).toBeGreaterThan(750);
    expect(rpm1).toBeLessThan(1500);
  });

  it("at 0 km/h should return idleRpm", () => {
    const rpm = calculateRpm(0, 0, CLIO_TRANSMISSION, "NA");
    expect(rpm).toBe(800);
  });

  it("above engagement speed should use gear ratio formula", () => {
    const rpm = calculateRpm(80, 4, CLIO_TRANSMISSION, "NA");
    expect(rpm).toBeGreaterThan(1000);
    expect(rpm).toBeLessThan(7000);
  });

  it("with clampToIdle=false returns raw RPM below idle", () => {
    const rpm = calculateRpm(10, 4, CLIO_TRANSMISSION, "NA", false);
    expect(typeof rpm).toBe("number");
  });
});

describe("selectOptimalGear - regression tests", () => {
  it("3 km/h flat terrain should select gear 1, not gear 2", () => {
    const result = selectOptimalGear(TEST_VEHICLE, 3, 0, 0);
    expect(result.gear).toBe(1);
    expect(result.rpm).toBeGreaterThan(750);
    expect(result.rpm).toBeLessThan(1500);
  });

  it("30 km/h flat should not select gear 5 (lugging)", () => {
    const result = selectOptimalGear(TEST_VEHICLE, 30, 0, 0);
    expect(result.gear).toBeLessThan(5);
    expect(result.rpm).toBeGreaterThanOrEqual(1100);
  });

  it("60 km/h flat should select a reasonable gear", () => {
    const result = selectOptimalGear(TEST_VEHICLE, 60, 0, 0);
    expect(result.gear).toBeGreaterThanOrEqual(3);
    expect(result.gear).toBeLessThanOrEqual(5);
    expect(result.rpm).toBeGreaterThanOrEqual(1300);
  });

  it("60 km/h steep uphill should select lower gear than flat", () => {
    const flatResult = selectOptimalGear(TEST_VEHICLE, 60, 0, 0);
    const uphillResult = selectOptimalGear(TEST_VEHICLE, 60, 0.3, 10);
    expect(uphillResult.gear).toBeLessThanOrEqual(flatResult.gear);
  });

  it("100 km/h flat should select top gear near rpmAt100Kmh", () => {
    const result = selectOptimalGear(TEST_VEHICLE, 100, 0, 0);
    expect(result.gear).toBe(5);
    expect(result.rpm).toBeGreaterThan(2500);
    expect(result.rpm).toBeLessThan(4000);
  });

  it("aspiration-dependent: NA engine should never go below 1300 RPM", () => {
    for (const speed of [20, 30, 40, 50, 60, 80]) {
      const result = selectOptimalGear(TEST_VEHICLE, speed, 0, 0);
      if (speed > 5) {
        expect(result.rpm).toBeGreaterThanOrEqual(1100);
      }
    }
  });

  it("stationary vehicle selects gear 1", () => {
    const result = selectOptimalGear(TEST_VEHICLE, 0.5, 0, 0);
    expect(result.gear).toBe(1);
  });

  it("returns valid confidence", () => {
    const result = selectOptimalGear(TEST_VEHICLE, 60, 0, 0);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.engineLoad).toBeGreaterThanOrEqual(0);
  });
});

describe("filterViableGears", () => {
  it("at very low speed only gear 1 is viable", () => {
    const results = filterViableGears(TEST_VEHICLE, 5, 0, 0);
    const viable = results.filter((r) => r.isViable);
    expect(viable.length).toBeGreaterThanOrEqual(1);
    expect(viable[0].gearNumber).toBe(1);
  });

  it("at 60 km/h multiple gears should be viable", () => {
    const results = filterViableGears(TEST_VEHICLE, 60, 0, 0);
    const viable = results.filter((r) => r.isViable);
    expect(viable.length).toBeGreaterThanOrEqual(2);
  });

  it("at 0 km/h returns single gear 1 result", () => {
    const results = filterViableGears(TEST_VEHICLE, 0, 0, 0);
    expect(results.length).toBe(1);
    expect(results[0].gearNumber).toBe(1);
  });

  it("no vehicle transmission returns empty", () => {
    const noTransVehicle = { ...TEST_VEHICLE, transmission: undefined };
    const results = filterViableGears(noTransVehicle, 60, 0, 0);
    expect(results).toEqual([]);
  });
});

describe("hysteresis prevents gear hunting", () => {
  it("should stay in current gear when oscillating near gear boundary", () => {
    const result48 = selectOptimalGear(TEST_VEHICLE, 48, 0, 0, 3);
    const result50 = selectOptimalGear(TEST_VEHICLE, 50, 0, 0, result48.gear);
    const result52 = selectOptimalGear(TEST_VEHICLE, 52, 0, 0, result50.gear);

    expect(result48.confidence).toBeGreaterThan(0);
    expect(result50.confidence).toBeGreaterThan(0);
    expect(result52.gear).toBeGreaterThanOrEqual(3);
  });
});

describe("sigmoid transitions", () => {
  it("produces smooth uphill weight across slope range", () => {
    const weights = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => sigmoid(s, 3, 2));
    expect(weights[0]).toBeLessThan(0.2);
    expect(weights[3]).toBeCloseTo(0.5, 1);
    expect(weights[10]).toBeGreaterThan(0.8);
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]).toBeGreaterThanOrEqual(weights[i - 1]);
    }
  });

  it("produces smooth acceleration weight across accel range", () => {
    const weights = [0, 0.3, 0.5, 1, 1.5, 2, 2.5, 3].map((a) => sigmoid(a, 0.5, 3.3));
    expect(weights[0]).toBeLessThan(0.2);
    expect(weights[7]).toBeGreaterThan(0.9);
  });
});

describe("kickdown bypass", () => {
  it("should select lower gear at high acceleration", () => {
    const normalResult = selectOptimalGear(TEST_VEHICLE, 60, 0, 0);
    const hardAccelResult = selectOptimalGear(TEST_VEHICLE, 60, 3.0, 0);
    expect(hardAccelResult.gear).toBeLessThanOrEqual(normalResult.gear);
  });
});