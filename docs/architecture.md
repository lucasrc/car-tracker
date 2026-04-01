# Arquitetura do Car Tracker

## Visão Geral

Aplicativo de rastreamento veicular 100% offline. roda no navegador/celular via PWA/Capacitor. Registra viagens via GPS, calcula consumo de combustível em tempo real, detecta radares no OpenStreetMap e classifica automaticamente o tipo de via (cidade/rodovia).

## Stack

| Camada    | Tecnologia                         |
| --------- | ---------------------------------- |
| Frontend  | React 19 + TypeScript + Vite       |
| Estilo    | Tailwind CSS v4                    |
| Estado    | Zustand (devtools + persist)       |
| Dados     | TanStack Query + Dexie (IndexedDB) |
| Maps      | Leaflet + react-leaflet            |
| Charts    | Recharts                           |
| Routing   | React Router DOM                   |
| Validação | Zod                                |
| Tests     | Vitest + Testing Library           |

## Camadas da Aplicação

```
┌─────────────────────────────────────────────────────────────┐
│                    APRESENTAÇÃO                              │
│  Pages: Home, Tracker, History, Settings, About            │
│  Components: Dashboard, MapTracker, Speedometer, TripCard  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                      CÁLCULO                                 │
│  useConsumptionModel → calculateAdjustedConsumption         │
│  useDriveMode → determineMode                               │
│  lib/distance → vincentyDistance, calculateTotalDistance    │
│  lib/utils → pointToPolylineDistanceKm, gaussianEmission   │
│  lib/radar-api → fetchRadarsInArea, isSpeeding             │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                      ESTADO                                  │
│  useTripStore → trip atual (path, stats, consumo)          │
│  useAppStore → configurações (consumo, combustível)        │
│  useRadarStore → radares próximos, speeding events          │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   COLETA DE DADOS                            │
│  useGeolocation → navigator.geolocation.watchPosition      │
│  useSimulation → modo demo para testes                      │
│  useOBD2 → Bluetooth LE para OBD2 (futuro)                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    PERSISTÊNCIA                              │
│  Dexie (IndexedDB) → trips, settings, refuels, radar cache│
└─────────────────────────────────────────────────────────────┘
```

## Fluxos Principais

### 1. GPS → Distância na Tela

```
navigator.geolocation.watchPosition()
         ↓
useGeolocation (normaliza, filtra accuracy > 30m)
         ↓
useTripStore.addPosition(Coordinates)
         ↓
calculateTotalDistance(path[])  [Vincenty]
         ↓
Trip.distanceMeters atualizado
         ↓
Dashboard → formatDistance() → UI
```

### 2. GPS → Consumo em Tempo Real

```
GPS (speed em m/s)
         ↓
useConsumptionModel.addReading(speedMs, timestamp)
         ↓
Janela deslizante de 30s
         ↓
getMetrics() → avgSpeed, maxSpeed, variance, acceleration
         ↓
calculateAdjustedConsumption()
   ├── COPERT (60%) → consumo por velocidade
   └── Modelo custom (40%) → penalidades/bônus por comportamento
         ↓
adjustedKmPerLiter → Dashboard
```

### 3. Modo de Condução (Cidade/Rodovia)

```
useDriveMode (janela de 60s)
         ↓
determineMode():
   - avgSpeed >= 60 km/h → highway
   - avgSpeed < 40 km/h → city
   - 40-60 km/h → stopsPerKm heuristic
         ↓
useTripStore.setDriveMode() → Trip.driveMode
         ↓
Consumo base muda (city vs highway km/l)
```

### 4. Radares

```
GPS position atual
         ↓
fetchRadarsInArea(lat, lng, radius=5km)
   ├── Overpass API → OpenStreetMap
   └── Cache em Dexie (7 dias)
         ↓
findNearestRadar(position, radars, maxDistance=0.5km)
         ↓
isRadarApplicable(heading, radar.direction)
         ↓
isSpeeding(currentSpeed, radar.maxSpeed)
         ↓
Alerta UI + SpeedingEvent registrado
```

## Estrutura de Arquivos

```
src/
├── api/                   # Chamadas externas (Overpass)
├── assets/                # Imagens, ícones
├── components/
│   ├── layout/            # Header, BottomNav, Layout
│   ├── ui/                # Button, Input, ConfirmDialog, Tabs
│   ├── tracker/           # Dashboard, MapTracker, Speedometer, TripInfo
│   └── history/           # FuelCharts, SpeedAnalysis, UsagePatterns
├── hooks/                 # useGeolocation, useConsumptionModel, useDriveMode
├── lib/                   # db, utils, distance, radar-api
├── pages/                 # Home, Tracker, History, Settings, About
├── schemas/               # Zod schemas
├── stores/                # Zustand stores (trip, app, radar)
├── types/                 # TypeScript interfaces
└── App.tsx                # Rotas e providers
```

## Banco de Dados (Dexie/IndexedDB)

### Tabelas

| Tabela        | Conteúdo                                             |
| ------------- | ---------------------------------------------------- |
| `trips`       | Viagens gravadas (path, distância, consumo, paradas) |
| `settings`    | Configurações do usuário (consumo, combustível)      |
| `refuels`     | Abastecimentos registrados                           |
| `radar_cache` | Radares do OSM em cache                              |

### Operações Principais

```typescript
// Viagens
saveTrip(trip) / getAllTrips() / getTripById(id) / deleteTrip(id);

// Configurações
getSettings() / saveSettings(settings);

// Abastecimentos
addRefuel(refuel) / getRefuels() / deleteRefuel(id);

// Radares (cache)
saveToCache(key, radars) / getFromCache(key);
```

## Configurações do Usuário

```typescript
interface Settings {
  fuelType: "gasolina" | "etanol" | "flex";
  engineDisplacement: number; // cc (ex: 1600)
  fuelCapacity: number; // litros (ex: 50)
  fuelPrice: number; // R$/litro
  manualCityKmPerLiter: number;
  manualHighwayKmPerLiter: number;
  maxSpeedTolerance: number; // km/h para radar
}
```

## Testes

- **Vitest** — runner de testes
- **@testing-library/react** — testes de componente
- **Estrutura**: `*.test.tsx` ao lado do componente

Executar:

```bash
bun run test        # watch mode
bun run test:run   # uma vez
```
