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

## 2. GPS → Consumo em Tempo Real + Previsão de Marcha

### Entrada

```typescript
// speed do GPS ou calculado por delta posição
{ speed: 15.2, timestamp: 1700000000000 }  // m/s

// Novos campos opcionais (Abril 2026)
{
  altitudeM?: number,    // altitude em metros (padrão: 0)
  temperatureC?: number  // temperatura em °C (padrão: 25)
}
```

### Pipeline (Modelos Revisados)

```
1. useTelemetryEngine.addPosition(position)
   ├── Calcula aceleração: (speed - lastSpeed) / deltaTime
   ├── Determina modo: city (< 40 km/h), highway (>= 60 km/h), mixed
   └── Chama TelemetryEngine.simulate()

2. TelemetryEngine.simulate(vehicle, input)
    ├── Calcula densidade do ar: ρ = calculateAirDensity(altitudeM, temperatureC)
    │   └── Importante para cidades em altitude (Brasília, Bogotá)
    ├── Verifica se vehicle.transmission existe
    │
    ├── SE transmission disponível:
    │   ├── selectOptimalGear(vehicle, speed, accel, slope, currentGear?)
    │   │   ├── FASE 1: filterViableGears() → filtra marchas com RPM viável
    │   │   │   ├── Calcula RPM para cada marcha: calculateRpm(speed, gear, transmission)
    │   │   │   ├── Abaixo de clutchEngagementSpeed: só marcha 1 com modelo clutch-slip
    │   │   │   └── Descarta marchas com RPM < MIN_OPERATING_RPM ou > redline × 0.95
    │   │   │
    │   │   ├── FASE 2: scoreViableGear() → scoring multi-critério Gaussiano
    │   │   │   ├── fuelScore = gaussianScore(BSFC, bsfcOptimal, σ_fuel)
    │   │   │   ├── driveScore = asymmetricScore(RPM, rpmTarget, σ_low, σ_high)
    │   │   │   ├── powerScore = gaussianScore(load, 0.65, σ_load)
    │   │   │   ├── safetyScore = hardCutoff(RPM > redline × 0.95)
    │   │   │   ├── Pesos adaptativos via sigmoid(slope, accel)
    │   │   │   └── Seleciona marcha com maior score total
    │   │   │
    │   │   └── FASE 3: Histerese com margens assimétricas
    │   │       ├── Upshift requer +15% de score vs marcha atual
    │   │       ├── Downshift requer currentScore < bestScore - 10%
    │   │       ├── Dwell mínimo de 1500ms entre trocas
    │   │       └── Kickdown bypass para accel > 2.5 m/s²
    │   │
   │   ├── SE torqueCurve + bsfcMinGPerKwh disponíveis:
   │   │   ├── getTorqueAtRpm(rpm, torqueCurve) → interpolação linear
   │   │   ├── getEngineEfficiency(loadPercent) → eficiência por carga (0.16-0.32)
   │   │   ├── getTransmissionEfficiency(type) → por tipo (0.86-0.93)
   │   │   ├── getLoadFactor(loadPercent) → BSFC penalidade em cargas baixas
   │   │   ├── calculatePhysicsConsumption()
   │   │   └── kmpl = physicsKmpl (modelo físico puro)
   │   │   └── confidence = 0.95
   │   │
   │   └── SENÃO (sem torqueCurve ou bsfc):
   │       ├── estimateEngineLoadNoTransmission() → RPM estimado + carga
   │       └── kmpl = fallback físico
   │       └── confidence = 0.9
   │
   └── SENÃO (sem transmission):
       └── Similar ao bloco acima com fallback
   │
   ├──getCalibratedBase(): pondera INMETRO vs user averages(com pesos)
   │   base = inmetro * weightInmetro + userAvg * weightUser
   │   └── Suporta gasolina, etanol, GNV
   │
   ├── Aplica fatores de correção:
   │   ├── Crr dependente de velocidade: Crr_at_speed = Crr × (1 + 0.00006 × v²)
   │   ├── Densidade do ar variável por altitude
   │   ├── massPenalty: 1.0 + (extraMass / vehicleMass) * 0.4
   │   ├── speedFactor: calibrado linear em torno do ponto de teste
   │   ├── acFactor: 0.88 (motores <= 80kW) ou 0.92
   │   ├── hybridImprovement: 1.4 (cidade) ou 1.1 (rodovia)
   │   └── parasiticPower: 0.4 kW (alternador, auxiliares)
   │
   ├── Fuel cut: shouldFuelCut(slope, accel, speed, rpm, techEra)
   │   ├── slope <= -3%
   │   ├── slope <= -1.5 && accel < -0.3 && speed > 20
   │   └── accel < -0.5 && speed > 50
   ├── GNV: multiplica por gnvEfficiencyFactor (padrão 1.22)
   └── Mínimo: 3.0 km/l

3. Acumula consumo ponderado por tempo
   └── averageConsumption = Σ(kmpl * durationMs) / Σ(durationMs)

4. Acumula dados de marcha/RPM (se disponível)
   ├── gearDistribution: contagem de tempo por marcha
   ├── rpmReadings: últimas 300 leituras de RPM
   └── Atualiza estado: currentGear, currentRpm, confidence

5. Resultado: kmpl ajustado + gear + rpm + confidence + estado da bateria (híbridos)
```

### Pipeline

```
1. useTelemetryEngine.addPosition(position)
   ├── Calcula aceleração: (speed - lastSpeed) / deltaTime
   ├── Determina modo: city (< 40 km/h), highway (>= 60 km/h), mixed
   └── Chama TelemetryEngine.simulate()

2. TelemetryEngine.simulate(vehicle, input)
   ├── Verifica se vehicle.transmission existe
   │
   ├── SE transmission disponível:
   │   ├── predictGear(speed, transmission)
   │   │   ├── Para cada marcha: calcula RPM = (speed / 3.6) / (2π × tireRadius) × gearRatio × finalDrive × 60
   │   │   ├── Encontra marcha onde idleRpm <= RPM <= redlineRpm
   │   │   └── Retorna { gear, rpm }
   │   │
   │   ├── SE torqueCurve + bsfcMinGPerKwh disponíveis:
   │   │   ├── getTorqueAtRpm(rpm, torqueCurve) → interpolação linear
   │   │   ├── calculatePhysicsConsumption(rpm, torque, bsfc, techEra, fuelType, speed)
   │   │   │   ├── powerKw = (torque × rpm × 2π) / 60000
   │   │   │   ├── bsfc = bsfcMin × (1 + |rpm - 2500| / 5000)
   │   │   │   ├── fuelFlowLPerH = (bsfc × powerKw) / fuelDensity / 1000
   │   │   │   └── physicsKmpl = speed / fuelFlowLPerH
   │   │   └── kmpl = physicsKmpl × 0.7 + copertKmpl × 0.3 (modelo híbrido)
   │   │   └── confidence = 0.95
   │   │
   │   └── SENÃO (sem torqueCurve ou bsfc):
   │       └── kmpl = copertKmpl (fallback COPERT puro)
   │       └── confidence = 0.9
   │
   └── SENÃO (sem transmission):
       └── kmpl = copertKmpl (modelo COPERT tradicional)
       └── confidence = 0.85
   │
   ├── getCalibratedBase(): pondera INMETRO vs user averages com pesos
   │   base = inmetro * weightInmetro + userAvg * weightUser
   │   └── Suporta gasolina, etanol, GNV
   │
   ├── Aplica fatores de correção (COPERT):
   │   ├── massPenalty: 1.0 + (extraMass / vehicleMass) * 0.4
   │   │   └── extraMass = (passengers-1)*75 + cargo + gnvCylinderWeight
   │   ├── speedFactor: calibrado linear em torno do ponto de teste
   │   ├── dynamicFactor: 1.0 - slope*0.025 - accel*0.415
   │   ├── acFactor: 0.88 (motores <= 80kW) ou 0.92
   │   └── hybridImprovement: 1.6 (cidade) ou 1.1 (rodovia)
   │
   ├── Fuel cut: slope < -3% → consumo zero (freio motor)
   ├── GNV: multiplica por gnvEfficiencyFactor (padrão 1.32)
   └── Mínimo: 3.0 km/l

3. Acumula consumo ponderado por tempo
   └── averageConsumption = Σ(kmpl * durationMs) / Σ(durationMs)

4. Acumula dados de marcha/RPM (se disponível)
   ├── gearDistribution: contagem de tempo por marcha
   ├── rpmReadings: últimas 300 leituras de RPM
   └── Atualiza estado: currentGear, currentRpm, confidence

5. Resultado: kmpl ajustado + gear + rpm + confidence + estado da bateria (híbridos)
```

### Saída

```typescript
// Na UI (Dashboard)
"12.5 km/l"; // estimatedConsumption

// Na UI (Speedometer - se transmission disponível)
"3ª marcha"; // currentGear
"2800 RPM"; // currentRpm
"95% confiança"; // confidence
```

---

## 3. Posição GPS → Autonomia

### Entrada

```typescript
// Quantidade de combustível no tanque (do vehicle)
fuelRemaining: 25; // litros
```

### Pipeline

```
1. useTelemetryEngine hook determina modo atual
   ├── Se avgSpeed >= 60 km/h → "highway"
   ├── Se avgSpeed < 40 km/h → "city"
   └── Se 40-60 km/h → usa distância/heurística

2. Consumo atual calculado pelo TelemetryEngine
   └── adjustedKmPerLiter (com todos os fatores aplicados)

3. Calcula autonomia
   rawRange = fuelRemaining * currentConsumption
   warmUpFactor = min(elapsedMs / 90000, 1)²
   estimatedRange = lerp(conservativeRange, rawRange, warmUpFactor)
```

### Saída

```typescript
// Na UI (DrivingPanel)
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
  totalFuelUsed: 3.8,
  telemetryData: {
    fuelType: "gasolina",
    batterySocStart: 100,
    batterySocEnd: 65,
    hybridDistancePct: 40,
    avgSlope: 1.2,
    maxSlope: 8.5,
    acUsagePct: 75,
    massPenaltyAvg: 1.15,
    avgAcceleration: 0.8,
    maxAcceleration: 3.2,
    speedDistribution: { city: 30, mixed: 25, highway: 45 },
    // Dados de marcha (se transmission disponível)
    gearDistribution: { 1: 15, 2: 20, 3: 25, 4: 20, 5: 20 },
    avgRpm: 2500,
    maxRpm: 4500,
    hasTransmissionData: true
  }
}
```

### Pipeline

```
1. useTripStore.stopTrip(totalFuelUsed, actualCost, breakdown?, avgConsumption?, telemetryData?)
   ├── Verifica mínimos: distance > 30m, duration > 30s
   ├── Se não passa → limpa trip, não salva
   └── Se passa → continua

2. Calcula campos finais
   ├── avgSpeed = distanceKm / durationHours
   ├── consumption = avgConsumption ou trip.consumption
   ├── fuelUsed = max(totalFuelUsed, 0)
   ├── telemetryData = snapshot do useTelemetryEngine.getTelemetryData()
   └── endTime = new Date().toISOString()

3. saveTrip(completedTrip)
   └── Dexie.table('trips').put(completedTrip)
      └── Inclui telemetryData com:
          ├── fuelType, battery SOC (start/end)
          ├── hybridDistancePct (para híbridos)
          ├── avg/max slope, acUsagePct
          ├── massPenaltyAvg, acceleration stats
          ├── speedDistribution (city/mixed/highway %)
          └── Se transmission disponível:
              ├── gearDistribution (tempo por marcha)
              ├── avgRpm, maxRpm
              └── hasTransmissionData (flag)

4. clearCurrentTrip()
   └── Limpa trip atual da memória
```

### Resultado

```typescript
// Salvo em IndexedDB
// Disponível em History page para consulta
// telemetryData permite análise detalhada pós-viagem
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
