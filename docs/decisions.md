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
