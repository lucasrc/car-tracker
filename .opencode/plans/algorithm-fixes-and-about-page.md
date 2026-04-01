# Plano: Correções de Precisão dos Algoritmos + About Page para Leigos

## Análise Realizada

Todos os algoritmos de cálculo do app foram auditados. Abaixo estão as correções necessárias organizadas por prioridade.

---

## 1. BUG CRÍTICO: Gap de Distância em `calculateTotalDistance`

**Arquivo**: `src/lib/distance.ts:117-134`

**Problema**: Quando um ponto tem `accuracy > 30m`, o loop faz `continue` e **perde silenciosamente** a distância entre o último ponto bom e o próximo ponto bom. Isso subestima distâncias reais.

**Exemplo**: Pontos A(good) → B(bad, skipped) → C(good). A distância B→C é perdida, e A→C nunca é calculada.

**Correção**: Rastrear o último índice válido e calcular distância a partir dele:

```typescript
export function calculateTotalDistance(
  coordinates: { lat: number; lng: number; accuracy?: number }[],
): number {
  if (coordinates.length < 2) return 0;

  let total = 0;
  let lastValidIndex = -1;

  for (let i = 0; i < coordinates.length; i++) {
    const curr = coordinates[i];
    if (curr.accuracy !== undefined && curr.accuracy > 30) continue;

    if (lastValidIndex >= 0) {
      const prev = coordinates[lastValidIndex];
      total += vincentyDistance(prev.lat, prev.lng, curr.lat, curr.lng);
    }

    lastValidIndex = i;
  }

  return total;
}
```

---

## 2. BUG: Threshold de Velocidade Muito Baixo

**Arquivo**: `src/lib/distance.ts:136`

**Problema**: `MAX_SPEED_MS = 80 / 3.6` (80 km/h) é muito baixo para rastreamento veicular. Em rodovias brasileiras, velocidades de 100-130 km/h são normais e legais. Segmentos válidos estão sendo rejeitados.

**Correção**: Aumentar para 180 km/h (50 m/s):

```typescript
const MAX_SPEED_MS = 180 / 3.6; // ~50 m/s (180 km/h)
```

---

## 3. BUG: COPERT Denominador Pode Zerar

**Arquivo**: `src/hooks/useConsumptionModel.ts:103-109`

**Problema**: O denominador `1 + 0.096*v - 0.000421*v²` se aproxima de zero perto de 230 km/h e fica negativo acima disso, produzindo NaN ou resultados negativos.

**Correção**: Adicionar guard e fallback:

```typescript
export function copertFuelConsumption(speedKmh: number): number {
  if (speedKmh <= 0) return 0;
  const v = speedKmh;
  const denominator = 1 + 0.096 * v - 0.000421 * v * v;
  if (denominator <= 0.01) return 0; // Prevent division by zero or negative
  const fcPerKm = (217 + 0.253 * v + 0.00965 * v * v) / denominator;
  return 100 / fcPerKm;
}
```

---

## 4. BUG: `getIdleConsumptionMlPerSecond` sem Guard

**Arquivo**: `src/hooks/useConsumptionModel.ts:95-101`

**Problema**: Se `engineDisplacement <= 0`, `ratio` fica negativo e `Math.pow(ratio, 0.7)` retorna NaN.

**Correção**:

```typescript
export function getIdleConsumptionMlPerSecond(
  engineDisplacement: number,
): number {
  if (engineDisplacement <= 0) return 0;
  const baseMlPerSecond = 0.361;
  const ratio = engineDisplacement / BASELINE_DISPLACEMENT_CC;
  return baseMlPerSecond * Math.pow(ratio, 0.7);
}
```

---

## 5. BUG: `getEstimatedCosts` Pode Gerar Infinity

**Arquivo**: `src/hooks/useTripConsumptionTracker.ts:274-309`

**Problema**: Se `baseKmPerLiter = 0`, `baseFuelUsed = distanceKm / 0 = Infinity`.

**Correção**:

```typescript
const getEstimatedCosts = useCallback(
  (
    distanceKm: number,
    baseKmPerLiter: number,
    fuelPrice: number,
    totalBonusPct: number = 0,
  ) => {
    if (baseKmPerLiter <= 0) {
      return {
        baseFuelUsed: 0,
        extraFuelUsed: 0,
        savedFuel: 0,
        extraCost: 0,
        savedCost: 0,
        totalFuelUsed: 0,
        totalCost: 0,
      };
    }
    // ... resto do código existente
  },
  [getEffectivePenalties],
);
```

---

## 6. BUG: `gaussianEmissionProbability` sem Guard

**Arquivo**: `src/lib/utils.ts:204-210`

**Problema**: Se `sigmaKm = 0`, divisão por zero no exponente.

**Correção**:

```typescript
export function gaussianEmissionProbability(
  distanceKm: number,
  sigmaKm: number = 0.01,
): number {
  if (sigmaKm <= 0) return 0;
  const exponent = -(distanceKm * distanceKm) / (2 * sigmaKm * sigmaKm);
  return Math.exp(exponent);
}
```

---

## 7. BUG: `calculateBoundingBox` sem Guard para Polos

**Arquivo**: `src/lib/radar-api.ts:96-108`

**Problema**: Perto de lat = ±90°, `cos(lat)` → 0, causando `lngDelta` → infinito.

**Correção**:

```typescript
function calculateBoundingBox(
  lat: number,
  lng: number,
  radiusKm: number,
): [number, number, number, number] {
  const earthRadiusKm = 6371;
  const latDelta = (radiusKm / earthRadiusKm) * (180 / Math.PI);
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const lngDelta =
    cosLat > 0.001
      ? (radiusKm / (earthRadiusKm * cosLat)) * (180 / Math.PI)
      : 180; // Near poles, use full longitude range

  return [
    Math.max(-90, lat - latDelta),
    Math.max(-180, lng - lngDelta),
    Math.min(90, lat + latDelta),
    Math.min(180, lng + lngDelta),
  ];
}
```

---

## 8. MELHORIA: Consolidar Haversine

**Arquivos com duplicação**: `distance.ts:94`, `utils.ts:124`, `radar-api.ts:278`

**Ação**: Exportar uma única implementação de `haversineDistanceKm` de `distance.ts` e reexportar nos outros arquivos. Isso elimina risco de inconsistência futura.

---

## 9. About Page: Reescrita para Leigos

**Arquivo**: `src/pages/About.tsx`

**Problema**: A página atual é apenas uma lista de tecnologias sem contexto. Um usuário leigo não entende o que o app faz nem como os cálculos funcionam.

**Nova estrutura proposta**:

```
Sobre o Car Tracker

O que este app faz
  Rastreia suas viagens, calcula distância, velocidade e consumo de combustível
  usando o GPS do seu celular.

Como os cálculos funcionam
  📍 Distância: Usamos a fórmula de Vincenty, que considera que a Terra não é
    uma esfera perfeita, mas sim levemente achatada nos polos. Isso nos dá
    precisão de milímetros.

  ⛽ Consumo de combustível: Combinamos o modelo europeu COPERT (usado por
    fabricantes de carros) com ajustes para seu estilo de direção — acelerações
    bruscas gastam mais, velocidade constante economiza.

  🚗 Velocidade: Calculada a partir das coordenadas GPS, convertida de metros
    por segundo para km/h.

  📡 Radares: Consultamos o OpenStreetMap para encontrar radares próximos e
    usamos matemática de probabilidade para verificar se você está na mesma
    via.

  🛑 Paradas: Detectamos automaticamente quando você para por mais de 5
    segundos e registramos no histórico da viagem.

Tecnologias utilizadas
  React 19, TypeScript, Vite 8, Tailwind CSS 4, etc.
```

---

## Resumo das Mudanças

| #   | Arquivo                                  | Tipo        | Impacto                                 |
| --- | ---------------------------------------- | ----------- | --------------------------------------- |
| 1   | `src/lib/distance.ts`                    | Bug fix     | Distâncias corretas (gap eliminado)     |
| 2   | `src/lib/distance.ts`                    | Bug fix     | Segmentos de rodovia não rejeitados     |
| 3   | `src/hooks/useConsumptionModel.ts`       | Bug fix     | Consumo válido em altas velocidades     |
| 4   | `src/hooks/useConsumptionModel.ts`       | Bug fix     | Idle consumption não gera NaN           |
| 5   | `src/hooks/useTripConsumptionTracker.ts` | Bug fix     | Estimativas de custo não geram Infinity |
| 6   | `src/lib/utils.ts`                       | Bug fix     | Probabilidade HMM não gera NaN          |
| 7   | `src/lib/radar-api.ts`                   | Bug fix     | Bounding box válida nos polos           |
| 8   | `src/lib/distance.ts` + outros           | Refatoração | Haversine centralizado                  |
| 9   | `src/pages/About.tsx`                    | Melhoria    | Página acessível a leigos               |
