import { z } from "zod";
import { validateBasic, type CalibrationResult } from "./agent-judge";
import { createAIProvider, getProviderType } from "./ai";
import type { ChatMessage } from "./ai/providers";

export function extractJsonFromResponse(raw: string): string {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : raw;
}

const copertCalibrationSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1990).max(2027),
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
});

const JSON_SCHEMA = `{
  "make": "string",
  "model": "string",
  "year": number,
  "displacement": number,
  "fuelType": "gasoline" | "diesel" | "ethanol" | "flex",
  "euroNorm": "Euro 1" | "Euro 2" | "Euro 3" | "Euro 4" | "Euro 5" | "Euro 6" | "Euro 6d" | "Euro 7",
  "segment": "mini" | "small" | "medium" | "large" | "suv" | "pickup",
  "urbanKmpl": number,
  "highwayKmpl": number,
  "combinedKmpl": number,
  "mass": number,
  "grossWeight": number,
  "frontalArea": number,
  "dragCoefficient": number,
  "f0": number,
  "f1": number,
  "f2": number,
  "fuelConversionFactor": number,
  "peakPowerKw": number,
  "peakTorqueNm": number,
  "co2_gkm": number,
  "nox_mgkm": number,
  "confidence": "high" | "medium" | "low",
  "inmetroCityKmpl": number,
  "inmetroHighwayKmpl": number,
  "userAvgCityKmpl": number,
  "userAvgHighwayKmpl": number,
  "inmetroEthanolCityKmpl": number (opcional, se flex/etanol),
  "inmetroEthanolHighwayKmpl": number (opcional, se flex/etanol),
  "userAvgEthanolCityKmpl": number (opcional, se flex/etanol),
  "userAvgEthanolHighwayKmpl": number (opcional, se flex/etanol),
  "crr": number,
  "idleLph": number,
  "baseBsfc": number
}`;

const SYSTEM_PROMPT = `Atue como um engenheiro automotivo especializado em dinâmica veicular, eficiência energética e fichas técnicas homologadas no Brasil.

Sua tarefa é fornecer os dados técnicos do veículo informado para uso em um motor de simulação física e telemetria.

Requisitos obrigatórios:
1. Retorne SOMENTE um JSON válido (sem explicações, sem texto adicional).
2. Use valores reais sempre que disponíveis (INMETRO, fabricantes, literatura técnica).
3. Quando não houver dados exatos (ex: Cd, área frontal), utilize aproximações fundamentadas em engenharia para o segmento do veículo.
4. Mantenha consistência física entre os parâmetros (ex: potência, massa, consumo).
5. Evite arredondamentos agressivos.
6. Não invente valores irreais — prefira aproximações conservadoras.

=== PARÂMETROS COPERT (muito importante) ===
Os parâmetros f0, f1, f2 são coeficientes da equação de potência em kW:
  P(kW) = f0 + f1 × v + f2 × v²

Valores típicos:
- f0: 0.05 a 0.5 (consumo em marcha lenta/fricção)
- f1: 0.0005 a 0.01 (perdas mecânicas)
- f2: 0.0001 a 0.001 (arrasto aerodinâmico)

⚠️ ATENÇÃO: Valores muito maiores são COMPLETAMENTE ERRADOS.
   - f0 deve ser MENOR que 0.5
   - f1 deve ser MENOR que 0.01
   - f2 deve ser MENOR que 0.001

=== EXEMPLO de resposta CORRETA ===
{
  "make": "Renault",
  "model": "Clio 1.6 16V Flex",
  "year": 2008,
  "displacement": 1598,
  "fuelType": "flex",
  "euroNorm": "Euro 4",
  "segment": "small",
  "urbanKmpl": 8.5,
  "highwayKmpl": 13.2,
  "combinedKmpl": 10.5,
  "mass": 1025,
  "grossWeight": 1500,
  "frontalArea": 2.05,
  "dragCoefficient": 0.35,
  "f0": 0.15,
  "f1": 0.008,
  "f2": 0.00035,
  "fuelConversionFactor": 8.5,
  "peakPowerKw": 84.5,
  "peakTorqueNm": 148,
  "co2_gkm": 145,
  "nox_mgkm": 40,
  "confidence": "high",
  "inmetroCityKmpl": 11.5,
  "inmetroHighwayKmpl": 15.0,
  "userAvgCityKmpl": 10.5,
  "userAvgHighwayKmpl": 14.5,
  "inmetroEthanolCityKmpl": 8.0,
  "inmetroEthanolHighwayKmpl": 10.5,
  "userAvgEthanolCityKmpl": 7.2,
  "userAvgEthanolHighwayKmpl": 9.8,
  "crr": 0.013,
  "idleLph": 0.9,
  "baseBsfc": 265
}

${JSON_SCHEMA}`;

const VERIFY_PROMPT = (
  vehicle: string,
  data: object,
) => `Você é um verificador independente de dados automotivos.

Dados recebidos para: ${vehicle}
${JSON.stringify(data, null, 2)}

VERIFIQUE CADA CAMPO CRÍTICO:

1. Consumo (urbano < combinado < rodoviário):
   - urbano deve ser o MENOR (mais consumo em cidade)
   - rodoviário deve ser o MAIOR (menos consumo na estrada)

2. Parâmetros f0, f1, f2 DEVEM ser muito pequenos:
   - f0: 0.05 a 0.5 (NUNCA maior que 1.0)
   - f1: 0.0005 a 0.01 (NUNCA maior que 0.1)
   - f2: 0.0001 a 0.001 (NUNCA maior que 0.01)

3. fuelConversionFactor: 7.0 a 10.0 para gasolina/flex

4. Se algum valor estiver ERRADO, CORRIJA.

Retorne JSON válido:
${JSON_SCHEMA}`;

const INFER_PROMPT = (
  vehicle: string,
  data: object,
) => `Você é um engenheiro automotivo criativo calculando parâmetros de veículo.

Veículo: ${vehicle}
Dados conhecidos:
${JSON.stringify(data, null, 2)}

Os dados acima podem ter valores incorretos. SUA TAREFA:

1. Mantenha TODOS os campos EXCETO f0, f1, f2, fuelConversionFactor
2. Para f0, f1, f2 e fuelConversionFactor: use sua intuição de engenharia

=== GUIA DE ENGENHARIA ===
f0 (kW) - Resistência básica:
- Hatchback pequeno (1.0-1.6L): 0.10-0.18 kW
- Sedan médio (1.6-2.0L): 0.15-0.25 kW
- SUV/Caminhonete: 0.20-0.40 kW

f1 (kW/(m/s)) - Fricção mecânica:
- Motor 1.0-1.6L: 0.005-0.010
- Motor 1.6-2.0L: 0.007-0.012
- Motor >2.0L turbo: 0.010-0.020

f2 (kW/(m/s)²) - Arrasto aerodinâmico:
- Hatchback (Cd~0.30): 0.00025-0.00040
- Sedan (Cd~0.28): 0.00020-0.00035
- SUV (Cd~0.35): 0.00035-0.00055

fuelConversionFactor:
- Gasolina pura: 8.5-9.0
- Etanol: 5.5-6.5
- Flex (gasolina): 8.0-8.8
- Flex (etanol): 5.5-6.2
- Diesel: 10.0-12.0

Retorne JSON com valores calculados:
${JSON_SCHEMA}`;

const USER_PROMPT = (vehicle: string) => `Veículo: ${vehicle}`;

async function chat(
  messages: ChatMessage[],
  options?: { temperature?: number; model?: string; enableWebSearch?: boolean },
): Promise<string> {
  const ai = createAIProvider();
  return ai.chat(messages, options);
}

function parseJson(content: string): {
  data?: z.infer<typeof copertCalibrationSchema>;
  error?: string;
} {
  try {
    const jsonStr = extractJsonFromResponse(content);
    const parsed = JSON.parse(jsonStr);
    const zodResult = copertCalibrationSchema.safeParse(parsed);

    if (!zodResult.success) {
      return {
        error: `Dados inválidos: ${zodResult.error.issues[0]?.message}`,
      };
    }

    return { data: zodResult.data };
  } catch {
    return { error: "Erro ao processar resposta" };
  }
}

function isValid(data: z.infer<typeof copertCalibrationSchema>): boolean {
  const validation = validateBasic(data as any);
  return validation.valid && data.confidence !== "low";
}

function withTelemetryDefaults<T extends Record<string, unknown>>(
  data: T,
): T & {
  weightInmetro: number;
  weightUser: number;
  isHybrid: boolean;
  gnvCylinderWeightKg: number;
  gnvEfficiencyFactor: number;
} {
  return {
    ...data,
    weightInmetro: (data as any).weightInmetro ?? 0.6,
    weightUser: (data as any).weightUser ?? 0.4,
    isHybrid: (data as any).isHybrid ?? false,
    gnvCylinderWeightKg: (data as any).gnvCylinderWeightKg ?? 80,
    gnvEfficiencyFactor: (data as any).gnvEfficiencyFactor ?? 1.32,
  } as T & {
    weightInmetro: number;
    weightUser: number;
    isHybrid: boolean;
    gnvCylinderWeightKg: number;
    gnvEfficiencyFactor: number;
  };
}

function getModelForStep(
  step: number,
  providerType: string,
): string | undefined {
  if (providerType === "openai") {
    return step <= 2 ? "gpt-4o" : "gpt-4o";
  }
  return step <= 2 ? "deepseek-chat" : "deepseek-reasoner";
}

export async function calibrateCopert(
  vehicle: string,
  onProgress?: (status: string) => void,
): Promise<CalibrationResult | null> {
  const providerType = getProviderType();
  const webSearchEnabled =
    providerType === "openai" && import.meta.env.VITE_AI_WEB_SEARCH === "true";

  let searchData: object | null = null;
  let dataSource: "web" | "ai_inferred" | undefined = undefined;

  if (webSearchEnabled) {
    onProgress?.("Buscando dados na web...");

    const searchResult = await chat(
      [
        {
          role: "system",
          content:
            "Você é um especialista em dados de veículos e emissões. Responda apenas com JSON válido.",
        },
        {
          role: "user",
          content: `Busque dados técnicos do veículo: ${vehicle}`,
        },
      ],
      {
        temperature: 0.1,
        model: "gpt-4o-search-preview",
        enableWebSearch: true,
      },
    );

    if (searchResult) {
      try {
        const jsonMatch = searchResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          searchData = JSON.parse(jsonMatch[0]);
          dataSource = "web";
          onProgress?.("Dados da web encontrados");
        }
      } catch {
        onProgress?.("Dados da web não puderam ser processados");
      }
    }
  }

  onProgress?.(`Gerando parâmetros do veículo (${providerType})...`);

  const systemMessage: ChatMessage = {
    role: "system",
    content: searchData
      ? `${SYSTEM_PROMPT}\n\nDADOS ENCONTRADOS NA WEB (use estes valores preferencialmente):\n${JSON.stringify(searchData, null, 2)}`
      : SYSTEM_PROMPT,
  };
  const userMessage: ChatMessage = {
    role: "user",
    content: USER_PROMPT(vehicle),
  };

  let result = await chat([systemMessage, userMessage], {
    temperature: 0.1,
    model: getModelForStep(1, providerType),
  });

  if (!result) {
    onProgress?.("Tentando novamente...");
    result = await chat([systemMessage, userMessage], {
      temperature: 0.1,
      model: getModelForStep(1, providerType),
    });
  }

  if (!result) {
    onProgress?.("Tentando com modelo avançado...");
    result = await chat([systemMessage, userMessage], {
      temperature: 0.1,
      model: getModelForStep(2, providerType),
    });
  }

  if (!result) {
    onProgress?.("Não foi possível encontrar dados");
    return null;
  }

  let parsed = parseJson(result);
  if (!parsed.data) {
    const retry = await chat([systemMessage, userMessage], {
      temperature: 0.1,
      model: getModelForStep(2, providerType),
    });
    if (retry) {
      const retryParsed = parseJson(retry);
      if (retryParsed.data) {
        parsed = retryParsed;
      }
    }
    if (!parsed.data) {
      onProgress?.("Não foi possível encontrar dados");
      return null;
    }
  }

  if (isValid(parsed.data!)) {
    onProgress?.("Dados encontrados");
    return {
      data: withTelemetryDefaults(parsed.data!),
      confidence: parsed.data!.confidence,
      similarUsed: false,
      dataSource,
    };
  }

  onProgress?.("Verificando dados...");
  const verified = await chat(
    [
      { role: "system", content: VERIFY_PROMPT(vehicle, parsed.data!) },
      { role: "user", content: "Retorne o JSON com os dados corrigidos." },
    ],
    { temperature: 0.1, model: getModelForStep(2, providerType) },
  );

  if (verified) {
    const verifiedParsed = parseJson(verified);
    if (verifiedParsed.data) {
      parsed.data = verifiedParsed.data;
    }
  }

  if (isValid(parsed.data!)) {
    onProgress?.("Dados encontrados");
    return {
      data: withTelemetryDefaults(parsed.data!),
      confidence: "medium",
      similarUsed: false,
      dataSource,
    };
  }

  onProgress?.("Calculando parâmetros...");
  const inferred = await chat(
    [
      { role: "system", content: INFER_PROMPT(vehicle, parsed.data!) },
      {
        role: "user",
        content:
          "Calcule f0, f1, f2 e fuelConversionFactor usando sua intuição de engenharia.",
      },
    ],
    {
      temperature: 0.5,
      model: providerType === "openai" ? "gpt-4o" : undefined,
    },
  );

  if (inferred) {
    const inferredParsed = parseJson(inferred);
    if (inferredParsed.data) {
      dataSource = "ai_inferred";
      onProgress?.("Dados encontrados");
      return {
        data: withTelemetryDefaults(inferredParsed.data),
        confidence: inferredParsed.data.confidence,
        similarUsed: false,
        dataSource,
      };
    }
  }

  parsed.data!.confidence = "low";
  dataSource = "ai_inferred";
  onProgress?.("Dados parciais");
  return {
    data: withTelemetryDefaults(parsed.data!),
    confidence: "low",
    similarUsed: false,
    dataSource,
  };
}
