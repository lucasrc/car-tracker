# Plano de Correção: Cálculos de RPM, Marcha e Carga do Motor

## Data: 2025-01-28

---

## 1. RESUMO DOS PROBLEMAS IDENTIFICADOS

### 1.1 Problema Principal: Não existe cálculo de CARGA DO MOTOR

O usuário queria saber a **carga do motor** para melhores resultados de consumo, mas este cálculo **não existe** no código atual.

### 1.2 Problemas no Algoritmo `GearRpmEstimator`:

1. **Sempre prefere marcha mais alta**: O algoritmo tenta minimizar RPM para economizar combustível, sem considerar se o motor tem torque suficiente
2. **Não considera demanda de torque**: Subidas e acelerações não influenciam adequadamente a seleção de marcha
3. **Cálculo de "target RPM" linear incorreto**: Usa `rpmAt100Kmh * (speed/100)` que não reflete a física real
4. **Scores heurísticos arbitrários**: Os pesos de decisão não são baseados em torque necessário vs disponível

### 1.3 Problemas nos Testes Atuais:

- Testes apenas verificam se a marcha está "dentro de uma zona", não se é a marcha correta
- Não há validação de cenários realistas (subidas, acelerações)
- Não verificam se o motor teria torque suficiente na marcha escolhida

---

## 2. ANÁLISE DOS RESULTADOS ATUAIS

Com base nos logs de teste, identifiquei:

| Cenário             | Resultado Atual    | Problema                           |
| ------------------- | ------------------ | ---------------------------------- |
| 50 km/h, plano      | Marcha 5, 1538 RPM | RPM muito baixo - motor sem torque |
| 30 km/h, aceleração | Marcha 5, 923 RPM  | IMPOSSÍVEL - motor morreria        |
| 20 km/h, plano      | Marcha 3, 990 RPM  | RPM baixo demais para operação     |
| 60 km/h, subida 10% | Marcha 5, 2264 RPM | Deveria estar em marcha mais baixa |

---

## 3. SOLUÇÃO PROPOSTA

### 3.1 Implementar Cálculo de Carga do Motor (Engine Load)

O cálculo deve considerar:

```
POTÊNCIA NECESSÁRIA =
  - Resistência ao rolamento: P_roll = massa * g * crr * velocidade
  - Resistência aerodinâmica: P_drag = 0.5 * rho * CdA * velocidade³
  - Força de subida: P_slope = massa * g * sin(θ) * velocidade
  - Força de aceleração: P_accel = massa * aceleração * velocidade

POTÊNCIA DISPONÍVEL =
  - torque(RPM_atual) * RPM_atual * 2π / 60000

CARGA DO MOTOR (%) = (POTÊNCIA_NECESSÁRIA / POTÊNCIA_DISPONÍVEL) * 100
```

### 3.2 Nova Lógica de Seleção de Marcha

```
PARA cada marcha disponível:
  1. Calcular RPM nesta marcha na velocidade atual
  2. Obter torque disponível na curva de torque para este RPM
  3. Calcular potência disponível
  4. Calcular carga do motor (%)

  REGRAS DE DECISÃO:
  - Se carga > 85%: penalizar marcha (muito esforço)
  - Se carga < 25% E aceleração < 0.5: favorecer subida de marcha
  - Se aceleração > 1.5 E carga > 70%: manter ou reduzir marcha
  - Se subida > 5% E carga > 75%: reduzir marcha
  - Se RPM < 1200: descartar marcha (lugging)
  - Se RPM > redline * 0.9: descartar marcha

ESCOLHER marcha com melhor score ponderado por:
  - Eficiência (carga próxima de 60-70%)
  - Conforto (RPM > 1200)
  - Reserva de torque (capacidade de acelerar)
```

### 3.3 Cálculo de RPM mais Realista

O RPM atual é calculado corretamente pela fórmula:

```
RPM = (velocidade_kmh / 3.6) / (2π * raio_pneu) * relação_marcha * relação_diferencial * 60
```

Mas a **seleção de qual marcha usar** é que está errada.

---

## 4. BATERIA DE TESTES COM DADOS REAIS

### 4.1 Veículos de Teste (35 modelos reais do mercado brasileiro)

#### Compactos (17 veículos)

| Veículo                   | Motor      | Cilindrada | Relações de Marcha                   | Diferencial | RPM@100km/h | Torque Est. |
| ------------------------- | ---------- | ---------- | ------------------------------------ | ----------- | ----------- | ----------- |
| VW Gol 1.6 MSI 2020       | 1.6 NA MPI | 1598cc     | [3.45, 1.94, 1.28, 0.97, 0.80]       | 4.27        | 2924        | 144 Nm      |
| Fiat Argo 1.3 2021        | 1.3 NA MPI | 1332cc     | [3.91, 2.16, 1.35, 0.97, 0.77]       | 4.07        | 2650        | 120 Nm      |
| Chevrolet Onix 1.0T 2022  | 1.0 Turbo  | 999cc      | [3.73, 2.05, 1.30, 0.95, 0.76, 0.61] | 3.87        | 1972        | 170 Nm      |
| Hyundai HB20 1.0 2022     | 1.0 NA MPI | 998cc      | [3.64, 1.96, 1.28, 0.97, 0.77]       | 4.06        | 2665        | 90 Nm       |
| VW Polo 1.0 TSI 2021      | 1.0 Turbo  | 999cc      | [3.77, 2.09, 1.32, 0.98, 0.77, 0.63] | 3.77        | 1976        | 200 Nm      |
| Fiat Cronos 1.3 2022      | 1.3 NA MPI | 1332cc     | [3.91, 2.16, 1.35, 0.97, 0.77]       | 4.07        | 2629        | 120 Nm      |
| Chevrolet Cruze 1.4T 2021 | 1.4 Turbo  | 1399cc     | [3.82, 2.16, 1.45, 1.00, 0.75, 0.62] | 3.35        | 1681        | 245 Nm      |
| Renault Sandero 1.6 2020  | 1.6 NA MPI | 1598cc     | [3.73, 2.05, 1.32, 0.97, 0.76]       | 4.21        | 2695        | 144 Nm      |
| Renault Logan 1.6 2020    | 1.6 NA MPI | 1598cc     | [3.73, 2.05, 1.32, 0.97, 0.76]       | 4.21        | 2673        | 144 Nm      |
| Ford Ka 1.5 2019          | 1.5 NA MPI | 1497cc     | [3.62, 1.96, 1.28, 0.95, 0.76]       | 4.25        | 2742        | 135 Nm      |
| Nissan Versa 1.6 2021     | 1.6 NA MPI | 1598cc     | [3.67, 1.95, 1.29, 0.97, 0.76]       | 4.07        | 2564        | 144 Nm      |
| Toyota Yaris 1.5 2021     | 1.5 NA MPI | 1496cc     | [3.54, 1.91, 1.31, 0.97, 0.76]       | 4.24        | 2703        | 135 Nm      |
| VW Jetta 1.4 TSI 2020     | 1.4 Turbo  | 1395cc     | [3.77, 2.09, 1.32, 0.98, 0.77, 0.63] | 3.77        | 1930        | 250 Nm      |
| Honda Fit 1.5 2019        | 1.5 NA MPI | 1497cc     | [3.31, 1.90, 1.30, 0.97, 0.76]       | 4.56        | 2919        | 135 Nm      |
| Peugeot 208 1.6 2021      | 1.6 NA MPI | 1587cc     | [3.73, 2.05, 1.32, 0.97, 0.76]       | 4.23        | 2686        | 143 Nm      |
| Citroen C3 1.6 2021       | 1.6 NA MPI | 1587cc     | [3.73, 2.05, 1.32, 0.97, 0.76]       | 4.23        | 2697        | 143 Nm      |
| VW Golf 1.4 TSI           | 1.4 Turbo  | 1395cc     | [3.77, 2.09, 1.32, 0.98, 0.77, 0.63] | 3.45        | 1766        | 250 Nm      |

#### Médios (7 veículos)

| Veículo                 | Motor         | Cilindrada | Relações de Marcha                   | Diferencial | RPM@100km/h | Torque Est. |
| ----------------------- | ------------- | ---------- | ------------------------------------ | ----------- | ----------- | ----------- |
| Toyota Corolla 2.0 2022 | 2.0 NA Dual   | 1987cc     | [3.30, 1.90, 1.40, 1.00, 0.80, 0.67] | 3.94        | 2179        | 190 Nm      |
| Honda Civic 2.0 2020    | 2.0 NA MPI    | 1997cc     | [3.64, 2.08, 1.36, 1.02, 0.83, 0.69] | 4.11        | 2314        | 190 Nm      |
| Mitsubishi Lancer 2.0   | 2.0 NA MPI    | 1998cc     | [3.58, 1.91, 1.31, 0.97, 0.76]       | 4.11        | 2529        | 195 Nm      |
| Subaru Impreza 2.0      | 2.0 Boxer     | 1995cc     | [3.45, 1.95, 1.35, 0.97, 0.78]       | 4.44        | 2782        | 196 Nm      |
| Mazda 3 2.0             | 2.0 NA Direto | 1998cc     | [3.54, 2.06, 1.40, 1.00, 0.71, 0.60] | 4.11        | 2004        | 200 Nm      |
| Kia Cerato 2.0          | 2.0 NA MPI    | 1999cc     | [3.62, 2.19, 1.41, 1.00, 0.83, 0.72] | 4.19        | 2461        | 195 Nm      |
| Ford Focus 2.0          | 2.0 NA Direto | 1999cc     | [3.82, 2.05, 1.32, 1.00, 0.76]       | 4.06        | 2517        | 200 Nm      |

#### SUVs (4 veículos)

| Veículo                | Motor       | Cilindrada | Relações de Marcha                                     | Diferencial | RPM@100km/h | Torque Est. |
| ---------------------- | ----------- | ---------- | ------------------------------------------------------ | ----------- | ----------- | ----------- |
| Jeep Compass 2.0 2021  | 2.0 NA Flex | 1995cc     | [3.50, 2.05, 1.40, 1.00, 0.78, 0.65]                   | 4.13        | 2039        | 190 Nm      |
| Hyundai Creta 1.6 2020 | 1.6 NA MPI  | 1591cc     | [3.77, 2.09, 1.32, 0.98, 0.77, 0.63]                   | 4.56        | 2222        | 143 Nm      |
| Jeep Renegade 1.8 2021 | 1.8 NA Flex | 1747cc     | [3.91, 2.16, 1.35, 0.97, 0.77, 0.62]                   | 4.12        | 1954        | 165 Nm      |
| Jeep Compass Diesel    | 2.0 Diesel  | 1956cc     | [4.70, 2.84, 1.91, 1.38, 1.00, 0.81, 0.70, 0.58, 0.48] | 3.73        | 1336        | 350 Nm      |

#### Premium (3 veículos)

| Veículo          | Motor     | Cilindrada | Relações de Marcha                         | Diferencial | RPM@100km/h | Torque Est. |
| ---------------- | --------- | ---------- | ------------------------------------------ | ----------- | ----------- | ----------- |
| BMW 320i         | 2.0 Turbo | 1998cc     | [4.11, 2.32, 1.54, 1.18, 1.00, 0.85]       | 3.23        | 2180        | 300 Nm      |
| Audi A3 1.4 TFSI | 1.4 Turbo | 1395cc     | [3.77, 2.09, 1.32, 0.98, 0.77, 0.63]       | 3.45        | 1760        | 250 Nm      |
| Mercedes A200    | 1.3 Turbo | 1332cc     | [3.92, 2.43, 1.44, 1.00, 0.80, 0.67, 0.59] | 3.87        | 1834        | 250 Nm      |

#### Pickups (4 veículos)

| Veículo           | Motor       | Cilindrada | Relações de Marcha                   | Diferencial | RPM@100km/h | Torque Est. |
| ----------------- | ----------- | ---------- | ------------------------------------ | ----------- | ----------- | ----------- |
| Toyota Hilux 2.8  | 2.8 Diesel  | 2755cc     | [4.31, 2.33, 1.44, 1.00, 0.84, 0.72] | 3.91        | 2028        | 500 Nm      |
| Ford Ranger 3.2   | 3.2 Diesel  | 3198cc     | [4.17, 2.34, 1.52, 1.14, 0.87, 0.69] | 3.73        | 1822        | 470 Nm      |
| Chevrolet S10 2.8 | 2.8 Diesel  | 2776cc     | [4.27, 2.34, 1.52, 1.15, 0.85, 0.67] | 3.73        | 1788        | 500 Nm      |
| Fiat Toro 1.8     | 1.8 NA Flex | 1747cc     | [3.91, 2.16, 1.35, 0.97, 0.77, 0.62] | 4.12        | 1919        | 157 Nm      |

**Observações importantes:**

- RPM@100km/h varia de 1336 (Jeep Compass Diesel com 9 marchas) a 2924 (Gol 1.6)
- Média geral: 2273 RPM@100km/h
- Veículos com overdrive (6ª/7ª/9ª marcha) têm RPM mais baixos para economia
- Motores turbo diesel têm torque muito alto em baixas rotações
- Raio do pneu calculado: `(diameter * 0.0254 / 2)` em metros

### 4.2 Cenários de Teste (25 cenários por veículo = 875 testes totais)

#### A. Cruzeiro Plano - Marcha mais alta possível

Validar que o sistema escolhe a marcha mais alta mantendo RPM operacional mínimo.

| Velocidade | Condição              | Critério Esperado                                     |
| ---------- | --------------------- | ----------------------------------------------------- |
| 30 km/h    | plano, aceleração = 0 | Marcha 3 ou 4, RPM > 1400 (aspirado) / > 1100 (turbo) |
| 40 km/h    | plano, aceleração = 0 | Marcha 4 ou 5, RPM > 1500 (aspirado) / > 1200 (turbo) |
| 50 km/h    | plano, aceleração = 0 | Marcha 5, RPM > 1600 (aspirado) / > 1300 (turbo)      |
| 60 km/h    | plano, aceleração = 0 | Marcha 5 ou 6, RPM > 1800 (aspirado) / > 1500 (turbo) |
| 80 km/h    | plano, aceleração = 0 | Marcha mais alta, RPM > 2000                          |
| 100 km/h   | plano, aceleração = 0 | Marcha mais alta, RPM ≈ rpm@100kmh (±10%)             |
| 120 km/h   | plano, aceleração = 0 | Marcha mais alta, RPM < redline \* 0.85               |

#### B. Aceleração - Reserva de torque necessária

| Velocidade | Aceleração | Condição | Critério Esperado                       |
| ---------- | ---------- | -------- | --------------------------------------- |
| 30 km/h    | 1.5 m/s²   | plano    | Marcha 2 ou 3, RPM > 2500, carga 60-75% |
| 40 km/h    | 2.0 m/s²   | plano    | Marcha 2 ou 3, RPM > 3000, carga 65-80% |
| 60 km/h    | 1.5 m/s²   | plano    | Marcha 3 ou 4, RPM > 2800, carga 60-75% |
| 80 km/h    | 1.0 m/s²   | plano    | Marcha 4 ou 5, RPM > 2500, carga 55-70% |
| 100 km/h   | 0.8 m/s²   | plano    | Marcha 5 ou 6, RPM > 2800, carga 55-70% |

#### C. Subidas - Redução de marcha obrigatória

| Velocidade | Inclinação | Carga Esperada | Critério Esperado                               |
| ---------- | ---------- | -------------- | ----------------------------------------------- |
| 30 km/h    | +8%        | 70-85%         | Marcha 2 ou 3, nunca marcha mais alta que plano |
| 40 km/h    | +8%        | 75-90%         | Marcha 3, reduzir se carga > 85%                |
| 60 km/h    | +5%        | 65-80%         | Marcha 4 ou 5, manter se carga < 80%            |
| 80 km/h    | +3%        | 60-75%         | Marcha mais alta permitida, observar carga      |
| 60 km/h    | +10%       | 80-95%         | Reduzir marcha imediatamente, carga crítica     |

#### D. Descidas - Freio motor

| Velocidade | Inclinação | Aceleração | Critério Esperado                                  |
| ---------- | ---------- | ---------- | -------------------------------------------------- |
| 60 km/h    | -5%        | -0.5 m/s²  | Pode usar marcha mais alta (eco), freio motor leve |
| 60 km/h    | -8%        | -1.0 m/s²  | Marcha normal ou uma acima, freio motor moderado   |
| 80 km/h    | -5%        | -0.5 m/s²  | Marcha mais alta permitida, aproveitar descida     |

#### E. Casos Extremos

| Cenário                   | Velocidade  | Condições             | Critério Esperado                             |
| ------------------------- | ----------- | --------------------- | --------------------------------------------- |
| Arranque em subida        | 10 km/h     | +15%, aceleração 2.0  | Marcha 1, RPM > 2500, carga máxima permitida  |
| Cruzeiro com carga máxima | 80 km/h     | plano, 5 pax + 200kg  | Reduzir uma marcha vs vazio, carga < 85%      |
| Ultrapassagem             | 80→100 km/h | aceleração 2.5 m/s²   | Reduzir marcha antes de acelerar, "kick-down" |
| Muito baixa velocidade    | 15 km/h     | plano, aceleração 0.5 | Marcha 1 ou 2, nunca > 3, RPM > 1200          |

### 4.3 Parâmetros Adicionais Necessários

Para cada veículo, precisamos estimar:

**Massa do veículo (kg):**

- Compactos: 1050-1200 kg
- Médios: 1250-1400 kg
- SUVs: 1350-1550 kg
- Premium: 1400-1600 kg
- Pickups: 1800-2200 kg

**Coeficiente de resistência ao rolamento (crr):**

- 0.012-0.015 para pneus radiais modernos

**Área frontal × coeficiente de arrasto (CdA):**

- Compactos: 0.60-0.70 m²
- Médios: 0.65-0.75 m²
- SUVs: 0.75-0.90 m²
- Premium: 0.60-0.70 m²
- Pickups: 0.85-1.00 m²

**Curvas de torque estimadas (RPM → Nm):**

Motores 1.0-1.3L aspirados:

```
1000: 80% torque_max, 1500: 90%, 2500: 100%, 4000: 95%, 5500: 80%, 6000: 70%
```

Motores 1.4-1.6L aspirados:

```
1000: 80% torque_max, 1500: 92%, 3000: 100%, 4500: 95%, 5500: 85%, 6500: 75%
```

Motores 2.0L aspirados:

```
1000: 82% torque_max, 1500: 93%, 3000: 100%, 4500: 97%, 6000: 90%, 6800: 80%
```

Motores turbo gasolina:

```
1500: 85% torque_max, 2000: 100%, 3500: 100%, 5000: 95%, 6000: 85%
```

Motores turbo diesel:

```
1000: 70% torque_max, 1500: 95%, 2000: 100%, 3000: 95%, 4000: 80%, 4500: 70%
```

---

## 5. IMPLEMENTAÇÃO PASSO A PASSO

### Fase 1: Engine Load Calculator (2-3 horas)

- Criar `src/lib/engine-load-calculator.ts`
- Implementar cálculo de potência necessária (rolamento + arrasto + subida + aceleração)
- Implementar cálculo de potência disponível (usando curva de torque)
- Calcular porcentagem de carga do motor
- **Testes**: Validar cálculos com dados conhecidos

### Fase 2: Refatorar GearRpmEstimator (3-4 horas)

- Modificar `GearRpmEstimator.estimate()` para usar carga do motor
- Implementar lógica de decisão baseada em carga
- Adicionar proteção contra "lugging" (RPM < 1200)
- Adicionar regras para subidas e acelerações
- **Testes**: Validar seleção de marcha em cada cenário

### Fase 3: Bateria de Testes Realistas (2-3 horas)

- Criar `src/lib/rpm-gear-realistic.test.ts`
- Adicionar dados reais dos 4 veículos
- Criar cenários de teste abrangentes
- Validar todos os cenários
- Documentar resultados esperados vs obtidos

### Fase 4: Integração e Ajustes (2 horas)

- Atualizar `TelemetryResult` para incluir `engineLoad`
- Expor carga do motor no hook `useTelemetryEngine`
- Ajustar fatores de peso baseado nos testes
- **Testes**: Testes de regressão

---

## 6. RESULTADOS ESPERADOS (Baseline para Validação)

### 6.1 Volkswagen Gol 1.6 MSI (exemplo de cálculo detalhado)

**Dados:**

- Massa: 1150 kg
- crr: 0.013
- CdA: 0.65 m²
- Marchas: 5
- Relações: [3.45, 1.94, 1.28, 0.97, 0.80]
- Diferencial: 4.27
- Raio pneu: 0.310 m
- Torque máximo: 144 Nm @ 3000 RPM
- rpm@100kmh: 2924 (5ª marcha)

**Cenário: 60 km/h, plano, aceleração = 0**

```
5ª marcha: RPM = 2924 × (60/100) × (0.80/0.80) = 1754 RPM
   - Torque disponível: 144 × 0.92 = 132 Nm
   - Potência disponível: 132 × 1754 × 2π / 60000 = 24.3 kW
   - Potência necessária: ~8 kW (rolamento + arrasto)
   - CARGA: 33% ✅ (pode subir marcha, mas é a última)

4ª marcha: RPM = 2924 × (60/100) × (0.97/0.80) = 2129 RPM
   - Torque disponível: 144 × 0.97 = 140 Nm
   - Potência disponível: 140 × 2129 × 2π / 60000 = 31.2 kW
   - CARGA: 26% ✅ (mais confortável, mas 5ª é preferida em cruzeiro)

RESULTADO ESPERADO: Marcha 5, RPM 1754, carga 33%
```

**Cenário: 60 km/h, subida 8%, aceleração = 0.3**

```
5ª marcha:
   - Potência necessária: 8 kW + (1150 × 9.81 × sin(4.57°) × 16.67 / 1000) = 8 + 15.1 = 23.1 kW
   - CARGA: 95% ❌ (CRÍTICO - deve reduzir)

4ª marcha:
   - Potência disponível: 31.2 kW
   - CARGA: 74% ✅ (aceitável)

3ª marcha:
   - RPM = 2924 × (60/100) × (1.28/0.80) = 2807 RPM
   - Torque disponível: 144 × 0.99 = 143 Nm
   - Potência disponível: 143 × 2807 × 2π / 60000 = 42.0 kW
   - CARGA: 55% ✅ (ótima, mas 4ª é suficiente)

RESULTADO ESPERADO: Marcha 4, RPM 2129, carga 74%
```

### 6.2 Chevrolet Onix 1.0 Turbo (exemplo com overdrive)

**Dados:**

- rpm@100kmh: 1972 (6ª marcha - overdrive)
- Torque máximo: 170 Nm @ 2000-3500 RPM

**Cenário: 60 km/h, plano, aceleração = 0**

```
6ª marcha: RPM = 1972 × (60/100) = 1183 RPM ❌ (muito baixo, motor sem torque)

5ª marcha: RPM = 1972 × (60/100) × (0.76/0.61) = 1473 RPM
   - Torque disponível: 170 × 0.95 = 162 Nm
   - CARGA: ~30% ✅

RESULTADO ESPERADO: Marcha 5, RPM 1473, carga ~30%
(NUNCA deve usar 6ª a 60 km/h, mesmo em cruzeiro)
```

### 6.3 Jeep Compass Diesel (exemplo com 9 marchas)

**Dados:**

- rpm@100kmh: 1336 (9ª marcha)
- Torque máximo: 350 Nm @ 1750-2500 RPM

**Cenário: 100 km/h, plano, aceleração = 0**

```
9ª marcha: RPM = 1336
   - Torque diesel disponível: 350 × 0.98 = 343 Nm
   - Potência disponível: 343 × 1336 × 2π / 60000 = 48.0 kW
   - Potência necessária: ~25 kW (resistências + SUV)
   - CARGA: 52% ✅

RESULTADO ESPERADO: Marcha 9, RPM 1336, carga 52%
(Diesel aguenta RPM baixo com alto torque)
```

---

## 7. CRITÉRIOS DE ACEITAÇÃO

1. **Carga do Motor**: Sistema deve calcular e reportar carga do motor (0-100%)
2. **RPM Mínimo**:
   - Motores aspirados: nunca < 1300 RPM em operação
   - Motores turbo gasolina: nunca < 1100 RPM
   - Motores diesel: nunca < 1000 RPM
3. **Subidas**: Reduzir marcha quando carga > 85% em subidas
4. **Aceleração**:
   - Leve (0.5-1.0): carga 40-60%
   - Moderada (1.0-2.0): carga 60-75%
   - Forte (>2.0): carga 70-85%, reduzir marcha se necessário
5. **Testes**: 90% dos cenários da bateria de testes devem passar
6. **Consistência**: Mesmo veículo em mesmas condições deve dar mesmo resultado
7. **Performance**: Cálculo de cada cenário < 5ms em dispositivo móvel médio

---

## 7. RISCOS E CONSIDERAÇÕES

### Riscos:

1. **Veículos sem curva de torque**: Fallback para cálculo simplificado baseado em torque máximo
2. **CVT**: Lógica diferente necessária (não tem marchas discretas)
3. **Performance**: Cálculos mais complexos podem impactar performance em dispositivos móveis

### Mitigações:

1. Cache de cálculos de torque
2. Cálculo simplificado para veículos sem dados completos
3. Web Workers para cálculos pesados (se necessário)

---

## 8. PRÓXIMAS ETAPAS

1. **Aprovação do plano** pelo usuário
2. **Implementação da Fase 1** (Engine Load)
3. **Revisão e feedback** antes de continuar
4. **Implementação das Fases 2-4**
5. **Testes finais e validação**

---

## ANEXO: Exemplo de Cálculo de Carga do Motor

### Cenário: Gol 1.6, 60 km/h, subida 8%, aceleração 0.5 m/s²

**Dados:**

- Massa: 1200 kg
- crr: 0.013
- CdA: 0.66 m²
- Relação 4ª marcha: 1.033
- Diferencial: 4.25
- Raio pneu: 0.28 m
- Torque a 3000 RPM: ~145 Nm

**Cálculos:**

```
Velocidade: 60 km/h = 16.67 m/s

Potência rolamento:
P_roll = 1200 * 9.81 * 0.013 * 16.67 = 2.55 kW

Potência arrasto:
P_drag = 0.5 * 1.225 * 0.66 * 16.67³ = 1.87 kW

Potência subida:
P_slope = 1200 * 9.81 * sin(4.57°) * 16.67 = 15.42 kW

Potência aceleração:
P_accel = 1200 * 0.5 * 16.67 = 10.0 kW

TOTAL NECESSÁRIO: ~30 kW

RPM em 4ª marcha a 60 km/h:
RPM = (16.67 / (2π * 0.28)) * 1.033 * 4.25 * 60 = 2510 RPM

Potência disponível:
P_avail = 145 * 2510 * 2π / 60000 = 38.1 kW

CARGA DO MOTOR: 30 / 38.1 = 79%
```

**Decisão**: Carga de 79% é aceitável. Se fosse > 85%, deveria reduzir para 3ª marcha.

---

_Plano criado para revisão e aprovação antes da implementação._
