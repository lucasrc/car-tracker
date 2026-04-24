import type { VehicleCalibration } from "@/types";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface CalibrationResult {
  data: VehicleCalibration;
  confidence: ConfidenceLevel;
  similarUsed: boolean;
  originalVehicle?: string;
  notes?: string;
  dataSource?: "web" | "ai_inferred";
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateBasic(data: VehicleCalibration): ValidationResult {
  const errors: string[] = [];

  if (data.mass >= data.grossWeight) {
    errors.push(
      `mass (${data.mass}kg) deve ser menor que grossWeight (${data.grossWeight}kg)`,
    );
  }

  if (data.f0 !== undefined && (data.f0 < 0.05 || data.f0 > 0.5)) {
    errors.push(`f0 (${data.f0}) deve estar entre 0.05 e 0.5`);
  }

  if (data.f1 !== undefined && (data.f1 < 0.0005 || data.f1 > 0.01)) {
    errors.push(`f1 (${data.f1}) deve estar entre 0.0005 e 0.01`);
  }

  if (data.f2 !== undefined && (data.f2 < 0.0001 || data.f2 > 0.001)) {
    errors.push(`f2 (${data.f2}) deve estar entre 0.0001 e 0.001`);
  }

  if (
    !(
      data.urbanKmpl < data.combinedKmpl && data.combinedKmpl < data.highwayKmpl
    )
  ) {
    errors.push(
      `consumo inválido: urbano (${data.urbanKmpl}) < combinado (${data.combinedKmpl}) < rodovia (${data.highwayKmpl})`,
    );
  }

  return { valid: errors.length === 0, errors };
}

export function determineConfidence(data: VehicleCalibration): ConfidenceLevel {
  const conf = data.confidence;
  if (conf === "high") return "high";
  if (conf === "low") return "low";
  return "medium";
}

export function validateFull(_data: VehicleCalibration): ValidationResult {
  return { valid: true, errors: [] };
}
