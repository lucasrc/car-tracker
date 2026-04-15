import { z } from "zod";
import {
  validateBasic,
  validateFull,
  type CalibrationResult,
  type VehicleCalibration,
} from "./agent-judge";
import { createAIProvider, getProviderType } from "./ai";
import type { ChatMessage } from "./ai/providers";
import type { TransmissionData } from "@/types";

export function extractJsonFromResponse(raw: string): string {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : raw;
}

export function calculateTireRadiusM(
  gearRatios: number[],
  finalDrive: number,
  rpmAt100Kmh: number,
): number {
  const topGearRatio = gearRatios[gearRatios.length - 1];
  const tireRadiusM =
    ((100 / 3.6) * topGearRatio * finalDrive * 60) /
    (2 * Math.PI * rpmAt100Kmh);
  return Math.round(tireRadiusM * 1000) / 1000;
}

const vehicleCalibrationSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1900).max(2028),
  displacement: z.number().positive(),
  fuelType: z.enum(["gasoline", "diesel", "ethanol", "flex"]),
  euroNorm: z.enum([
    "Euro 1",
    "Euro 2",
    "Euro 3",
    "Euro 4",
    "Euro 5",
    "Euro 6",
    "Euro 6d",
    "Euro 7",
  ]),
  segment: z.enum(["mini", "small", "medium", "large", "suv", "pickup"]),
  urbanKmpl: z.number().positive(),
  highwayKmpl: z.number().positive(),
  combinedKmpl: z.number().positive(),
  mass: z.number().positive(),
  grossWeight: z.number().positive(),
  frontalArea: z.number().positive(),
  dragCoefficient: z.number().positive(),
  f0: z.number().positive(),
  f1: z.number().positive(),
  f2: z.number().positive(),
  fuelConversionFactor: z.number().positive(),
  peakPowerKw: z.number().positive(),
  peakTorqueNm: z.number().positive(),
  co2_gkm: z.number().positive().optional(),
  nox_mgkm: z.number().positive().optional(),
  confidence: z.enum(["high", "medium", "low"]),
  inmetroCityKmpl: z.number().positive(),
  inmetroHighwayKmpl: z.number().positive(),
  userAvgCityKmpl: z.number().positive(),
  userAvgHighwayKmpl: z.number().positive(),
  inmetroEthanolCityKmpl: z.number().positive().optional(),
  inmetroEthanolHighwayKmpl: z.number().positive().optional(),
  userAvgEthanolCityKmpl: z.number().positive().optional(),
  userAvgEthanolHighwayKmpl: z.number().positive().optional(),
  crr: z.number().positive(),
  idleLph: z.number().positive(),
  baseBsfc: z.number().positive(),
  transmission: z
    .object({
      type: z.enum(["Manual", "Automatic", "CVT"]).optional(),
      gearRatios: z.array(z.number()).optional(),
      finalDrive: z.number().optional(),
      tireRadiusM: z.number().optional(),
      redlineRpm: z.number().optional(),
      idleRpm: z.number().optional(),
      torqueCurve: z.record(z.number(), z.number()).optional(),
      rpmAt100Kmh: z.number().optional(),
    })
    .optional(),
});

const SYSTEM_PROMPT = `Você é especialista em engenharia automotiva e dados COPERT (EMEP/EEA).

Retorne UM JSON válido com todos os campos abaixo.

## CAMPOS OBRIGATÓRIOS - todos devem estar presentes no JSON:

### Identificação do veículo:
- make: string (ex: "Renault")
- model: string (ex: "Clio")
- year: number (1990-2027)
- displacement: number em litros (0.5-8.0)
- fuelType: "gasoline" | "diesel" | "ethanol" | "flex" (NÃO use outros valores)
- euroNorm: "Euro 1" | "Euro 2" | "Euro 3" | "Euro 4" | "Euro 5" | "Euro 6" | "Euro 6d" | "Euro 7"
- segment: "mini" | "small" | "medium" | "large" | "suv" | "pickup"

### Parâmetros físicos:
- mass: number em kg (600-3500)
- grossWeight: number em kg (800-6000, deve ser > mass)
- frontalArea: number em m² (1.5-4.0)
- dragCoefficient: number (0.20-0.60)

### Parâmetros COPERT (resistência ao rolamento):
- f0: number em kW (0.08-0.40) - resistência constante
- f1: number (0.002-0.015) - resistência velocidade
- f2: number (0.0001-0.0006) - resistência velocidade²
- crr: number (0.005-0.040) - coeficiente de rolamento

### Dados do motor:
- peakPowerKw: number (30-500 kW)
- peakTorqueNm: number (50-800 Nm)
- idleLph: number em L/h (0.3-2.5)
- baseBsfc: number em g/kWh (180-400)
- fuelConversionFactor: number conforme tipo:
  - gasoline/flex: 8.0-9.5
  - ethanol: 5.0-7.0
  - diesel: 9.0-13.0

### Consumo do veículo (urbano < combinado < rodovia):
- urbanKmpl: km/L (3-35)
- combinedKmpl: km/L (5-40)
- highwayKmpl: km/L (8-45)
- inmetroCityKmpl: km/L (5-30)
- inmetroHighwayKmpl: km/L (8-40)
- userAvgCityKmpl: km/L (pode variar ±50% do inmetro)
- userAvgHighwayKmpl: km/L (pode variar ±50% do inmetro)

### Para veículos flex (obrigatório):
- inmetroEthanolCityKmpl: km/L (3-20)
- inmetroEthanolHighwayKmpl: km/L (5-25)
- userAvgEthanolCityKmpl: km/L
- userAvgEthanolHighwayKmpl: km/L

### Pesos para média (valores entre 0 e 1):
- weightInmetro: 0.3-0.9
- weightUser: 0.1-0.7

### Confiança:
- confidence: "high" | "medium" | "low" (obrigatório, sempre inclua)

### Emissões (opcionais):
- co2_gkm: number
- nox_mgkm: number

### Transmissão (OPCIONAL - só inclua se tiver TODOS):
- transmission.type: "Manual" | "Automatic" | "CVT"
- transmission.gearRatios: array de 5 números (2.0-5.5)
- transmission.finalDrive: number (2.0-5.5)
- transmission.redlineRpm: number (4000-9000)
- transmission.idleRpm: number (500-1200)
- transmission.rpmAt100Kmh: number (2000-4000) - RPM do motor a 100 km/h em cruising (marcha mais alta)

## REGRAS DE VALIDAÇÃO (aplique antes de retornar):
1. mass < grossWeight (sempre)
2. urbanKmpl < combinedKmpl < highwayKmpl
3. Se fuelType="flex": inclua campos de etanol
4. confidence DEVE ser "high", "medium" ou "low"
5. fuelConversionFactor DEVE ter valor numérico
6. NÃO retorne undefined, null ou campos vazios

## SAÍDA:
Retorne APENAS o JSON válido, sem texto adicional.

Exemplo de estrutura:
{"make":"Renault","model":"Clio","year":2008,"fuelType":"flex","segment":"small","mass":1050,"grossWeight":1480,"urbanKmpl":12.5,"combinedKmpl":14.5,"highwayKmpl":17.0,"inmetroCityKmpl":14.2,"inmetroHighwayKmpl":18.1,"userAvgCityKmpl":12.0,"userAvgHighwayKmpl":16.5,"inmetroEthanolCityKmpl":9.5,"inmetroEthanolHighwayKmpl":12.0,"f0":0.15,"f1":0.006,"f2":0.0003,"crr":0.015,"peakPowerKw":65,"peakTorqueNm":135,"fuelConversionFactor":8.5,"confidence":"medium"}`;

const USER_PROMPT = (vehicle: string) =>
  `Para o veículo "${vehicle}", retorne UM JSON completo com todos os campos de calibração técnica listados no sistema.

Campos obrigatórios: make, model, year, displacement, fuelType, euroNorm, segment, mass, grossWeight, frontalArea, dragCoefficient, f0, f1, f2, crr, peakPowerKw, peakTorqueNm, idleLph, baseBsfc, fuelConversionFactor, urbanKmpl, combinedKmpl, highwayKmpl, inmetroCityKmpl, inmetroHighwayKmpl, userAvgCityKmpl, userAvgHighwayKmpl, weightInmetro, weightUser, confidence.

Se tiver dados de transmissão: inclua transmission.rpmAt100Kmh (RPM a 100 km/h).

Se flex: adicione inmetroEthanolCityKmpl, inmetroEthanolHighwayKmpl, userAvgEthanolCityKmpl, userAvgEthanolHighwayKmpl.

Confirme que urbanKmpl < combinedKmpl < highwayKmpl.

Retorne apenas JSON válido.`;

async function chat(
  messages: ChatMessage[],
  options?: { temperature?: number; model?: string; enableWebSearch?: boolean },
): Promise<string | null> {
  const ai = createAIProvider();
  return ai.chat(messages, options);
}

function parseJson(content: string): {
  data?: VehicleCalibration;
  error?: string;
} {
  try {
    const jsonStr = extractJsonFromResponse(content);
    const parsed = JSON.parse(jsonStr);
    const zodResult = vehicleCalibrationSchema.safeParse(parsed);
    if (!zodResult.success) {
      console.log(
        "[Calibration] Zod validation failed:",
        zodResult.error.issues,
      );
      if (Array.isArray(parsed) && parsed.length > 0) {
        const firstItem = parsed[0];
        const retryResult = vehicleCalibrationSchema.safeParse(firstItem);
        if (retryResult.success) {
          return { data: addMissingDefaults(retryResult.data) };
        }
      }
      return {
        error: `Dados inválidos: ${zodResult.error.issues[0]?.message}`,
      };
    }
    return { data: addMissingDefaults(zodResult.data) };
  } catch (e) {
    console.log("[Calibration] Parse error:", e);
    return { error: "Erro ao processar resposta" };
  }
}

function addMissingDefaults(
  data: z.input<typeof vehicleCalibrationSchema>,
): VehicleCalibration {
  const { transmission, ...rest } = data;

  if (transmission) {
    const cleaned = Object.fromEntries(
      Object.entries(transmission).filter(([, v]) => v !== undefined),
    );
    return {
      ...rest,
      ...(Object.keys(cleaned).length > 0 && {
        transmission: cleaned as TransmissionData,
      }),
    } as VehicleCalibration;
  }

  return rest as VehicleCalibration;
}

function isValid(data: VehicleCalibration): boolean {
  const basicValidation = validateBasic(data);
  const fullValidation = validateFull(data);
  return (
    basicValidation.valid && fullValidation.valid && data.confidence !== "low"
  );
}

function getValidationErrors(data: VehicleCalibration): string[] {
  const fullValidation = validateFull(data);
  const basicValidation = validateBasic(data);
  return [...fullValidation.errors, ...basicValidation.errors];
}

async function retryWithFeedback(
  systemMessage: ChatMessage,
  userPrompt: string,
  model: string,
  isO1: boolean,
  errors: string[],
  onProgress?: (status: string) => void,
): Promise<string | null> {
  const errorFeedback = `\n\nATENÇÃO - corrija os seguintes erros na próxima resposta:\n${errors.join("\n")}`;

  const retryMessage: ChatMessage = {
    role: "system",
    content: systemMessage.content + errorFeedback,
  };

  onProgress?.("Corrigindo dados...");

  return chat([retryMessage, { role: "user", content: userPrompt }], {
    temperature: isO1 ? undefined : 0.1,
    model,
  });
}

function withDefaults(data: VehicleCalibration): VehicleCalibration {
  const result: VehicleCalibration = {
    ...data,
    confidence: data.confidence ?? "medium",
    fuelConversionFactor: data.fuelConversionFactor ?? 8.5,
    weightInmetro: data.weightInmetro ?? 0.6,
    weightUser: data.weightUser ?? 0.4,
    isHybrid: data.isHybrid ?? false,
    gnvCylinderWeightKg: data.gnvCylinderWeightKg ?? 80,
    gnvEfficiencyFactor: data.gnvEfficiencyFactor ?? 1.32,
  };

  const trans = data.transmission;
  if (
    trans?.gearRatios &&
    trans?.finalDrive &&
    trans?.rpmAt100Kmh &&
    trans.gearRatios.length > 0
  ) {
    trans.tireRadiusM = calculateTireRadiusM(
      trans.gearRatios,
      trans.finalDrive,
      trans.rpmAt100Kmh,
    );
  }

  return result;
}

function getModel(providerType: string): string {
  if (providerType === "openai") {
    return "o1";
  }
  return "deepseek-chat";
}

const DEFAULT_VALUES: Record<string, number> = {
  f0: 0.15,
  f1: 0.006,
  f2: 0.0003,
  fuelConversionFactor: 8.5,
  crr: 0.015,
  idleLph: 0.8,
  baseBsfc: 280,
  mass: 1100,
  grossWeight: 1500,
  frontalArea: 2.0,
  dragCoefficient: 0.3,
  peakPowerKw: 80,
  peakTorqueNm: 140,
};

export async function calibrateVehicle(
  vehicle: string,
  onProgress?: (status: string) => void,
): Promise<CalibrationResult | null> {
  const providerType = getProviderType();
  const webSearchEnabled =
    providerType === "openai" && import.meta.env.VITE_AI_WEB_SEARCH === "true";

  let searchData: object | null = null;
  let dataSource: "web" | "ai_inferred" | undefined = undefined;

  if (webSearchEnabled) {
    onProgress?.("Buscando na web...");

    const searchResult = await chat(
      [
        { role: "system", content: "Responda apenas com JSON válido." },
        { role: "user", content: `Dados técnicos: ${vehicle}` },
      ],
      { model: "gpt-4o" },
    );

    if (searchResult) {
      try {
        const jsonMatch = searchResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          searchData = JSON.parse(jsonMatch[0]);
          dataSource = "web";
          onProgress?.("Dados encontrados");
        }
      } catch {
        onProgress?.("Usando geração padrão");
      }
    }
  }

  onProgress?.("Gerando parâmetros...");

  const systemMessage: ChatMessage = {
    role: "system",
    content: searchData
      ? `${SYSTEM_PROMPT}\n\nDADOS WEB:\n${JSON.stringify(searchData)}`
      : SYSTEM_PROMPT,
  };

  const model = getModel(providerType);
  const isO1 = model === "o1";

  let result = await chat(
    [systemMessage, { role: "user", content: USER_PROMPT(vehicle) }],
    {
      temperature: isO1 ? undefined : 0.1,
      model,
    },
  );

  if (!result) {
    onProgress?.("Tentando novamente...");
    result = await chat(
      [systemMessage, { role: "user", content: USER_PROMPT(vehicle) }],
      {
        temperature: isO1 ? undefined : 0.1,
        model,
      },
    );
  }

  if (!result) {
    onProgress?.("Não foi possível");
    return null;
  }

  let parsed = parseJson(result);

  if (!parsed.data) {
    onProgress?.("Não foi possível processar");
    return null;
  }

  if (isValid(parsed.data)) {
    onProgress?.("Concluído");
    return {
      data: withDefaults(parsed.data),
      confidence: parsed.data.confidence,
      similarUsed: false,
      dataSource,
    };
  }

  const errors = getValidationErrors(parsed.data);
  onProgress?.("Dados inválidos, corrigindo...");

  const retryResult = await retryWithFeedback(
    systemMessage,
    USER_PROMPT(vehicle),
    model,
    isO1,
    errors,
    onProgress,
  );

  if (retryResult) {
    const retryParsed = parseJson(retryResult);
    if (retryParsed.data && isValid(retryParsed.data)) {
      onProgress?.("Concluído");
      return {
        data: withDefaults(retryParsed.data),
        confidence: retryParsed.data.confidence,
        similarUsed: false,
        dataSource,
      };
    }
  }

  const data = parsed.data;
  const correctedData = { ...data };

  if (data.f0 > 1 || data.f1 > 0.1 || data.f2 > 0.01) {
    correctedData.f0 = data.f0 > 1 ? DEFAULT_VALUES.f0 : data.f0;
    correctedData.f1 = data.f1 > 0.1 ? DEFAULT_VALUES.f1 : data.f1;
    correctedData.f2 = data.f2 > 0.01 ? DEFAULT_VALUES.f2 : data.f2;
  }

  if (data.fuelConversionFactor < 5 || data.fuelConversionFactor > 15) {
    correctedData.fuelConversionFactor = DEFAULT_VALUES.fuelConversionFactor;
  }

  if (data.urbanKmpl > data.highwayKmpl) {
    const temp = correctedData.urbanKmpl;
    correctedData.urbanKmpl = correctedData.highwayKmpl;
    correctedData.highwayKmpl = temp;
  }

  correctedData.confidence = "medium";
  dataSource = dataSource || "ai_inferred";

  onProgress?.("Concluído");
  return {
    data: withDefaults(correctedData),
    confidence: "medium",
    similarUsed: false,
    dataSource,
  };
}
