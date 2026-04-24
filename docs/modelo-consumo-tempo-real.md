# Modelo de Consumo em Tempo Real - Híbrido (COPERT + Física)

## Visão Geral

Este documento descreve o algoritmo de cálculo de consumo de combustível em tempo real implementado no sistema de rastreamento veicular. O modelo utiliza uma abordagem **híbrida** que combina:

1. **COPERT** (Computer Programme to calculate Emissions from Road Transport) - modelo validado pela EEA com precisão de ~88.6%
2. **Modelo de Física Veicular** - cálculo baseado em transmissão, curva de torque e BSFC (quando dados disponíveis)

## Novas Constantes Físicas (Abril 2026)

O modelo foi revisado com base em pesquisa científica para corrigir superestimação de consumo em cidade:

| Constante | Valor | Descrição |
|-----------|-------|-----------|
| `DEFAULT_TRANSMISSION_EFFICIENCY` | 0.90 | Eficiência típica do trem de força |
| `getTransmissionEfficiency(type)` | 0.86-0.93 | Por tipo: Manual 0.93, Auto 0.88, CVT 0.86 |
| `PARASITIC_POWER_KW` | 0.4 kW | Carga base (alternador, auxiliares) |
| `DEFAULT_ALTITUDE_M` | 0 | Altitude padrão (nível do mar) |
| `DEFAULT_TEMPERATURE_C` | 25 | Temperatura padrão (°C) |

### Eficiência do Motor por Carga

O modelo agora usa **eficiência dependente de carga** baseada em dados reais de BSFC island maps:

| Load (%) | Efficiency (gasolina) |
|----------|------------------------|
| 10% | 0.16 |
| 20% | 0.24 |
| 50% | 0.32 |
| 75% | 0.32 |
| 100% | 0.27 |

### BSFC por Era Tecnológica (mínimo/ótimo)

| Era | Gasolina | Diesel | GNV |
|----|----------|--------|-----|
| Carburetor | 310 | 245 | 300 |
| Early Injection | 280 | 230 | 275 |
| Modern Injection | 250 | 215 | 245 |
| Direct Injection | 230 | 200 | 225 |

### Load Factor (BSFC penalidade)

O BSFC efetiva é multiplicada por um load factor que reflete a ineficiência em cargas baixas:

| Load (%) | Load Factor |
|----------|-------------|
| 5% | 2.8 |
| 10% | 2.0 |
| 20% | 1.4 |
| 50% | 1.1 |
| 75% | 1.0 |
| 100% | 1.1 |

## Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    useDriveMode.ts                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Classificação de Atividade (STPS)                      │ │
│  │  • MA: velocidade > 1 m/s → Mobile Activity            │ │
│  │  • SA_ENGINE_ON: velocidade ≤ 1 m/s → Ociosidade       │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│              TelemetryEngine.simulate()                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Verifica vehicle.transmission                            │ │
│  │                                                         │ │
│  │ SE transmission disponível:                             │ │
│  │  ┌───────────────────────────────────────────────────┐  │ │
│  │  │ predictGear(speed, transmission)                  │  │ │
│  │  │  • Calcula RPM para cada marcha                   │  │ │
│  │  │  • Encontra marcha válida (idle ≤ RPM ≤ redline) │  │ │
│  │  │  • Retorna { gear, rpm }                          │  │ │
│  │  └───────────────────────────────────────────────────┘  │ │
│  │                                                         │ │
│  │  SE torqueCurve + bsfcMinGPerKwh disponíveis:           │ │
│  │   ┌─────────────────────────────────────────────────┐   │ │
│   │   │ Modelo de Física (70%) + COPERT (30%)         │   │ │
│   │   │  • getTorqueAtRpm(rpm, torqueCurve)           │   │ │
│   │   │  • calculatePhysicsConsumption()              │   │ │
│   │   │  • powerKw = (torque × rpm × 2π) / 60000     │   │ │
│   │   │  • bsfc = bsfcMin × (1 + |rpm-2500|/5000)    │   │ │
│   │   │  • fuelFlow = (bsfc × power) / density       │   │ │
│   │   │  • physicsKmpl = speed / fuelFlow             │   │ │
│   │   │  • kmpl = physics×0.7 + copert×0.3            │   │ │
│   │   │  • confidence = 0.95                          │   │ │
│   │   └─────────────────────────────────────────────────┘   │ │
│  │                                                         │ │
│  │  SENÃO (sem torqueCurve ou bsfc):                       │ │
│  │   ┌─────────────────────────────────────────────────┐   │ │
│   │   │ COPERT puro + gear prediction                  │   │ │
│   │   │  • kmpl = copertKmpl                           │   │ │
│   │   │  • confidence = 0.9                            │   │ │
│   │   └─────────────────────────────────────────────────┘   │ │
│  │                                                         │ │
│  │ SENÃO (sem transmission):                                │ │
│  │  ┌───────────────────────────────────────────────────┐  │ │
│  │  │ COPERT puro (modelo tradicional)                  │  │ │
│  │  │  • kmpl = copertKmpl                              │  │ │
│  │  │  • confidence = 0.85                              │  │ │
│  │  └───────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Modelo COPERT

O modelo COPERT é usado para calcular o consumo de combustível baseado na velocidade média do veículo.

### Fórmula:

```
FC = (217 + 0.253V + 0.00965V²) / (1 + 0.096V − 0.000421V²)

Onde:
- FC = Fuel Consumption (g/km)
- V = Velocidade média (km/h)

Conversão para km/l:
km/l = (1000 × densidade) / FC
densidade gasolina = 750 g/L
```

### Referência:

- Kan, Z. et al. (2018). "Estimating Vehicle Fuel Consumption and Emissions Using GPS Big Data" - PMC5923608
- European Environmental Agency - COPERT Model
- Estudo validado com precisão de ~88.6%

## Modelo de Física Veicular

Quando dados de transmissão estão disponíveis, o sistema utiliza um modelo baseado em física para maior precisão.

### Previsão de Marcha

```typescript
function predictGear(speedKmh, transmission): { gear; rpm } {
  // Para cada marcha, calcula RPM:
  // RPM = (speed / 3.6) / (2π × tireRadius) × gearRatio × finalDrive × 60
  // Encontra a marcha onde idleRpm <= RPM <= redlineRpm
  // Se nenhuma marcha válida, encontra a mais próxima
}
```

### Cálculo de Consumo por BSFC

```typescript
function calculatePhysicsConsumption(rpm, torque, bsfcMin, techEra, fuelType, speed):
  // 1. Potência mecânica:
  powerKw = (torque × rpm × 2π) / 60000

  // 2. BSFC ajustado por RPM:
  bsfc = bsfcMin × (1 + |rpm - 2500| / 5000)

  // 3. Fluxo de combustível:
  fuelFlowGPerH = bsfc × powerKw
  fuelFlowLPerH = fuelFlowGPerH / fuelDensity / 1000

  // 4. Consumo:
  return speed / fuelFlowLPerH
```

### Curva de Torque

A curva de torque é interpolada linearmente entre pontos conhecidos:

```typescript
function getTorqueAtRpm(rpm, torqueCurve):
  // Encontra os dois pontos mais próximos
  // Interpola linearmente entre eles
  // Retorna torque estimado em Nm
```

### Mapa BSFC por Era Tecnológica

| Era Tecnológica  | BSFC Mínimo (g/kWh) |
| ---------------- | ------------------- |
| carburetor       | 280                 |
| injection_early  | 265                 |
| injection_modern | 250                 |
| direct_injection | 235                 |

## Classificação de Atividades (STPS)

| Tipo                     | Condição           | Consumo           |
| ------------------------ | ------------------ | ----------------- |
| **MA** (Mobile Activity) | velocidade > 1 m/s | COPERT/Física     |
| **SA_ENGINE_ON**         | velocidade ≤ 1 m/s | 4-mode (~1.3 L/h) |

### Decisão de Design

**Por que não detectamos engine-off?**

Sem acesso a OBD (On-Board Diagnostics), é impossível distinguir entre:

- Veículo parado com motor ligado (start-stop, trânsito)
- Veículo parado com motor desligado

A abordagem conservadora assume **sempre motor ligado** quando parado, o que:

- ✅ Não superestima autonomia (erro pelo lado da segurança)
- ✅ Funciona corretamente em trânsito
- ✅ Não requer sensores adicionais

## Fatores Técnicos

### Cilindrada do Motor

```typescript
displacementFactor = (cilindrada / 1600) ^ -0.15;
```

**Exemplo:**

- Motor 1.0L (1000 cc): fator = 1.09 (+9%)
- Motor 1.6L (1600 cc): fator = 1.0 (base)
- Motor 2.0L (2000 cc): fator = 0.93 (-7%)

### Tipo de Combustível

```typescript
const FUEL_ENERGY_FACTORS = {
  gasolina: 0.91,
  etanol: 0.7,
  flex: 0.87,
};
```

## Exemplo de Cálculo

### Cenário: Viagem urbana com trânsito

1. **Condução a 40 km/h** (MA):
   - COPERT: ~12.8 km/l (com ajustes técnicos)
   - **Consumo instantâneo: 12.8 km/l**

2. **Parado em semáforo** (SA_ENGINE_ON, 30s):
   - 4-mode: 0.361 ml/s × 30s = 10.83 ml
   - Consumo em marcha lenta: ~1.3 L/h

3. **Resultado final** (3 km na cidade):
   - Distância: 3 km
   - Consumo médio: 12.8 km/l (próximo ao valor configurado de 10 km/l)
   - Combustível usado: 0.23 L

### Cenário: Com dados de transmissão

1. **Condução a 50 km/h** com transmissão Manual 5 marchas:
   - predictGear(50, transmission) → { gear: 3, rpm: 2800 }
   - getTorqueAtRpm(2800, torqueCurve) → 148 Nm
   - calculatePhysicsConsumption(2800, 148, 240, "injection_modern", "gasolina", 50)
   - kmpl = physicsKmpl × 0.7 + copertKmpl × 0.3
   - confidence = 0.95

## Vantagens do Modelo Híbrido

1. **Base científica sólida**: 88.6% de precisão validada (COPERT)
2. **Maior precisão com dados de transmissão**: Física veicular real
3. **Fallback robusto**: COPERT quando dados insuficientes
4. **Confiança mensurável**: Score de confiança por cenário
5. **Previsão de marcha**: Informação útil para o usuário
6. **Fácil manutenção**: Lógica clara e modular

## Comparativo: Modelos

| Aspecto              | COPERT Puro      | Híbrido (COPERT + Física) |
| -------------------- | ---------------- | ------------------------- |
| Precisão (sem trans) | 88.6% (validado) | 88.6% (igual)             |
| Precisão (com trans) | 88.6%            | ~92-95% (estimado)        |
| Complexidade         | Baixa            | Média                     |
| Dados necessários    | Básicos          | Transmissão (opcional)    |
| Confiança            | 0.85             | 0.90-0.95                 |
| Informação extra     | Nenhuma          | Marcha, RPM               |

## Referências

1. **COPERT Model**
   - European Environmental Agency - COPERT
   - Kan, Z. et al. (2018). "Estimating Vehicle Fuel Consumption and Emissions Using GPS Big Data"
   - URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC5923608/

2. **Space-Time Path (STPS)**
   - Hägerstrand, T. (1970). "What about people in Regional Science?"
   - Kan, Z. et al. (2018) - N-Dimensional framework

3. **BSFC (Brake Specific Fuel Consumption)**
   - Heywood, J.B. (1988). "Internal Combustion Engine Fundamentals"
   - Valores típicos por era tecnológica

4. **Precisão do Modelo**
   - STPS + COPERT: ~88.6% de precisão (Kan et al., 2018)
   - Física veicular: ~92-95% com dados de transmissão completos

---

_Documento atualizado - Versão 3.0 (Modelo Híbrido com Previsão de Marcha)_
_Data: Abril 2026_
