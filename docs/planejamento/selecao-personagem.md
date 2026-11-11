# Seleção de personagem

Play abre `CharacterSelectScene`. Selecionar começa uma jornada com `classId: 'arthur'`;
Voltar retorna ao lobby. Nova jornada também passa pela seleção. Arthur é a única
classe disponível, por isso as setas aparecem desabilitadas. Ao adicionar classes
em `src/data/characters.js`, cada entrada deve informar seu retrato e seu cenário;
as setas passam a trocar os dois juntos, preservando os controles da tela.

A composição segue `Selecione Seu Cavaleiro.png`, com adaptação para orientação
vertical. Jogador e todos os rivais usam a arte de Arthur, espelhada no lado inimigo.
O ataque reproduz sequências de oito quadros, ignorando novos eventos visuais enquanto
estiver em curso, sem alterar o dano. Há golpe rápido, normal e crítico, aura de
queimadura, impacto sutil, derrota em cinza e espada erguida na vitória. Passiva e
exclusivos continuam pendentes. Ver [animações de Arthur](animacoes-arthur.md).

## Artes preparadas

Arquivos originais preservados na raiz. Assets derivados com a ferramenta integrada
de imagens (não foi usada API/CLI):

- `public/assets/characters/arthur/portrait.png`: recorte transparente.
- `public/assets/characters/arthur/background.png`: cenário sem interface.

Prompts usados:

```text
Use case: background-extraction. Edit target: supplied knight image. Extract exactly the existing full-body Arthur knight with sword, shield and red cloak onto a truly transparent background. Preserve pose, geometric low-poly shapes, original colors, face, hair, proportions, sword, shield cross, and all details. Remove only dark teal background and oval ground shadow. Entire sword and boots must be visible. No redesign, no text. This is a game character asset.
```

```text
Use case: precise-object-edit. Edit target supplied character selection screen. Create its clean background plate only, same wide 16:9 composition. Remove ALL UI: title, divider, central character, central gold frame, arrows, class label, select button and back button. Reconstruct empty dark teal atmospheric background in their places. Preserve exactly the scenery: large dim low-poly knight with shield on the left, large planted sword and rocky ruins on the right, subtle floating fragments. Keep same low contrast dark teal palette, vignette, original geometric art style and placements. Center should be empty dark teal for live UI overlay. No text, no borders, no UI, no new objects.
```

Validação: `npm test`, `npm run build` e, com Vite ativo,
`node scripts/smoke-character-select.mjs` para navegação, seleção, toque,
redimensionamento e retratos na batalha.
