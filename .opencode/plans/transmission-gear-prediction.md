# Transmission Data & Gear Prediction Integration

## Overview

Integrate transmission data collection into AI calibration service and implement gear prediction algorithm with hybrid COPERT fallback.

## Phase 1: Type System Updates

### 1.1 Add Transmission Interfaces (`src/types/index.ts`)

Add after `CopertConfidence` type:

```typescript
export type TechEra =
  | "carburetor"
  | "injection_early"
  | "injection_modern"
  | "direct_injection";
export type TransmissionType = "Manual" | "Automatic" | "CVT";

export interface TransmissionData {
  type: TransmissionType;
  gearRatios: number[];
  finalDrive: number;
  tireRadiusM: number;
  redlineRpm: number;
  idleRpm: number;
  torqueCurve: Record<number, number>;
}
```

Add to `CopertCalibration` interface (before closing brace):

```typescript
transmission?: TransmissionData;
techEra?: TechEra;
idleFuelRateLph?: number;
bsfcMinGPerKwh?: number;
```

Add to `Vehicle` interface (before closing brace):

```typescript
transmission?: TransmissionData;
techEra?: TechEra;
idleFuelRateLph?: number;
bsfcMinGPerKwh?: number;
```

## Phase 2: AI Calibration Service Updates

### 2.1 Update Zod Schema (`src/lib/copert-calibration-service.ts`)

Add to `copertCalibrationSchema` (before closing):

```typescript
transmissionType: z.enum(["Manual", "Automatic", "CVT"]).optional(),
gearRatios: z.array(z.number().positive()).optional(),
finalDrive: z.number().positive().optional(),
tireRadiusM: z.number().positive().optional(),
redlineRpm: z.number().int().positive().optional(),
idleRpm: z.number().int().positive().optional(),
torqueCurve: z.record(z.number(), z.number()).optional(),
techEra: z.enum(["carburetor", "injection_early", "injection_modern", "direct_injection"]).optional(),
idleFuelRateLph: z.number().positive().optional(),
bsfcMinGPerKwh: z.number().positive().optional(),
```

### 2.2 Update JSON_SCHEMA

Add transmission fields to schema string:

```json
"transmissionType": "Manual" | "Automatic" | "CVT" (opcional),
"gearRatios": [3.364, 1.864, 1.321, 1.029, 0.821] (opcional),
"finalDrive": 4.067 (opcional),
"tireRadiusM": 0.288 (opcional),
"redlineRpm": 6500 (opcional),
"idleRpm": 800 (opcional),
"torqueCurve": { "800": 105, "1200": 120, "1800": 135, "2500": 145, "3500": 152, "4500": 155, "5500": 148, "6000": 140, "6500": 135 } (opcional),
"techEra": "carburetor" | "injection_early" | "injection_modern" | "direct_injection" (opcional),
"idleFuelRateLph": 0.7 (opcional),
"bsfcMinGPerKwh": 240 (opcional)
```

Update example in SYSTEM_PROMPT to include transmission data:

```json
{
  // ... existing fields ...
  "transmissionType": "Manual",
  "gearRatios": [3.364, 1.864, 1.321, 1.029, 0.821],
  "finalDrive": 4.067,
  "tireRadiusM": 0.288,
  "redlineRpm": 6500,
  "idleRpm": 800,
  "torqueCurve": {
    "800": 105,
    "1200": 120,
    "1800": 135,
    "2500": 145,
    "3500": 152,
    "4500": 155,
    "5500": 148,
    "6000": 140,
    "6500": 135
  },
  "techEra": "injection_modern",
  "idleFuelRateLph": 0.7,
  "bsfcMinGPerKwh": 240
}
```

### 2.3 Update SYSTEM_PROMPT

Add after existing COPERT parameters section:

```
=== DADOS DE TRANSMISSÃO (para previsão de marcha) ===
Forneça os dados da transmissão do veículo quando disponíveis:
1. transmissionType: "Manual", "Automatic" ou "CVT"
2. gearRatios: Array com relações de cada marcha (da 1ª à última)
3. finalDrive: Relação do diferencial final (tipicamente 3.0-4.5)
4. tireRadiusM: Raio de rolamento do pneu em metros
   - Calcule de tamanho de pneu: 185/65R14 → 0.296m, 195/65R15 → 0.315m
   - Fórmula: (largura_mm * perfil% / 100 / 1000 * 2) + (aro_pol * 0.0254) / 2
5. redlineRpm: RPM máximo do motor (gasolina: 5500-7000, diesel: 4500-5500)
6. idleRpm: RPM em marcha lenta (tipicamente 750-900)
7. torqueCurve: Objeto com mapeamento RPM → torque (Nm)
   - Use dados do fabricante ou estime de peakTorqueNm
   - Pontos típicos: idle, 1200, 1800, 2500, 3500, 4500, peak, redline
8. techEra: Era tecnológica do motor
   - carburetor: até ~1990
   - injection_early: ~1990-2000
   - injection_modern: ~2000-2015
   - direct_injection: ~2015+
9. idleFuelRateLph: Consumo em marcha lenta (L/h)
   - Motores pequenos (1.0-1.6): 0.5-0.8 L/h
   - Motores médios (1.6-2.0): 0.7-1.0 L/h
   - Motores grandes (2.0+): 0.9-1.3 L/h
10. bsfcMinGPerKwh: Consumo específico mínimo (g/kWh)
    - Motores modernos: 220-250 g/kWh
    - Motores antigos: 250-280 g/kWh

Quando dados exatos não existirem:
- transmissionType: Carros populares BR → Manual 5 marchas
- gearRatios: Use relações típicas para segmento
- finalDrive: Estimar de consumo rodoviário e RPM a 100km/h
- tireRadiusM: Calcular de tamanho de pneu comum para o veículo
- torqueCurve: Gerar curva baseada em displacement, peakPowerKw, peakTorqueNm
```

### 2.4 Update VERIFY_PROMPT

Add transmission validation:

```
5. Valide dados de transmissão:
   - gearRatios devem ser decrescentes (1ª > 2ª > 3ª > ...)
   - finalDrive típico: 3.0 a 4.5
   - tireRadiusM típico: 0.25 a 0.35m
   - redlineRpm: 5500-7000 (gasolina/flex), 4500-5500 (diesel)
   - idleRpm: 750-900
   - torqueCurve deve ter pico próximo ao peakTorqueNm informado
   - torqueCurve deve ser crescente até o pico, depois decrescente
   - idleFuelRateLph: 0.5-1.3 dependendo da cilindrada
   - bsfcMinGPerKwh: 220-280 para motores a combustão
```

### 2.5 Update INFER_PROMPT

Add transmission inference:

```
3. Para dados de transmissão (quando não disponíveis):
   - transmissionType: Inferir de segmento e ano (carros populares BR → Manual 5 marchas)
   - gearRatios: Usar relações típicas para veículo similar
     * Hatch 1.0-1.6: [3.5, 2.0, 1.4, 1.0, 0.8]
     * Sedan 1.6-2.0: [3.4, 1.9, 1.3, 1.0, 0.75]
     * SUV/Pickup: [3.8, 2.2, 1.5, 1.1, 0.85]
   - finalDrive: Estimar (3.5-4.2 para econômicos, 3.0-3.5 para rodoviários)
   - tireRadiusM: Calcular de tamanho de pneu comum
     * 175/70R13 → 0.284m, 185/65R14 → 0.296m, 195/65R15 → 0.315m
   - torqueCurve: Gerar curva suave baseada em:
     * idleRpm → 70% do peakTorqueNm
     * 1500rpm → 80% do peakTorqueNm
     * 2500rpm → 95% do peakTorqueNm
     * peakTorqueRpm → 100% do peakTorqueNm
     * redlineRpm → 85% do peakTorqueNm
   - techEra: Inferir de ano e combustível
   - idleFuelRateLph: Estimar de cilindrada (0.5-1.3 L/h)
   - bsfcMinGPerKwh: Estimar de era tecnológica (220-280 g/kWh)
```

## Phase 3: Gear Prediction Algorithm

### 3.1 Update Telemetry Engine (`src/lib/telemetry-engine.ts`)

Add imports and interfaces:

```typescript
import type { TransmissionData, TechEra } from "@/types";

export interface TelemetryResult {
  kmpl: number;
  lphOrM3ph: number;
  updatedBatterySocPct: number;
  isHybridEvMode: boolean;
  factors: TelemetryFactors;
  // New fields for gear prediction
  gear?: number;
  rpm?: number;
  confidence: number;
  hasTransmissionData: boolean;
}
```

Add gear prediction function:

```typescript
function calculateRPM(
  speedKmh: number,
  gearRatio: number,
  finalDrive: number,
  tireRadiusM: number,
): number {
  const speedMs = speedKmh / 3.6;
  const wheelRps = speedMs / (2 * Math.PI * tireRadiusM);
  const engineRps = wheelRps * gearRatio * finalDrive;
  return engineRps * 60;
}

function predictGear(
  speedKmh: number,
  transmission: TransmissionData,
): { gear: number; rpm: number } {
  const { gearRatios, finalDrive, tireRadiusM, idleRpm, redlineRpm } =
    transmission;

  if (speedKmh < 1) {
    return { gear: 0, rpm: idleRpm };
  }

  for (let i = 0; i < gearRatios.length; i++) {
    const rpm = calculateRPM(speedKmh, gearRatios[i], finalDrive, tireRadiusM);
    if (rpm >= idleRpm && rpm <= redlineRpm) {
      return { gear: i + 1, rpm: Math.round(rpm) };
    }
  }

  const results = gearRatios.map((ratio, i) => ({
    gear: i + 1,
    rpm: calculateRPM(speedKmh, ratio, finalDrive, tireRadiusM),
  }));

  const valid = results.filter((r) => r.rpm >= idleRpm && r.rpm <= redlineRpm);
  if (valid.length > 0) {
    const best = valid.reduce((a, b) => (a.rpm < b.rpm ? a : b));
    return { gear: best.gear, rpm: Math.round(best.rpm) };
  }

  const closest = results.reduce((a, b) => {
    const aDist = Math.min(
      Math.abs(a.rpm - idleRpm),
      Math.abs(a.rpm - redlineRpm),
    );
    const bDist = Math.min(
      Math.abs(b.rpm - idleRpm),
      Math.abs(b.rpm - redlineRpm),
    );
    return aDist < bDist ? a : b;
  });

  return { gear: closest.gear, rpm: Math.round(closest.rpm) };
}

function getTorqueAtRpm(
  rpm: number,
  torqueCurve: Record<number, number>,
): number {
  const rpms = Object.keys(torqueCurve)
    .map(Number)
    .sort((a, b) => a - b);

  if (rpm <= rpms[0]) return torqueCurve[rpms[0]];
  if (rpm >= rpms[rpms.length - 1]) return torqueCurve[rpms[rpms.length - 1]];

  for (let i = 0; i < rpms.length - 1; i++) {
    if (rpm >= rpms[i] && rpm <= rpms[i + 1]) {
      const t1 = torqueCurve[rpms[i]];
      const t2 = torqueCurve[rpms[i + 1]];
      const ratio = (rpm - rpms[i]) / (rpms[i + 1] - rpms[i]);
      return t1 + (t2 - t1) * ratio;
    }
  }

  return torqueCurve[rpms[0]];
}

function calculateBSFCConsumption(
  rpm: number,
  torqueNm: number,
  bsfcMinGPerKwh: number,
  techEra: TechEra,
  fuelType: string,
): number {
  const powerKw = (torqueNm * rpm * 2 * Math.PI) / 60000;
  if (powerKw <= 0) return 999;

  const bsfcMap: Record<TechEra, number> = {
    carburetor: 280,
    injection_early: 265,
    injection_modern: 250,
    direct_injection: 235,
  };

  const bsfcBase = bsfcMinGPerKwh || bsfcMap[techEra] || 250;
  const bsfc = bsfcBase * (1 + Math.abs(rpm - 2500) / 5000);
  const fuelFlowGPerH = bsfc * powerKw;

  const fuelDensity = fuelType === "etanol" ? 0.79 : 0.75;
  const fuelFlowLPerH = fuelFlowGPerH / fuelDensity / 1000;

  const speedKmh =
    (((rpm * 60 * 2 * Math.PI * 0.288) / (4.067 * 3.364)) * 3.6) / 1000;

  return speedKmh / fuelFlowLPerH;
}
```

Update `simulate()` function to use gear prediction:

```typescript
export function simulate(
  vehicle: Vehicle,
  input: TelemetryInput,
): TelemetryResult {
  const {
    speed,
    slope,
    accel,
    acOn,
    passengers,
    cargoKg,
    fuelType,
    batterySocPct,
  } = input;

  const isCity = speed < CITY_SPEED_THRESHOLD;
  const baseKmpl = getCalibratedBase(vehicle, isCity, fuelType);

  let batterySoc = batterySocPct;
  let isHybridEvMode = false;

  const extraMass =
    (passengers - 1) * 75 +
    cargoKg +
    (fuelType === "gnv" ? (vehicle.gnvCylinderWeightKg ?? 80) : 0);
  const massPenalty = 1.0 + (extraMass / vehicle.mass) * 0.4;

  let speedFactor = 1.0;
  if (isCity) {
    if (speed > 0) {
      speedFactor = 1.0 + (speed - 32.5) * 0.005;
    }
  } else {
    speedFactor = 1.0 - (speed - 85.0) * 0.008;
  }

  const dynamicFactor = 1.0 - slope * 0.025 - accel * 0.415;
  const fuelCutActive = slope < -3 && speed > 0;

  const acPenalty = vehicle.peakPowerKw <= 80 ? 0.12 : 0.08;
  const acFactor = acOn ? 1.0 - acPenalty : 1.0;

  let hybridImprovement = 1.0;
  if (vehicle.isHybrid) {
    if (isCity) {
      hybridImprovement = 1.6;
      isHybridEvMode = batterySoc > 20;
      batterySoc = Math.max(20, batterySoc - 2);
    } else {
      hybridImprovement = 1.1;
      batterySoc = Math.min(100, batterySoc + 1);
    }
  }

  // Gear prediction and physics-based consumption
  let gear: number | undefined;
  let rpm: number | undefined;
  let confidence = 0.85;
  let hasTransmissionData = false;
  let physicsKmpl: number | null = null;

  if (vehicle.transmission) {
    hasTransmissionData = true;
    const gearResult = predictGear(speed, vehicle.transmission);
    gear = gearResult.gear;
    rpm = gearResult.rpm;

    if (vehicle.transmission.torqueCurve && vehicle.bsfcMinGPerKwh) {
      const torque = getTorqueAtRpm(rpm, vehicle.transmission.torqueCurve);
      physicsKmpl = calculateBSFCConsumption(
        rpm,
        torque,
        vehicle.bsfcMinGPerKwh,
        vehicle.techEra || "injection_modern",
        fuelType,
      );

      const copertKmpl =
        ((baseKmpl * speedFactor * acFactor * dynamicFactor) / massPenalty) *
        hybridImprovement;

      kmpl = physicsKmpl * 0.7 + copertKmpl * 0.3;
      confidence = 0.95;
    } else {
      kmpl =
        ((baseKmpl * speedFactor * acFactor * dynamicFactor) / massPenalty) *
        hybridImprovement;
      confidence = 0.9;
    }
  } else {
    kmpl =
      ((baseKmpl * speedFactor * acFactor * dynamicFactor) / massPenalty) *
      hybridImprovement;
    confidence = 0.85;
  }

  if (fuelCutActive) {
    kmpl = 999;
  }

  if (fuelType === "gnv") {
    kmpl *= vehicle.gnvEfficiencyFactor ?? 1.32;
  }

  kmpl = Math.round(Math.max(kmpl, MIN_KMPL) * 100) / 100;

  const lphOrM3ph =
    kmpl > 0 && speed > 0
      ? Math.round((speed / kmpl) * 100) / 100
      : (vehicle.idleLph ?? vehicle.idleFuelRateLph ?? 0.9);

  return {
    kmpl,
    lphOrM3ph,
    updatedBatterySocPct: batterySoc,
    isHybridEvMode,
    factors: {
      baseKmpl,
      massPenalty,
      speedFactor,
      dynamicFactor,
      acFactor,
      hybridImprovement,
      fuelCutActive,
    },
    gear,
    rpm,
    confidence,
    hasTransmissionData,
  };
}
```

## Phase 4: Telemetry Hook Updates

### 4.1 Update useTelemetryEngine (`src/hooks/useTelemetryEngine.ts`)

Add to return interface:

```typescript
export interface TelemetryEngineReturn {
  // ... existing fields ...
  currentGear?: number;
  currentRpm?: number;
  hasTransmissionData: boolean;
  confidence: number;
}
```

Add state tracking:

```typescript
const [currentGear, setCurrentGear] = useState<number | undefined>();
const [currentRpm, setCurrentRpm] = useState<number | undefined>();
const [confidence, setConfidence] = useState(0.85);
const [hasTransmissionData, setHasTransmissionData] = useState(false);
```

Update `addPosition` callback to extract gear data:

```typescript
const result: TelemetryResult = simulate(vehicle, {
  speed: speedKmh,
  slope: gradePercent,
  accel,
  acOn,
  passengers,
  cargoKg,
  fuelType,
  batterySocPct: batterySocRef.current,
});

setCurrentGear(result.gear);
setCurrentRpm(result.rpm);
setConfidence(result.confidence);
setHasTransmissionData(result.hasTransmissionData);
```

Update return statement:

```typescript
return {
  // ... existing fields ...
  currentGear,
  currentRpm,
  hasTransmissionData,
  confidence,
};
```

## Phase 5: UI Updates (Future)

### 5.1 Update Speedometer Component

- Display current gear and RPM
- Show confidence indicator
- Visual gear indicator (1-5 or 1-6)

### 5.2 Update TripTelemetryData

Add gear distribution tracking:

```typescript
export interface TripTelemetryData {
  // ... existing fields ...
  gearDistribution: Record<number, number>;
  avgRpm: number;
  maxRpm: number;
  rpmDistribution: {
    idle: number;
    low: number;
    medium: number;
    high: number;
    redline: number;
  };
}
```

## Testing Strategy

1. Unit tests for gear prediction algorithm
2. Unit tests for RPM calculation
3. Unit tests for torque curve interpolation
4. Integration tests for hybrid fallback
5. AI calibration tests with transmission data

## Migration Notes

- Existing vehicles without transmission data will continue to work with COPERT model
- New vehicles calibrated with AI will include transmission data
- Confidence score indicates which model is being used
- UI should show gear/RPM only when `hasTransmissionData` is true
