# Leitura da bateria de 300 combates

Foram executadas exatamente 100 lutas por fase, 300 no total, com 300 sementes
distintas. Cada fase tem cinco builds e dez pares; cada par disputa dez lutas,
cinco de cada lado. Cada build aparece em 40 lutas, portanto não são 100 lutas
por build. Composições e encaixes foram fixados antes dos resultados.

Os orçamentos de 14, 34 e 70 ouro incluem mochilas e o custo dos ingredientes
das fusões. O início representa uma mochila de baixo investimento, possível
na fase inicial; não representa necessariamente as ofertas garantidas da
primeira loja. Os dois primeiros patamares têm, respectivamente, 16 e 32
espaços; o último também usa 32. Todas as posições e colisões passaram pelo
PackingBoard. A busca de encaixe foi geométrica, com 8.000 tentativas por build;
não garante o melhor encaixe possível nem a ativação de ambas as armas por
todo suporte. Os alvos efetivamente ativos estão no JSON.

## Alertas principais

- **Dois arcos no meio: 40 vitórias em 40 aparições.** Venceu cada uma das quatro
  outras builds por 10–0. A composição inclui elmo de couro, escudo de madeira,
  regeneração, cristal branco e poção de vida. São duas armas com consumo
  nominal combinado de 1 estamina por segundo, igual à regeneração base;
  a bateria registrou zero espera por estamina. É um forte candidato a uma
  investigação de eficiência do pacote de arcos, defesa e cura. Não isola o
  efeito do arco em relação ao investimento diferente das outras builds.
- **Fortaleza de ferro no fim: 38 vitórias, uma derrota e um empate.** Começa
  com 35 de armadura, dois escudos e duas espadas de ferro. A armadura de ferro
  alcança os dois escudos nas estrelas, gerando 8 de armadura a cada 5,9 s.
  Gerou 71,2 de armadura por luta, em média. A absorção total média foi 47,474,
  contando a armadura inicial: nem toda a geração foi utilizada. Venceu
  dourado, vampírico e machados por 10–0 cada; contra fogo/vermelho/armadura
  foram oito vitórias, uma derrota e um empate. O alerta é a combinação de
  bloqueios, armadura renovável e armas, sem atribuir toda a vantagem a um
  único componente.
- **Machados no fim: quatro vitórias e 36 derrotas.** Mesmo com dois cristais
  energéticos e duas poções de vigor, a build esperou estamina por 21,682 s
  em lutas de duração média de 39,61 s. Usou celeridade, que aumenta a demanda
  contínua. Isso aponta uma composição sobrecarregada de armas caras em
  estamina; não demonstra que o machado isolado precisa de aumento de dano.
- **Adaga e pedra de fogo no início: uma vitória e 39 derrotas.** A pedra
  gerou apenas 2,638 de dano médio de queimadura. Preparar a receita tem um
  custo imediato de força; a futura evolução não foi creditada à luta atual.
  Comparar também a jornada antes de tornar a peça de preparação mais forte.

## Cristais e Vampírico

- O dourado terminou com 15 vitórias e 25 derrotas. Última Luz ativou em 32
  das 40 lutas, curando 6,8 por ativação e 5,44 por aparição. Não houve sinal
  de dominância dessa build; isso não prova que o dourado seja fraco em todo
  arsenal, nem mede uma build equivalente com os quatro cristais separados.
- No confronto direto do meio, fogo com azul venceu fogo com vermelho por
  10–0. A composição é igual salvo a troca do cristal. É um sinal de resposta
  defensiva à queimadura nesta configuração, com apenas dez sementes.
- O bônus vermelho foi pequeno nas configurações selecionadas: 1,33 de dano
  adicional médio por luta no meio; no pacote dourado, 3,989 no fim. Esses
  valores já consideram críticos e sua mitigação, mas são anteriores ao
  bloqueio e à absorção da armadura. Não representam dano adicional útil à vida.
- O Vampírico terminou com 11 vitórias e 29 derrotas, com 5,161 de cura
  vampírica média. Não mostrou dominância contra estas outras quatro builds.
- Branco e preto não foram isolados em pares equivalentes; não há evidência
  suficiente nesta bateria para recomendar mudar suas porcentagens.

## Próxima investigação recomendada

Primeiro comparar duas armas físicas com o mesmo pacote de cura e defesa dos
arcos. Depois comparar a Fortaleza com apenas uma mudança por vez: segundo
escudo, armadura geradora ou sua frequência. Assim é possível separar vantagem
de composição de vantagem de item antes de propor ajustes. Nenhum atributo foi
modificado durante esta bateria.

Não ocorreram combates sem término, valores não finitos ou vida, armadura,
estamina e resistência negativas nas verificações executadas. Isso não substitui
uma auditoria de todos os efeitos nem prova ausência de bugs.

Há apenas dez sementes por par e cinco builds por fase; são resultados
descritivos. Acesso às ofertas, gasto de renovação, demora de fusão e sobrevivência
até montar os conjuntos não foram simulados. As taxas não são da campanha ou
de jogadores humanos.

Resultados e composições: [stages-300.md](stages-300.md).
Posições, sementes e métricas: [stages-300.json](stages-300.json).
