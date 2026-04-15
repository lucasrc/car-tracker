import type { Vehicle } from "@/types";

export interface VehicleValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

export function validateVehicleCalibration(
  vehicle: Vehicle | null,
): VehicleValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!vehicle) {
    errors.push("Nenhum veículo selecionado");
    return { isValid: false, warnings, errors };
  }

  if (!vehicle.inmetroCityKmpl || vehicle.inmetroCityKmpl <= 0) {
    warnings.push(
      "Consumo urbano não calibrado - vá em Configurações para calibrar",
    );
  }

  if (!vehicle.inmetroHighwayKmpl || vehicle.inmetroHighwayKmpl <= 0) {
    warnings.push(
      "Consumo rodoviário não calibrado - vá em Configurações para calibrar",
    );
  }

  if (!vehicle.userAvgCityKmpl || vehicle.userAvgCityKmpl <= 0) {
    warnings.push(
      "Seu consumo urbano não registrado - adicione abastecimento para calibrar",
    );
  }

  if (!vehicle.userAvgHighwayKmpl || vehicle.userAvgHighwayKmpl <= 0) {
    warnings.push(
      "Seu consumo rodoviário não registrado - adicione abastecimento para calibrar",
    );
  }

  if (vehicle.fuelCapacity <= 0) {
    errors.push("Capacidade do tanque não configurada");
  }

  if (vehicle.currentFuel < 0) {
    errors.push("Nível de combustível inválido (negativo)");
  }

  if (vehicle.currentFuel > vehicle.fuelCapacity) {
    errors.push(
      `Nível de combustível (${vehicle.currentFuel}L) maior que capacidade (${vehicle.fuelCapacity}L)`,
    );
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

export function getConsumptionWarning(vehicle: Vehicle | null): string | null {
  if (!vehicle) return "Selecione um veículo em Configurações";

  const result = validateVehicleCalibration(vehicle);

  if (result.errors.length > 0) {
    return result.errors[0];
  }

  if (result.warnings.length > 0) {
    return result.warnings.join(". ");
  }

  return null;
}
