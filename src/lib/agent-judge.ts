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
