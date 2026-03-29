# Regras de Negocio - Sistema de Monitoramento de Combustivel

## Visao Geral

Este documento descreve os algoritmos e parametros utilizados para calculo automatico de penalidades de consumo de combustivel. O sistema detecta automaticamente comportamentos de direcao que aumentam o consumo sem necessidade de entrada manual de dados.

## Penalidades Implementadas

### 1. Excesso de Velocidade

**Regra**: Quando a velocidade media da viagem ultrapassa 90 km/h, uma penalidade progressiva e aplicada.

**Parametros**:

- Limiar: 90 km/h
- Penalidade: 0.8% por km/h acima do limite

**Fundamentacao Cientifica**:

- Oak Ridge National Laboratory (ORNL, 2013) - "Fuel Efficiency of Automobile and Truck Fuels" - Confirmou que o consumo aumenta significativamente acima de 80-90 km/h devido a resistencia do ar
- O limite de 90 km/h e conservativo e apropriado para condicoes brasileiras de rodovia

**Calculo**:

```
se (velocidadeMedia > 90):
    velocidadeAcima = velocidadeMedia - 90
    penalidadeVelocidade = velocidadeAcima * 0.8%
```

---

### 2. Tempo Ocioso (Idle)

**Rega**: Quando o veiculo permanece parado por mais de 30 segundos consecutivas, e considerada situacao de ociosidade.

**Parametros**:

- Limiar: velocidade < 1 m/s (~3.6 km/h)
- Janela minima: 30 segundos
- Penalidade: 30% de aumento no consumo estimado

**Fundamentacao Cientifica**:

- CarXplorer (2026) - Estudo de consumo em marcha lenta: veiculos compactos consomem 0.6-0.95 L/h em marcha lenta
- A penalidade de 30% e compensatoria e conservadora para o custo real de ociosidade

**Calculo**:

```
se (velocidade < 1 m/s por > 30 segundos):
    penalidadeOciosidade = 30%
```

---

### 3. Aceleracoes Bruscas

**Regra**: Detectadas quando a aceleracao longitudinal ultrapassa limites definidos.

**Parametros**:

- Aceleracao severa: > 2.5 m/s² = +15%
- Aceleracao moderada: > 1.5 m/s² = +8%

**Fundamentacao Cientifica**:

- ScienceDirect (2021) - "Energy Consumption Analysis of Electric Vehicles" - Cada aumento de 0.1 m/s² na aceleracao resulta em +0.15 J/(kg·m) de energia
- Os limites utilizados sao conservadores mas validos para o contexto de direcao urbana

**Calculo**:

```
se (aceleracao > 2.5):
    penalidadeAceleracao = 15%
senao se (aceleracao > 1.5):
    penalidadeAceleracao = 8%
```

---

### 4. Irregularidade na Diregibilidade

**Regra**: Baseada na variancia da velocidade ao longo do tempo.

**Parametros**:

- Penalidade: variancia × 10%

**Fundamentacao Cientifica**:

- Direcao instavel (aceleracao e frenagem constantes) e reconhecidamente menos eficiente
- O fator 10x e um multiplicador de impacto para converter variancia em penalidade

**Calculo**:

```
variancia = variancia(velocidades)
penalidadeEstabilidade = variancia * 10%
```

---

## Calculo de Custo

### Formula Principal

1. **Consumo Base**: `combustivelBase = distancia / kmPorLitro`

2. **Consumo Ajustado**: `kmPorLitroAjustado = kmPorLitro / (1 + penalidadeTotal)`

3. **Combustivel Extra**: `combustivelExtra = combustivelTotal - combustivelBase`

4. **Custo Extra**: `custoExtra = combustivelExtra * precoCombustivel`

### Distribuicao de Penalidades

Quando o custo extra e calculado, ele e distribuido proporcionalmente entre as penalidades ativas:

```
para cada penalidade:
    custoPenalidade = (porcentagemPenalidade / totalPenalidades) * custoExtra
```

---

## Referencias

1. **Oak Ridge National Laboratory (ORNL)** - "Fuel Efficiency of Automobile and Truck Fuels" (2013)
   - URL: https://www.energy.gov/eere/vehicles/fact-861-february-23-2015-fuel-efficiency-automobile-and-truck-fuels

2. **ScienceDirect (2021)** - "Energy Consumption Analysis of Electric Vehicles"
   - URL: https://www.sciencedirect.com/science/article/abs/pii/S2210670720307759

3. **CarXplorer (2026)** - "Idle Fuel Consumption Study"
   - URL: https://www.carxplorer.io/studies/idle-consumption-2026

---

## Thresholds Resumidos

| Parametro                      | Valor | Unit        |
| ------------------------------ | ----- | ----------- |
| Limiar Velocidade              | 90    | km/h        |
| Penalidade por km/h acima      | 0.8   | %           |
| Limiar Velocidade Idle         | 1     | m/s         |
| Tempo Minimo Idle              | 30    | segundos    |
| Penalidade Idle                | 30    | %           |
| Aceleracao Severa              | 2.5   | m/s²        |
| Aceleracao Moderada            | 1.5   | m/s²        |
| Penalidade Aceleracao Severa   | 15    | %           |
| Penalidade Aceleracao Moderada | 8     | %           |
| Fator Estabilidade             | 10    | x variancia |

---

_Documento gerado automaticamente - Versao 1.0_
_Data: Marte 2026_
