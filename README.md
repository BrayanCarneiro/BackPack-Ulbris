# Ulbris Backpack Battles

Jogo 2D em JavaScript, Phaser 3 e Vite, em formato vertical.
Etapa atual: jornada contra bots, economia, organização e batalha automática.
A paleta original foi mantida. Há rodadas de compras/batalha e oito receitas de
fusão; ainda não há checkpoints ou persistência.

O ciclo é preparação/compra → batalha automática de mochila contra
mochila → próximo inimigo, até encerrar a jornada.
O ajuste mais recente de armas e defesas está descrito em
[balanceamento por etapas](reports/balanceamento-etapas-aplicado.md), com comparação
antes/depois, limites da medição e pontos ainda fortes ou fracos.
Os atributos e efeitos iniciais estão em `src/data/combatItems.js` e descritos
em `docs/referencias/itens.txt`, que serve como referência editável, sem carregamento automático.

Escudo de madeira, Ferro refinado e Espada de treino já usam artes próprias,
seguindo o estilo geométrico do Arthur, com encaixes e giros preservados na
mochila. Aparecem também na loja, reserva, arena, catálogo, fichas e mochila
vencedora. [Artes, arquivos e prompts](docs/art/items/README.md).

## Jornada

O objetivo inicial é alcançar **8 vitórias antes de perder 4 vidas**.
Vitórias somam um ponto; derrotas e empates custam uma vida. A loja e a arena
mostram o progresso. Cada batalha concluída processa suas fusões uma única vez.
Na oitava vitória ou ao zerar as vidas, a arena abre o resultado da jornada,
com resumo de vitórias, derrotas e empates e a opção **Nova jornada**.
Uma nova jornada começa com coleção vazia e os contadores restaurados.

Na vitória, **Ver mochila vencedora** abre uma visualização somente de consulta
da formação usada na batalha final: posições, rotações e ingredientes são
preservados antes das fusões pós-batalha. A grade mostra os equipamentos por
número e raridade, com legenda, quantidades e atributos iniciais da build.
Peças na reserva não aparecem como equipadas. Tocar em um equipamento abre
sua ficha. **Salvar imagem** baixa um PNG com a formação e a legenda, sem os
botões da tela; **Voltar ao resultado** retorna às opções da mesma jornada.

Os bots alternam entre Viajante, Duelista e Sentinela, com prioridades de compra
para equilíbrio, ataque e defesa. Cada jornada sorteia um dos 32 grupos de
históricos de compras. O rival da mesma rodada permanece estável nessa jornada.
Os bots usam `ShoppingSession`: seis ofertas, ouro e renda iguais aos do jogador,
renovação paga, inventário persistente e fusão somente após uma batalha anterior.
Não escolhem diretamente do catálogo nem testam combinações em combate para
selecionar a mais forte. Os atributos de combate são iguais para ambos os lados.

A progressão dá tempo ao jogador para montar a primeira fusão: os rivais só
procuram ferro e uma segunda arma a partir da rodada 3. Fazem no máximo uma
renovação por loja e limitam seu gasto à renda da rodada, preservando o saldo
não usado. O primeiro rival investe até 13 dos 14 de ouro iniciais. Os históricos
dos NPCs avançam através de treinos espelhados reais; não são campanhas do jogador
com meta de vitórias ou eliminação por vidas. Cada fusão tem ingredientes,
posição e batalha concluída verificáveis no histórico.

`npm run simulate:balance` executa 300 jornadas por nível de habilidade (900 no
total), com compras reais, 8 vitórias e 4 vidas. Para outra bateria de sementes:
`npm run simulate:balance -- 300 1`. Consulte [o relatório atual](reports/balance-current.md)
para resultados, limites do método e comparação com a IA anterior.

## Economia

### Raridade e ofertas

Os 34 itens possuem raridade: **Comum** (cinza), **Incomum** (verde),
**Raro** (azul), **Épico** (roxo) ou **Lendário** (dourado).
O **Cristal Dourado é Épico**, assim como a Armadura de ferro e o Peitoral
Vampírico; os três continuam exclusivos de fusão. Nenhum item atual é Lendário.
A classificação considera poder, versatilidade e acesso às receitas, sem
adicionar atributos de combate ou mudar preços.

| Rodadas | Comum | Incomum | Raro |
| --- | ---: | ---: | ---: |
| 1–2 | 70% | 25% | 5% |
| 3–5 | 55% | 30% | 15% |
| 6–11 | 40% | 35% | 25% |

As chances são totais por raridade em cada oferta sorteada. Dentro de uma
raridade, cada item comprável tem a mesma chance. Os resultados de fusão
não entram no sorteio. A loja inicial mantém as seis ofertas garantidas;
raridade vale ao renovar e ao entrar em novas rodadas. Fixar preserva a oferta,
e o custo de renovação continua em 1 ouro. Jogador e bots usam o mesmo sorteio.

Raridade aparece por nome e cor nos cartões da loja, catálogo, fichas e
componentes de receitas. Cópias e fusões mantêm o metadado atualizado.
O preenchimento dos equipamentos também usa a cor da raridade na mochila,
reserva, batalha e miniaturas. Na batalha, a recarga aumenta o brilho da mesma
cor; poções usadas ficam apagadas. O verde das fusões prontas continua no
contorno, e a seleção usa contorno dourado. Mochilas mantêm o fundo discreto
para distinguir a área de suporte dos equipamentos.
A lista completa e a validação estão em [raridade aplicada](reports/raridade-aplicada.md).

Cada jornada começa com **14 de ouro**. A renda após uma batalha é igual para
vitória, derrota ou empate: +8 ao entrar na rodada 2, +9 na 3, crescendo até
o máximo de +13. O saldo restante é acumulado. A renda só é paga uma vez por
batalha concluída e não é paga quando a jornada termina.

| Item | Compra | Venda |
| --- | ---: | ---: |
| Mochila viajante | 4 | 2 |
| Mochila alongada | 3 | 1 |
| Bolsa de couro | 2 | 1 |
| Espada de treino | 3 | 1 |
| Escudo de madeira | 4 | 2 |
| Poção de vida | 2 | 1 |
| Ferro refinado | 3 | 1 |
| Espada de ferro | Somente fusão | 3 |
| Escudo de ferro | Somente fusão | 3 |

São **seis ofertas**, com uma compra por espaço. **Renovar ofertas** custa 1
de ouro e sorteia novos itens, inclusive cópias. **Fixar** preserva uma oferta
não comprada tanto nas renovações quanto na passagem de rodada. Se todas as
ofertas estiverem fixadas, renovar fica indisponível e não cobra ouro.
A loja inicial garante mochila, arma, escudo, poção, ferro e mochila alongada.

Na organização, selecione uma peça e use **Vender**; o botão mostra o valor.
A venda devolve metade do preço, arredondada para baixo, com mínimo de 1.
Mochilas ocupadas precisam ser esvaziadas antes da venda. A fusão atualiza o
valor da espada para o preço combinado dos ingredientes. Comprar, vender,
renovar e fixar são bloqueados durante a batalha e depois do fim da jornada.
Os preços e a renda são um ponto inicial para testes de balanceamento.

## Fase de compras

**Jogar** abre uma tela com **Play** e **Itens**. **Play** abre a seleção de
personagem. **Selecionar** inicia uma nova jornada na loja, com o letreiro
“Fase de compras” aparecendo letra por letra. Arthur (Cavaleiro) é a primeira
classe disponível; jogador e inimigos usam sua arte. Cada classe possui retrato
e cenário próprios, preparados para trocar juntos pelas setas. Com somente Arthur,
as setas ficam desabilitadas. **Voltar** retorna ao lobby.
**Itens** mostra os 34 itens atuais em páginas, incluindo mochilas e resultados de
fusão. Tocar em um cartão abre a ficha com atributos, classe e
receitas; fechar a ficha retorna ao catálogo. **Voltar** retorna à tela de Play/Itens.
Na tela **Itens**, os controles **Tipo**, **Nome** e **Raridade** ficam acima
dos cartões. Tipo permite escolher a categoria e agrupa armaduras antes de
armas; Raridade filtra uma categoria ou ordena de Comum a Lendário.
Os dois filtros podem ser combinados. Nome alterna A–Z e Z–A, respeitando
acentos em português. **Limpar filtros** restaura todos os itens agrupados por
tipo. A paginação acompanha o resultado; consultar uma ficha preserva os
filtros, a ordem e a página ao fechar.
O catálogo inicial tinha sete tipos de oferta: mochila viajante
(4×4), mochila alongada (5×1), bolsa de couro (2×2), espada de treino (1×3),
escudo de madeira (2×2), poção de vida (1×1) e Ferro refinado (1×1).
Cada cópia tem identidade, posição e recarga independentes. As compras vão para a reserva;
seus atributos só contam quando estão posicionadas na mochila.

Compra e organização agora ficam na mesma tela. No computador, as seis ofertas
ficam à esquerda e a mochila à direita. No celular, as seis ofertas aparecem
grandes na parte superior; a mochila fica menor embaixo, com a mesma grade 8×8
e os itens reduzidos na mesma proporção. A reserva fica ao lado da grade compacta.
Compras aparecem imediatamente na reserva. Posicione primeiro uma mochila e
depois os equipamentos; renovar, fixar, girar, consultar e vender não trocam de
tela. **Batalhar** exige pelo menos uma mochila e um equipamento posicionados.
**🧹 Limpar tudo** esvazia a grade, enviando equipamentos e mochilas para a
reserva e abrindo-a para reorganizar. Mantém os itens, giros e ouro; não vende
nem descarta peças. Os indicadores de fusão são atualizados ao limpar.
Redimensionar a janela preserva compras, posições, rotações e a escolha de fusão.
Só é possível voltar às compras a partir da arena após o fim da batalha,
preservando a organização.
Voltar ao menu e jogar inicia uma nova partida.

## Itens gerais e classe

Os sete itens abaixo foram adicionados ao catálogo compartilhado. Os seis itens
de compra direta podem aparecer ao renovar ofertas ou entrar em outra rodada,
independentemente da classe. O Escudo de ferro é obtido somente por fusão.
A primeira loja continua garantindo o conjunto básico anterior.

| Item | Tamanho | Ouro | Efeito |
| --- | --- | ---: | --- |
| Escudo de ferro | 2×2 | Fusão | +9 de armadura inicial e 40% de chance de bloquear 1,8 por acerto. |
| Poção de vigor | 1×1 | 3 | Recupera 2,4 de estamina ao chegar a 25% ou menos. |
| Poção de proteção | 1×1 | 3 | Concede 6 de armadura ao ficar sem armadura, inclusive no início. |
| Poção de regeneração | 1×2 | 4 | Com 60% de vida ou menos, cura 6 imediatamente e 1,2 por segundo por 6 segundos. |
| Pedra de amolar | 1×1 | 3 | +0,3 de dano para armas nas estrelas; limite combinado de +0,9 por arma. |
| Pedra da celeridade | 1×1 | 4 | Reduz a recarga das armas nas estrelas em 10%; limite combinado de 30%. |
| Pedra Carmim | 1×1 | 3 | Uma estrela à direita; a arma nela tem 5% de chance por acerto de curar 50% do dano causado à vida. Inclui críticos e extras; exclui queimadura. |
| Cristal vital | 1×1 | 4 | +4 de vida inicial e máxima enquanto posicionado. |
| Cristal armadurado | 1×1 | 3 | +4 de armadura inicial. |
| Cristal energético | 1×1 | 3 | +1 de estamina inicial e máxima; recuperação permanece igual. |
| Elmo de couro | 2×1 | 4 | +3 de armadura; reduz duração de atordoamentos em 30% e dano total crítico recebido em 20%. |
| Peitoral de couro | 2×3 | 5 | +6 de armadura e 1 resistência; a cada 5,9 s, +3 de armadura por peça de armadura nas duas estrelas. |
| Elmo de ferro | 2×1 | Fusão | +6 de armadura; reduz duração de atordoamentos em 45% e dano total crítico recebido em 30%. |
| Armadura de ferro | 2×3 | Fusão | +11 de armadura e 2 resistências; a cada 5,9 s, +3 de armadura por peça de armadura nas duas estrelas. |
| Peitoral Vampírico | 4×3, 8 espaços | Fusão | +10 de armadura, +4 de vida e 2 resistências. Cura 20% da vida perdida ao sofrer dano; não revive após dano letal. |

Os cinco cristais de cores também estão implementados, todos de 1×1:

| Cristal | Ouro | Efeito |
| --- | ---: | --- |
| Azul | 4 | +1 de resistência a cada 6 s, sem estrelas; acumula até ser consumida. |
| Vermelho | 4 | Armas nas duas estrelas recebem +0,5 de dano por acúmulo ativo de queimadura no adversário. |
| Branco | 4 | Reduz o dano total crítico recebido em 10%, sem estrelas. |
| Preto | 4 | Reduz o dano recebido de fadiga em 10%, sem estrelas. |
| Dourado | Fusão (valor 16) | Todos os quatro efeitos e Última Luz. |

**Última Luz:** uma vez por batalha e por cristal, ao sobreviver a dano com
25% de vida ou menos, remove todas as queimaduras e o atordoamento ativo e
cura 20% da vida máxima. Não revive após dano letal. A cura acontece antes
da cura do Peitoral Vampírico e das poções, inclusive contra queimadura e fadiga.
O atordoamento removido deixa de atrasar as recargas das armas.

Para criar o dourado, conecte as quatro cores por bordas, em qualquer ordem,
e complete uma batalha. Linha, quadrado 2×2 e outros grupos contínuos funcionam;
não é necessário que todos toquem o azul. O resultado substitui o azul e consome
as outras três cores. Ingredientes na reserva, diagonais ou distantes não contam.
As estrelas do vermelho e dourado giram como as pedras. O bônus de dano é
recalculado por golpe, não permanece após a queimadura expirar e não usa o
teto da Pedra de amolar. Cópias somam dano e geração de resistência; reduções
de crítico e fadiga combinam multiplicativamente. Os bônus só valem equipados
e seguem as mesmas regras para ambos os lados. Preços são valores iniciais
para balanceamento, sem uma nova calibração da campanha nesta alteração.

Armadura de ferro + Pedra Carmim + Cristal vital = Peitoral Vampírico: coloque
a armadura na estrela da pedra e encoste o cristal na armadura. Após uma batalha
completa, pedra e cristal são consumidos. As ombreiras mantêm o torso na posição
anterior; se faltarem espaço ou mochilas de suporte, o resultado vai para a reserva.
Essa evolução troca a geração de armadura por cura após dano à vida, incluindo
golpes, queimadura e fadiga. Seu valor é 18 de ouro, com venda por 9.

Elmo de couro + Ferro refinado = Elmo de ferro: encoste o elmo por uma borda
no ferro. Peitoral de couro + 2 Ferros refinados = Armadura de ferro: o peitoral
deve encostar por uma borda em cada um de dois ferros diferentes, sem exigir estrelas. As fusões ocorrem
após uma batalha completa e consomem todos os ferros necessários de uma vez.
As evoluções preservam identidade, posição, tamanho e orientação do equipamento.
As receitas mostram ingredientes repetidos agrupados, com a quantidade indicada.

A ficha dos itens usa o mesmo visual arredondado dos cartões da loja. Atributos
ficam em blocos numéricos e cada efeito mostra um valor curto com a condição logo
abaixo (por exemplo, +3 de armadura a cada 5,9 s, por armadura nas estrelas).
A aba Receitas separa encaixe, momento da fusão e ingredientes consumidos;
valor e venda ficam no rodapé.

Na organização, ingredientes de fusões prontas recebem um contorno verde e o
aviso **Fusão pronta**, com o equipamento resultante e a indicação de que a fusão
ocorre após a batalha. Receitas incompletas mostram a quantidade de ingredientes
encaixados (por exemplo, Ferro refinado: 1/2). Selecionar o equipamento mostra seu
progresso; mover, girar, guardar ou vender ingredientes atualiza o indicador.
Peças na reserva e ingredientes já destinados a outra fusão não contam.

Resistência impede uma aplicação de queimadura ou atordoamento por ponto e por
batalha. Cópias equipadas somam resistência; a próxima batalha restaura os pontos.
Elmos combinam suas reduções multiplicando os fatores. As estrelas do peitoral
contam escudos, elmos e peitorais; cada peça conta uma vez, e os cristais não contam.
As estrelas giram junto com o peitoral. A geração de armadura continua durante
atordoamentos, com o primeiro pulso em 5,9 segundos de combate.

As poções são consumidas uma vez por combate e restauradas para a próxima
batalha, como a poção de vida. Nenhuma revive personagens mortos. A cura e a
estamina respeitam seus máximos. A regeneração não gera ativações adicionais do
Ferro refinado: a poção conta como uma ativação ao ser consumida.
As pedras usam as mesmas estrelas laterais/verticais e a mesma rotação do ferro,
e afetam qualquer tipo de arma. Peças guardadas na reserva não concedem bônus.
Os bots também consideram combinações com os novos itens nas suas simulações.

A ficha de todo item mostra **Classe: G — Geral** para os compartilhados.
O **Ferro refinado é geral**, assim como estes sete novos itens. O campo está
preparado para mostrar **Classe: 🗡 — Arthur** nos futuros itens exclusivos do
cavaleiro. Arthur será focado em espadas e armaduras; sua passiva e seus itens
exclusivos ficam para a próxima etapa. O combate já possui [três golpes por quadros,
efeitos de estado e poses finais](docs/planejamento/animacoes-arthur.md). Atualmente todos os itens
existentes continuam gerais.

Depois de concluir Arthur, a fase de contas, perfis, progresso online,
conquistas, PvP e ranking está registrada no
[planejamento pós-Arthur](docs/planejamento/pos-arthur.md). Esse documento reúne
ideias para a etapa futura; esses serviços ainda não estão implementados.

## Informações dos itens e receitas

Na loja, toque na parte superior de uma oferta ou em **i** para consultar sua
ficha. Na organização, um toque curto abre a ficha; arrastar continua movendo
a peça. O botão **Informações** também abre a ficha da peça selecionada. Na
arena, toque em um equipamento de qualquer lado para consultá-lo.

A ficha mostra nome, tamanho, atributos e passivas derivados das mesmas regras
usadas no combate. A aba **Receitas** mostra as combinações do item:
**Espada de treino + Ferro refinado = Espada de ferro**,
**Escudo de madeira + Ferro refinado = Escudo de ferro**,
**Machadinha + Machadinha = Machado de batalha** e
**Adagas rápida + Pedra de fogo = Adagas flamejantes**. Cada receita aparece nos
ingredientes e no resultado, explica o encaixe e o momento da fusão,
e permite tocar nos componentes para consultar suas fichas. Para um item sem
receita, aparece somente seu próprio cartão e a indicação de que não há fusões.

**Fechar** ou **Esc** retorna à mesma tela, preservando compras, posição, seleção
e rotação. Durante a consulta, a tela de origem fica pausada; o combate e seu
relógio só continuam ao fechar. Redimensionar a janela mantém a consulta aberta.
O catálogo de receitas em `src/data/itemRecipes.js` também é usado pela fusão.
Na ficha do ferro, as setas permitem alternar entre suas receitas.

As Adagas rápida (1×2, 3 ouro), Machadinha (2×2, 3 células, 3 ouro), Arco (2×3, 4 ouro)
e Pedra de fogo (1×1, 3 ouro) podem aparecer ao renovar a loja.
O Arco ocupa cinco espaços em C dentro de uma área de 2×3: duas células no
topo, uma à esquerda no meio e duas na base. O vazio aceita outro item,
não exige mochila e não recebe bônus de estrelas destinados ao arco.
O formato gira junto com o item e é exibido na loja, catálogo, ficha e batalha.
As duas novas armas de fusão custam 6 ouro para cálculo de venda e mantêm o
giro da arma base; não aparecem como ofertas diretas. O Machado de batalha
ocupa quatro espaços em uma área de 2×3: um cabo vertical de três células e
uma lâmina lateral na ponta superior. Seus espaços vazios ficam livres.
Quando o formato maior não cabe na posição original após a fusão, o resultado
é guardado na reserva e a loja avisa. As adagas mantêm as dimensões da base.
Para fundir, posicione
duas Machadinhas encostadas por uma borda, ou as adagas em uma estrela da pedra,
e complete uma batalha. A Machadinha tem duas células de cabo e uma lâmina
lateral na ponta; ela e o Machado de batalha não têm estrelas de fusão.
O contato entre Machadinhas considera as células ocupadas, inclusive ao girar;
contato apenas diagonal não conta. Ingredientes guardados não participam e cada cópia só
pode ser consumida uma vez por batalha.

Adagas flamejantes: 1,4 de dano direto, custo de 0,8 de estamina e recarga de
1,3 segundos. Cada acerto que não seja totalmente bloqueado tem 20% de chance
de aplicar queimadura. Dano absorvido somente pela armadura ainda permite
a aplicação; bloqueio parcial também permite.
Um turno equivale a 1 segundo de combate: cada acúmulo causa 2 de dano direto
à vida após 1 segundo e novamente após 2 segundos, quando desaparece. Os
acúmulos têm durações independentes e novos acúmulos não renovam os anteriores.
O Machado de batalha tem 15% de chance por acerto de atordoar por 1 segundo:
impede ataques e pausa recargas, mantendo regeneração de estamina, poções e
queimaduras. Novas aplicações renovam a duração restante, sem somar durações.
Os estados aparecem na arena e as regras também constam nas fichas dos itens.
O registro dos ajustes, decisões e medições está em
[balanceamento aplicado](reports/balanceamento-aplicado.md).

Verificado no Edge com mouse (1440×900) e toque emulado (390×844): consulta na
loja, receita e resultado navegáveis, item sem receita, fechamento, toque versus
arraste, rotação, pausa/retomada do combate e redimensionamento com a ficha aberta.

## Tela de batalha

A arena mantém a paleta do jogo. No computador (janela com ao menos 900 px de
largura e proporção de ao menos 1,1), ela aproveita a largura disponível, com
painéis e grades de mochilas maiores e personagens mais espaçados no centro.
Em telas estreitas, usa a apresentação vertical. Redimensionar a janela recompõe
o layout; voltar à loja restaura a resolução vertical de compras.
A mochila do jogador fica
à esquerda e a do inimigo à direita, mostrando apenas as peças posicionadas,
com suas posições e rotações preservadas. Os números nos itens correspondem à
legenda de equipamentos de cada mochila. Peças na reserva não aparecem na arena.

Os dois aventureiros ficam no centro, jogador à esquerda e inimigo à direita,
voltados um para o outro. A estamina aparece acima da vida e a armadura abaixo.
O inimigo usa os mesmos atributos de espada, escudo e poção do jogador.

## Regras iniciais de combate

Concluir as compras inicia a batalha automaticamente, com 30 de vida, 4,4 de
estamina e armadura básica provisória de zero. Somente peças posicionadas dão
bônus: mochila alongada soma 1 à estamina inicial e máxima; bolsa soma 1,2 de
armadura; escudo de madeira soma 5, e escudo de ferro soma 9. A estamina recupera 0,10 por passo de 100 ms
(1 por segundo) até seu máximo.

Quando várias armas disputam estamina, tem prioridade a que terminou a recarga
há mais tempo. Se falta energia para ela, aguarda a recuperação antes de liberar
as próximas; armas mais baratas não podem furar essa fila. A regra vale para
ambos os lados e evita que uma terceira espada pare de atacar indefinidamente.

A Espada de treino ataca a cada 2 segundos, com 88% de precisão, 1,8 de dano e custo de 1,2
de estamina (inclusive se errar). Sem estamina suficiente, aguarda a recuperação
antes de atacar e iniciar outra recarga. O crítico tem 3% de chance e multiplica
o dano por 1,5. Acertar tem 10% de chance de gerar um ataque extra imediato,
gratuito, com precisão e crítico próprios, sem gerar outro ataque extra.

Cada escudo tem 30% de chance de bloquear 1,8 de dano de um acerto e, quando
bloqueia, mais 10% de chance de bloquear outros 1,8 no mesmo golpe. O restante
atinge primeiro a armadura, consumindo seus pontos; só o excesso atinge a vida.
Não há regeneração passiva de armadura. O Ferro refinado pode conceder armadura
durante o combate, inclusive depois de zerar, sem um teto de armadura.

A poção cura 12 ao chegar a 45% de vida ou menos. Provisoriamente, é consumida
após uma cura, sem reviver personagens mortos. Sua peça fica esmaecida na arena;
o inventário de preparação não é alterado.

Ataques prontos no mesmo instante são calculados antes de aplicar os danos dos
dois lados. Ambos podem morrer juntos e empatar. Ao terminar, a arena mostra
vitória, derrota ou empate e congela o combate. Após 1,6 segundo, retorna
automaticamente às compras, processa as fusões e avança a rodada. O botão
**Voltar às compras** fica desabilitado durante o combate e é liberado após
o resultado. Entrar novamente na arena começa outro combate com os atributos cheios.
Redimensionar a janela durante a luta preserva o combate em andamento.

Dano, cura, bloqueio e armadura foram reduzidos para 60% dos valores da versão
com 50 de vida. Estamina, recargas e probabilidades foram preservadas para
manter as proporções e o ritmo do combate. As fichas mostram os valores atuais.
Após 60 segundos, a **fadiga** atinge os dois lados simultaneamente a cada
segundo: 0,6 de dano direto à vida no primeiro pulso, 1,2 no segundo, e assim
por diante. Ela ignora armadura e bloqueios e permite empates simultâneos.
A arena mostra a contagem regressiva e avisa quando a fadiga está ativa.

## Ferro refinado e fusão

O Ferro refinado ocupa um slot. Segurá-lo na grade ou arrastá-lo sobre ela mostra
bolinhas nos slots imediatamente à esquerda e à direita. Girar o ferro em 90°
alterna essas estrelas para cima/baixo; outro giro retorna aos lados. A prévia
durante o arraste, o bônus de armadura e a fusão seguem a mesma orientação.
Qualquer célula de um equipamento de vários slots pode ocupar uma estrela.
Para cada ativação de um equipamento nessas estrelas, há um sorteio independente
de 30% para conceder 2,4 de armadura ao dono do ferro. São ativações: ataque de uma
arma, inclusive erro/extra; uso de poção; bloqueio bem-sucedido de escudo. O bônus
não se autoativa nem gera cadeias entre ferros. Peças na reserva não participam.

Cada item pode ativar no máximo dois Ferros refinados. O limite é aplicado
antes dos sorteios de 30%: os ferros excedentes não dão tentativas adicionais,
mesmo se os dois primeiros falharem. Cada ferro continua podendo reagir aos
itens de suas duas estrelas, inclusive no mesmo instante. O limite vale para
armas, poções, escudos e efeitos periódicos de armaduras, sem alterar as fusões.

Uma Espada de treino encostada por uma borda em um Ferro refinado ao iniciar uma
batalha completa se funde com ele ao voltar às compras, em vitória, derrota ou empate. Cada par
é usado uma vez; o ferro é consumido, e a espada vira Espada de ferro mantendo
sua identidade, células e orientação. A receita funciona com cópias e espadas
giradas. Somente o ferro é consumido, liberando seu slot. Sair antes do resultado
não permite a fusão. O novo item é obtido por receita, sem oferta direta na loja.

O Escudo de madeira segue a mesma regra de contato por uma borda no Ferro refinado e se
transforma em Escudo de ferro após uma batalha completa. O ferro é consumido;
o escudo preserva identidade, posição, tamanho 2×2 e rotação. Seu valor passa
a 7 de ouro (4 do escudo + 3 do ferro), com venda por 3. Continua geral e
consultável no catálogo, sem aparecer nas ofertas da loja. Cada ferro é usado
em apenas uma receita; se houver espada e escudo encostados, a espada é a escolha
inicial. Pegar e soltar o ferro na mesma posição alterna o resultado destacado
em verde. A escolha é respeitada após a batalha. As estrelas continuam controlando
o efeito de gerar armadura durante o combate. Com dois ferros, ambos os equipamentos podem ser fundidos.

A Espada de ferro mantém o tamanho 1×3 da receita e tem atributos próprios:
3 de dano, 90% de precisão, custo de 1,8 de estamina, recarga de 2,5 segundos,
3% de chance crítica e dano crítico adicional de 50% (4,5 de dano no crítico).
Acertar o primeiro golpe tem 10% de chance de um segundo imediato; acertar o
segundo tem 20% de chance de um terceiro imediato. Os extras não gastam energia
nem reiniciam a recarga; cada um tem precisão e crítico próprios. A sequência
para ao errar, falhar o sorteio ou chegar ao terceiro golpe. Cada golpe pode
ativar um Ferro refinado vizinho. O terceiro golpe tem exatamente 60% de chance
crítica, mantendo o adicional de dano em 50%: 4,5 de dano quando crítico.
Os primeiros dois golpes continuam com 3% de chance crítica, e todos os três
precisam passar no sorteio de 90% de precisão para acertar.
Preencher o TXT não muda o jogo automaticamente; os dados são aplicados em
`src/data/combatItems.js` após a definição.

O fluxo foi conferido no Edge com mouse (1440×900) e toque emulado (390×844):
compras repetidas, consulta de ofertas, bolinhas ao segurar o ferro, efeito de
armadura, retorno automático, fusão, compras na rodada seguinte, uso da espada
forjada e cancelamento sem fusão.

O motor usa passos de 100 ms independentes da taxa de frames. Há indicador de
recarga/falta de estamina, animação de ataque e um resumo dos últimos golpes.
Itens com recarga começam cinza e recuperam a cor de baixo para cima conforme
o tempo passa. Ao atacar (incluindo erro ou ataque extra), o item cresce 12% e
volta ao tamanho normal; a recarga reinicia no instante real do uso. Itens
passivos mantêm sua cor e a poção consumida continua esmaecida.
Quando um golpe extra é ativado, o item pisca em azul por 180 ms e volta à
aparência da recarga. Isso inclui o terceiro golpe da Espada de ferro, mesmo
quando o extra erra. O brilho acompanha 1x/2x/3x e não altera o progresso da recarga.
O preenchimento cinza/cor, o pulso e a restauração de tamanho foram conferidos
no Edge com mouse e toque emulado em 1x, 2x e 3x, incluindo redimensionamento
durante a animação e armas giradas.
O botão pequeno abaixo dos personagens alterna 1x → 2x → 3x → 1x, acelerando
o relógio, recargas, regeneração e animações. A seleção é preservada ao
redimensionar a janela; cada nova batalha começa em 1x.
O combate usa tempo real em primeiro plano, independente da suavização de FPS
do Phaser. Sair da aba ou abrir a ficha de um item pausa o relógio; voltar
retoma imediatamente a velocidade selecionada, sem acumular o tempo ausente.
O teste `node scripts/smoke-weapons.mjs --speed-only` alterna abas reais três
vezes e mede a retomada em 3x, além de conferir a pausa em segundo plano.

O combate foi verificado no Edge com mouse (1440×900) e toque emulado (390×844):
início automático, ataques simultâneos, ordem dos indicadores, consumo da armadura,
cura/consumo da poção, espera e recuperação de estamina, empate, congelamento do
resultado, redimensionamento e retorno à loja sem alterar o inventário.

Validada no Edge com mouse (1440×900) e toque emulado (390×844): transição ao
concluir compras, posição das mochilas e personagens, duas barras de vida,
preservação da organização e rotação, exclusão da reserva e retorno à loja.
O layout ampliado também foi conferido em 1069×886, 1440×900 e 960×720, com
redimensionamento para 390×844 e volta ao computador, sem duplicação da interface
ou alteração das peças. A referência visual é o arquivo `../pc.png`.

Para conferir o fluxo, pegue uma mochila e um equipamento, organize ambos,
volte à loja, confira que as ofertas podem ser compradas novamente e conclua
as compras. Confira também a recusa de conclusão com a mochila vazia.

O fluxo de compras foi conferido no Edge headless com mouse (1440×900) e
toque emulado (390×844): aquisição, arraste de mochilas
e equipamentos, preservação ao voltar à loja, conclusão e reinício da coleção.

## Testar pelo navegador

Endereço de publicação: https://BrayanCarneiro.github.io/BackPack-Ulbris/

O workflow `.github/workflows/deploy-pages.yml` testa, compila e publica o jogo
a cada push na branch `main`. O GitHub Pages precisa estar habilitado com
origem **GitHub Actions** nas configurações do repositório.
O link passa a funcionar após a primeira publicação bem-sucedida.
O repositório é público para permitir a hospedagem no plano atual da conta.
Se ele voltar a ser privado, será necessário um plano compatível ou outra
hospedagem para continuar disponibilizando o jogo.
Referência: [publicação de projetos Vite](https://vite.dev/guide/static-deploy#github-pages).

## Executar localmente

Requer Node.js 22.12+ e npm.

```sh
npm install
npm run dev
```

Abra o endereço exibido pelo Vite (normalmente http://127.0.0.1:5173).
No PowerShell, se `npm.ps1` estiver bloqueado, use `npm.cmd install`
e `npm.cmd run dev`. Não é necessário alterar a política de execução.

```sh
npm run build
npm run preview
```

O build é gerado em `dist/`. O preview serve esse build localmente.
Para testar na mesma rede de um celular, execute `npm run dev -- --host 0.0.0.0`
e acesse o IP local do computador na porta indicada. Isso depende de a rede
e o firewall permitirem a conexão.

## Organização

- `docs/referencias/`: anotações de itens e receitas, incluindo conteúdo planejado; não são carregadas pelo jogo.
- `docs/brand/`: imagem original da logo, usada por `scripts/prepare-brand.mjs`.
- `src/main.js`: entrada da aplicação e encerramento da instância durante HMR.
- `src/config/`: configuração do Phaser e tema visual.
- `src/scenes/`: Boot → Preload → Menu → Shop → Battle, com compra e organização integradas e ItemInfo sobreposta para consultas.
- `src/components/`: botões e visualização/interação da área de organização.
- `src/systems/PackingBoard.js`: regras de posicionamento, sem dependência do Phaser.
- `src/entities/`: reservado para entidades futuras.
- `src/data/packingPrototype.js`: dimensões e peças provisórias, copiadas a cada partida.
- `src/utils/`: reservado para utilitários compartilhados futuros.
- `public/assets/`: logo otimizada em WebP e PNG de fallback, compartilhada pela home e pelo menu.

O jogo inicia diretamente no Phaser, usando o mesmo menu desde a primeira visita.
Todas as imagens (logo, personagens, itens e animações de batalha) são carregadas
na abertura, antes de exibir o menu, sem barra ou mensagem de progresso.
As telas seguintes reutilizam essas texturas em memória, sem downloads por etapa.
`src/scenes/PreloadScene.js` reúne os grupos de `src/data/sceneAssets.js` e prepara
as variantes visuais da batalha. `src/scenes/AssetScene.js` mantém o fallback para
PNG e a opção de tentar novamente caso as imagens falhem.
Game conecta o modelo da grade à interface.
Os 31 equipamentos compartilham um [atlas de itens gerais](docs/art/items/atlas.md),
com recortes por ID. `npm run assets:items` recria os atlas a partir das artes
existentes, separando os arquivos pela classe definida em `pool`.
`src/config/packingLayout.js` concentra as medidas da interface do protótipo.

A resolução lógica padrão é 720 × 1280 (vertical), configurada em
`src/config/gameConfig.js`. `Phaser.Scale.FIT` preserva a proporção e
`CENTER_BOTH` centraliza o canvas. Telas com proporções diferentes exibem
margens; o conteúdo não é cortado nem esticado. O contêiner acompanha a altura
visível do navegador e considera as áreas seguras do dispositivo.
A cena de batalha ajusta sua largura lógica no computador, mantendo 1280 de
altura, para ampliar as mochilas e distribuir os personagens pela arena.

Não há motor de física. O `update` da arena alimenta o motor de combate,
que é independente do Phaser e testado separadamente.
O projeto usa recursos locais e formas/textos nativos do Phaser.
Capacitor será integrado em uma etapa futura.

## Verificação manual

1. Execute o servidor e confirme que o menu aparece sem erros no console.
2. Clique/toque em **Jogar** e compre ofertas na tela integrada de preparação.
   Arraste primeiro uma mochila para a grade e depois um equipamento sobre ela.
3. Tente sobrepor itens ou soltá-los no espaço vazio: a posição anterior deve
   ser restaurada. O contorno verde/vermelho indica a validade durante o arraste.
4. Arraste diretamente as mochilas 4×4, 5×1 e 2×2 por uma parte livre de itens.
   Soltar sobre mochilas vazias envia as atingidas para a reserva. Uma mochila
   com itens fica protegida e impede o encaixe.
5. Devolva um item à reserva para liberar espaço. Itens e mochilas podem ser
   movidos a qualquer momento, sem selecionar um modo.
6. Compre mais itens sem sair da organização e confira que aparecem na reserva.
   No celular, confira as seis ofertas acima da mochila compacta. Use **Voltar ao
   menu** e **Jogar** novamente: a coleção recomeça vazia.
7. Redimensione a janela e teste as duas orientações, conferindo proporções e interação.
8. Clique/toque em **Expandir** na reserva. Ela cresce sobre a parte inferior
   da área de organização; **Recolher** restaura o tamanho compacto.
9. Arraste uma mochila ou item para a reserva. Guardar peças ou substituir
   mochilas não expande o painel: a expansão acontece apenas pelo botão. Para guardar
   uma mochila diretamente, retire seus itens primeiro.
10. Puxe uma peça guardada de volta: a reserva se recolhe automaticamente,
    liberando toda a área para posicionamento. As miniaturas voltam ao tamanho
    real durante o arraste. Recolher a reserva não apaga seu conteúdo.

## Regras provisórias de organização

A área externa tem 8×8 células; esse tamanho é ajustável nos dados do protótipo.
Mochilas podem ficar lado a lado ou uma acima da outra. A mochila arrastada
tem prioridade sobre mochilas vazias, que vão inteiras para a reserva.
Mochilas com qualquer parte de um item dentro têm prioridade sobre a arrastada:
se o encaixe atingir uma delas, a tentativa inteira é recusada, preservando
todas as peças e suas orientações. Isso também vale para peças giradas ou
vindas da reserva. Um item entre duas mochilas protege ambas, mesmo que o
encaixe atinja uma célula distante desse item.
Um item pode atravessar a divisa entre mochilas adjacentes se todas as suas
células estiverem apoiadas em mochilas e livres de outros itens.
Mochilas com itens ficam travadas: não é possível iniciar o arraste, mudar
sua posição, girá-las ou enviá-las à reserva, mesmo que os itens continuassem
apoiados na posição resultante. Retirar o último item libera a mochila
automaticamente. Itens que atravessam duas mochilas travam ambas.
Mochilas guardadas não oferecem suporte nem ocupam células da área principal.
Itens e mochilas giram em incrementos de 90° sobre o próprio centro.
Durante o arraste, pressione **Espaço** para girar. Também é possível selecionar
uma peça com clique/toque e usar **Girar · 90°**. Um segundo toque no botão durante
o arraste também é suportado. O texto permanece legível na nova orientação.
No tabuleiro, a posição final se ajusta à grade. Se o encaixe falhar, posição
e orientação anteriores são restauradas. A rotação não expande a reserva.

## Validação do protótipo

`node scripts/smoke-preparation.mjs` valida a preparação integrada no Edge com
mouse (1440×900) e toque emulado (390×844): compras na reserva, arraste de mochilas
e itens, escolha de fusão, rotação, consulta, venda, ofertas fixadas, expansão da
reserva, redimensionamento e retorno da batalha com a fusão escolhida.

```sh
npm test
```

Os testes com o executor nativo do Node verificam fusões, itens gerais, classe,
consumíveis, regeneração, pedras e seus limites, economia, jornada, rivais,
fadiga, vida inicial de 30, fichas, receitas,
atributos apresentados, combate simultâneo,
estamina, crítico, ataque extra, bloqueio, armadura, poção, resultados, compras com estoque,
identidades independentes das cópias, estrelas, bônus de armadura, fusão pós-batalha,
conclusão das compras, limites, colisões, suporte
entre mochilas adjacentes, proteção de mochilas ocupadas, substituição de vazias, retorno à
reserva, rotação com validação de encaixe e isolamento do estado por partida.
As verificações de interface usam uma instalação temporária do Playwright,
que não faz parte das dependências do jogo.
O protótipo passou no Edge headless com mouse em 1440×900 e toque emulado
em 390×844: encaixe válido, recusa por colisão/falta de suporte, movimento
de mochilas, devolução à reserva e reinício ao retornar do menu.
Não houve erros no console durante esses testes. O build também passou.
A reserva expansível foi validada com mouse e toque emulado: expansão,
recolhimento, envio/recuperação de mochilas, prioridade sobre mochilas atingidas,
armazenamento de itens sem apoio e reinício da cena, sem erros no console.
A rotação passou na verificação no Edge: Espaço durante o arraste, botão por
toque, dois contatos simultâneos, dimensões/encaixe atualizados, restauração
após drop inválido e atalho sem duplicação depois de reiniciar a cena.

## Validação da etapa 1

- Build de produção concluído com `npm run build`.
- Navegação de ida e volta testada no Edge headless em 1440 × 900,
  390 × 844 e 844 × 390, incluindo redimensionamento e toque emulado.
- Nenhum erro de execução ou recurso ausente nesses testes.
- A validação móvel foi emulada; ainda falta testar em aparelhos físicos.

O jogo usa o Phaser core com as fábricas necessárias, em um arquivo separado
para cache. O JavaScript caiu de 1,29 MB para cerca de 748 kB minificados
(204 kB com gzip). O Vite ainda avisa que o motor ultrapassa 500 kB.
Consulte a [revisão de desempenho](reports/performance-review.md) para medições,
otimizações, comandos de validação e limites dos testes em aparelhos emulados.
Os relatórios de [lazy loading](reports/lazy-loading.md) e
[menu leve e batalha antecipada](reports/loading-menu-warmup.md) registram
experimentos anteriores. O menu HTML e o carregamento por etapa foram removidos;
esses relatórios não descrevem o fluxo atual.

Referências: [Vite](https://vite.dev/guide/) e
[escala no Phaser 3](https://docs.phaser.io/api-documentation/3.90.0/constant/scale).
