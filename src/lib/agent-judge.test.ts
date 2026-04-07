import { describe, it, expect } from "vitest";
import { validateBasic, determineConfidence } from "./agent-judge";
import type { VehicleCalibration } from "@/types";

function makeValidCalibration(
  overrides: Partial<VehicleCalibration> = {},
): VehicleCalibration {
  const base: VehicleCalibration = {
    make: "Toyota",
    model: "Corolla",
    year: 2020,
    displacement: 1800,
    fuelType: "gasoline",
    euroNorm: "Euro 6",
    segment: "medium",
    urbanKmpl: 8.5,
    highwayKmpl: 13.5,
    combinedKmpl: 10.8,
    mass: 1350,
    grossWeight: 1800,
    frontalArea: 2.3,
    dragCoefficient: 0.28,
    f0: 0.17,
    f1: 0.008,
    f2: 0.0004,
    fuelConversionFactor: 8.5,
    peakPowerKw: 125,
    peakTorqueNm: 200,
    confidence: "high",
    inmetroCityKmpl: 11.0,
    inmetroHighwayKmpl: 15.2,
    userAvgCityKmpl: 10.5,
    userAvgHighwayKmpl: 14.0,
    crr: 0.013,
    idleLph: 0.9,
    baseBsfc: 265,
    weightInmetro: 0.6,
    weightUser: 0.4,
    isHybrid: false,
    gnvCylinderWeightKg: 80,
    gnvEfficiencyFactor: 1.32,
    ...overrides,
  };
  return base;
}

describe("agent-judge", () => {
  describe("validateBasic", () => {
    describe("consumption order validation (BUG FIX)", () => {
      it("accepts valid consumption order: urban < combined < highway", () => {
        const data = makeValidCalibration({
          urbanKmpl: 8.5,
          combinedKmpl: 10.8,
          highwayKmpl: 13.5,
        });

        const result = validateBasic(data);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("rejects inverted consumption order (old bug)", () => {
        const data = makeValidCalibration({
          urbanKmpl: 13.5,
          combinedKmpl: 10.8,
          highwayKmpl: 8.5,
        });

        const result = validateBasic(data);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.stringContaining("consumo inválido"),
        );
      });

      it("rejects when urban == combined (not strictly less)", () => {
        const data = makeValidCalibration({
          urbanKmpl: 10.8,
          combinedKmpl: 10.8,
          highwayKmpl: 13.5,
        });

        const result = validateBasic(data);
        expect(result.valid).toBe(false);
      });

      it("rejects when combined == highway (not strictly less)", () => {
        const data = makeValidCalibration({
          urbanKmpl: 8.5,
          combinedKmpl: 13.5,
          highwayKmpl: 13.5,
        });

        const result = validateBasic(data);
        expect(result.valid).toBe(false);
      });

      it("rejects when combined > highway", () => {
        const data = makeValidCalibration({
          urbanKmpl: 8.5,
          combinedKmpl: 14.0,
          highwayKmpl: 13.5,
        });

        const result = validateBasic(data);
        expect(result.valid).toBe(false);
      });

      it("rejects when urban > combined", () => {
        const data = makeValidCalibration({
          urbanKmpl: 11.0,
          combinedKmpl: 10.8,
          highwayKmpl: 13.5,
        });

        const result = validateBasic(data);
        expect(result.valid).toBe(false);
      });
    });

    describe("physical parameters validation", () => {
      it("rejects f0 below minimum (0.05)", () => {
        const data = makeValidCalibration({ f0: 0.04 });
        const result = validateBasic(data);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(expect.stringContaining("f0"));
      });

      it("rejects f0 above maximum (0.5)", () => {
        const data = makeValidCalibration({ f0: 0.51 });
        const result = validateBasic(data);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(expect.stringContaining("f0"));
      });

      it("accepts f0 at boundaries", () => {
        let data = makeValidCalibration({ f0: 0.05 });
        expect(validateBasic(data).valid).toBe(true);

        data = makeValidCalibration({ f0: 0.5 });
        expect(validateBasic(data).valid).toBe(true);
      });

      it("rejects f1 below minimum (0.0005)", () => {
        const data = makeValidCalibration({ f1: 0.0004 });
        const result = validateBasic(data);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(expect.stringContaining("f1"));
      });

      it("rejects f1 above maximum (0.01)", () => {
        const data = makeValidCalibration({ f1: 0.011 });
        const result = validateBasic(data);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(expect.stringContaining("f1"));
      });

      it("rejects f2 below minimum (0.0001)", () => {
        const data = makeValidCalibration({ f2: 0.00009 });
        const result = validateBasic(data);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(expect.stringContaining("f2"));
      });

      it("rejects f2 above maximum (0.001)", () => {
        const data = makeValidCalibration({ f2: 0.0011 });
        const result = validateBasic(data);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(expect.stringContaining("f2"));
      });

      it("rejects mass >= grossWeight", () => {
        const data = makeValidCalibration({
          mass: 1800,
          grossWeight: 1800,
        });
        const result = validateBasic(data);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.stringContaining("massa deve ser menor"),
        );
      });

      it("rejects mass > grossWeight", () => {
        const data = makeValidCalibration({
          mass: 1900,
          grossWeight: 1800,
        });
        const result = validateBasic(data);
        expect(result.valid).toBe(false);
      });
    });

    describe("combined validations", () => {
      it("reports multiple errors when multiple validations fail", () => {
        const data = makeValidCalibration({
          f0: 1.0,
          f1: 0.05,
          urbanKmpl: 13.5,
          combinedKmpl: 10.8,
          highwayKmpl: 8.5,
          mass: 2000,
          grossWeight: 1800,
        });
        const result = validateBasic(data);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(4);
      });
    });
  });

  describe("determineConfidence", () => {
    it("returns high when confidence field is high", () => {
      const data = makeValidCalibration({ confidence: "high" });
      expect(determineConfidence(data)).toBe("high");
    });

    it("returns low when confidence field is low", () => {
      const data = makeValidCalibration({ confidence: "low" });
      expect(determineConfidence(data)).toBe("low");
    });

    it("returns medium when confidence field is medium", () => {
      const data = makeValidCalibration({ confidence: "medium" });
      expect(determineConfidence(data)).toBe("medium");
    });

    it("always respects the confidence field value", () => {
      const testCases: Array<
        ["high" | "medium" | "low", "high" | "medium" | "low"]
      > = [
        ["high", "high"],
        ["medium", "medium"],
        ["low", "low"],
      ];

      for (const [input, expected] of testCases) {
        const data = makeValidCalibration({ confidence: input });
        expect(determineConfidence(data)).toBe(expected);
      }
    });
  });

  describe("real-world vehicle scenarios", () => {
    it("validates realistic HB20 1.0 Flex (2023) data", () => {
      const hb20: VehicleCalibration = {
        make: "Hyundai",
        model: "HB20 1.0 Flex",
        year: 2023,
        displacement: 1000,
        fuelType: "flex",
        euroNorm: "Euro 6",
        segment: "small",
        urbanKmpl: 8.2,
        combinedKmpl: 10.5,
        highwayKmpl: 13.0,
        mass: 1090,
        grossWeight: 1520,
        frontalArea: 2.1,
        dragCoefficient: 0.32,
        f0: 0.12,
        f1: 0.006,
        f2: 0.0003,
        fuelConversionFactor: 8.2,
        peakPowerKw: 80,
        peakTorqueNm: 148,
        confidence: "high",
        inmetroCityKmpl: 10.2,
        inmetroHighwayKmpl: 14.5,
        userAvgCityKmpl: 9.8,
        userAvgHighwayKmpl: 13.5,
        crr: 0.013,
        idleLph: 0.7,
        baseBsfc: 265,
        weightInmetro: 0.6,
        weightUser: 0.4,
        isHybrid: false,
        gnvCylinderWeightKg: 80,
        gnvEfficiencyFactor: 1.32,
      };

      const result = validateBasic(hb20);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates realistic Corolla 2.0 Flex (2020) data", () => {
      const corolla: VehicleCalibration = {
        make: "Toyota",
        model: "Corolla 2.0 Flex",
        year: 2020,
        displacement: 1968,
        fuelType: "flex",
        euroNorm: "Euro 5",
        segment: "medium",
        urbanKmpl: 8.5,
        combinedKmpl: 10.8,
        highwayKmpl: 13.5,
        mass: 1350,
        grossWeight: 1800,
        frontalArea: 2.3,
        dragCoefficient: 0.28,
        f0: 0.17,
        f1: 0.008,
        f2: 0.0004,
        fuelConversionFactor: 8.5,
        peakPowerKw: 125,
        peakTorqueNm: 200,
        confidence: "high",
        inmetroCityKmpl: 11.0,
        inmetroHighwayKmpl: 15.2,
        userAvgCityKmpl: 10.5,
        userAvgHighwayKmpl: 14.0,
        crr: 0.013,
        idleLph: 0.9,
        baseBsfc: 265,
        weightInmetro: 0.6,
        weightUser: 0.4,
        isHybrid: false,
        gnvCylinderWeightKg: 80,
        gnvEfficiencyFactor: 1.32,
      };

      const result = validateBasic(corolla);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates realistic Creta 1.6 Flex (2021) data", () => {
      const creta: VehicleCalibration = {
        make: "Hyundai",
        model: "Creta 1.6 Flex",
        year: 2021,
        displacement: 1598,
        fuelType: "flex",
        euroNorm: "Euro 6",
        segment: "suv",
        urbanKmpl: 7.2,
        combinedKmpl: 9.5,
        highwayKmpl: 12.0,
        mass: 1305,
        grossWeight: 1860,
        frontalArea: 2.6,
        dragCoefficient: 0.35,
        f0: 0.18,
        f1: 0.009,
        f2: 0.00045,
        fuelConversionFactor: 8.2,
        peakPowerKw: 115,
        peakTorqueNm: 144,
        confidence: "medium",
        inmetroCityKmpl: 9.2,
        inmetroHighwayKmpl: 13.0,
        userAvgCityKmpl: 8.8,
        userAvgHighwayKmpl: 11.8,
        crr: 0.014,
        idleLph: 0.85,
        baseBsfc: 270,
        weightInmetro: 0.6,
        weightUser: 0.4,
        isHybrid: false,
        gnvCylinderWeightKg: 80,
        gnvEfficiencyFactor: 1.32,
      };

      const result = validateBasic(creta);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
