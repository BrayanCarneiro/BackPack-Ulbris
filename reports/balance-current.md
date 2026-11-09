# IA rebalanceada — 08/11/2026

## Atualização: fila de armas corrigida

Armas prontas agora recebem estamina pela ordem em que terminaram a recarga.
Uma arma mais barata não ultrapassa a que está esperando. Isso corrige a terceira
espada atacar duas vezes e depois parar indefinidamente, mantendo custos,
regeneração, recargas e a mesma regra para os dois lados.

Após a correção, uma nova bateria de **900 jornadas**, com outras sementes
(`npm run simulate:balance -- 300 2`), produziu:

| Habilidade simulada | Vitórias em 300 jornadas |
|---|---:|
| Iniciante | 101 (33,67%) |
| Intermediário | 205 (68,33%) |
| Avançado | 275 (91,67%) |

Dados atuais: `balance-calibrated-300-2.json` e os registros completos em
`balance-calibrated-300-2.json.gz`. Foram 7.366 combates de progressão e mais
7.366 com lados invertidos. Não houve novo ajuste de atributos ou de dificuldade.
As sementes diferem das baterias anteriores; a comparação não isola o efeito
da fila sobre a taxa de vitórias.

**100 testes passaram**, incluindo regressões com três espadas de treino,
três espadas de ferro, custos diferentes, conservação de estamina, recargas,
ambos os lados e independência do tamanho dos frames. O build passou e o
servidor local foi verificado servindo o módulo de combate atualizado.

## Histórico do rebalanceamento antes da correção da fila

A IA agora compra pelas ofertas reais e mantém o inventário. Em duas baterias
de 300 jornadas por habilidade, o comprador avançado concluiu 270 e 277 jornadas.

| Habilidade simulada | Meta sugerida / 300 | Bateria 0 | Bateria 1, outras sementes |
|---|---:|---:|---:|
| Iniciante | ~100 | 111 (37%) | 98 (32,67%) |
| Intermediário | 150–200 | 206 (68,67%) | 204 (68%) |
| Avançado | 250–280 | 270 (90%) | 277 (92,33%) |

O iniciante ficou perto da meta e o avançado dentro da faixa nas duas baterias.
O intermediário ficou um pouco acima do teto sugerido: 4–6 jornadas a mais.
Essas são políticas automatizadas, não uma previsão exata de desempenho humano.
As políticas não consultam o rival nem procuram resultados favoráveis em combate.

## O que mudou no jogo

- O planejador deixou de selecionar itens do catálogo completo ou de testar
  combinações em combate para escolher a mais forte.
- Rivais usam `ShoppingSession`: 14 de ouro iniciais, seis ofertas, preços,
  renda, renovação paga e inventário persistente iguais aos do jogador.
- Equipamentos evoluídos precisam de ingredientes em estrelas e de uma batalha
  completa anterior. Não existem compras diretas de espadas ou escudos de ferro.
- Os rivais só procuram ferro e segunda arma a partir da rodada 3. Limitam
  compras a 13 de ouro iniciais e à renda de cada rodada, com uma renovação
  no máximo. O ouro não utilizado permanece no saldo.
- Perfis Viajante, Duelista e Sentinela seguem prioridades de equilíbrio,
  ataque e defesa. Existem 32 grupos de históricos; cada jornada sorteia um,
  mantendo o rival da mesma rodada estável, sem reagir à mochila do jogador.
- Atributos, dano, vida, estamina, bloqueio, cura e probabilidades são os mesmos
  para jogador e rival. A campanha continua com 8 vitórias e 4 vidas.

Os históricos dos NPCs são treinos independentes, com lutas espelhadas reais
para processar fusões e renda. Eles não são campanhas eliminatórias com vidas.
Esse modo de treino não é utilizado pela campanha do jogador. O resultado do
treino nunca é usado para selecionar ou descartar uma mochila mais fraca.

## Método e evidências

Foram **1.800 jornadas completas**, 600 por habilidade, sem vidas extras,
ouro gratuito ou vitórias forçadas. Cada jornada termina naturalmente ao atingir
8 vitórias ou perder as 4 vidas. As duas baterias usam as mesmas políticas e
o mesmo conjunto de 32 grupos de rivais, com sementes diferentes para lojas e
combates do jogador. A segunda foi executada sem novos ajustes de dificuldade.

- Iniciante compra um conjunto básico, privilegia armas e atributos imediatos,
  pode empilhar três armas e não otimiza estrelas.
- Intermediário usa estrelas e fusões, limita-se a duas armas e reorganiza
  uma vez por loja; privilegia bônus de ataque e faz até uma renovação.
- Avançado prioriza fusões, defesa e cura, considera a pressão de estamina,
  reorganiza para cada compra e deixa espaço para suportes atingirem duas armas.
  Pode renovar até cinco vezes, sempre pagando e usando apenas o próprio ouro.

Houve **14.738 combates de progressão**, todos repetidos com lados invertidos:
**29.476 combates ao todo**. As repetições são diagnósticas e não concedem
vitórias, fusões ou renda às jornadas.

| Bateria | Perfil | Combates | Vitórias | Derrotas | Empates | Vitórias com lados invertidos |
|---|---|---:|---:|---:|---:|---:|
| 0 | Iniciante | 2.176 | 1.168 | 790 | 218 | 1.166 |
| 0 | Intermediário | 2.532 | 1.798 | 574 | 160 | 1.772 |
| 0 | Avançado | 2.684 | 2.220 | 370 | 94 | 2.216 |
| 1 | Iniciante | 2.093 | 1.080 | 803 | 210 | 1.101 |
| 1 | Intermediário | 2.562 | 1.803 | 581 | 178 | 1.808 |
| 1 | Avançado | 2.691 | 2.256 | 346 | 89 | 2.265 |

Trocar os lados redistribui os sorteios de uma sequência aleatória compartilhada;
não é esperado obter o mesmo resultado em cada luta. Os totais próximos não
indicam uma grande vantagem de um dos lados neste teste.

As etapas início (1–3), meio (4–7) e fim (8–11), além dos resultados por rodada,
estão nos resumos JSON. As taxas do fim descrevem somente os sobreviventes;
não são amostras independentes nem equivalem à taxa de vitória da jornada.

O teste original venceu 18/300 jornadas com três estratégias diferentes das
atuais. Ele comprova que existia um gargalo, mas não é uma comparação controlada
da melhoria, pois também aperfeiçoamos os compradores. O histórico antigo foi
preservado em [balance-300.md](balance-300.md).

## Reproduzir

```sh
npm run simulate:balance
npm run simulate:balance -- 300 1
npm test
npm run build
```

No PowerShell, use `npm.cmd` se o script `npm.ps1` estiver bloqueado.
Cada simulação grava um resumo `balance-calibrated-300-N.json` e as transações,
mochilas, resultados, fusões e sementes completos em `balance-calibrated-300-N.json.gz`.
Os arquivos `.gz` contêm JSON compactado, sem perda de dados.

**Validação:** 96 testes passaram. A auditoria reconstrói as compras, posições,
ofertas, custos, saldos, treinos e fusões dos três perfis em todos os 32 grupos.
O build de produção passou, mantendo o aviso já existente de tamanho do pacote
do Phaser. Não foi realizada uma nova bateria de interação no navegador.
