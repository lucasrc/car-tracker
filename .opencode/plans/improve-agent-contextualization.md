# Plano: Melhorar Contextualização para Agentes AI

## Objetivo

Criar documentação estratégica que maximize a eficácia de agentes AI neste projeto, focando em **contexto que o AGENTS.md não cobre**.

---

## Diagnóstico

### O que já funciona bem

- `AGENTS.md` — convenções, comandos, estrutura de arquivos (✅ manter)
- `docs/regras-negocio.md` — especificação de penalidades (✅ manter)
- `docs/modelo-consumo-tempo-real.md` — modelo de consumo (✅ manter)
- `.opencode/plans/` — planos de task (✅ manter)

### O que falta (gaps críticos)

1. **Nenhum documento explica como as peças se conectam** — o agente sabe onde cada arquivo está, mas não como `useGeolocation` → `useTripStore` → `Dashboard` se comunicam
2. **Nenhum glossário de domínio** — termos como COPERT, STPS, HMM, Vincenty aparecem nos docs mas sem explicação acessível
3. **Nenhum registro de decisões** — por que Zustand e não Redux? Por que Dexie e não SQLite?
4. **Nenhum mapa de fluxo de dados** — como uma coordenada GPS vira "12.5 km/l" na tela
5. **README genérico** — não serve nem para humanos, muito menos para agentes

---

## Documentos Propostos

### 1. `docs/architecture.md` — Visão Geral do Sistema

**Propósito:** Dar ao agente uma visão 30.000 pés de como tudo funciona junto.

**Conteúdo:**

```
# Arquitetura do Car Tracker

## Visão Geral
Aplicativo de rastreamento veicular que roda 100% offline no navegador/celular.
Registra viagens via GPS, calcula consumo de combustível, detecta radares.

## Camadas
1. **Coleta** (hooks) → GPS, simulação, Bluetooth OBD2
2. **Estado** (stores) → TripStore (viagem atual), AppStore (configurações)
3. **Persistência** (Dexie/IndexedDB) → trips, settings, refuels
4. **Cálculo** (hooks/lib) → consumo, distância, detecção de modo
5. **Apresentação** (pages/components) → UI em React

## Fluxo Principal
GPS → useGeolocation → useTripStore.addPosition → calculateTotalDistance → UI

## Fluxo de Consumo
GPS → useGeolocation → useConsumptionModel.addReading →
  getMetrics() → calculateAdjustedConsumption() → UI

## Fluxo de Radar
GPS → fetchRadarsInArea(Overpass API) → cache(Dexie) →
  isSpeeding() + isRadarApplicable() → alerta UI
```

### 2. `docs/data-flow.md` — Fluxo de Dados Detalhado

**Propósito:** Explicar exatamente como dados se movem, para o agente entender cadeias de dependência.

**Conteúdo:**

```
# Fluxo de Dados

## Coordenada GPS → Distância na Tela
1. navigator.geolocation.watchPosition() emite coordenadas
2. useGeolocation normaliza e filtra (accuracy threshold)
3. useTripStore.addPosition() recebe Coordinates
4. calculateTotalDistance() soma trechos com Vincenty
5. Trip.distanceMeters é atualizado no store
6. Dashboard/TripInfo lê do store e formata

## Velocidade → Consumo de Combustível
1. GPS emite speed em m/s (ou calculada por delta posição)
2. useConsumptionModel.addReading(speedMs, timestamp)
3. Janela deslizante de 30s mantém últimas leituras
4. getMetrics() calcula: avgSpeed, maxSpeed, variance, acceleration
5. calculateAdjustedConsumption() aplica modelo híbrido:
   - COPERT (60%) + modelo custom (40%)
   - Penalidades: velocidade, agressão, idle, instabilidade
   - Bônus: velocidade ideal, aceleração suave, coasting
6. Resultado: adjustedKmPerLiter
```

### 3. `docs/glossary.md` — Dicionário de Domínio

**Propósito:** Todo termo técnico que aparece no código, explicado em 1-2 linhas.

**Conteúdo:**

```
# Glossário

## Termos de Domínio
- **COPERT**: Modelo europeu de emissões veiculares. Usado para estimar consumo baseado na velocidade.
- **STPS**: Space-Time Path Segmentation. Classifica atividades do veículo (andando, parado, desligado).
- **HMM**: Hidden Markov Model. Usado para matching de rota com radares no OpenStreetMap.
- **Vincenty**: Fórmula geodésica de alta precisão. Considera a Terra como elipsoide WGS84.

## Tipos de Dados
- **Coordinates**: { lat, lng, timestamp, accuracy?, speed? }
- **Trip**: Viagem completa com path, distância, consumo, paradas
- **ActivityType**: "MA" (moving), "SA_ENGINE_ON" (parado ligado), "SA_ENGINE_OFF" (desligado)

## Unidades
- Velocidade interna: m/s → exibida em km/h
- Distância interna: metros → exibida em m ou km
- Consumo: km/l (quilômetros por litro)
```

### 4. `docs/decisions.md` — Architecture Decision Records

**Propósito:** Registrar POR QUE decisões foram tomadas, para o agente não sugerir mudanças que já foram rejeitadas.

**Conteúdo:**

```
# Decisões de Arquitetura

## Estado: Zustand vs Redux
**Decisão:** Zustand
**Por quê:** Menos boilerplate, API mais simples, devtools integrado, persist nativo.
**Quando reconsiderar:** Se o estado ficar complexo demais com múltiplos stores interdependentes.

## Banco: Dexie (IndexedDB) vs SQLite
**Decisão:** Dexie
**Por quê:** App roda no navegador (PWA). SQLite requer Capacitor plugin. IndexedDB é nativo.
**Quando reconsiderar:** Se migrar para app nativo puro.

## Validação: Zod
**Decisão:** Zod
**Por quê:** Runtime validation + TypeScript types inferidos. Schema-first approach.
```

### 5. Atualizar `README.md`

**Propósito:** Primeira impressão para humanos E agentes.

**Conteúdo:**

```
# Car Tracker

App de rastreamento veicular 100% offline. Registra viagens, calcula consumo,
detecta radares e classifica tipo de via (cidade/rodovia).

## Para Agentes AI
Leia `AGENTS.md` primeiro — contém todas as convenções e comandos.
Depois leia `docs/architecture.md` para entender como as peças se conectam.

## Stack
React 19 + TypeScript + Vite + Tailwind CSS v4
```

---

## Técnicas de Uso do Agente

### 1. Contexto via Arquivos (o que já funciona)

- `AGENTS.md` é lido automaticamente pelo agente — é o "system prompt"
- Docs em `docs/` são referenciados pelo agente quando relevante
- Plans em `.opencode/plans/` dão contexto específico por task

### 2. Técnicas de Prompt

- **Referenciar arquivos:** "Leia docs/modelo-consumo-tempo-real.md antes de mexer em useConsumptionModel"
- **Dar escopo:** "Apenas a aba Sobre em Settings.tsx, não mexa no resto"
- **Dar critério de sucesso:** "O texto deve ser entendível por alguém que não sabe programar"

### 3. Técnicas de Manutenção

- **Manter docs curtos:** Agente lê tudo a cada interação. Docs longos = token waste = contexto perdido
- **Atualizar docs quando mudar lógica:** Se mudar o algoritmo de consumo, atualizar o doc correspondente
- **Usar o plano atualizado:** `.opencode/plans/` é o melhor lugar para contexto temporário de uma task

### 4. O que EVITAR

- Docs duplicados com informações conflitantes
- Docs muito longos (>200 linhas) — o agente pode truncar
- Comentários excessivos no código — o agente lê o código, não precisa de comentários óbvios
- README genérico de template — confunde mais que ajuda

---

## Ordem de Execução

1. `docs/architecture.md` — maior impacto, base para todo resto
2. `docs/glossary.md` — rápido de escrever, elimina ambiguidade
3. `docs/data-flow.md` — detalhado mas valioso para debugging
4. `docs/decisions.md` — começa com 3-4 decisões, cresce organicamente
5. `README.md` — atualização rápida

---

## Métrica de Sucesso

Um agente bem contextualizado deve:

- ✅ Saber quais arquivos tocar sem perguntar
- ✅ Não sugerir bibliotecas que já foram rejeitadas
- ✅ Entender termos de domínio sem pedir explicação
- ✅ Não quebrar fluxos de dados que não vê diretamente
- ✅ Escrever código que segue as convenções do projeto
