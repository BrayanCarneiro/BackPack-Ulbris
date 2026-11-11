# Raridade dos itens

Todos os 34 itens estão classificados. Raridade representa poder,
versatilidade e acesso às receitas; não concede atributos extras e não altera
preços. A classificação é inicial e pode mudar com novos dados de progressão.

O Cristal Dourado é **Épico**. A categoria Lendário existe no sistema, mas
nenhum item atual a utiliza.

## Classificação completa

| Raridade | Itens |
| --- | --- |
| Comum — 8 | Mochila viajante, Mochila alongada, Bolsa de couro, Espada de treino, Escudo de madeira, Poção de vida, Adagas rápida, Machadinha. |
| Incomum — 9 | Ferro refinado, Poção de vigor, Poção de proteção, Pedra de amolar, Cristal vital, Cristal armadurado, Cristal energético, Elmo de couro, Peitoral de couro. |
| Raro — 14 | Arco, Pedra de fogo, Pedra da celeridade, Pedra Carmim, Poção de regeneração, Cristal azul, Cristal vermelho, Cristal branco, Cristal preto, Espada de ferro, Escudo de ferro, Elmo de ferro, Machado de batalha, Adagas flamejantes. |
| Épico — 3 | Armadura de ferro, Peitoral Vampírico, Cristal dourado. |
| Lendário — 0 | Nenhum item atual. |

Itens básicos ficam Comuns para sustentar a preparação inicial. Materiais e
suportes gerais ficam Incomuns. Arco e suportes que habilitam combinações
fortes ficam Raros; os equipamentos evoluídos também recebem essa classificação.
Armadura de ferro é Épica pela força das montagens defensivas. Vampírico e
Dourado são Épicos pelos efeitos exclusivos e pelas receitas de múltiplas
etapas ou ingredientes. Isso não afirma que toda build com um Épico vence
uma build de Raros: composição, encaixe e estamina continuam determinantes.

## Distribuição na loja

| Rodadas | Comum | Incomum | Raro |
| --- | ---: | ---: | ---: |
| 1–2 | 70% | 25% | 5% |
| 3–5 | 55% | 30% | 15% |
| 6–11 | 40% | 35% | 25% |

São chances totais por categoria em cada oferta sorteada, divididas igualmente
entre os itens compráveis dessa categoria. Atualmente há oito Comuns, nove
Incomuns e nove Raros no catálogo da loja. Por exemplo, um Raro específico
tem cerca de 0,56% por oferta no início e 2,78% a partir da rodada 6.

Os oito resultados de fusão não são ofertas diretas. Os três Épicos atuais
continuam obtidos exclusivamente por suas receitas; não há chance artificial
de comprá-los. Os ingredientes continuam aparecendo conforme sua raridade.
Uma receita Épica não exige ingredientes Épicos.

A primeira loja mantém as seis ofertas garantidas. Raridade controla renovações
e lojas seguintes. Há seis ofertas; renovar custa 1 ouro, fixar preserva a
oferta, e compras só podem acontecer uma vez por espaço. Jogador e NPCs usam
as mesmas probabilidades e regras. O sorteio consome uma chamada aleatória
por oferta renovada, mantendo sua reprodução por semente.

## Apresentação e metadados

- Nome e cor da raridade nos cartões da loja, catálogo e fichas.
- Bordas e nomes dos itens usam a cor da raridade; o desenho do item mantém
  sua identificação por categoria ou cor própria do cristal.
- Ingredientes e resultados também mostram raridade na ficha de receitas.
- Ofertas fixadas mantêm o destaque de fixação e continuam com o rótulo de
  raridade visível.
- Compras, cópias, giros e fusões preservam a identificação correta. A fusão
  atualiza o campo `rarity`, além do ID de catálogo do equipamento.
- A referência `docs/referencias/itens.txt` foi sincronizada.

## Verificação

229 testes passaram, incluindo cobertura explícita dos 34 itens, Dourado
Épico, ausência de Lendários, fronteiras dos sorteios, probabilidades totais por
categoria, atualização em fusões e preservação de ofertas fixadas.

Foram sorteadas 36.000 ofertas nos testes de frequência: 12.000 por patamar.
Os resultados ficaram dentro da tolerância de dois pontos percentuais das
probabilidades configuradas. Também há verificações exatas das massas de
probabilidade, independentes dessa amostragem.

A interface foi conferida no Edge em 1440×900 e 390×844: rótulos da loja,
fichas e catálogo, incluindo ausência de sobreposição com categoria e preço.
As verificações também cobrem a fusão do Dourado e o botão de limpar a mochila.

## Jornadas com ofertas e fusões

Foram executadas 180 jornadas: 30 por política antes e 30 depois, com os mesmos
atributos de combate. A versão anterior usa o sorteio uniforme; a nova usa
raridade. Compras, renda, renovações, organização e fusões foram simuladas.
Os rivais seguem a mesma versão do sorteio do jogador em cada bateria.

| Política automatizada | Jornadas vencidas antes | Com raridade |
| --- | ---: | ---: |
| Iniciante | 8/30 | 12/30 |
| Intermediária | 17/30 | 18/30 |
| Avançada | 24/30 | 23/30 |

Houve 1.504 batalhas de progressão, mais 1.504 repetições com os lados invertidos
para diagnóstico. Repetições não concedem vitórias, renda ou fusões extras.
As sementes são pareadas entre versões, mas decisões e ofertas podem divergir
durante a progressão. São apenas 30 jornadas por política por versão: os números
não comprovam uma melhora de equilíbrio nem substituem testes com jogadores.

Os dados estão em `balance-calibrated-30-14-rarity-before.json` e
`balance-calibrated-30-14-rarity-after.json`. Os arquivos `.json.gz` contêm
históricos de compras, mochilas, fusões e resultados das batalhas.

```powershell
node scripts/calibrate-balance.js 30 14 rarity-before
node scripts/calibrate-balance.js 30 14 rarity-after
npm.cmd test
npm.cmd run build
node scripts/smoke-preparation.mjs --crystals-only
```

O modo `rarity-before` modifica o sorteio apenas em memória no processo de
diagnóstico. A implementação normal permanece com raridade. Nenhum atributo
de combate foi alterado nesta etapa. Alterações locais, sem commit ou push.
