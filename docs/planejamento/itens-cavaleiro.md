# Itens da classe Cavaleiro

Implementados em `src/data/arthurItems.js`, exclusivos do grupo `arthur`.
Artes: `public/assets/atlases/items-arthur.{png,webp,json}`.
Prévia: `docs/art/items/items-arthur-preview.png`.

## Regras adotadas para os detalhes não especificados

- O escudo do anel soma à armadura. O gatilho conta a perda acumulada de vida na batalha, mesmo que haja cura entre os golpes.
- A mochila inicial é 4×4, equipada em (0, 0), sem gastar ouro. Seu bônus exige a armadura inteira dentro dela e não acumula entre mochilas.
- Os 10% de eficácia aumentam armadura inicial e gerada, bloqueio em pontos e reduções de dano/crítico/atordoamento da peça. Resistência em cargas e bônus de vida não são multiplicados.
- Bastião protege de golpes, queimadura e sangramento enquanto houver armadura; fadiga mantém sua regra de ignorar proteção.
- Sangramento causa dano direto à vida, com duração própria por acúmulo. Bloqueio total impede aplicação; resistência pode impedi-la. Última Luz do Cristal dourado também remove sangramento; a versão da Excalibur apenas cura.
- A Excalibur conta tentativas de ataque e reinicia o ciclo a cada cinco. No quinto, o bônus de dano entra antes do crítico e a armadura é recuperada mesmo se o golpe errar.
- Espada Grande e Excalibur ocupam 2×4. Sangrenta ocupa 1×3; elmo 2×1; peitoral 2×3; anel 1×1.
- Elmo do Comandante e Espada Sangrenta são raros; Mochila do Cavaleiro é incomum. Armas sem crítico adicional especificado usam +50%.
- Receitas de Arthur exigem ingredientes conectados por bordas e uma batalha completa. Resultado sem espaço vai para a reserva.
- Preços adotados: anel 5, mochila 5, elmo 11, Bastião 9, Sangrenta 12, Espada Grande 18 e Excalibur 34 de ouro.

## 1. Anel do Juramento

- Classe: Cavaleiro.
- Raridade: Incomum.
- Tipo: Joia/pedra.
- Efeito: Ao perder 25% da vida, ganha 10 de escudo.
- Limite: Ativa uma vez por batalha.
- Status: Implementado no jogo, com arte no atlas exclusivo do Arthur.

## 2. Elmo do Comandante

- Classe: Cavaleiro.
- Receita: 1 Elmo de ferro + 1 Cristal armadurado (o cristal reforçado citado na definição) = Elmo do Comandante.
- Armadura: 9.
- Efeitos: Mantém os mesmos efeitos do Elmo de ferro.
- Passiva adicional: Quando a armadura cair para 0, recebe +5 de armadura. Ativa a cada queda para zero; não ativa apenas por começar sem armadura.
- Status: Implementado no jogo, com arte no atlas exclusivo do Arthur.

## 3. Mochila do Cavaleiro

- Classe: Cavaleiro.
- Equipamento inicial: Arthur já começa com ela equipada.
- Aparência: Levemente cinza, menos acinzentada que a mochila de reforço, com uma borda mais escura.
- Passiva: Armaduras dentro da mochila têm 10% a mais de eficácia.
- Status: Implementado no jogo, com arte no atlas exclusivo do Arthur.

## 4. Peitoral do Bastião

- Classe: Cavaleiro.
- Raridade: Raro.
- Armadura: 15.
- Efeito: Enquanto tiver armadura, recebe 10% a menos de dano.
- Status: Implementado no jogo, com arte no atlas exclusivo do Arthur.

## 5. Espada Sangrenta

- Exclusividade: Arthur.
- Tipo: Espada.
- Receita: 1 Espada de ferro + 1 Pedra de amolar + 1 Pedra Carmim = Espada Sangrenta.
- Dano: 5.
- Precisão: 85%.
- Custo de estamina: 1,7.
- Recarga: 2,0 segundos.
- Chance crítica base: 5%.
- Dano crítico adicional: 50%.
- Efeito 1: Ataques têm 30% de chance de infligir 1 acúmulo de sangramento.
- Efeito 2: Enquanto o alvo estiver sangrando, a chance crítica desta arma é de 20%.
- Sangramento: Causa 1 de dano a menos que a queimadura e dura 1 turno a mais. Com a queimadura atual de 3 de dano por 2 turnos, corresponde a 2 de dano por 3 turnos.
- Status: Implementado no jogo, com arte no atlas exclusivo do Arthur.

## 6. Espada Grande do Cavaleiro

- Classe: Cavaleiro.
- Raridade: Épico.
- Tipo: Espada.
- Receita: 1 Espada de ferro + 1 Pedra de amolar + 1 Pedra da celeridade + 1 Ferro refinado = Espada Grande do Cavaleiro.
- Dano: 15.
- Precisão: 80%.
- Custo de estamina: 3.
- Recarga: 3,2 segundos.
- Chance crítica: 10%.
- Efeito: Enquanto você tiver mais de 15 de armadura, esta arma não gasta estamina.
- Status: Implementado no jogo, com arte no atlas exclusivo do Arthur.

## 7. Excalibur — Lâmina do Último Juramento

- Primeiro item lendário.
- Classe: Cavaleiro.
- Raridade: Lendário.
- Tipo: Espada.
- Receita: 1 Espada Grande do Cavaleiro + 1 Cristal dourado = Excalibur — Lâmina do Último Juramento.
- Dano: 20.
- Precisão: 100%.
- Recarga: 2,5 segundos.
- Chance crítica: 10%.
- Última Luz: Herda apenas a ativação de vida extra do Cristal dourado: cura 20% da vida máxima quando a vida chega a 25% ou menos, uma vez por batalha.
- Efeito próprio — Excalibur: A cada quinto ataque, o golpe é imbuído de luz, causando +5 de dano e recuperando 5 de armadura.
- Visual do efeito: A espada brilha em dourado no inventário ao ficar imbuída de luz.
- Valores adotados na implementação: 3 de estamina e +50% de dano crítico adicional; o ciclo de cinco ataques se repete.
- Status: Implementado no jogo, com arte no atlas exclusivo do Arthur.
