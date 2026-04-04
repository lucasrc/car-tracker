# Glossário

Termos técnicos usados no código e documentação, com explicações curtas.

---

## Modelos e Algoritmos

| Termo         | Significado                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **COPERT**    | Modelo europeu de emissões veiculares. Estima consumo de combustível baseado na velocidade.                                                |
| **STPS**      | Space-Time Path Segmentation. Classifica atividade do veículo: "MA" (moving), "SA_ENGINE_ON" (parado ligado), "SA_ENGINE_OFF" (desligado). |
| **HMM**       | Hidden Markov Model. Usado para matching de posição com geometria de vias do OSM.                                                          |
| **Vincenty**  | Fórmula geodésica de alta precisão. Calcula distância entre duas coordenadas considerando a Terra como elipsóide WGS84.                    |
| **Haversine** | Fórmula mais simples para distância entre coordenadas. Usada como fallback quando Vincenty falha (pontos antipodais).                      |
| **WGS84**     | Sistema de coordenadas geográficas padrão (GPS). Terra modelada como elipsóide.                                                            |

---

## Tipos de Dados

| Tipo             | Estrutura                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Coordinates**  | `{ lat, lng, timestamp, accuracy?, speed? }`                                                                     |
| **Trip**         | `{ id, startTime, endTime, path[], distanceMeters, maxSpeed, avgSpeed, consumption, fuelUsed, stops[], status }` |
| **ActivityType** | `"MA"` (moving), `"SA_ENGINE_ON"` (parado ligado), `"SA_ENGINE_OFF"` (desligado)                                 |
| **DriveMode**    | `"city"` ou `"highway"`                                                                                          |
| **FuelType**     | `"gasolina"`, `"etanol"`, `"flex"`                                                                               |
| **TripStatus**   | `"idle"`, `"recording"`, `"paused"`, `"completed"`                                                               |

---

## Métricas

| Métrica              | Descrição                                                   |
| -------------------- | ----------------------------------------------------------- |
| **km/l**             | Quilômetros por litro — consumo do veículo                  |
| **L/100km**          | Litros por 100 km — forma inversa de expressar consumo      |
| **speedFactor**      | Penalidade por velocidade acima de 90 km/h                  |
| **aggressionFactor** | Penalidade por aceleração > 1.5 m/s²                        |
| **idleFactor**       | Penalidade por tempo parado com motor ligado                |
| **stabilityFactor**  | Penalidade por variação de velocidade (dirigir instability) |

---

## Conceitos de Interface

| Conceito                | Descrição                                                                      |
| ----------------------- | ------------------------------------------------------------------------------ |
| **Autonomia**           | Quantos km faltam para o combustível acabar, dado o consumo atual              |
| **Consumo instantâneo** | km/l calculado em tempo real com base no comportamento atual                   |
| **Consumo médio**       | km/l total da viagem (distância / combustível usado)                           |
| **Parada**              | Período com velocidade < 3.6 km/h por mais de 5 segundos                       |
| **Speeding event**      | Registro de passagem por radar acima do limite                                 |
| **Histerese**           | Tempo de espera (10s) antes de mudar modo cidade/rodovia para evitar flutuação |

---

## Termos de Custo e Combustivel

| Termo                          | Significado                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| **FIFO**                       | First-In-First-Out: modelo onde o combustivel mais antigo é consumido primeiro      |
| **Fuel Batch**                 | Lote de combustivel: registro de um abastecimento individual com preco e quantidade |
| **Custo Real (actualCost)**    | Custo calculado via FIFO ao final da viagem                                         |
| **Custo Estimado (totalCost)** | Custo calculado em tempo real usando preco medio ponderado                          |
| **Preco Medio Ponderado**      | Media de precos pesada pela quantidade de cada lote                                 |
| **Consumo por Lote**           | Quantidade consumida de cada batch no calculo FIFO                                  |

---

## Siglas

| Sigla     | Significado                                          |
| --------- | ---------------------------------------------------- |
| **GPS**   | Global Positioning System                            |
| **OSM**   | OpenStreetMap                                        |
| **PWA**   | Progressive Web App                                  |
| **OBD2**  | On-Board Diagnostics (porta de diagnóstico veicular) |
| **Dexie** | Wrapper IndexedDB (banco de dados do navegador)      |
| **WGS**   | World Geodetic System                                |
