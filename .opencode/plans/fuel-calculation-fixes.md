# Plano de Correção - Cálculo de Combustível

## 1.1 Fix `useFuelInventory`: trocar `batchesRef` por `useRef`

**Arquivo:** `src/hooks/useFuelInventory.ts`

**Mudança:** Linha 1 e Linha 57

```diff
- import { useCallback } from "react";
+ import { useCallback, useRef } from "react";
```

```diff
- const batchesRef: { current: FuelBatch[] } = { current: [] };
+ const batchesRef = useRef<FuelBatch[]>([]);
```

**Por quê:** `useRef` mantém a referência estável entre re-renders. O objeto literal `{ current: [] }` cria uma nova referência a cada render, perdendo todo o estado de `consumedAmount`.

---

## 1.2 Persistir `consumedAmount` no banco de dados

### 1.2.1 `src/types/index.ts` - Adicionar campo ao `Refuel`

```diff
 export interface Refuel {
   id: string;
   timestamp: string;
   amount: number;
   fuelPrice: number;
   fuelType: FuelType;
   totalCost: number;
+  consumedAmount: number;
 }
```

### 1.2.2 `src/lib/db.ts` - Atualizar `addRefuel` e criar `updateRefuelConsumed`

```diff
 export async function addRefuel(
   amount: number,
   fuelPrice: number,
   fuelType: FuelType = "gasolina",
 ): Promise<Refuel> {
   const refuel: Refuel = {
     id: generateId(),
     timestamp: new Date().toISOString(),
     amount,
     fuelPrice,
     fuelType,
     totalCost: amount * fuelPrice,
+    consumedAmount: 0,
   };
   await db.refuels.put(refuel);
   return refuel;
 }
```

**Nova função:**

```ts
export async function updateRefuelConsumed(
  id: string,
  consumedAmount: number,
): Promise<void> {
  await db.refuels.update(id, { consumedAmount });
}
```

### 1.2.3 `src/lib/db.ts` - Migration Dexie versão 8

```ts
db.version(8)
  .stores({
    trips: "id, startTime, endTime, status",
    currentTrip: "id",
    settings: "id",
    refuels: "id, timestamp",
  })
  .upgrade((tx) => {
    return tx
      .table("refuels")
      .toCollection()
      .modify((r) => {
        if (typeof r.consumedAmount === "undefined") {
          r.consumedAmount = 0;
        }
      });
  });
```

### 1.2.4 `src/hooks/useFuelInventory.ts` - Ler e persistir `consumedAmount`

**Em `loadInventory`:**

```diff
   const loadInventory = useCallback(async (): Promise<FuelBatch[]> => {
     const refuels = await getRefuels();
     const batches: FuelBatch[] = refuels.map((r) => ({
       id: r.id,
       timestamp: r.timestamp,
       amount: r.amount,
       fuelPrice: r.fuelPrice,
       fuelType: r.fuelType,
       totalCost: r.totalCost,
-      consumedAmount: 0,
+      consumedAmount: r.consumedAmount ?? 0,
     }));
     batchesRef.current = batches;
     return batches;
   }, []);
```

**Em `consumeFuel`:** adicionar import e persistir após consumir

```diff
 import {
   getRefuels,
   addRefuel as dbAddRefuel,
   deleteRefuel as dbDeleteRefuel,
+  updateRefuelConsumed as dbUpdateRefuelConsumed,
 } from "@/lib/db";
```

Após o loop de consumo, persistir:

```diff
       for (const batch of availableBatches) {
         if (remaining <= 0) break;

         const available = getRemainingAmount(batch);
         const toConsume = Math.min(available, remaining);
         const batchCost = toConsume * batch.fuelPrice;

         totalCost += batchCost;
         batch.consumedAmount += toConsume;
         remaining -= toConsume;

+        await dbUpdateRefuelConsumed(batch.id, batch.consumedAmount);
+
         consumedBatches.push({
           amount: toConsume,
           price: batch.fuelPrice,
           fuelType: batch.fuelType,
         });
       }
```

---

## 1.3 Unificar fontes de verdade de combustível no Tracker

**Arquivo:** `src/pages/Tracker.tsx`

### Remover `consumeFuel` do loop de GPS (linhas 460-473)

```diff
         const distanceKm = distance / 1000;
         const fuelUsed = distanceKm / estimatedConsumption;

         if (fuelUsed > 0 && status === "recording") {
           const newTotalFuel = storeTotalFuelUsed + fuelUsed;
           setTotalFuelUsed(newTotalFuel);
-
-          consumeFuel(fuelUsed).then((updated) => {
-            setSettings((prev) => ({
-              ...prev,
-              fuelCapacity: updated.fuelCapacity,
-              currentFuel: updated.currentFuel,
-            }));
-          });
         }
```

### Remover import desnecessário

```diff
- import { getSettings, consumeFuel } from "@/lib/db";
+ import { getSettings } from "@/lib/db";
```

### Atualizar `handleConfirmStop` para sincronizar `currentFuel` ao final

```diff
     // Calculate FIFO actual cost
     await fuelInventory.loadInventory();
     const { cost: actualCost } = await fuelInventory.consumeFuel(
       storeTotalFuelUsed,
       settings.fuelType,
     );

+    // Sync currentFuel in settings after trip
+    const newCurrentFuel = Math.max(
+      0,
+      settings.currentFuel - storeTotalFuelUsed,
+    );
+    setSettings((prev) => ({
+      ...prev,
+      currentFuel: newCurrentFuel,
+    }));
+
     const tripId = await stopTrip(storeTotalFuelUsed, actualCost, breakdown);
```

---

## 1.4 Corrigir `idleTimeRef` com janela deslizante

**Arquivo:** `src/hooks/useConsumptionModel.ts`

### Substituir refs acumulativos por readings com estado de idle

```diff
 export function useConsumptionModel() {
   const readingsRef = useRef<Array<{ speed: number; timestamp: number }>>([]);
-  const idleTimeRef = useRef<number>(0);
-  const totalTimeRef = useRef<number>(0);

   const addReading = useCallback((speedMs: number, timestamp: number) => {
     const now = timestamp;

     readingsRef.current.push({ speed: speedMs, timestamp: now });

     const windowStart = now - 30000;
     readingsRef.current = readingsRef.current.filter(
       (r) => r.timestamp > windowStart,
     );

-    if (speedMs < 1) {
-      idleTimeRef.current += 1000;
-    }
-    totalTimeRef.current += 1000;
   }, []);
```

### Calcular idlePercentage a partir dos readings na janela

```diff
   const getMetrics = useCallback((currentTime?: number) => {
     const now = currentTime ?? Date.now();
     const windowStart = now - 30000;

     const recentReadings = readingsRef.current.filter(
       (r) => r.timestamp > windowStart,
     );

     if (recentReadings.length === 0) {
       return {
         avgSpeedKmh: 0,
         maxSpeedKmh: 0,
         speedVariance: 0,
         idlePercentage: 0,
       };
     }

     const speeds = recentReadings.map((r) => r.speed * 3.6);
     const avgSpeedKmh = speeds.reduce((a, b) => a + b, 0) / speeds.length;
     const maxSpeedKmh = Math.max(...speeds);

     const speedVariance =
       speeds.reduce((sum, s) => sum + Math.pow(s - avgSpeedKmh, 2), 0) /
       speeds.length;

-    const totalTimeWindow = 30000;
-    const idlePercentage =
-      totalTimeWindow > 0 ? (idleTimeRef.current / totalTimeWindow) * 100 : 0;
+    const idleReadings = recentReadings.filter((r) => r.speed < 1).length;
+    const idlePercentage =
+      recentReadings.length > 0
+        ? (idleReadings / recentReadings.length) * 100
+        : 0;

     return {
       avgSpeedKmh,
       maxSpeedKmh,
       speedVariance,
-      idlePercentage: Math.min(100, idlePercentage),
+      idlePercentage,
     };
   }, []);
```

### Atualizar `reset`

```diff
   const reset = useCallback(() => {
     readingsRef.current = [];
-    idleTimeRef.current = 0;
-    totalTimeRef.current = 0;
   }, []);
```

---

## 2.1 `addReading` com delta de tempo real

**Arquivo:** `src/hooks/useConsumptionModel.ts`

### Adicionar `lastTimestampRef`

```diff
 export function useConsumptionModel() {
   const readingsRef = useRef<Array<{ speed: number; timestamp: number }>>([]);
+  const lastTimestampRef = useRef<number>(0);
```

### Usar delta real em vez de 1000ms fixo

```diff
   const addReading = useCallback((speedMs: number, timestamp: number) => {
     const now = timestamp;
+    const delta = lastTimestampRef.current > 0 ? now - lastTimestampRef.current : 0;
+    lastTimestampRef.current = now;

     readingsRef.current.push({ speed: speedMs, timestamp: now });

     const windowStart = now - 30000;
     readingsRef.current = readingsRef.current.filter(
       (r) => r.timestamp > windowStart,
     );
   }, []);
```

---

## 2.2 Proteção contra `estimatedConsumption = 0` no Tracker

**Arquivo:** `src/pages/Tracker.tsx`

```diff
         const distanceKm = distance / 1000;
-        const fuelUsed = distanceKm / estimatedConsumption;
+        if (estimatedConsumption <= 0) {
+          console.warn("Tracker: estimatedConsumption <= 0, skipping fuel calculation");
+          return;
+        }
+        const fuelUsed = distanceKm / estimatedConsumption;

         if (fuelUsed > 0 && status === "recording") {
```

---

## 2.3 Validar entradas negativas no `db.ts`

**Arquivo:** `src/lib/db.ts`

### `refuel` com validação

```diff
 export async function refuel(amount: number): Promise<Settings> {
+  if (amount < 0) {
+    throw new Error("refuel: amount cannot be negative");
+  }
   const settings = await getSettings();
```

### `consumeFuel` com validação

```diff
 export async function consumeFuel(liters: number): Promise<Settings> {
+  if (liters < 0) {
+    throw new Error("consumeFuel: liters cannot be negative");
+  }
   const settings = await getSettings();
   const newFuel = Math.max(settings.currentFuel - liters, 0);
+  const cappedFuel = Math.min(newFuel, settings.fuelCapacity);
   const updated = { ...settings, currentFuel: cappedFuel };
   await saveSettings(updated);
   return updated;
 }
```

---

## 3.1 `getFuelEnergyFactor` com fallback seguro

**Arquivo:** `src/hooks/useConsumptionModel.ts`

```diff
 export function getFuelEnergyFactor(fuelType: FuelType): number {
   const FUEL_ENERGY_FACTORS: Record<FuelType, number> = {
     gasolina: 0.91,
     etanol: 0.7,
     flex: 0.87,
   };
-  return FUEL_ENERGY_FACTORS[fuelType];
+  const factor = FUEL_ENERGY_FACTORS[fuelType];
+  if (factor === undefined) {
+    console.warn(`getFuelEnergyFactor: unknown fuel type "${fuelType}", using default 1.0`);
+    return 1.0;
+  }
+  return factor;
 }
```

---

## 3.2 `addSample` com validação de `durationMs`

**Arquivo:** `src/hooks/useTripConsumptionTracker.ts`

```diff
   const addSample = useCallback(
     (factors: ConsumptionFactors, durationMs: number) => {
+      if (durationMs <= 0) return;
       const acc = accumulatedRef.current;
       acc.totalTimeMs += durationMs;
       acc.totalConsumption += factors.adjustedKmPerLiter * durationMs;
       acc.sampleCount += 1;
     },
     [],
   );
```

---

## 3.3 Campos hardcoded como zero no TripConsumptionTracker

**Arquivo:** `src/hooks/useTripConsumptionTracker.ts`

Os campos `extraFuelUsed`, `savedFuel`, `extraCost`, `savedCost` são retornados como 0 e não são usados em nenhum lugar do código. Recomenda-se removê-los da interface de retorno.

```diff
   const getEstimatedCosts = useCallback(
     (distanceKm: number, avgKmPerLiter: number, fuelPrice: number) => {
       if (avgKmPerLiter <= 0) {
         return {
           baseFuelUsed: 0,
-          extraFuelUsed: 0,
-          savedFuel: 0,
-          extraCost: 0,
-          savedCost: 0,
           totalFuelUsed: 0,
           totalCost: 0,
         };
       }

       const totalFuelUsed = distanceKm / avgKmPerLiter;

       return {
         baseFuelUsed: Math.round(totalFuelUsed * 100) / 100,
-        extraFuelUsed: 0,
-        savedFuel: 0,
-        extraCost: 0,
-        savedCost: 0,
         totalFuelUsed: Math.round(totalFuelUsed * 100) / 100,
         totalCost: Math.round(totalFuelUsed * fuelPrice * 100) / 100,
       };
     },
     [],
   );
```

**Nota:** Verificar se algum componente usa esses campos antes de remover. Se sim, manter mas adicionar comentário `// TODO: implementar cálculo de penalties/bonuses`.

---

## 4.x Testes Faltantes

### 4.1 `src/hooks/useFuelInventory.test.ts`

```ts
describe("consumeFuel persistence", () => {
  it("should persist consumedAmount between consecutive calls", async () => {
    const mockRefuels = [
      {
        id: "batch-1",
        timestamp: "2024-01-01T10:00:00Z",
        amount: 20,
        fuelPrice: 5.0,
        fuelType: "gasolina" as const,
        totalCost: 100,
        consumedAmount: 0,
      },
    ];

    vi.mocked(db.getRefuels).mockResolvedValue(mockRefuels as never);
    vi.mocked(db.updateRefuelConsumed).mockResolvedValue(undefined);

    const { result } = renderHook(() => useFuelInventory());
    await act(async () => await result.current.loadInventory());

    // Primeira chamada
    await act(async () => result.current.consumeFuel(10, "gasolina"));
    expect(db.updateRefuelConsumed).toHaveBeenCalledWith("batch-1", 10);

    // Segunda chamada - consumedAmount deve ser 10, não 0
    await act(async () => result.current.consumeFuel(5, "gasolina"));
    expect(db.updateRefuelConsumed).toHaveBeenCalledWith("batch-1", 15);
  });

  it("should load consumedAmount from DB", async () => {
    const mockRefuels = [
      {
        id: "batch-1",
        timestamp: "2024-01-01T10:00:00Z",
        amount: 20,
        fuelPrice: 5.0,
        fuelType: "gasolina" as const,
        totalCost: 100,
        consumedAmount: 8,
      },
    ];

    vi.mocked(db.getRefuels).mockResolvedValue(mockRefuels as never);

    const { result } = renderHook(() => useFuelInventory());
    const batches = await act(async () => await result.current.loadInventory());

    expect(batches[0].consumedAmount).toBe(8);
    expect(result.current.getTotalLiters()).toBe(12);
  });
});
```

### 4.2 `src/hooks/useConsumptionModel.test.ts`

```ts
describe("idlePercentage with windowed readings", () => {
  it("should calculate idle percentage correctly in long trip", () => {
    const { result } = renderHook(() => useConsumptionModel());
    const now = Date.now();

    // 60 segundos de leituras: 10s idle, 50s movendo
    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.addReading(0, now - 50000 + i * 1000); // idle
      }
      for (let i = 0; i < 50; i++) {
        result.current.addReading(15, now - 50000 + (10 + i) * 1000); // moving
      }
    });

    const metrics = result.current.getMetrics(now);
    // Apenas leituras na janela de 30s contam
    expect(metrics.idlePercentage).toBeLessThan(100);
  });

  it("should handle irregular reading intervals", () => {
    const { result } = renderHook(() => useConsumptionModel());
    const now = Date.now();

    act(() => {
      result.current.addReading(10, now - 2000);
      result.current.addReading(10, now - 500); // 1.5s depois
      result.current.addReading(10, now); // 0.5s depois
    });

    const metrics = result.current.getMetrics(now);
    expect(metrics.avgSpeedKmh).toBeCloseTo(36, 0);
  });
});
```

### 4.3 `src/hooks/useTripConsumptionTracker.test.ts`

```ts
describe("edge cases", () => {
  it("should ignore negative durationMs", () => {
    const { result } = renderHook(() => useTripConsumptionTracker());

    act(() => {
      result.current.addSample(
        createFactors({ adjustedKmPerLiter: 10 }),
        -5000,
      );
    });

    expect(result.current.getAverageConsumption()).toBe(0);
  });

  it("should ignore zero durationMs", () => {
    const { result } = renderHook(() => useTripConsumptionTracker());

    act(() => {
      result.current.addSample(createFactors({ adjustedKmPerLiter: 10 }), 0);
    });

    expect(result.current.getAverageConsumption()).toBe(0);
  });
});
```

### 4.4 `src/lib/db.test.ts` (novo arquivo)

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { refuel, consumeFuel } from "@/lib/db";

vi.mock("dexie", () => {
  // mock setup
});

describe("db refuel/consumeFuel validation", () => {
  describe("refuel", () => {
    it("should throw for negative amount", async () => {
      await expect(refuel(-5)).rejects.toThrow("amount cannot be negative");
    });

    it("should cap at fuelCapacity", async () => {
      // setup: currentFuel=45, capacity=50
      const result = await refuel(20);
      expect(result.currentFuel).toBe(50);
    });
  });

  describe("consumeFuel", () => {
    it("should throw for negative liters", async () => {
      await expect(consumeFuel(-5)).rejects.toThrow(
        "liters cannot be negative",
      );
    });

    it("should cap at fuelCapacity when negative liters", async () => {
      // Se negative for permitido como "devolução", não ultrapassar capacity
      // Se negative for rejeitado, testar que lança erro
    });

    it("should not go below zero", async () => {
      // setup: currentFuel=5
      const result = await consumeFuel(20);
      expect(result.currentFuel).toBe(0);
    });
  });
});
```

---

## Ordem de Execução

```
FASE 1 (Crítico):
  1.1 → useFuelInventory useRef
  1.2 → Persistir consumedAmount (types → db migration → db functions → hook)
  1.3 → Unificar fontes de verdade no Tracker
  1.4 → Janela deslizante para idle

FASE 2 (Alto):
  2.1 → Delta de tempo real em addReading
  2.2 → Proteção estimatedConsumption=0
  2.3 → Validação entradas negativas no db

FASE 3 (Médio):
  3.1 → Fallback getFuelEnergyFactor
  3.2 → Validação durationMs
  3.3 → Remover campos hardcoded zero

FASE 4 (Testes):
  4.1 → useFuelInventory tests
  4.2 → useConsumptionModel tests
  4.3 → useTripConsumptionTracker tests
  4.4 → db tests (novo arquivo)
```
