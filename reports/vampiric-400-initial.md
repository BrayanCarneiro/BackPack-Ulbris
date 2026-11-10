# Peitoral Vampírico — 400 lutas

Resultado: **116 vitórias, 284 derrotas e 0 empates**; win rate de **29%**.

## Método

Motor Combat atual, sem alterar atributos. Quatro adversários, 100 sementes independentes por adversário; 50 lutas em cada lado. Todos os conjuntos custam 70 de ouro, incluindo duas Mochilas viajantes, e cabem legalmente numa área de 8×4. Itens de fusão têm o valor de seus ingredientes. Não simula encontrar ofertas, comprar ou sobreviver até completar as fusões.

12.000 tentativas de organização por conjunto; seleção por estrelas ativas, sem usar resultados de combate. A build e os adversários foram fixados antes das 400 lutas.

## Build Vampírica

Vida: 38; armadura: 25; resistência: 2; estamina: 4.4.

| Item | Ouro | Posição (coluna, linha) | Orientação |
|---|---:|---|---:|
| Peitoral Vampírico | 18 | (1, 2) | 180° |
| Elmo de ferro | 7 | (1, 1) | 270° |
| Escudo de ferro | 7 | (5, 1) | 180° |
| Adagas flamejantes | 6 | (5, 4) | 270° |
| Espada de ferro | 6 | (8, 2) | 0° |
| Pedra da celeridade | 4 | (7, 4) | 0° |
| Pedra de amolar | 3 | (5, 3) | 90° |
| Poção de regeneração | 4 | (2, 1) | 90° |
| Poção de vigor | 3 | (7, 3) | 90° |
| Cristal vital | 4 | (7, 2) | 180° |
| 2 Mochilas viajantes | 8 | Colunas 1–4 e 5–8, linhas 1–4 | 0° |

### Estrelas da build

- Pedra da celeridade: Adagas flamejantes, Espada de ferro.
- Pedra de amolar: Escudo de ferro, Adagas flamejantes.

## Resultados por adversário

| Adversário | V | D | E | Win rate | Duração média | Cura Vampírica média |
|---|---:|---:|---:|---:|---:|---:|
| Queimadura e armadura | 0 | 100 | 0 | 0% | 47,82 s | 1,56 |
| Fortaleza de ferro | 0 | 100 | 0 | 0% | 50,76 s | 1,54 |
| Machados, fogo e estamina | 63 | 37 | 0 | 63% | 37,63 s | 1,29 |
| Três espadas de ferro | 53 | 47 | 0 | 53% | 36,81 s | 1,4 |

Duração média geral: 43,26 s. Cura média do Peitoral Vampírico: 1,45 de vida; cura total média: 14,6. 12/400 lutas chegaram à fadiga.

## Adversários

### Queimadura e armadura

Vida 38; armadura 26; resistência 2; estamina 4.4.

- 2× Adagas flamejantes
- 1× Armadura de ferro
- 1× Elmo de ferro
- 1× Escudo de ferro
- 1× Pedra da celeridade
- 1× Pedra de amolar
- 1× Poção de regeneração
- 1× Poção de vigor
- 2× Cristal vital
- 1× Ferro refinado

- Estrelas de Armadura de ferro: Escudo de ferro.
- Estrelas de Pedra da celeridade: Adagas flamejantes, Adagas flamejantes.
- Estrelas de Pedra de amolar: Adagas flamejantes, Adagas flamejantes.
- Estrelas de Ferro refinado: Armadura de ferro.

### Fortaleza de ferro

Vida 34; armadura 35; resistência 2; estamina 4.4.

- 1× Armadura de ferro
- 1× Elmo de ferro
- 2× Escudo de ferro
- 2× Espada de ferro
- 1× Pedra da celeridade
- 1× Poção de regeneração
- 1× Poção de proteção
- 1× Poção de vigor
- 1× Cristal vital

- Estrelas de Armadura de ferro: Elmo de ferro, Escudo de ferro.
- Estrelas de Pedra da celeridade: Espada de ferro, Espada de ferro.

### Machados, fogo e estamina

Vida 34; armadura 15; resistência 0; estamina 6.4.

- 2× Machado de batalha
- 1× Elmo de ferro
- 1× Escudo de ferro
- 1× Pedra da celeridade
- 2× Pedra de amolar
- 1× Poção de regeneração
- 2× Poção de vigor
- 2× Cristal energético
- 1× Poção de proteção
- 1× Cristal vital
- 1× Pedra de fogo

- Estrelas de Pedra da celeridade: Machado de batalha, Machado de batalha.
- Estrelas de Pedra de amolar: Machado de batalha, Machado de batalha.
- Estrelas de Pedra de amolar: Machado de batalha, Cristal energético.
- Estrelas de Pedra de fogo: Poção de proteção.

### Três espadas de ferro

Vida 34; armadura 15; resistência 0; estamina 4.4.

- 3× Espada de ferro
- 1× Elmo de ferro
- 1× Escudo de ferro
- 1× Pedra da celeridade
- 2× Pedra de amolar
- 1× Poção de regeneração
- 2× Poção de vigor
- 1× Poção de proteção
- 1× Cristal vital
- 1× Pedra de fogo

- Estrelas de Pedra da celeridade: Espada de ferro.
- Estrelas de Pedra de amolar: Espada de ferro, Espada de ferro.
- Estrelas de Pedra de amolar: Espada de ferro, Espada de ferro.
- Estrelas de Pedra de fogo: Espada de ferro.

## Limites e reprodução

A taxa vale para estes quatro adversários com pesos iguais. Não é taxa de vitória de jogadores ou da jornada, nem comprova que esta é a melhor build. A cura observada não mede quantas vitórias o efeito causou; seria necessário outro experimento removendo apenas a cura. O intervalo de Wilson no JSON resume incerteza sob a mistura testada, sem cobrir outras composições ou a escolha dos adversários.

`node scripts/simulate-vampiric.mjs`

Coordenadas, rotações, atributos, sementes e resultados individuais deste lote diagnóstico: `reports/vampiric-400-initial.json`.
