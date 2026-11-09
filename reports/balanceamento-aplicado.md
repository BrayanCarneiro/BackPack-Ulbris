# Balanceamento aplicado ao jogo

Implementação baseada na apresentação e na revisão técnica. Os documentos
anteriores preservam a análise inicial; este arquivo descreve o estado aplicado.

## Alterações

| Item / regra | Antes | Aplicado |
|---|---|---|
| Adagas flamejantes: dano direto | 1,6 | 1,4 |
| Adagas flamejantes: estamina por ataque | 0,5 | 0,8 |
| Queimadura: dano por pulso | 4 | 2 |
| Queimadura após bloqueio total | Podia aplicar | Não aplica |
| Escudo de ferro: armadura inicial | 6 | 9 |

A chance de queimadura continua em 20%. Cada acúmulo causa dois pulsos,
um por segundo, com duração independente. O dano continua direto à vida,
ignorando armadura. Um acerto absorvido apenas pela armadura ainda pode
aplicar queimadura; um bloqueio parcial também permite. O bloqueio total
impede a aplicação e passa a ser uma resposta defensiva útil.

O menor dano direto diferencia a evolução pela queimadura, sem dar ao mesmo
tempo um aumento de 60% no dano físico. O custo de 0,8 preserva a cadência
de uma arma isolada, mas duas cópias aceleradas passam a disputar estamina.
O escudo evoluído mantém os 9 pontos de proteção da madeira e ganha maior
chance de bloqueio: 45% contra 30%.

Combate, fichas e catálogo usam as mesmas definições. itens.txt foi
sincronizado. As receitas continuam exibindo os componentes e resultados,
e a arma ou escudo obtido por fusão entra na próxima batalha com as novas regras.
A ficha de celeridade também explica o empilhamento: duas pedras reduzem
19% e três reduzem 27,1%, respeitando o teto existente de 30%.

## Avaliado e preservado

- Pedra de amolar: +0,3, com limite de +0,9 por arma.
- Celeridade: redução multiplicativa de 10% por pedra, teto de 30%.
- Ferro refinado: 30% de chance de +2,4 de armadura por ativação elegível,
  sem um novo intervalo obrigatório.
- Regeneração: cura inicial de 6 e seis pulsos de 1,2.
- Machado: 15% de atordoar por 1 segundo, renovando a duração restante.
- Cristais, preços, receitas, formatos, vida, renda e regeneração de estamina.
- Regras iguais para jogador e rivais; sem conceder ouro ou vitórias extras.

Testei limites de 0,5, 1 e 2 segundos no ferro. Eles reduziram a armadura
gerada, mas não resolveram a vantagem da montagem com fogo e prejudicaram
outras defesas. Por isso não foram adotados. A redução do teto da celeridade
para 20% também não mostrou benefício suficiente na amostra selecionada.
Testei a queimadura absorvida pela armadura, mas preservei sua identidade
de dano direto à vida. A decisão foi reduzir dano e economia da arma e
permitir que bloqueio total impeça a aplicação.

## Comparação final entre builds

A bateria final usa sementes diferentes das de seleção dos candidatos:
100 sementes por confronto e os dois lados. Foram **159.200 combates**,
comparando todas as combinações entre 8 builds de 14 ouro e entre 19 builds
de 28 ouro, antes e depois dos ajustes. Capacidade e orçamento são iguais
dentro de cada grupo; posições, formatos e suportes foram validados.

| Build observada | Média de vitórias entre adversários selecionados: antes | Depois |
|---|---:|---:|
| Adagas flamejantes + Escudo de madeira, grupo de 14 ouro | 95,6% | 55,6% |
| Duas Adagas flamejantes + celeridade + escudo, grupo de 28 ouro | 97,3% | 56,7% |
| Fogo + ferro + escudo de ferro + regeneração, grupo de 28 ouro | 94,3% | 90,2% |

As médias não são taxas de vitória da campanha nem uma distribuição do
que jogadores humanos vão montar. Incluem composições menos eficientes,
como armas isoladas com vigor que nem sempre precisam desse consumível.
O grupo final também inclui armas físicas com o mesmo pacote de defesa e cura,
para evitar concluir que toda vantagem da defesa vinha da arma de fogo.

A montagem defensiva com fogo continua forte. Contra Machado de batalha
com ferro, escudo evoluído e regeneração, teve 87 vitórias, 88 derrotas e
25 empates nos 200 combates deste confronto. Contra montagens defensivas
com Machadinhas e Arco, venceu 57% e 59%, respectivamente. Isso oferece
respostas reais, mas não prova equilíbrio definitivo do arsenal.

Os confrontos são de builds prontas, após a fusão, sem loja ou atraso para
obter ingredientes. Há repetições correlacionadas, tanto pelo espelhamento
quanto pelos pares ordenados. Não tratar todos os combates como observações
estatisticamente independentes.

## Jornadas completas

Executei **1.800 jornadas**: 300 por política automatizada antes e 300 depois,
com as mesmas sementes de compras e combate e os mesmos 32 grupos de rivais.
O código de compra e os preços são iguais nas duas versões. O conjunto atual
de armas e formatos foi preservado em ambas, isolando os parâmetros de combate.

| Política automatizada | Antes | Depois |
|---|---:|---:|
| Iniciante | 115/300 (38,33%) | 111/300 (37,00%) |
| Intermediária | 219/300 (73,00%) | 220/300 (73,33%) |
| Avançada | 283/300 (94,33%) | 283/300 (94,33%) |

Foram 15.233 combates de progressão, repetidos com lados invertidos para
diagnóstico: 30.466 combates ao todo. O espelhamento não concede vitórias,
renda ou fusões. As diferenças pequenas não sustentam afirmar uma melhoria
na dificuldade geral. Não houve uma mudança deliberada de dificuldade da IA.
Essas políticas não substituem testes com jogadores humanos.

## Validação e reprodução

- 131 testes passaram, incluindo bloqueio total/parcial, dois pulsos de 2,
  duração independente, estamina com duas adagas, escudo evoluído e 1x/2x/3x.
- Build de produção aprovado; permanece o aviso de tamanho do pacote Phaser.
- Fichas, receitas, fusões e efeitos conferidos no Edge em 1440×900 e 390×844.
- Dados completos: balance-items-final.json e
  balance-calibrated-300-3-rebalance-before/after.json; os arquivos .json.gz
  guardam as transações e os históricos completos das jornadas.

```powershell
node scripts/balance-items.mjs 100 final
node scripts/calibrate-balance.js 300 3 rebalance-before
node scripts/calibrate-balance.js 300 3 rebalance-after
npm.cmd test
npm.cmd run build
node scripts/smoke-weapons.mjs
node scripts/smoke-weapons.mjs --speed-only
```

As baterias experiments, stamina, iron, armor e damage do script balance-items
registram candidatos isolados em relatórios próprios. A execução ajusta
parâmetros somente em memória e restaura o estado ao terminar.
