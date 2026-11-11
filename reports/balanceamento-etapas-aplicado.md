# Ajuste de armas e defesas por etapas

## Parâmetros aplicados

| Item | Antes | Aplicado |
| --- | --- | --- |
| Arco: estamina por ataque | 1,4 | 2 |
| Machado de batalha: estamina por ataque | 2,5 | 2 |
| Espada de ferro: estamina por ataque | 1,5 | 1,8 |
| Escudo de ferro: chance de bloqueio | 45% | 40% |
| Armadura de ferro: armadura por peça nas estrelas a cada 5,9 s | 4 | 3 |
| Pedra de fogo: chance concedida por estrela | 5% | 10% |
| Peitoral Vampírico: cura sobre dano à vida | 10% | 20% |

As mudanças usam a abordagem observada nos anúncios oficiais do
[Backpack Battles](https://steamcommunity.com/app/2427700/announcements/): ajustes
de consumo de estamina, proteção e efeitos. Os patches 1.1.8 e 1.1.7 incluem,
respectivamente, alteração no consumo da Busted Blade e redução de proteção da
Gold Armor. Isso é referência de abordagem; os números aplicados ao Ulbris
foram escolhidos nas simulações do próprio jogo, não copiados como equivalentes.

Os cinco cristais de cores, poções, preços, receitas, formatos, renda e
regeneração base foram preservados. Fichas do jogo leem os mesmos parâmetros
do combate; README e referência de itens foram sincronizados.

## Seleção de candidatos

A bateria de seleção executou 19.800 lutas e a de refinamento 16.200. Elas
compararam candidatos isolados e combinações. Uma primeira validação do
conjunto, ainda com cura vampírica de 15%, executou 7.200 lutas. Depois foi
adotada cura de 20% e usada outra bateria de sementes para a comparação final.
Resultados exploratórios não são somados para calcular as taxas finais.

Reduzir o dano do arco enfraquecia também seu uso isolado. Aumentar o custo de
estamina mantém a cadência de um arco e exige mais suporte ao usar dois.
Nerfar somente a geração de armadura chegou a aumentar a taxa relativa da
Fortaleza, por prejudicar também sua rival de fogo. Isso motivou um ajuste
combinado de geração, bloqueio e consumo de armas. Não foi estabelecido que
cada componente dessa combinação seja individualmente necessário ou ótimo.

## Comparação final com sementes novas

Foram **7.200 combates completos**: 3.600 antes e 3.600 com os valores aplicados.
Cada variante contém 1.000 lutas por fase e 600 no painel controlado de armas.
No painel por fase, cada build disputa 400 lutas: 100 contra cada adversário,
metade de cada lado. As mesmas sementes são usadas antes/depois para comparar
as variantes; essas repetições não são observações independentes.

| Build observada | Antes | Aplicado |
| --- | ---: | ---: |
| Adaga e Pedra de fogo, início | 4,75% | 13,25% |
| Dois arcos, meio | 99% | 83% |
| Dois machados e estamina, meio | 23% | 50% |
| Fortaleza de ferro, fim | 95,25% | 88,5% |
| Machados e cristais defensivos, fim | 8,5% | 27,5% |
| Dourado e duas flamejantes, fim | 36,5% | 34,75% |
| Vampírico equilibrado, fim | 30% | 19,25% |

O painel controlado de 36 ouro usa a mesma defesa, cura e suportes. O arco
recebe uma Poção de vida adicional de 2 ouro para compensar seu menor preço;
portanto não é uma comparação puramente isolada da arma. A taxa do arco nesse
painel permaneceu em 49% antes/depois. Isso sustenta que o ajuste de estamina
atinge principalmente montagens com múltiplas armas nestas configurações.

Os números não mostram equilíbrio concluído. Dois arcos e Fortaleza continuam
fortes contra os adversários escolhidos. A build Vampírica perdeu desempenho
apesar de curar mais, enquanto os machados melhoraram. Não interpretar o buff
da cura como prova de melhora global daquela build. Pedra de fogo continua
fraca como compra de preparação, mas a vantagem de sua futura fusão não está
creditada à luta atual.

## Jornadas completas

Também foram executadas **180 jornadas** com lojas, ofertas, renda, organização
e fusões: 30 por política automatizada antes e 30 depois. Os rivais mantêm as
mesmas regras de atributos e compra do jogador. Sementes e políticas foram
mantidas, mas as decisões podem divergir depois que o resultado de uma batalha
muda a progressão. Cada luta recebeu uma repetição com os lados invertidos
apenas para diagnóstico; ela não concede renda, vida, vitória ou fusão.

| Política | Jornadas vencidas antes | Depois |
| --- | ---: | ---: |
| Iniciante | 10/30 | 11/30 |
| Intermediária | 17/30 | 19/30 |
| Avançada | 24/30 | 24/30 |

Foram 1.491 batalhas de progressão, mais 1.491 repetições de diagnóstico.
A amostra por política é pequena e não demonstra melhora geral de dificuldade.
Políticas automatizadas não substituem jogadores humanos.

## Verificação e reprodução

- 216 testes passaram. Os testes mantêm verificações de limiar de probabilidade,
  dano real, cura sem reviver, geração periódica, fila de armas e simetria.
- Foram acrescentadas verificações de cadência de um arco, restrição de dois
  arcos e continuidade dos dois machados com o novo consumo.
- Build de produção aprovada; permanece o aviso de tamanho do pacote Phaser.
- Não houve nova conferência visual no navegador nesta alteração de atributos.
- Alterações locais, sem commit, push ou publicação. Raridade fica para a etapa
  seguinte, sem alterar disponibilidade nesta medição.

```powershell
node scripts/rebalance-stages.mjs select
node scripts/rebalance-stages.mjs refine
node scripts/rebalance-stages.mjs validate 1
node scripts/calibrate-balance.js 30 12 stages-before
node scripts/calibrate-balance.js 30 12 stages-after
npm.cmd test
npm.cmd run build
```

O script preserva `stages-balance-baseline.json`, que guarda os atributos
anteriores. Candidatos alteram parâmetros somente em memória e restauram o
estado ao encerrar. O lote final está em `stages-balance-validate-1.json`;
os lotes de seleção/refinamento e a primeira validação são arquivos separados.
As composições e posições originais ficam em `stages-300.json`; a comparação
mantém esses encaixes, sem otimizá-los depois de observar resultados.

As jornadas ficam em `balance-calibrated-30-12-stages-before/after.json`;
os arquivos `.json.gz` guardam as transações e os históricos. Taxas de painéis
de builds prontas não são taxas de vitória da jornada. Composição, distribuição
de adversários e encaixe limitam as conclusões; todos os percentuais aqui são
descritivos e não uma garantia para outras builds.
