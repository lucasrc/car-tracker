import type { CopertCalibration } from "@/types";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface CalibrationResult {
  data: CopertCalibration;
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

const PHYSICAL_LIMITS = {
  f0: [0.05, 0.5],
  f1: [0.0005, 0.01],
  f2: [0.0001, 0.001],
  mass: [500, 4000],
  grossWeight: [1000, 5000],
  displacement: [0.5, 8.0],
  combinedKmpl: [3, 25],
  frontalArea: [1.5, 3.5],
  dragCoefficient: [0.2, 0.5],
};

export function validateBasic(data: CopertCalibration): ValidationResult {
  const errors: string[] = [];

  if (data.f0 < PHYSICAL_LIMITS.f0[0] || data.f0 > PHYSICAL_LIMITS.f0[1]) {
    errors.push(`f0 fora do range físico`);
  }
  if (data.f1 < PHYSICAL_LIMITS.f1[0] || data.f1 > PHYSICAL_LIMITS.f1[1]) {
    errors.push(`f1 fora do range físico`);
  }
  if (data.f2 < PHYSICAL_LIMITS.f2[0] || data.f2 > PHYSICAL_LIMITS.f2[1]) {
    errors.push(`f2 fora do range físico`);
  }
  if (data.mass >= data.grossWeight) {
    errors.push(`massa deve ser menor que peso bruto`);
  }
  if (
    !(
      data.urbanKmpl > data.combinedKmpl && data.combinedKmpl > data.highwayKmpl
    )
  ) {
    errors.push(`consumo inválido: urbano deve ser menor que rodoviário`);
  }

  return { valid: errors.length === 0, errors };
}

export function determineConfidence(data: CopertCalibration): ConfidenceLevel {
  const conf = data.confidence;
  if (conf === "high") return "high";
  if (conf === "low") return "low";
  return "medium";
}
