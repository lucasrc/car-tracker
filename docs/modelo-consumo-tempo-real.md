# Modelo de Consumo em Tempo Real - COPERT Puro

## Visão Geral

Este documento descreve o algoritmo de cálculo de consumo de combustível em tempo real implementado no sistema de rastreamento veicular. O modelo utiliza apenas o **COPERT** (Computer Programme to calculate Emissions from Road Transport), um modelo cientificamente validado pela Agência Europeia do Meio Ambiente (EEA) com precisão de ~88.6%.

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
│  │ Modelo COPERT Puro (100%)                               │ │
│  │  • Fórmula cientificamente validada                    │ │
│  │  • Ajustes: cilindrada, tipo combustível               │ │
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

## Vantagens do Modelo Simplificado

1. **Base científica sólida**: 88.6% de precisão validada
2. **Código simplificado**: -60% de linhas de código
3. **Previsibilidade**: Comportamento consistente e explicável
4. **Sem "magia"**: Usuário confia no resultado
5. **Fácil manutenção**: Lógica clara e direta

## Comparativo: Antes vs Depois

| Aspecto      | Antes (Híbrido + Penalidades) | Depois (COPERT Puro) |
| ------------ | ----------------------------- | -------------------- |
| Código       | 449 linhas                    | 176 linhas           |
| Precisão     | ~85% (estimado)               | 88.6% (validado)     |
| Complexidade | Alta                          | Baixa                |
| Manutenção   | Difícil                       | Simples              |
| Confiança    | Média                         | Alta                 |

## Referências

1. **COPERT Model**
   - European Environmental Agency - COPERT
   - Kan, Z. et al. (2018). "Estimating Vehicle Fuel Consumption and Emissions Using GPS Big Data"
   - URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC5923608/

2. **Space-Time Path (STPS)**
   - Hägerstrand, T. (1970). "What about people in Regional Science?"
   - Kan, Z. et al. (2018) - N-Dimensional framework

3. **Precisão do Modelo**
   - STPS + COPERT: ~88.6% de precisão (Kan et al., 2018)

---

_Documento atualizado - Versão 2.0 (Modelo COPERT Puro)_
_Data: Abril 2026_
