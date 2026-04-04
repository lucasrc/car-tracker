import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useConsumptionModel,
  copertFuelConsumption,
  copertFuelConsumptionCalibrated,
  getDisplacementFactor,
  getFuelEnergyFactor,
  calculateIdleConsumptionLiters,
} from "./useConsumptionModel";
import type { ActivityType, FuelType, CopertCalibration } from "@/types";

describe("useConsumptionModel", () => {
  describe("copertFuelConsumption - valores realistas", () => {
    it("retorna ~12.88 km/l para 40 km/h (velocidade urbana típica)", () => {
      const result = copertFuelConsumption(40);
      expect(result).toBeCloseTo(12.88, 1);
    });

    it("retorna ~14.74 km/l para 60 km/h (velocidade urbana/rodoviária)", () => {
      const result = copertFuelConsumption(60);
      expect(result).toBeCloseTo(14.74, 1);
    });

    it("retorna ~15.01 km/l para 80 km/h (pico de eficiência)", () => {
      const result = copertFuelConsumption(80);
      expect(result).toBeCloseTo(15.01, 1);
    });

    it("retorna ~14.15 km/l para 100 km/h (rodoviária)", () => {
      const result = copertFuelConsumption(100);
      expect(result).toBeCloseTo(14.15, 1);
    });

    it("retorna ~12.54 km/l para 120 km/h (rodoviária alta)", () => {
      const result = copertFuelConsumption(120);
      expect(result).toBeCloseTo(12.54, 1);
    });

    it("retorna 0 para velocidade zero", () => {
      expect(copertFuelConsumption(0)).toBe(0);
    });

    it("retorna 0 para velocidade negativa", () => {
      expect(copertFuelConsumption(-10)).toBe(0);
    });

    it("retorna valores realistas (nunca > 25 km/l)", () => {
      for (let v = 10; v <= 150; v += 5) {
        const result = copertFuelConsumption(v);
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThan(25);
      }
    });

    it("a eficiência é maior em velocidades médias (80 km/h)", () => {
      const at40 = copertFuelConsumption(40);
      const at80 = copertFuelConsumption(80);
      const at120 = copertFuelConsumption(120);

      expect(at80).toBeGreaterThan(at40);
      expect(at80).toBeGreaterThan(at120);
    });
  });

  describe("fatores técnicos", () => {
    it("getDisplacementFactor retorna 1.0 para motor 1.6L (baseline)", () => {
      const result = getDisplacementFactor(1600);
      expect(result).toBeCloseTo(1.0, 2);
    });

    it("getDisplacementFactor retorna >1 para motor menor (1.0L)", () => {
      const result = getDisplacementFactor(1000);
      expect(result).toBeGreaterThan(1);
      expect(result).toBeCloseTo(1.073, 2);
    });

    it("getDisplacementFactor retorna <1 para motor maior (2.0L)", () => {
      const result = getDisplacementFactor(2000);
      expect(result).toBeLessThan(1);
      expect(result).toBeCloseTo(0.967, 2);
    });

    it("getDisplacementFactor retorna 1.0 para cilindrada inválida", () => {
      expect(getDisplacementFactor(0)).toBe(1.0);
      expect(getDisplacementFactor(-100)).toBe(1.0);
    });

    it("getFuelEnergyFactor retorna valores corretos por tipo", () => {
      expect(getFuelEnergyFactor("gasolina" as FuelType)).toBe(0.91);
      expect(getFuelEnergyFactor("etanol" as FuelType)).toBe(0.7);
      expect(getFuelEnergyFactor("flex" as FuelType)).toBe(0.87);
    });

    it("getFuelEnergyFactor retorna 1.0 para tipo inválido", () => {
      expect(getFuelEnergyFactor("invalid" as FuelType)).toBe(1.0);
    });
  });

  describe("consumo em marcha lenta", () => {
    it("calcula consumo em marcha lenta para motor 1.6L", () => {
      const result = calculateIdleConsumptionLiters(60000, 1600);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1);
    });

    it("calcula consumo maior para motor maior", () => {
      const result16 = calculateIdleConsumptionLiters(60000, 1600);
      const result20 = calculateIdleConsumptionLiters(60000, 2000);
      expect(result20).toBeGreaterThan(result16);
    });

    it("retorna 0 para cilindrada inválida", () => {
      expect(calculateIdleConsumptionLiters(60000, 0)).toBe(0);
      expect(calculateIdleConsumptionLiters(60000, -100)).toBe(0);
    });
  });

  describe("calculateAdjustedConsumption - integração completa", () => {
    it("aplica fatores técnicos corretamente para motor 1.6L gasolina a 80 km/h", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;

      const factors = calculateAdjustedConsumption(
        12,
        80,
        0,
        0,
        "MA" as ActivityType,
        0,
        1600,
        "gasolina" as FuelType,
      );

      expect(factors.copertKmPerLiter).toBeCloseTo(15.01, 1);
      expect(factors.displacementFactor).toBeCloseTo(1.0, 2);
      expect(factors.fuelEnergyFactor).toBe(0.91);
      expect(factors.adjustedKmPerLiter).toBeCloseTo(13.66, 1);
      expect(factors.gradePercent).toBe(0);
      expect(factors.fuelCutActive).toBe(false);
      expect(factors.gradePercent).toBe(0);
      expect(factors.fuelCutActive).toBe(false);
    });

    it("aplica fatores técnicos corretamente para motor 1.0L etanol a 80 km/h", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;

      const factors = calculateAdjustedConsumption(
        10,
        80,
        0,
        0,
        "MA" as ActivityType,
        0,
        1000,
        "etanol" as FuelType,
      );

      expect(factors.copertKmPerLiter).toBeCloseTo(15.01, 1);
      expect(factors.displacementFactor).toBeCloseTo(1.073, 2);
      expect(factors.fuelEnergyFactor).toBe(0.7);
      expect(factors.adjustedKmPerLiter).toBeCloseTo(11.28, 1);
    });

    it("retorna baseConsumption como fallback quando COPERT retorna 0 (velocidade zero)", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;

      const factors = calculateAdjustedConsumption(10, 0, 0, 0);

      expect(factors.copertKmPerLiter).toBe(10);
      expect(factors.adjustedKmPerLiter).toBeCloseTo(9.1, 1); // base * fuelEnergyFactor (10 * 0.91)
    });

    it("SA_ENGINE_OFF retorna consumo zero", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;

      const factors = calculateAdjustedConsumption(
        10,
        0,
        0,
        0,
        "SA_ENGINE_OFF" as ActivityType,
      );

      expect(factors.copertKmPerLiter).toBe(0);
      expect(factors.adjustedKmPerLiter).toBe(0);
    });

    it("SA_ENGINE_ON usa base consumption (motor ligado, parado)", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;

      const factors = calculateAdjustedConsumption(
        10,
        0,
        0,
        0,
        "SA_ENGINE_ON" as ActivityType,
      );

      expect(factors.copertKmPerLiter).toBe(10);
      expect(factors.activityType).toBe("SA_ENGINE_ON");
    });

    it("consumo ajustado nunca ultrapassa limite físico (~20 km/l)", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;

      const speeds = [20, 40, 60, 80, 100, 120, 140];
      speeds.forEach((speed) => {
        const factors = calculateAdjustedConsumption(
          15,
          speed,
          0,
          0,
          "MA" as ActivityType,
          0,
          1600,
          "gasolina" as FuelType,
        );
        expect(factors.adjustedKmPerLiter).toBeLessThan(20);
      });
    });
  });

  describe("addReading e getMetrics", () => {
    it("calcula velocidade média corretamente", () => {
      const { result } = renderHook(() => useConsumptionModel());

      act(() => {
        result.current.addReading(10, 1000);
        result.current.addReading(15, 2000);
        result.current.addReading(20, 3000);
      });

      const metrics = result.current.getMetrics(3000);
      // 10 m/s = 36 km/h, 15 m/s = 54 km/h, 20 m/s = 72 km/h
      // Média: (36 + 54 + 72) / 3 = 54 km/h
      expect(metrics.avgSpeedKmh).toBeCloseTo(54, 0);
    });

    it("calcula velocidade máxima corretamente", () => {
      const { result } = renderHook(() => useConsumptionModel());

      act(() => {
        result.current.addReading(10, 1000);
        result.current.addReading(30, 2000);
        result.current.addReading(20, 3000);
      });

      const metrics = result.current.getMetrics(3000);
      expect(metrics.maxSpeedKmh).toBeCloseTo(108, 0);
    });

    it("calcula percentual de ociosidade (idle)", () => {
      const { result } = renderHook(() => useConsumptionModel());

      act(() => {
        result.current.addReading(0, 1000);
        result.current.addReading(0, 2000);
        result.current.addReading(10, 3000);
      });

      const metrics = result.current.getMetrics(3000);
      expect(metrics.idlePercentage).toBeGreaterThan(0);
      expect(metrics.idlePercentage).toBeLessThanOrEqual(100);
    });

    it("filtra leituras antigas (>30s)", () => {
      const { result } = renderHook(() => useConsumptionModel());

      act(() => {
        result.current.addReading(50, 1000);
        result.current.addReading(50, 2000);
        result.current.addReading(50, 3000);
      });

      const metrics = result.current.getMetrics(35000);
      expect(metrics.avgSpeedKmh).toBe(0);
    });

    it("retorna métricas zeradas sem leituras", () => {
      const { result } = renderHook(() => useConsumptionModel());

      const metrics = result.current.getMetrics(3000);
      expect(metrics.avgSpeedKmh).toBe(0);
      expect(metrics.maxSpeedKmh).toBe(0);
      expect(metrics.idlePercentage).toBe(0);
    });
  });

  describe("reset", () => {
    it("limpa todos os dados acumulados", () => {
      const { result } = renderHook(() => useConsumptionModel());

      act(() => {
        result.current.addReading(50, 1000);
        result.current.addReading(50, 2000);
        result.current.reset();
      });

      const metrics = result.current.getMetrics(3000);
      expect(metrics.avgSpeedKmh).toBe(0);
      expect(metrics.idlePercentage).toBe(0);
    });
  });

  describe("cenários de integração - simulação de viagem real", () => {
    it("viagem urbana: velocidades típicas de cidade (30-60 km/h)", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;

      const speeds = [30, 40, 50, 60, 40, 50, 30, 40];
      const consumptions = speeds.map((speed) => {
        const factors = calculateAdjustedConsumption(
          10,
          speed,
          0,
          0,
          "MA" as ActivityType,
          0,
          1600,
          "gasolina" as FuelType,
        );
        return factors.adjustedKmPerLiter;
      });

      const avgConsumption =
        consumptions.reduce((a, b) => a + b, 0) / consumptions.length;

      expect(avgConsumption).toBeGreaterThan(10);
      expect(avgConsumption).toBeLessThan(18);
    });

    it("viagem rodoviária: velocidades típicas de estrada (80-120 km/h)", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;

      const speeds = [80, 100, 110, 120, 110, 100, 90, 80];
      const consumptions = speeds.map((speed) => {
        const factors = calculateAdjustedConsumption(
          12,
          speed,
          0,
          0,
          "MA" as ActivityType,
          0,
          1600,
          "gasolina" as FuelType,
        );
        return factors.adjustedKmPerLiter;
      });

      const avgConsumption =
        consumptions.reduce((a, b) => a + b, 0) / consumptions.length;

      expect(avgConsumption).toBeGreaterThan(11);
      expect(avgConsumption).toBeLessThan(16);
    });

    it("viagem mista: combinação cidade + estrada", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;

      const speeds = [40, 50, 60, 80, 100, 110, 100, 80, 60, 50, 40, 30];
      const consumptions = speeds.map((speed) => {
        const factors = calculateAdjustedConsumption(
          11,
          speed,
          0,
          0,
          "MA" as ActivityType,
          0,
          1600,
          "flex" as FuelType,
        );
        return factors.adjustedKmPerLiter;
      });

      const avgConsumption =
        consumptions.reduce((a, b) => a + b, 0) / consumptions.length;

      expect(avgConsumption).toBeGreaterThan(9);
      expect(avgConsumption).toBeLessThan(15);
    });

    it("consumo realista: 100km em cidade com motor 1.6L gasolina", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;

      const citySpeed = 45;
      const factors = calculateAdjustedConsumption(
        10,
        citySpeed,
        0,
        0,
        "MA" as ActivityType,
        0,
        1600,
        "gasolina" as FuelType,
      );

      const distance = 100;
      const fuelUsed = distance / factors.adjustedKmPerLiter;

      expect(fuelUsed).toBeGreaterThan(6);
      expect(fuelUsed).toBeLessThan(10);
    });
  });

  describe("edge cases - velocidades extremas", () => {
    it("lida com velocidade muito baixa (10 km/h)", () => {
      const result = copertFuelConsumption(10);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(20);
    });

    it("lida com velocidade muito alta (180 km/h)", () => {
      const result = copertFuelConsumption(180);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(10);
    });

    it("lida com скорость = 0 (edge case)", () => {
      expect(copertFuelConsumption(0)).toBe(0);
    });

    it("lida com velocidade negativa (não deve crashar)", () => {
      expect(copertFuelConsumption(-5)).toBe(0);
      expect(copertFuelConsumption(-100)).toBe(0);
    });

    it("lida com velocidades muito altas (200 km/h)", () => {
      const result = copertFuelConsumption(200);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(5);
    });
  });

  describe("copertFuelConsumptionCalibrated - com dados do veículo", () => {
    function makeCalibration(): CopertCalibration {
      return {
        make: "Toyota",
        model: "Corolla",
        year: 2020,
        displacement: 2000,
        fuelType: "flex",
        euroNorm: "Euro 6",
        segment: "medium",
        urbanKmpl: 9.5,
        highwayKmpl: 12.5,
        combinedKmpl: 11.0,
        mass: 1380,
        grossWeight: 1750,
        frontalArea: 2.28,
        dragCoefficient: 0.29,
        f0: 156,
        f1: 2.5,
        f2: 0.47,
        fuelConversionFactor: 275,
        peakPowerKw: 130,
        peakTorqueNm: 210,
        co2_gkm: 145,
        nox_mgkm: 60,
        confidence: "high",
      };
    }

    it("returns 0 for zero speed", () => {
      expect(copertFuelConsumptionCalibrated(0, makeCalibration())).toBe(0);
    });

    it("returns 0 for negative speed", () => {
      expect(copertFuelConsumptionCalibrated(-10, makeCalibration())).toBe(0);
    });

    it("returns positive consumption at 60 km/h", () => {
      const result = copertFuelConsumptionCalibrated(60, makeCalibration());
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(30);
    });

    it("returns higher consumption at higher speeds (aerodynamic drag)", () => {
      const at80 = copertFuelConsumptionCalibrated(80, makeCalibration());
      const at120 = copertFuelConsumptionCalibrated(120, makeCalibration());
      expect(at80).toBeGreaterThan(at120);
    });

    it("heavier vehicle gets worse consumption", () => {
      const light = makeCalibration();
      light.mass = 900;
      light.f0 = 0.1 + (900 / 1000) * 0.05;

      const heavy = makeCalibration();
      heavy.mass = 2000;
      heavy.f0 = 0.1 + (2000 / 1000) * 0.05;

      const lightKmpl = copertFuelConsumptionCalibrated(60, light);
      const heavyKmpl = copertFuelConsumptionCalibrated(60, heavy);

      expect(heavyKmpl).toBeLessThan(lightKmpl);
    });

    it("worse aerodynamics reduces highway consumption", () => {
      const aero = makeCalibration();
      aero.dragCoefficient = 0.25;
      aero.f2 = 0.0004 * 2.28 * 0.25;

      const brick = makeCalibration();
      brick.dragCoefficient = 0.45;
      brick.f2 = 0.0004 * 2.28 * 0.45;

      const aeroKmpl = copertFuelConsumptionCalibrated(120, aero);
      const brickKmpl = copertFuelConsumptionCalibrated(120, brick);

      expect(brickKmpl).toBeLessThan(aeroKmpl);
    });

    it("diesel has better consumption than gasoline (higher LHV)", () => {
      const diesel = makeCalibration();
      diesel.fuelType = "diesel";

      const gas = makeCalibration();
      gas.fuelType = "gasoline";

      const dieselKmpl = copertFuelConsumptionCalibrated(80, diesel);
      const gasKmpl = copertFuelConsumptionCalibrated(80, gas);

      expect(dieselKmpl).toBeGreaterThan(gasKmpl);
    });
  });

  describe("calculateAdjustedConsumption with calibration", () => {
    function makeCalibration(): CopertCalibration {
      return {
        make: "Toyota",
        model: "Corolla",
        year: 2020,
        displacement: 2000,
        fuelType: "flex",
        euroNorm: "Euro 6",
        segment: "medium",
        urbanKmpl: 9.5,
        highwayKmpl: 12.5,
        combinedKmpl: 11.0,
        mass: 1380,
        grossWeight: 1750,
        frontalArea: 2.28,
        dragCoefficient: 0.29,
        f0: 156,
        f1: 2.5,
        f2: 0.47,
        fuelConversionFactor: 275,
        peakPowerKw: 130,
        peakTorqueNm: 210,
        co2_gkm: 145,
        nox_mgkm: 60,
        confidence: "high",
      };
    }

    it("sets calibrated=true when calibration is provided", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;

      const factors = calculateAdjustedConsumption(
        12,
        80,
        0,
        0,
        "MA" as ActivityType,
        0,
        1600,
        "gasolina" as FuelType,
        makeCalibration(),
      );

      expect(factors.calibrated).toBe(true);
    });

    it("sets calibrated=false when no calibration", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;

      const factors = calculateAdjustedConsumption(
        12,
        80,
        0,
        0,
        "MA" as ActivityType,
        0,
        1600,
        "gasolina" as FuelType,
      );

      expect(factors.calibrated).toBe(false);
    });

    it("calibrated model produces different consumption than generic model", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;

      const calibrated = calculateAdjustedConsumption(
        12,
        80,
        0,
        0,
        "MA" as ActivityType,
        0,
        1600,
        "gasolina" as FuelType,
        makeCalibration(),
      );

      const generic = calculateAdjustedConsumption(
        12,
        80,
        0,
        0,
        "MA" as ActivityType,
        0,
        1600,
        "gasolina" as FuelType,
      );

      expect(calibrated.adjustedKmPerLiter).not.toBe(
        generic.adjustedKmPerLiter,
      );
    });

    it("SA_ENGINE_OFF returns zero even with calibration", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;

      const factors = calculateAdjustedConsumption(
        10,
        0,
        0,
        0,
        "SA_ENGINE_OFF" as ActivityType,
        0,
        1600,
        "gasolina" as FuelType,
        makeCalibration(),
      );

      expect(factors.copertKmPerLiter).toBe(0);
      expect(factors.adjustedKmPerLiter).toBe(0);
    });

    it("SA_ENGINE_ON uses base consumption even with calibration", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;

      const factors = calculateAdjustedConsumption(
        10,
        0,
        0,
        0,
        "SA_ENGINE_ON" as ActivityType,
        0,
        1600,
        "gasolina" as FuelType,
        makeCalibration(),
      );

      expect(factors.copertKmPerLiter).toBe(10);
    });
  });

  describe("grade/inclination effects", () => {
    function makeCalibration(): CopertCalibration {
      return {
        make: "Toyota",
        model: "Corolla",
        year: 2020,
        displacement: 2000,
        fuelType: "flex",
        euroNorm: "Euro 6",
        segment: "medium",
        urbanKmpl: 9.5,
        highwayKmpl: 12.5,
        combinedKmpl: 11.0,
        mass: 1380,
        grossWeight: 1750,
        frontalArea: 2.28,
        dragCoefficient: 0.29,
        f0: 156,
        f1: 2.5,
        f2: 0.47,
        fuelConversionFactor: 275,
        peakPowerKw: 130,
        peakTorqueNm: 210,
        co2_gkm: 145,
        nox_mgkm: 60,
        confidence: "high",
      };
    }

    it("uphill increases fuel consumption (worse km/l)", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;

      const flat = calculateAdjustedConsumption(
        12,
        80,
        0,
        0,
        "MA" as ActivityType,
        0,
        1600,
        "gasolina" as FuelType,
        makeCalibration(),
        0,
      );

      const uphill = calculateAdjustedConsumption(
        12,
        80,
        0,
        0,
        "MA" as ActivityType,
        0,
        1600,
        "gasolina" as FuelType,
        makeCalibration(),
        5,
      );

      expect(uphill.adjustedKmPerLiter).toBeLessThan(flat.adjustedKmPerLiter);
      expect(uphill.gradePercent).toBe(5);
      expect(uphill.fuelCutActive).toBe(false);
    });

    it("downhill improves fuel consumption (better km/l)", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;

      const flat = calculateAdjustedConsumption(
        12,
        80,
        0,
        0,
        "MA" as ActivityType,
        0,
        1600,
        "gasolina" as FuelType,
        makeCalibration(),
        0,
      );

      const downhill = calculateAdjustedConsumption(
        12,
        80,
        0,
        0,
        "MA" as ActivityType,
        0,
        1600,
        "gasolina" as FuelType,
        makeCalibration(),
        -2,
      );

      expect(downhill.adjustedKmPerLiter).toBeGreaterThan(
        flat.adjustedKmPerLiter,
      );
      expect(downhill.gradePercent).toBe(-2);
      expect(downhill.fuelCutActive).toBe(false);
    });

    it("steep downhill triggers fuel cut (consumption = 0)", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;

      const factors = calculateAdjustedConsumption(
        12,
        80,
        0,
        0,
        "MA" as ActivityType,
        0,
        1600,
        "gasolina" as FuelType,
        makeCalibration(),
        -4,
      );

      expect(factors.copertKmPerLiter).toBe(0);
      expect(factors.fuelCutActive).toBe(true);
      expect(factors.adjustedKmPerLiter).toBe(0);
    });

    it("fuel cut does not trigger on mild downhill", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;

      const factors = calculateAdjustedConsumption(
        12,
        80,
        0,
        0,
        "MA" as ActivityType,
        0,
        1600,
        "gasolina" as FuelType,
        makeCalibration(),
        -2.5,
      );

      expect(factors.fuelCutActive).toBe(false);
      expect(factors.adjustedKmPerLiter).toBeGreaterThan(0);
    });
  });
});
