/**
 * @deprecated This file is kept for backward compatibility.
 * Please import from './transmission-calculator' instead.
 *
 * This module now re-exports all functions from transmission-calculator.ts
 * to maintain backward compatibility with existing code.
 */

export {
  calculateEngineLoad,
  calculateEngineLoadForAllGears,
  calculateRpm,
  estimateTorqueCurve,
  getTorqueAtRpm,
  scoreGear,
  validateTransmission,
  getAspirationType,
  selectOptimalGear,
  type EngineLoadInput,
  type EngineLoadResult,
  type GearEstimationResult,
  type GearSelectionParams,
} from "./transmission-calculator";
