# Primeiras artes de itens

Referência visual: `Cavaleiro Sombrio com Espada e Escudo.png` na raiz do projeto.
Artes geradas com a ferramenta integrada de imagens, sem CLI/API. Estética
geométrica medieval, cores sóbrias e fundo transparente.

| Item | Encaixe | Asset do jogo | Dimensões | WebP |
| --- | --- | --- | --- | --- |
| Escudo de madeira | 2×2 | `public/assets/items/shield.webp` | 256×250 | 10.604 bytes |
| Ferro refinado | 1×1 | `public/assets/items/refined-iron.webp` | 128×109 | 2.174 bytes |
| Espada de treino | 1×3 | `public/assets/items/sword.webp` | 175×512 | 6.758 bytes |

Os PNGs `*-source.png` nesta pasta preservam os resultados originais. As versões
de jogo possuem PNG de fallback na mesma pasta dos WebPs. `node scripts/prepare-item-art.mjs`
remove as margens transparentes e exporta os tamanhos menores, sem alterar o desenho.

As artes aparecem na loja, mochila, reserva, batalha, catálogo, ficha, receitas
e mochila vencedora (inclusive no PNG exportado). A rotação acompanha a peça,
respeitando suas dimensões e área de interação. Itens sem arte mantêm sua
representação anterior. Os contornos de raridade, seleção e fusão permanecem;
atrás das novas artes o preenchimento de raridade fica discreto.

Validação: `npm test`, `npm run build`, `node scripts/smoke-item-art.mjs`,
`node scripts/smoke-item-art.mjs --png` e `node scripts/smoke-preparation.mjs`.

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
