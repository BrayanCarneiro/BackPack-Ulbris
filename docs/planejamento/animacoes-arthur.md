# Animações e apresentação da arena

Arthur usa três animações por quadros no Phaser, seguindo a referência
`Cavaleiro em Três Golpes Épicos.png`: estocada rápida, corte em arco e golpe
descendente crítico. Cada animação possui oito poses sequenciais, com preparação,
golpe, continuação e recuperação. Corpo e espada em camadas continuam na espera,
vitória e derrota. Os originais e o retrato da seleção foram preservados.

- Golpes comuns alternam corte em arco (1), estocada (2), corte (1), estocada (2).
  Um crítico usa o golpe descendente (3) e preserva o próximo golpe da alternância.
- A duração completa de qualquer golpe comum é 22% da menor recarga efetiva entre
  as armas equipadas, limitada a 180–720 ms em 1x. O crítico dura 15% a mais para
  reforçar o peso. Com uma arma de recarga 3 s, são 660 ms; com uma adaga de 1,3 s,
  são 286 ms; se a celeridade reduzir a adaga para 0,91 s, são 200,2 ms.
- A recarga vem das armas processadas pelo motor de combate, incluindo pedras de
  celeridade, seus alvos e limites. A arma que disparou o evento não escolhe a pose.
- Durante um golpe, novos eventos visuais são ignorados, sem fila. O dano segue
  normalmente. A velocidade da batalha também escala as animações, preservando a
  aceleração da arma ao alternar 1x, 2x e 3x durante um golpe.
- Dano à vida ou armadura gera duas oscilações de 1,7 pixels lógicos, com duração
  total de aproximadamente 96 ms. Erro e bloqueio total não geram impacto.
- Queimadura ativa mostra halo e uma tonalidade vermelha fraca; o fim do estado
  remove ambos. As variantes de cor são criadas em memória e funcionam em Canvas
  e WebGL, sem filtros pós-processados por personagem.
- Morte remove a aura e deixa corpo e espada cinza. O vencedor ergue a espada;
  empate não produz comemoração. A arena espera 2,6 segundos antes do retorno.
- Reduzir movimento no sistema desativa respiração, avanço do corpo e tremida e
  simplifica a comemoração.

No PC, a altura do corpo é 278 pixels lógicos, e os painéis de mochila têm largura
máxima de 340 e grade de 264. No celular, corpo de 208 e grade de 146. Barras e
números de vida/estamina foram ampliados visualmente e depois ligeiramente
reduzidos a pedido: barras com largura de 228 no PC e 142 no celular. Atributos
não foram alterados.

## Assets e prompts

Ferramenta integrada de imagens, sem CLI/API. Assets salvos em:

- `public/assets/characters/arthur/battle-body.png`
- `public/assets/characters/arthur/battle-sword.png`

As três folhas de golpes e seus prompts estão em [prompts dos golpes](prompts-golpes-arthur.md).

Prompt do corpo:

```text
Use case: precise-object-edit. Edit target is the supplied transparent Arthur knight. Create a game animation BODY layer: remove ONLY the entire sword blade, guard, grip and pommel. Keep the knight's right closed fist and arm exactly in their original position, now empty-handed. Preserve shield, hair, face, geometric low-poly armor, red cape, legs, boots, proportions, all colors and original canvas placement. Keep the same 1227x1282 canvas if possible. Background must remain truly transparent. No other changes, no shadow, no text.
```

Prompt da espada:

```text
Use case: background-extraction. Edit target is the supplied transparent Arthur knight. Extract ONLY his sword as an isolated game animation weapon layer on a truly transparent background. Preserve the same straight long silver low-poly blade, rectangular gray guard, black grip and gray pommel. Remove ALL the knight including hand, shield and cape. Reconstruct the small hidden grip section where the hand was. Center the entire sword vertically point up, completely visible with small transparent margins. No text, no shadow, no redesign.
```

Validação: `npm test`, `npm run build` e `node scripts/smoke-character-select.mjs`
com Vite ativo. O navegador confere desktop/celular, sobreposição de ataques,
recuperação da animação, impacto, ativação/remoção da queimadura, derrota e vitória.
