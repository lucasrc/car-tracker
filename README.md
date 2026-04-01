# Car Tracker

App de rastreamento veicular 100% offline. Registra viagens via GPS, calcula consumo de combustível em tempo real, detecta radares e classifica automaticamente o tipo de via.

## Quick Start

```bash
# Instalar dependências
bun install

# Desenvolvimento
bun run dev

# Build
bun run build

# Testes
bun run test
```

## Para Agentes AI

1. Leia **AGENTS.md** — convenções de código, comandos, estrutura de arquivos
2. Leia **docs/architecture.md** — visão geral de como as peças se conectam
3. Use **docs/glossary.md** — para entender termos de domínio (COPERT, HMM, etc.)
4. Plans em **.opencode/plans/** — contexto específico por task

## Stack

| Camada    | Tecnologia              |
| --------- | ----------------------- |
| Frontend  | React 19 + TypeScript   |
| Build     | Vite 8                  |
| Estilo    | Tailwind CSS v4         |
| Estado    | Zustand 5               |
| Dados     | TanStack Query + Dexie  |
| Maps      | Leaflet + react-leaflet |
| Charts    | Recharts                |
| Validação | Zod 4                   |

## Recursos

- Rastreamento GPS em tempo real
- Cálculo de consumo híbrido (COPERT + modelo custom)
- Detecção de radares via OpenStreetMap
- Classificação automática de via (cidade/rodovia)
- Histórico de viagens com gráficos
- Tudo funciona offline (PWA)
- Deploy Android via Capacitor

## Estrutura

```
src/
├── components/     # UI components
├── hooks/          # useGeolocation, useConsumptionModel, useDriveMode
├── lib/            # db, utils, distance, radar-api
├── pages/          # Home, Tracker, History, Settings
├── stores/         # Zustand stores (trip, app, radar)
└── types/          # TypeScript interfaces
```

## License

MIT
