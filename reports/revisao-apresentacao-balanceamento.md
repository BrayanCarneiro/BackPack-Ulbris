# Revisão da apresentação de balanceamento

Fonte histórica: apresentação de balanceamento comparada com o código da época.
O HTML avulso foi removido na limpeza do projeto; esta revisão e os resultados do experimento foram preservados.
Esta revisão não altera atributos, regras ou conteúdo do jogo.

## Avaliação

A proposta central faz sentido: medir as interações antes de expandir o catálogo,
comparar builds com orçamento e capacidade iguais e alterar um parâmetro por vez.
Os números teóricos da apresentação estão coerentes para os recortes declarados.
As notas 8/10, 5/10 e 9/10 são opiniões de design, não medições.

Algumas informações tratadas como ausentes na apresentação já existem no código:

- Vida inicial: 30; estamina inicial e máxima base: 4,4; regeneração: 1/s.
- Ouro inicial: 14; seis ofertas; renovar custa 1. Renda: 8 na rodada 2,
  crescendo até 13 por rodada. Área de organização: 8×8, dependente de mochilas.
- Queimadura: 20% por acerto, inclusive com o dano físico totalmente bloqueado;
  4 de dano direto à vida a cada segundo, dois pulsos por acúmulo independente.
  Ignora armadura e não tem teto explícito de acúmulos.
- Atordoamento: 15% por acerto, duração de 1 s; renova a duração restante,
  sem simplesmente somar um segundo por aplicação.
- Pedra de amolar: teto de +0,9 por arma. Celeridade: multiplicativa,
  com recarga mínima de 70% da original; três pedras reduzem 27,1%, não 30%.
- O catálogo jogável tem 21 itens e quatro receitas; oito receitas estão
  documentadas em itens.txt, incluindo conteúdo ainda planejado.

## O que eu adotaria, testaria e adiaria

| Proposta | Avaliação |
|---|---|
| Testar queimadura de 4 para 2 por segundo | Prioridade alta. A vantagem aparece nas contas e no motor real. Dois ainda é um candidato experimental. |
| Escudo de ferro de 6 para 9 de armadura | Boa hipótese para uma segunda etapa isolada. Hoje a fusão perde 3 de armadura e ganha bloqueio. |
| Celeridade com teto de 20% | Testar após isolar a queimadura. Reduzir recarga em 30% significa até 42,9% mais frequência; é uma interação desejável em parte, não um defeito por definição. |
| Amolar com limite baseado na velocidade | Não aplicaria agora. Bônus fixo favorecer armas rápidas cria identidade de build. Comparar DPS adicional, ouro, encaixe e estamina antes de criar outra regra. |
| Ferro com intervalo de 2 s | Adiaria. Pode cortar fortemente a função do item com dois vizinhos rápidos. Medir armadura gerada e efetivamente absorvida primeiro. |
| Regeneração de 1,2 para 1/s | Não há evidência suficiente. Hoje custa 4 ouro e 2 espaços para até 13,2 de cura; vida custa 2 ouro e 1 espaço para 12 de cura. O momento da ativação e a cura útil importam. |
| Limite adicional de atordoamento | Adiaria até medir controle com várias armas. Uma arma isolada tem frequência teórica de aproximadamente 0,035 atordoamentos/s sem suporte, antes de considerar a luta real. |
| Novas receitas e completar todo conteúdo planejado | Depois de estabilizar os itens atuais. Não precisamos completar todos os itens para começar a testar as builds disponíveis. Cristais continuam fora deste ajuste. |

Uma fusão deve ter benefício claro, mas não precisa melhorar todo atributo.
Para golpes recebidos suficientemente fortes, o bloqueio médio isolado do
escudo de madeira é 0,594 por acerto recebido; o de ferro é 0,81. O ganho de
0,216 só compensa os 3 de armadura inicial após cerca de 14 acertos, em média.
Contra golpes pequenos, parte do bloqueio é desperdiçada. Isso sustenta testar
o escudo, sem provar sozinho que 9 é o número final.

## Conferência das contas de ataque

DPS esperado contínuo, incluindo precisão e crítico. A coluna ampliada inclui
os ataques extras das espadas e os dois pulsos completos da queimadura;
não inclui defesa, espera por estamina nem o benefício do atordoamento.

| Arma | DPS básico | DPS com extras/queimadura | Estamina/s |
|---|---:|---:|---:|
| Espada de treino | 0,804 | 0,875 | 0,600 |
| Adagas rápida | 0,760 | 0,760 | 0,308 |
| Machadinha | 0,813 | 0,813 | 0,500 |
| Arco | 1,110 | 1,110 | 0,500 |
| Espada de ferro | 1,096 | 1,218 | 0,600 |
| Machado de batalha | 1,321 | 1,321 | 0,781 |
| Adagas flamejantes | 1,216 | 2,385 | 0,385 |

Todas as armas isoladas consomem menos que a regeneração base de 1/s.
O gargalo aparece principalmente ao combinar armas ou acelerar as mais caras.
Por exemplo, dois machados sem suporte demandam aproximadamente 1,563/s;
um machado com recarga reduzida em 30% demanda aproximadamente 1,116/s.
A afirmação de que a regeneração ainda é desconhecida não vale para o código atual.

## Experimento controlado no motor atual

Foram 8.400 combates: sete adversários, duas variantes de queimadura e
300 sementes por confronto, repetidas com os lados invertidos. As mesmas
sementes foram usadas nas duas variantes. As repetições espelhadas são
correlacionadas, não amostras totalmente independentes.

Todas as builds custam 14 ouro, incluindo uma Mochila viajante de 4×4 por
4 ouro. Os encaixes foram validados pelo PackingBoard. A build observada é
Adagas flamejantes + Escudo de madeira. Só o dano de queimadura variou,
em memória no processo de diagnóstico; o código do jogo permaneceu intacto.

| Adversário | Vitória com queimadura 4 | Vitória com queimadura 2 |
|---|---:|---:|
| Espada de ferro + Escudo de madeira | 97,8% | 93,5% |
| Machado de batalha + Escudo de madeira | 92,2% | 73,0% |
| Duas Machadinhas + Escudo de madeira | 85,7% | 64,0% |
| Duas Adagas rápida + Escudo de madeira | 97,8% | 89,2% |
| Duas Espadas de treino + Escudo de madeira | 97,8% | 86,0% |
| Arco + Poção de vida + Escudo de madeira | 93,7% | 76,5% |
| Espada de treino + Escudo de ferro | 100,0% | 99,8% |

Os empates não contam como vitória. Os resultados completos, sementes,
composições e coordenadas estão em `revisao-apresentacao-experimento.json`.

Limites: são builds prontas, depois da fusão; não há simulação de ofertas,
custo de renovação, rodada de obtenção ou jornada. O espaço disponível é
igual, mas o espaço utilizado por cada build varia. Os adversários foram
escolhidos para diagnóstico, não representam todo o conjunto de estratégias.
Os resultados justificam a prioridade da queimadura; não demonstram que
reduzir para 2 resolve todo o balanceamento ou define uma taxa geral de vitória.
O relatório antigo balance-current.md antecede estas armas e não substitui
uma nova medição da campanha.

## Início recomendado

1. Usar o estado atual como referência e testar apenas queimadura de 4 para 2,
   mantendo chance de 20%, dois pulsos e duração independente.
2. Comparar versões com e sem suportes contra dano pesado, múltiplas armas,
   armadura, bloqueio e cura; manter orçamento e capacidade iguais.
3. Se a dominância persistir, experimentar um segundo ajuste isolado:
   chance de aplicação ou aplicação em golpes totalmente bloqueados.
   Não misturar esses ajustes com a primeira mudança.
4. Testar separadamente o escudo de ferro com 9 de armadura.
5. Só depois avaliar celeridade, geração de armadura e taxas da campanha.

Priorizar dano útil por origem, tempo de luta, vitórias/empates, armadura
absorvida, cura efetiva, espera por estamina e tempo sob atordoamento.
Não buscar 50% em todos os confrontos: vantagens e respostas entre builds
são desejáveis; uma combinação dominar quase todas é que merece investigação.
