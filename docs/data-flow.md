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
   ├── COPERT (60%):
   │   fcPerKm = (217 + 0.253v + 0.00965v²) / (1 + 0.096v - 0.000421v²)
   │   copertKmPerLiter = 100 / fcPerKm
   │
   ├── Modelo custom (40%):
   │   ├── speedFactor: 1.0 + (speed - 90) * 0.009  [se speed > 90]
   │   ├── aggressionFactor: 1.06 (moderna) ou 1.10 (agressiva)
   │   ├── idleFactor: 1 + (idlePct / 100) * 0.08
   │   └── stabilityFactor: 1 + (variance / 100) * 0.05
   │
   ├── Bônus (até 10% total):
   │   ├── speedBonus: até 5% para 60-80 km/h
   │   ├── accelerationBonus: 4% para aceleração < 0.5 m/s²
   │   ├── coastingBonus: 3% para desaceleração natural
   │   ├── stabilityBonus: 3% para variance < 15
   │   └── idleBonus: 3% se idlePct === 0
   │
   └── Resultado: adjustedKmPerLiter

4. Aplica fatores do motor e combustível:
   ├── displacementFactor: (cc / 1600) ^ -0.15
   └── fuelEnergyFactor: gasolina=1.0, etanol=0.7, flex=0.85
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
1. useTripStore.stopTrip(fuelPrice, fuelUsed, breakdown)
   ├── Verifica mínimos: distance > 30m, duration > 30s
   ├── Se não passa → limpa trip, não salva
   └── Se passa → continua

2. Calcula campos finais
   ├── avgSpeed = distanceKm / durationHours
   ├── totalCost = fuelUsed * fuelPrice
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
