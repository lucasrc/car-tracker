# Modelo de Consumo em Tempo Real - STPS + COPERT

## Visão Geral

Este documento descreve o algoritmo de cálculo de consumo de combustível em tempo real implementado no sistema de rastreamento veicular. O modelo combina o **Space-Time Path (STPS)** com o modelo **COPERT** para estimativas precisas de consumo.

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
│                  useConsumptionModel.ts                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Cálculo Híbrido                                         │ │
│  │  • COPERT (60%): Modelo científico                     │ │
│  │  • Modelo atual (40%): Fatores de condução             │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Modelos de Consumo

### 1. COPERT (Mobile Activity)

O modelo COPERT é usado quando o veículo está em movimento (MA).

**Fórmula:**

```
FC = (217 + 0.253V + 0.00965V²) / (1 + 0.096V − 0.000421V²)
```

Onde:

- FC = Fuel Consumption (g/km)
- V = Velocidade média (km/h)

**Conversão para km/l:**

```
kmPorLitro = 100 / FC
```

**Referência:**

- Kan, Z. et al. (2018). "Estimating Vehicle Fuel Consumption and Emissions Using GPS Big Data" - PMC5923608
- Estudo validado com precisão de ~88.6%

### 2. 4-Mode Elemental (Ociosidade)

O modelo 4-mode é usado quando o veículo está parado com motor ligado (SA_ENGINE_ON).

**Fórmula:**

```
FCSA = 0.361 × T
```

Onde:

- FCSA = Fuel Consumption (ml)
- T = Tempo de ociosidade (segundos)

**Consumo em marcha lenta:** ~0.361 ml/s ≈ 1.3 L/h

**Nota:** Este modelo é aplicado **sempre** quando o veículo está parado, assumindo motor ligado. Isso é uma abordagem conservadora que evita superestimar a autonomia.

### 3. Cálculo Híbrido

O sistema combina os dois modelos para maior estabilidade:

```
kmPorLitroFinal = 0.6 × kmCOPERT + 0.4 × kmModeloAtual
```

**Justificativa:**

- COPERT é scientificamente validado
- Modelo atual considera fatores específicos de condução (aceleração, estabilidade)
- A combinação suaviza variações e fornece estimativas mais estáveis

## Classificação de Atividades (STPS)

| Tipo                     | Condição           | Consumo           |
| ------------------------ | ------------------ | ----------------- |
| **MA** (Mobile Activity) | velocidade > 1 m/s | COPERT            |
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

## Tipos de Atividade

```typescript
type ActivityType = "MA" | "SA_ENGINE_ON" | "SA_ENGINE_OFF";
```

**Nota:** `SA_ENGINE_OFF` está reservado para futuras implementações com OBD.

## Fatores de Condução (Modelo Atual)

Além do COPERT, o sistema também considera:

### Penalidades

| Fator                | Condição       | Valor         |
| -------------------- | -------------- | ------------- |
| Velocidade           | > 90 km/h      | +0.9%/km/h    |
| Aceleração agressiva | > 2.5 m/s²     | +10%          |
| Aceleração moderada  | > 1.5 m/s²     | +6%           |
| Ociosidade           | tempo parado   | +8%           |
| Instabilidade        | variância > 15 | +5%/variância |

### Bônus

| Fator            | Condição         | Valor |
| ---------------- | ---------------- | ----- |
| Velocidade ideal | 60-80 km/h       | +5%   |
| Aceleração suave | < 0.5 m/s²       | +4%   |
| Coasting         | -0.3 a -2.0 m/s² | +3%   |
| Estabilidade     | variância < 15   | +3%   |
| Zero ociosidade  | 0% tempo parado  | +3%   |

## Exemplo de Cálculo

### Cenário: Viagem urbana com trânsito

1. **Primeiros 5 min** (MA, 40 km/h):
   - COPERT: ~14 km/l
   - Modelo atual: ~12 km/l
   - **Híbrido**: 0.6 × 14 + 0.4 × 12 = **12.8 km/l**

2. **Parado em semáforo** (SA_ENGINE_ON, 30s):
   - 4-mode: 0.361 ml/s × 30s = 10.83 ml
   - Distância: 0 km
   - **Não afeta km/l diretamente**

3. **Autonomia estimada**:
   - Tank: 50 L
   - Consumo médio: 12.8 km/l
   - **Autonomia: 640 km**

## Referências

1. **COPERT Model**
   - European Environmental Agency - COPERT
   - Kan, Z. et al. (2018). "Estimating Vehicle Fuel Consumption and Emissions Using GPS Big Data"
   - URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC5923608/

2. **Space-Time Path (STPS)**
   - Hägerstrand, T. (1970). "What about people in Regional Science?"
   - Kan, Z. et al. (2018) - N-Dimensional framework

3. **4-Mode Elemental Model**
   - Estimativa baseada em DOE Fact #861
   - Idle consumption: 0.6-0.65 L/h para veículos compactos

4. **Precisão do Modelo**
   - STPS + COPERT: ~88.6% de precisão (Kan et al., 2018)
   - Modelo híbrido atual: ~85% (estimado)

---

_Documento gerado automaticamente - Versão 1.0_
_Data: Março 2026_
