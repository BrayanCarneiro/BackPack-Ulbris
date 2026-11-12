# Artes de itens

O jogo agora usa um **atlas compartilhado** para as 31 artes de equipamentos,
carregado ao entrar na loja ou no catálogo. Os arquivos individuais listados
abaixo são fontes para a geração e não são mais requisitados durante o jogo.
Veja a [imagem de exemplo, o atlas transparente e o mapa de recortes](atlas.md).

As mochilas usam desenho de células, sem PNG ou WebP no jogo. Viajante e alongada
têm fundo marrom claro e borda marrom escura; a Mochila reforçada (`pouch`, antiga
Bolsa de couro) tem fundo cinza claro e borda cinza escura. Isso vale para loja,
reserva, organização, catálogo, ficha, batalha e vitória. Os arquivos de imagem
das mochilas abaixo são apenas propostas arquivadas, sem uso no jogo.

Referência visual: `Cavaleiro Sombrio com Espada e Escudo.png` na raiz do projeto.
Artes geradas com a ferramenta integrada de imagens, sem CLI/API. Estética
geométrica medieval, cores sóbrias e fundo transparente.

| Item | Encaixe | Asset do jogo | Dimensões | WebP |
| --- | --- | --- | --- | --- |
| Escudo de madeira | 2×2 | `public/assets/items/shield.webp` | 256×250 | 10.604 bytes |
| Ferro refinado | 1×1 | `public/assets/items/refined-iron.webp` | 128×109 | 2.174 bytes |
| Espada de treino | 1×3 | `public/assets/items/sword.webp` | 175×512 | 6.758 bytes |
| Mochila viajante | 4×4 | `public/assets/items/traveler-bag.webp` | 512×484 | 30.220 bytes |
| Mochila alongada | 5×1 | `public/assets/items/long-bag.webp` | 640×214 | 17.268 bytes |
| Bolsa de couro | 2×2 | `public/assets/items/pouch.webp` | 255×256 | 10.002 bytes |
| Poção de vida | 1×1 | `public/assets/items/potion.webp` | 125×128 | 3.972 bytes |
| Adagas rápidas (uma adaga na arte) | 1×2 | `public/assets/items/quick-daggers.webp` | 153×384 | 5.884 bytes |
| Machadinha | 2×2 em L | `public/assets/items/hatchet.webp` | 243×256 | 7.452 bytes |

Todos os oito itens comuns possuem arte. Espada e escudo foram preservados;
seis novos originais foram gerados pela ferramenta integrada `image_gen`.
O conjunto de prompts está em `common-prompts.json`.
O ajuste posterior de `quick-daggers` usa uma única adaga; o prompt da edição
com `image_gen` está em `quick-daggers-edit-prompt.txt`.
O ferro refinado é incomum e continua com sua arte existente. As mochilas equipadas nas telas de batalha
e vitória continuam representadas como áreas de suporte para facilitar a leitura dos itens.

Os PNGs `*-source.png` nesta pasta preservam os resultados originais. As versões
de jogo possuem PNG de fallback na mesma pasta dos WebPs. `node scripts/prepare-item-art.mjs`
remove as margens transparentes e exporta os tamanhos menores, sem alterar o desenho.
Para exportar apenas um subconjunto, passe os IDs como argumentos ao script.

As artes aparecem na loja, mochila, reserva, batalha, catálogo, ficha, receitas
e mochila vencedora (inclusive no PNG exportado). A rotação acompanha a peça,
respeitando suas dimensões e área de interação. Itens sem arte mantêm sua
representação anterior. Os contornos de raridade, seleção e fusão permanecem;
atrás das novas artes o preenchimento de raridade fica discreto.

Validação: `npm test`, `npm run build`, `node scripts/smoke-item-art.mjs`,
`node scripts/smoke-item-art.mjs --png` e `node scripts/smoke-preparation.mjs`.

## Incomuns e espada de ferro

Todos os nove incomuns têm arte: ferro refinado (preservado), poções de vigor e
proteção, pedra de amolar, cristais vital, armadurado e energético, elmo e
peitoral de couro. Também foi criada a espada de ferro, que é rara e obtida
por receita, com lâmina afiada com sulco, guarda curva e cabo escuro para se
distinguir da espada de treino.

Originais: `docs/art/items/<id>-source.png`. Assets usados no jogo:
`public/assets/items/<id>.webp`, com fallback `<id>.png`.
Prompts completos: `uncommon-prompts.json`; ferramenta integrada `image_gen`,
com fundo transparente. O recorte da espada e das duas poções foi refinado
com o prompt de limpeza em `uncommon-cleanup-prompt.txt`.

| ID | Dimensões exportadas | WebP |
| --- | --- | --- |
| vigor-potion | 233×256 | 9.902 bytes |
| protection-potion | 236×256 | 7.950 bytes |
| whetstone | 256×246 | 6.742 bytes |
| vital-crystal | 256×249 | 7.262 bytes |
| armored-crystal | 256×255 | 8.126 bytes |
| energy-crystal | 256×252 | 6.940 bytes |
| leather-helmet | 256×122 | 7.156 bytes |
| leather-chestplate | 255×384 | 17.236 bytes |
| iron-sword | 159×512 | 10.888 bytes |

Validação desta etapa: build e smoke de navegação/carregamento em WebP e PNG,
incluindo todos os novos ícones no catálogo. As mochilas continuam sem PNG.

## Raros

Atualização: armadura de ferro (`iron-armor`) passou de épica para rara. Agora
são 15 raros. Arte própria de placas de ferro, original em
`iron-armor-source.png`, exportada como `public/assets/items/iron-armor.webp`
e `iron-armor.png`, 261×384 (WebP: 18.920 bytes). Gerada com `image_gen`;
prompt em `iron-armor-prompt.txt`.

Os 14 raros agora têm arte integrada. A espada de ferro da etapa anterior foi
preservada; foram gerados 13 novos originais com a ferramenta integrada
`image_gen`, fundo transparente e prompts em `rare-prompts.json`.
As adagas flamejantes usam uma única arma, como as adagas rápidas. Escudo,
elmo e machado de receita têm material e silhueta distintos dos itens básicos.

Originais em `docs/art/items/<id>-source.png`; versões de jogo em
`public/assets/items/<id>.webp` e `<id>.png`.

| ID | Dimensões exportadas | WebP |
| --- | --- | --- |
| bow | 247×384 | 11.114 bytes |
| fire-stone | 256×241 | 9.496 bytes |
| haste-stone | 256×170 | 5.036 bytes |
| carmine-stone | 256×229 | 7.322 bytes |
| regeneration-potion | 120×256 | 6.558 bytes |
| blue-crystal | 256×253 | 7.896 bytes |
| red-crystal | 256×243 | 8.114 bytes |
| white-crystal | 241×256 | 6.274 bytes |
| black-crystal | 256×255 | 6.688 bytes |
| iron-shield | 238×256 | 10.828 bytes |
| iron-helmet | 256×125 | 6.926 bytes |
| battle-axe | 253×384 | 9.424 bytes |
| flaming-daggers | 185×384 | 11.138 bytes |

Validação: build, presença dos arquivos de todos os raros e smoke em WebP/PNG
com todos os ícones cadastrados no catálogo. Revisão visual das três páginas.

## Épicos

As duas artes épicas foram criadas com `image_gen` a partir das receitas e
integradas ao jogo. Prompts de geração em `epic-prompts.json`; refinamentos
de recorte e silhueta em `epic-edit-prompts.json`.

- `golden-crystal`: núcleo dourado com facetas azul, vermelha, branca e preta,
  remetendo à fusão dos quatro cristais e à Última Luz. Original:
  `golden-crystal-source.png`; WebP/PNG em `public/assets/items/`, 250×256,
  WebP de 14.574 bytes.
- `vampiric-chestplate`: placas de ferro escuro, ombreiras na faixa superior,
  veios carmim e gemas vermelha e verde incorporadas ao peito, representando
  armadura de ferro + Pedra Carmim + Cristal vital. Original:
  `vampiric-chestplate-source.png`; WebP/PNG em `public/assets/items/`, 512×384,
  WebP de 38.896 bytes.

Validação: 16 testes de receitas/efeitos passaram, build concluída, smoke de
carregamento WebP e PNG e revisão visual no catálogo.

## Prompts

Trecho comum:

```text
Use case: stylized-concept. Asset type: inventory equipment icon for a medieval 2D backpack game. The supplied knight image is STYLE REFERENCE ONLY: match its simple low-poly geometric flat shaded shapes, sharp angular facets, muted dark medieval palette, clean readable silhouette, no photoreal textures, no pixel-art outlines, no glossy rendered lighting. Show ONE isolated item only, full object visible, straight front view with small faceted depth as in the knight. TRUE transparent background, no ground shadow, no character, no hands, no text, no numbers, no slot grid, no card border, no glow. Clear edges at tiny in-game scale.
```

### shield

```text
Create a basic WOODEN SHIELD for a 2x2 square inventory footprint. Broad compact heater shield, nearly as wide as tall, flat top with clipped corners and short pointed bottom. Dark warm brown vertical wooden planks with a few broad polygon facets, restrained dull iron rim and two simple dark iron horizontal braces with a few studs. Modest beginner equipment, no heraldry, no gold, no ornate decoration. Upright and centered, fill about 85% of square canvas. Keep silhouette square-compatible.
```

### refined-iron

```text
Create a single REFINED IRON INGOT for a 1x1 square inventory footprint. Compact chunky gray iron bar, trapezoidal beveled block, broad flat top visible with simple low-poly angular facets, cool muted slate gray surfaces with one lighter face, slight three-quarter view, fits a square. No ore rocks, no extra ingots, no symbols. Centered with 10% transparent margin. Its material must match the dull iron armor of the reference knight.
```

### sword

```text
Create a beginner TRAINING SWORD for a vertical 1x3 inventory footprint. Straight upright sword tip UP, short narrow rectangular dark iron crossguard, simple brown leather or wood grip, small polygonal gray pommel. Plain unenchanted dull iron blade, blunt triangular tip, broad flat gray planes just like the sword in the reference but simpler beginner quality. Overall visible bounding box should be THREE TIMES as tall as wide (crossguard maximum width), centered, filling 90% height with transparent sides. No diagonal tilt, no ornate features, no gold, no damage chips. Preserve simple low-poly aesthetic.
```
