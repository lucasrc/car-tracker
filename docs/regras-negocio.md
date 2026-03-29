# Regras de Negocio - Sistema de Monitoramento de Combustivel

## Visao Geral

Este documento descreve os algoritmos e parametros utilizados para calculo automatico de penalidades de consumo de combustivel. O sistema detecta automaticamente comportamentos de direcao que aumentam o consumo sem necessidade de entrada manual de dados.

## Penalidades Implementadas

### 1. Excesso de Velocidade

**Regra**: Quando a velocidade media da viagem ultrapassa 90 km/h, uma penalidade progressiva e aplicada.

**Parametros**:

- Limiar: 90 km/h
- Penalidade: 0.9% por km/h acima do limite

**Fundamentacao Cientifica**:

- Oak Ridge National Laboratory (ORNL, 2013) - "Fuel Efficiency of Automobile and Truck Fuels" - Confirmou que o consumo aumenta significativamente acima de 80-90 km/h devido a resistencia do ar
- DOE Fact #773 (2013): 13-15% a mais por 16 km/h (70→80 mph) = ~0.8-0.9%/km
- DOE Fact #982 (2017): 14% a mais de 60→70 mph = ~0.7%/km

**Calculo**:

```
se (velocidadeMedia > 90):
    velocidadeAcima = velocidadeMedia - 90
    penalidadeVelocidade = velocidadeAcima * 0.9%
```

---

### 2. Tempo Ocioso (Idle)

**Regra**: Quando o veiculo permanece parado, e considerada situacao de ociosidade. A penalidade e aplicada proporcional ao tempo de ociosidade.

**Parametros**:

- Limiar: velocidade < 1 m/s (~3.6 km/h)
- Tempo minimo para ativar: 10 segundos
- Penalidade: 8% de aumento no consumo (proporcional ao tempo ocioso)

**Fundamentacao Cientifica**:

- DOE Fact #861 (2015): veiculos compactos consomem 0.16-0.17 gal/h = 0.6-0.65 L/h em marcha lenta
- Para um tanque de 50L, 1 hora de idle = ~1.2-1.3% do tanque
- A penalidade de 8% e aplicada proporcionalmente ao tempo ocioso

**Calculo**:

```
percentualOcioso = tempoOcioso / tempoTotalViagem
penalidadeEfetiva = percentualOcioso * 8%
```

---

### 3. Aceleracoes Bruscas

**Regra**: Detectadas quando a aceleracao longitudinal ultrapassa limites definidos.

**Parametros**:

- Aceleracao severa: > 2.5 m/s² = +10%
- Aceleracao moderada: > 1.5 m/s² = +6%

**Fundamentacao Cientifica**:

- ORNL (2017): 10-40% a mais em stop-and-go, 15-30% em highway para conducao agressiva COMBINADA (aceleracao + frenagem)
- Separando apenas a componente de aceleracao, os valores sao menores
- A aceleracao severa (>2.5 m/s²) adiciona 10%, moderada (>1.5 m/s²) adiciona 6%

**Calculo**:

```
se (aceleracao > 2.5):
    penalidadeAceleracao = 10%
senao se (aceleracao > 1.5):
    penalidadeAceleracao = 6%
```

---

### 4. Irregularidade na Diregibilidade

**Regra**: Baseada na variancia da velocidade ao longo do tempo.

**Parametros**:

- Penalidade: (variancia / 100) × 5%

**Fundamentacao Cientifica**:

- Direcao instavel (aceleracao e frenagem constantes) e reconhecidamente menos eficiente
- JRC (2022): 5% de diferenca entre melhor e pior driver vs WLTC

**Calculo**:

```
variancia = variancia(velocidades)
penalidadeEstabilidade = (variancia / 100) * 5%
```

---

## Ponderacao por Tempo

**Importante**: As penalidades sao aplicadas proporcionalmente ao tempo em que cada comportamento ocorre. Se o usuario ficou 10 minutos acima de 90 km/h em uma viagem de 1 hora, apenas ~16.6% da distancia recebera a penalidade de velocidade, nao a viagem inteira.

**Formula de Ponderacao**:

```
penalidadeEfetiva = (tempoComPenalidade / tempoTotal) * penalidadePercentual
```

---

## Calculo de Custo

### Formula Principal

1. **Consumo Base**: `combustivelBase = distancia / kmPorLitro`

2. **Penalidade Efetiva**: `penalidadeTotal = penalidadeVelocidade + penalidadeAceleracao + penalidadeIdle + penalidadeEstabilidade`

3. **Consumo Ajustado**: `kmPorLitroAjustado = kmPorLitro / (1 + penalidadeTotal / 100)`

4. **Combustivel Total**: `combustivelTotal = distancia / kmPorLitroAjustado`

5. **Combustivel Extra**: `combustivelExtra = combustivelTotal - combustivelBase`

6. **Custo Extra**: `custoExtra = combustivelExtra * precoCombustivel`

---

## Referencias

1. **Oak Ridge National Laboratory (ORNL)** - "Fuel Efficiency of Automobile and Truck Fuels" (2013)
   - URL: https://www.energy.gov/eere/vehicles/fact-861-february-23-2015-fuel-efficiency-automobile-and-truck-fuels

2. **DOE Fact #773 (2013)** - Fuel Economy Penalty at Higher Speeds
   - URL: https://energy.gov/cmei/vehicles/fact-773-april-1-2013-fuel-economy-penalty-higher-speeds

3. **DOE Fact #982 (2017)** - Slow Down to Save Fuel
   - URL: https://www.energy.gov/eere/vehicles/fact-982-june-19-2017-slow-down-save-fuel-fuel-economy-decreases-about-14-when

4. **DOE Fact #861 (2015)** - Idle Fuel Consumption for Selected Vehicles
   - URL: https://www.energy.gov/cmei/vehicles/fact-861-february-23-2015-idle-fuel-consumption-selected-gasoline-and-diesel-vehicles

5. **ORNL (2017)** - "Sensible driving saves more gas than drivers think"
   - URL: https://www.ornl.gov/news/sensible-driving-saves-more-gas-drivers-think

6. **JRC (2022)** - "Benchmarking the driver acceleration impact on vehicle energy consumption and CO2 emissions"
   - URL: https://www.sciencedirect.com/science/article/pii/S2210670722003282

---

## Thresholds Resumidos

| Parametro                      | Valor | Unit        |
| ------------------------------ | ----- | ----------- |
| Limiar Velocidade              | 90    | km/h        |
| Penalidade por km/h acima      | 0.9   | %           |
| Limiar Velocidade Idle         | 1     | m/s         |
| Tempo Minimo Penalidade        | 10    | segundos    |
| Penalidade Idle                | 8     | %           |
| Aceleracao Severa              | 2.5   | m/s²        |
| Aceleracao Moderada            | 1.5   | m/s²        |
| Penalidade Aceleracao Severa   | 10    | %           |
| Penalidade Aceleracao Moderada | 6     | %           |
| Fator Estabilidade             | 5     | x variancia |

---

_Documento gerado automaticamente - Versao 2.0_
_Data: Marte 2026_
