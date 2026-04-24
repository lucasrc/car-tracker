# Architecture Decision Records

Decisões de arquitetura documentadas com o contexto da época. Evita que o agente sugira alternativas já consideradas.

---

## ADR-001: Estado com Zustand vs Redux

**Decisão:** Zustand

**Data:** 2024

**Contexto:** Precisávamos de um gerenciador de estado simples para React.

**Alternativas consideradas:**

- Redux + Redux Toolkit
- React Context API

**Por quê Zustand:**

- API mínima (create store → hook)
- Não precisa Provider wrapper
- Devtools e persist integrados
- Menos boilerplate que Redux
- Suporte TypeScript nativo

**Quando reconsiderar:**

- Se necessário middleware complexo que Zustand não suporta
- Se o estado ficar tão grande que preciso de múltiplos stores com dependências complexas entre si

---

## ADR-002: Banco de Dados com Dexie (IndexedDB) vs SQLite

**Decisão:** Dexie

**Data:** 2024

**Contexto:** App roda no navegador via PWA. Precisávamos de persistência offline.

**Alternativas consideradas:**

- SQLite via Capacitor plugin
- LocalStorage (muito limitado)
- Redis/DynamoDB (precisa internet)

**Por quê Dexie/IndexedDB:**

- Nativo do navegador, zero configuração
- Suporta objetos complexos (não só strings)
- Query API fluente (não SQL)
- IndexedDB é assíncrono (não bloqueia UI)
- Funciona offline por design

**Quando reconsiderar:**

- Se migrar para app nativo Android/iOS puro (não PWA)
- Se precisar de queries complexas que IndexedDB não suporta bem

---

## ADR-003: Validação com Zod vs Yup ou io-ts

**Decisão:** Zod

**Data:** 2024

**Contexto:** Precisávamos de validação runtime com inferência TypeScript automática.

**Alternativas consideradas:**

- Yup
- io-ts
- runtypes
- custom validation

**Por quê Zod:**

- `z.infer<typeof schema>` gera tipos automaticamente
- API fluente e legível
- Schema-first, menos código que Yup
- Funciona com React Hook Form nativamente

**Quando reconsiderar:**

- Se precisar de validação assíncrona complexa
- Se a equipe já tiver investimento grande em outra biblioteca

---

## ADR-004: Maps com Leaflet vs Google Maps ou Mapbox

**Decisão:** Leaflet + OpenStreetMap

**Data:** 2024

**Contexto:** Precisávamos de mapa gratuito sem API key.

**Alternativas consideradas:**

- Google Maps API (pago)
- Mapbox (pago com tier gratuito)
- MapLibre GL (WebGL, mais complexo)

**Por quê Leaflet + OSM:**

- Totalmente gratuito
- Não precisa API key
- Tile providers variados (OSM, Stamen, etc.)
- Leve e performático
- Funciona offline com cache

**Quando reconsiderar:**

- Se precisar de mapas 3D ou renderização avançada
- Se o app precisar de rotas turn-by-turn ( Leaflet não faz nativamente)

---

## ADR-005: Distância com Vincenty vs Haversine

**Decisão:** Vincenty como primário, Haversine como fallback

**Data:** 2024

**Contexto:** GPS fornece coordenadas WGS84. Precisão importa para rastrear distância.

**Alternativas consideradas:**

- Haversine simples (esfera perfeita)
- Google Maps Distance Matrix API
- Custom (lat/lng \* constante)

**Por quê Vincenty:**

- Considera a Terra como elipsóide (não esfera)
- Precisão de ~1mm para distâncias normais
- Implementação madura e testada
- Fallback para casos edge (pontos antipodais)

**Quando reconsiderar:**

- Se performance em tempo real for crítica (Vincenty é iterativo)
- Se瞿 Soarem distâncias muito longas (continental)

---

## ADR-006: Consumo Híbrido (COPERT + Custom)

**Decisão:** 60% COPERT + 40% modelo custom

**Data:** 2024

**Contexto:** Precisávamos estimar consumo em tempo real, não apenas consumo médio histórico.

**Alternativas consideradas:**

- Apenas COPERT (modelo europeu)
- Apenas consumo manual fixo
- Machine learning (overkill para escopo)

**Por quê híbrido:**

- COPERT é validado academicamente para velocidade
- Modelo custom captura comportamento do motorista (aceleração, idle)
- Combinação cobre ambos os aspectos
- Bônus/penalidades dão feedback ao usuário

**Referências:**

- COPERT: European Environment Agency
- Baseline: Oak Ridge National Lab studies

---

## ADR-007: Background Geolocation com @capgo/background-geolocation

**Decisão:** @capgo/background-geolocation

**Data:** 2024

**Contexto:** App precisa rastrear em background (tela desligada).

**Alternativas consideradas:**

- navigator.geolocation (só foreground)
- react-native-background-geolocation (não é React web)
- Custom com Service Worker

**Por quê @capgo:**

- Funciona com Capacitor (nosso target)
- Suporta iOS e Android
- Battery-efficient tracking
- Geofencing incluso

**Quando reconsiderar:**

- Se migrar para app nativo puro (usar APIs nativas de geolocation)
- Se precisar de tracking em tempo real com alta frequência

---

## ADR-008: Charts com Recharts vs Chart.js

**Decisão:** Recharts

**Data:** 2024

**Contexto:** Precisávamos de gráficos para Histórico de viagens.

**Alternativas consideradas:**

- Chart.js
- Victory
- D3 puro

**Por quê Recharts:**

- Componentes React nativos
- Leve e performático
- Tipos TypeScript bons
- Customizável o suficiente

**Quando reconsiderar:**

- Se precisar de tipos de gráfico que Recharts não suporta
- Se performance com muitos dados for problema

---

## ADR-009: FIFO Fuel Cost Tracking vs Preco Unico vs Preco Medio

**Decisão:** FIFO (First-In-First-Out)

**Data:** 2026

**Contexto:** O usuario abastece em diferentes postos com precos diferentes. Precisamos calcular o custo real de cada viagem de forma precisa.

**Alternativas consideradas:**

1. **Preco Unico (Modelo Original):**
   - Usa um preco global configurado pelo usuario
   - Prós: Simples de implementar
   - Contras: Impreciso quando precos variam entre abastecimento

2. **Preco Medio Ponderado:**
   - Calcula preco medio de todos os abastecimentos
   - Prós: Simples, da visão geral
   - Contras: Não reflete custo real de combustivel consumido

3. **FIFO (First-In-First-Out):**
   - Rastreia cada abastecimento como lote independente
   - Consome do lote mais antigo primeiro
   - Prós: Custo real e preciso
   - Contras: Mais complexo de implementar

**Por quê FIFO:**

- Espelha realidade fisica do tanque de combustivel
- Permite calculo preciso de custo por viagem
- Suporta multiplos tipos de combustivel (gasolina/etanol)
- Possibilita validacao retrospectiva (custo real vs estimado)
- Preco medio ainda disponível para comparacao

**Implementação:**

- Cada refuel vira um `FuelBatch` com timestamp, amount, price, fuelType
- `consumeFuel(liters)` itera batches ordenados por timestamp
- Custo = soma(amount \* price) de cada batch parcialmente consumido
- Armazena `actualCost` (FIFO) além de `totalCost` (estimado)

**Quando reconsiderar:**

- Se odômetro estiver disponível: usar método fill-up para validação real
- Se usuario abastece sempre no mesmo posto: overhead não compensa
- Se performance com milhares de lotes for problema ( batches > 1000)

---

## ADR-007: Modelo de Consumo Híbrido (COPERT + Física Veicular)

**Decisão:** Modelo híbrido com fallback COPERT

**Data:** Abril 2026

**Contexto:** O modelo COPERT puro tem precisão de ~88.6%, mas não considera dados específicos da transmissão do veículo (marchas, RPM, curva de torque). Com dados de transmissão, é possível calcular consumo com base em física veicular real (BSFC, torque, potência).

**Alternativas consideradas:**

- COPERT puro (modelo atual)
- Física veicular pura (requer dados completos de transmissão)
- Modelo híbrido (70% física + 30% COPERT)

**Por quê modelo híbrido:**

- **Precisão superior**: Física veicular real quando dados disponíveis (~92-95%)
- **Fallback robusto**: COPERT quando dados de transmissão ausentes (88.6%)
- **Informação extra**: Previsão de marcha e RPM em tempo real
- **Confiança mensurável**: Score de confiança por cenário (0.85-0.95)
- **Coleta progressiva**: AI calibration service coleta dados de transmissão gradualmente

**Implementação:**

- `TransmissionData` interface: gearRatios, finalDrive, tireRadiusM, redlineRpm, idleRpm, torqueCurve
- `predictGear()`: calcula RPM por marcha, encontra marcha válida
- `getTorqueAtRpm()`: interpolação linear na curva de torque
- `calculatePhysicsConsumption()`: BSFC × potência → fluxo de combustível
- Pesos: 70% física + 30% COPERT quando ambos disponíveis
- AI calibration service atualizado para coletar dados de transmissão

**Dados de transmissão coletados pelo AI:**

- transmissionType (Manual/Automatic/CVT)
- gearRatios (relações de marcha)
- finalDrive (relação do diferencial)
- tireRadiusM (raio de rolamento do pneu)
- redlineRpm, idleRpm
- torqueCurve (RPM → torque Nm)
- techEra (carburetor/injection_modern/etc)
- idleFuelRateLph, bsfcMinGPerKwh

**Quando reconsiderar:**

- Se dados OBD2 disponíveis via Bluetooth: usar RPM e marcha reais
- Se precisão do modelo híbrido não superar COPERT puro em testes reais
- Se complexidade de manutenção do modelo híbrido for muito alta

---

## ADR-008: Substituição do Algoritmo de Seleção de Marcha por Scoring Gaussiano

**Data:** Abril 2026

**Contexto:**

O algoritmo anterior de seleção de marcha (`selectOptimalGear`) usava regras heurísticas com thresholds binários (slope > 3, accel > 2.0). Isso causava:

1. **Bug de marcha baixa**: Aos 3 km/h, selecionava 2ª marcha (RPM abaixo do idle)
2. **Descontinuidades**: Transições abruptas entre modos (cruzeiro/aceleração/subida)
3. **Gear hunting**: Oscilação entre marchas adjacentes em velocidades de fronteira
4. **Sem histerese**: Sem tempo mínimo entre trocas ou margens assimétricas

**Decisão:**

Substituir o algoritmo baseado em regras if/else por um seletor multi-critério com três fases:

1. **Filtro de Viabilidade**: Descarta marchas com RPM fora do range operacional (MIN_OPERATING_RPM por tipo de aspiração: NA=1300, turbo=1100, diesel=1000)
2. **Scoring Gaussiano**: Cada marcha viável recebe score ponderado:
   - `fuelScore` = `gaussianScore(BSFC, bsfcOptimal, σ_fuel)`
   - `driveScore` = `asymmetricScore(RPM, rpmTarget, σ_low, σ_high)`
   - `powerScore` = `gaussianScore(load, optimalLoad, σ_load)`
   - `safetyScore` = hardcutoff(RPM < redline × 0.95)
   - Pesos adaptativos via `sigmoid(slope)` e `sigmoid(accel)`
3. **Histerese**: Margens assimétricas (upshift +15%, downshift +10%), dwell mínimo 1.5s, kickdown bypass para accel > 2.5 m/s²

**Consequentess:**

- RPM a baixa velocidade segue modelo clutch-slip (aspiration-dependent: NA=10km/h, turbo=8, diesel=7)
- Transições entre modos são suaves (sigmoid ao invés de threshold binário)
- Bug de "3 km/h em 2ª marcha" corrigido
- Gear hunting eliminado pelo dwell e margens
- `calculateRpm` tem novo parâmetro `aspiration` e `clampToIdle`

**Alternativas consideradas:**

- Manter regras if/else com mais condições: rejeitado por não resolver descontinuidades
- Machine learning (regressão logística): rejeitado por necessidade de dados de treino
- Tabela de lookup velocidade→marcha (estilo COPERT Tier 2): rejeitado por não considerar carga/slope
