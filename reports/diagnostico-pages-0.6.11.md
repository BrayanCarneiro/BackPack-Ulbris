# Diagnóstico do GitHub Pages — 0.6.11

Verificação em 12/11/2026, a partir do commit `5a7a06a`.

## Travamento confirmado na publicação

URL testada: https://brayancarneiro.github.io/BackPack-Ulbris/

Ao criar uma batalha com arco, o navegador lançou `TypeError: g.setFillStyle is not a function`, em `BattleBackpack`, durante `drawArena`. O mesmo caminho atende jogador e adversário: a ocorrência não depende de o jogador comprar um arco.

Os itens com `cells` usam `Phaser.GameObjects.Graphics`; itens retangulares usam `Rectangle`. A inclusão das novas artes na 0.6.11 passou a executar `background.setFillStyle(...)` também nos Graphics, que não possuem esse método. A exceção interrompe a criação da arena. Por isso os testes de combate em Node e o smoke anterior, que equipava apenas espada, escudo e ferro, passavam.

Correção: limpar e redesenhar as células dos Graphics com `fillStyle`, mantendo os vazios do formato e a transparência da raridade. Retângulos continuam usando `setFillStyle`.

O diagnóstico ampliado percorreu os 31 equipamentos do catálogo, incluindo formas irregulares, na arena do jogador e em uma visualização inimiga. Não houve exceções após a correção. Isso cobre o erro reproduzido; não demonstra ausência de qualquer outro problema em todos os aparelhos.

## Gargalo de abertura

No acesso à publicação com perfil novo e sem limitação artificial de rede, o menu ficou pronto em aproximadamente **13,6 s**. Não houve requisições que falharam nesse acesso. As sete imagens PNG do personagem eram carregadas antes do menu e somavam **7.524.524 bytes**.

Foram adicionadas versões WebP com qualidade 0,9, mesmas dimensões, transparência e divisão dos sprites. Elas somam **972.506 bytes**, uma redução de aproximadamente **87%** nesses arquivos. Os PNGs permanecem como alternativa automática se WebP falhar. A preparação de quadros e variantes agora aguarda essa alternativa terminar. A abertura também mostra o percentual carregado.

O total de recursos observado via `PerformanceResourceTiming.decodedBodySize` caiu de **8.668.866** para **2.117.175 bytes** (aproximadamente **76%**). Essa medida inclui JavaScript descompactado, não equivale aos bytes efetivos na conexão. A referência antiga veio do Pages; a nova veio do preview local do build, com os mesmos recursos de produção.

Com CPU 4 vezes mais lenta, latência de 100 ms e download limitado a 400.000 bytes/s, o build corrigido abriu o menu em aproximadamente **6,5 s**. Esse tempo não é uma comparação direta com os 13,6 s da publicação, pois os ambientes de rede diferem. A melhoria comprovada é a redução do peso; a latência final do Pages depende da publicação e da conexão.

## Validação e reprodução

- `npm.cmd test`: 236 testes passaram.
- `npm.cmd run build`: passou; permanece o aviso sobre tamanho do chunk do Phaser.
- `node scripts/diagnose-pages.mjs --slow`: 31 equipamentos dos dois lados, clique real no menu e cinco ciclos de abrir/fechar ficha com retomada dos controles; sem exceções nem requisições que falharam.
- `node scripts/diagnose-pages.mjs --canvas --png`: mesmos equipamentos e cliques no renderer Canvas, bloqueando WebP para forçar a alternativa PNG; passou. As requisições bloqueadas nesse caso são intencionais.
- `node scripts/smoke-item-art.mjs --png`: passou nas telas de loja, batalha, catálogo, ficha e mochila vencedora.
- `node scripts/smoke-preparation.mjs`: passou em 1440 e 390 px, cobrindo compras, organização, filtros, fichas, batalha, vitória e exportação da mochila. Uma expectativa antiga do teste foi atualizada: a Armadura de ferro já era rara na 0.6.11 e deve aparecer entre as três armaduras raras.

Para executar o diagnóstico local, iniciar `npm.cmd run build` e `npm.cmd run preview`. Para testar a publicação, passar sua URL ao script. O script gera `report.json` em uma pasta temporária e imprime o caminho; o relatório inclui tempos de recursos, tarefas longas, erros e resultados por equipamento.

`node scripts/prepare-character-webp.mjs` reproduz a conversão dos PNGs usando o encoder do Edge. Os scripts usam Edge headless e aceitam `EDGE_PATH`.

As correções estão no workspace; a versão pública só muda após um novo deploy.
