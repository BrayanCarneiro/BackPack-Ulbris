# Simulação de 300 jornadas — 08/11/2026

Este é o relatório histórico da IA anterior ao rebalanceamento. Os resultados e todas as compras, renovações, posições, fusões e sementes daquela execução estão em `balance-300.json`, preservado como referência. Os resultados abaixo não representam a IA atual.

O comando `npm run simulate:balance` agora testa a nova IA, com 300 jornadas por nível de habilidade, e grava arquivos separados `balance-calibrated-300-*.json`. Consulte `balance-current.md` para o novo método e os resultados.

## Método

Foram 300 jornadas completas no motor real, com 100 sementes para cada uma de três políticas de compra: priorizar ferro/fusão, escudos ou cura. O comprador não consulta o inimigo nem testa combates para escolher compras. Usa `ShoppingSession.buy`, `reroll`, `beginBattle` e `finishBattle`, ofertas reais, renda real, 4 vidas e meta de 8 vitórias. As posições são validadas por `PackingBoard`, incluindo rotação e estrelas. Não há itens gratuitos, ouro extra ou vitórias forçadas. As políticas são heurísticas automatizadas; os números não representam a melhor estratégia possível nem a taxa exata de jogadores humanos.

A IA atual foi mantida exatamente como está no jogo. Ela NÃO compra pela loja: monta uma mochila nova por rodada a partir do catálogo completo, respeitando um orçamento, e seleciona candidatos usando combates de avaliação. Não depende das seis ofertas aleatórias, não paga renovações reais e não precisa carregar o histórico de fusões/compras. Portanto os atributos e posições seguem regras comuns, mas as condições de aquisição são diferentes. Simular compras da IA pela loja exigiria uma outra política de adversário; inverter os lados abaixo não faz essa alteração.

Cada um dos 1.461 combates também foi repetido com as mesmas mochilas e semente, trocando os lados: mais 1.461 combates diagnósticos, que não alteram a progressão. O resultado invertido é expresso da perspectiva do comprador. Como o motor compartilha uma sequência aleatória, trocar lados redistribui sorteios; não se espera igualdade de resultado por combate.

## Resultado

- Jornadas vencidas: **18/300 (6%)**; derrotadas: **282/300 (94%)**.
- Média de vitórias por jornada: **0,94**.
- Combates: **282 vitórias, 1.107 derrotas, 72 empates** — 19,30% de vitórias.
- Lados invertidos: **272 vitórias, 1.106 derrotas, 83 empates** — 18,62% de vitórias do comprador.
- Jornada completa por política: ferro/fusão **3/100**, escudos **10/100**, cura **5/100**.

| Etapa | Rodadas | Combates observados | Vitórias | Taxa |
|---|---|---:|---:|---:|
| Início | 1–3 | 900 | 156 | 17,33% |
| Meio | 4–7 | 489 | 58 | 11,86% |
| Fim | 8–11 | 72 | 68 | 94,44% |

**O fim contém somente sobreviventes.** Apenas 21 jornadas chegaram à rodada 8. Sua taxa alta não significa que 94% das jornadas vencem o fim nem permite comparar as etapas como amostras equivalentes.

| Rodada | Jornadas que chegaram | Vitórias no combate | Taxa |
|---|---:|---:|---:|
| 1 | 300 | 65 | 21,67% |
| 2 | 300 | 31 | 10,33% |
| 3 | 300 | 60 | 20,00% |
| 4 | 300 | 15 | 5,00% |
| 5 | 125 | 3 | 2,40% |
| 6 | 38 | 21 | 55,26% |
| 7 | 26 | 19 | 73,08% |
| 8 | 21 | 17 | 80,95% |
| 9 | 18 | 18 | 100,00% |
| 10 | 18 | 18 | 100,00% |
| 11 | 15 | 15 | 100,00% |

## Uma vitória reproduzível

Jornada de índice **12**, semente de loja **285028**, política ferro/fusão: **8 vitórias, 1 derrota, 1 empate**, terminando na rodada 10. Sequência: V, V, V, D, E, V, V, V, V, V.

1. Comprou mochila viajante, espada, ferro e poção na primeira loja. A espada ocupou uma estrela do ferro e virou espada de ferro após vencer.
2. Na segunda rodada comprou regeneração, escudo e outra poção; na terceira, outra mochila viajante e outro escudo.
3. Perdeu a quarta e empatou a quinta. Nessa quinta comprou outra espada e ferros e completou a segunda espada de ferro.
4. Continuou acumulando cura, escudos e suporte, expandindo o espaço legalmente; venceu da sexta à décima rodada.

É um exemplo com ofertas e sorte específicos, não uma receita garantida. Consulte o JSON para coordenadas, rotações e transações completas.

## Diagnóstico

O relato de ganhar ocasionalmente a primeira e travar depois aparece nas três políticas. O maior gargalo observado foi nas rodadas 4 e 5, antes que a maioria acumulasse equipamentos suficientes. A IA da rodada 4 já monta duas espadas de ferro, dois escudos, duas poções e dois ferros; na rodada 5 monta três escudos, três poções e três ferros com duas espadas de ferro. Ela não precisou encontrar essas ofertas nem executar essas fusões durante uma jornada.

Mais tarde a lista limitada de compras da IA deixa parte crescente do orçamento sem uso: na rodada 9 gasta 58 de 95; na 10, 61 de 107. Isso é compatível com o crescimento das mochilas dos sobreviventes superar o adversário, mas não prova a causa isoladamente.

A proximidade dos resultados com lados invertidos não indica uma grande vantagem sistemática do lado da tela neste teste. A prioridade de investigação é a curva de equipamentos e a diferença de aquisição da IA. O teste não determina sozinho qual ajuste produziria uma dificuldade adequada.

Validação adicional: os **93 testes existentes passaram**. Nenhum balanceamento foi aplicado.
