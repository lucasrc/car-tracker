# Fluxo de Dados

Como um dado entra no app e vira informação na tela.

---

## 1. Coordenada GPS → Distância na Tela

### Entrada

```typescript
// navigator.geolocation.watchPosition callback
{ latitude: -23.5505, longitude: -46.6331, accuracy: 10, speed: 16.6 }
```

### Pipeline

```
1. useGeolocation hook
   ├── Normaliza para { lat, lng, timestamp, accuracy, speed }
   ├── Filtra: ignora se accuracy > 30m
   └── Emite para listeners

2. useTripStore.addPosition(coords)
   ├── Adiciona ao path[] do trip
   └── Dispara recalculo de distância

3. calculateTotalDistance(path[])
   ├── Para cada par de coordenadas consecutivas:
   │   └── vincentyDistance(lat1, lng1, lat2, lng2)
   ├── Soma todos os trechos
   └── Retorna distância em metros

4. Trip.distanceMeters atualizado no store
   └── Salvo em memória (não persiste ainda)
```

### Saída

```typescript
// Na UI (Dashboard)
"12.5 km"; // formatDistance(12500)
```

---

## 2. GPS → Consumo em Tempo Real

### Entrada

```typescript
// speed do GPS ou calculado por delta posição
{ speed: 15.2, timestamp: 1700000000000 }  // m/s
```

### Pipeline

```
1. useConsumptionModel.addReading(speedMs, timestamp)
   ├── Calcula aceleração: (speed - lastSpeed) / deltaTime
   ├── Adiciona leitura à janela de 30s
   └── Remove leituras antigas (> 30s)

2. getMetrics(currentTime?)
   ├── avgSpeedKmh: média das velocidades na janela
   ├── maxSpeedKmh: velocidade máxima na janela
   ├── speedVariance: variância das velocidades
   ├── avgAcceleration: média das acelerações
   └── idlePercentage: % do tempo com speed < 1 m/s

3. calculateAdjustedConsumption(baseConsumption, currentSpeedKmh, ...)
   └── COPERT Puro (100%):
       fcPerKm = (217 + 0.253v + 0.00965v²) / (1 + 0.096v - 0.000421v²)
       km/l = (1000 × densidade) / fcPerKm
       └── Ajustes técnicos:
           ├── displacementFactor: (cc / 1600) ^ -0.15
           └── fuelEnergyFactor: gasolina=0.91, etanol=0.7, flex=0.85

 4. Resultado: adjustedKmPerLiter (sem penalidades/bônus arbitrários)
```

### Saída

```typescript
// Na UI (Dashboard/TripInfo)
"12.5 km/l"; // adjustedKmPerLiter
```

---

## 3. Posição GPS → Autonomia

### Entrada

```typescript
// Quantidade de combustível no tanque (do settings ou última medição)
fuelRemaining: 25; // litros
```

### Pipeline

```
1. useDriveMode hook determina modo atual
   ├── Se avgSpeed >= 60 km/h → "highway"
   ├── Se avgSpeed < 40 km/h → "city"
   └── Se 40-60 km/h → usa stopsPerKm heuristic

2. Escolhe consumo base conforme modo
   ├── city → settings.manualCityKmPerLiter
   └── highway → settings.manualHighwayKmPerLiter

3. Ajusta consumo base com modelo (similar ao item 2)
   └── adjustedKmPerLiter

4. Calcula autonomia
   rawRange = fuelRemaining * adjustedKmPerLiter
   warmUpFactor = min(elapsedMs / 90000, 1)²
   estimatedRange = lerp(conservativeRange, rawRange, warmUpFactor)
```

### Saída

```typescript
// Na UI (Dashboard)
"312 km"; // autonomia restante
```

---

## 4. GPS → Alerta de Radar

### Entrada

```typescript
// Posição atual do veículo
{ lat: -23.5505, lng: -46.6331, speed: 80 }
```

### Pipeline

```
1. fetchRadarsInArea(lat, lng, radius=5km)
   ├── Verifica cache em Dexie (validade 7 dias)
   ├── Se não tem → Overpass API query
   └── Salva resultado em cache

2. findNearestRadar(position, radars, maxDistance=0.5km)
   └── Retorna radar mais próximo ou null

3. Se radar encontrado:
   ├── isRadarApplicable(vehicleHeading, radar.direction, tolerance=60)
   │   └── Verifica se direção do veículo é compatível
   └── isSpeeding(currentSpeed, radar.maxSpeed, tolerance=5)
       └── Verifica se está acima do limite (+ folga de 5 km/h)

4. Se speeding:
   ├── Registra SpeedingEvent no trip
   ├── Dispara alerta visual/ui
   └── Opcional: notificação push
```

### Saída

```typescript
// Na UI (MapTracker)
"⚠️ Radar a 300m - limite: 60 km/h - sua velocidade: 85 km/h";
```

---

## 5. Viagem Concluída → Persistência

### Entrada

```typescript
// Trip completa em memória
{
  path: [...],
  distanceMeters: 45000,
  maxSpeed: 120,
  avgSpeed: 65,
  fuelUsed: 3.8,
  consumptionBreakdown: {...},
  stops: [...]
}
```

### Pipeline

```
1. useTripStore.stopTrip(fuelPrice, fuelUsed, breakdown, actualCost?)
   ├── Verifica mínimos: distance > 30m, duration > 30s
   ├── Se não passa → limpa trip, não salva
   └── Se passa → continua

2. Calcula campos finais
   ├── avgSpeed = distanceKm / durationHours
   ├── totalCost = fuelUsed * fuelPrice (estimado)
   ├── actualCost = custo calculado via FIFO
   └── endTime = new Date().toISOString()

3. saveTrip(completedTrip)
   └── Dexie.table('trips').put(completedTrip)

4. clearCurrentTrip()
   └── Limpa trip atual da memória
```

### Resultado

```typescript
// Salvo em IndexedDB
// Disponível em History page para consulta
```

---

## Abastecimento (Refuel Flow)

### Pipeline

```
1. RefuelModal.onConfirm(liters, price, fuelType)
   ├── Valida inputs (liters > 0, price > 0)
   └── Chama handleRefuel no Settings page

2. Settings.handleRefuel(liters, price, fuelType)
   ├── refuel(liters): atualiza currentFuel no Settings
   ├── addRefuel(liters, price, fuelType): cria registro no banco
   │   └── Dexie.table('refuels').put(refuel)
   │       └── Inclui: id, timestamp, amount, fuelPrice, fuelType, totalCost

3. useFuelInventory.addBatch(liters, price, fuelType)
   ├── Adiciona lote ao inventario local (FIFO)
   └──保持 persistencia em memoria
```

### Resultado

```typescript
// Registro salvo em IndexedDB
interface Refuel {
  id: string; // UUID
  timestamp: string; // ISO date
  amount: number; // litros
  fuelPrice: number; // R$/litro
  fuelType: FuelType; // gasolina | etanol | flex
  totalCost: number; // amount * fuelPrice
}
```

### FIFO Consumption

```
1. useFuelInventory.consumeFuel(liters, fuelType?)
   ├── Ordena lotes por timestamp (mais antigo primeiro)
   ├── Para cada lote:
   │   ├── available = lote.amount - lote.consumedAmount
   │   ├── toConsume = min(available, remaining)
   │   ├── cost += toConsume * lote.fuelPrice
   │   ├── lote.consumedAmount += toConsume
   │   └── remaining -= toConsume
   └── Retorna: { cost, batches: [{ amount, price, fuelType }] }
```

---

## Custo de Viagem: Estimado vs Real

### Estimado (totalCost)

- Calculado em **tempo real** durante a viagem
- Usa **preco medio ponderado** de todos os lotes
- Formula: `fuelUsed * weightedAveragePrice`

### Real (actualCost)

- Calculado ao **finalizar** a viagem
- Usa **FIFO** (consome do lote mais antigo)
- Formula: soma de `(amount * price)` de cada lote consumido
- Armazenado em `trip.actualCost`

### Comparacao

| Campo             | Quando           | Metodo                |
| ----------------- | ---------------- | --------------------- |
| `trip.totalCost`  | Tempo real       | Preco medio ponderado |
| `trip.actualCost` | Fim da viagem    | FIFO (custo real)     |
| `trip.fuelPrice`  | Inicio da viagem | Preco doSettings      |

O sistema exibe ambos os valores para que o usuario possa comparar e validar o consumo.
