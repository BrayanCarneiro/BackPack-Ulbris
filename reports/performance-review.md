# Revisão de desempenho — 10/11/2026

Revisão dos módulos do jogo: inicialização, cenas, componentes, entrada, desenho,
mochilas, receitas, compras, rivais, combate e definições dos 29 itens. As mudanças
preservam os valores, o formato dos equipamentos e as regras da jornada.

## Medições

| Medida | Antes | Depois | Redução |
| --- | ---: | ---: | ---: |
| JavaScript minificado, soma dos arquivos | 1.287.222 bytes | 748.349 bytes | 41,9% |
| JavaScript com gzip, soma dos arquivos | 346.588 bytes | 203.654 bytes | 41,2% |
| 10.000 consultas de geometria e vizinhança | 235,92 ms | 53,96 ms | 77,1% |
| 10.000 formatações numéricas | 412,35 ms | 9,48 ms | 97,7% |
| Rival da rodada 11, histórico ainda não calculado | 77,20 ms | 64,76 ms | 16,1% |
| Cópia do rival usada pela tela de batalha | 38.839 bytes com histórico | 5.373 bytes sem histórico | 86,2% |
| Logo PNG original → WebP usado nas telas | 770.080 bytes | 68.424 bytes | 91,1% |

As medições de CPU são medianas de cinco execuções locais no Node v26.13.0.
Não são medições de FPS, nem previsões para um celular específico. O tamanho dos
snapshots usa JSON para comparação; não representa o tamanho exato do heap.
Gzip foi calculado com `node:zlib`, usando a mesma configuração antes/depois.
Os dados brutos estão em [performance-before.json](performance-before.json) e
[performance-after.json](performance-after.json).

## Melhorias aplicadas

- Phaser: build oficial core, acrescido somente das fábricas usadas pelas telas.
  Física, tilemaps, partículas, vídeo, som e ferramentas de depuração não entram
  no carregamento. WebGL e Canvas continuam disponíveis.
- O motor fica em um arquivo separado com hash, permitindo reaproveitar seu
  cache quando mudar apenas o código do jogo. O alvo de compilação é ES2020.
- Geometria: formatos retangulares são calculados uma vez e protegidos contra
  alterações. Vizinhança e estrelas não recriam listas dentro de cada comparação.
- Fusões: a prévia reaproveita os resultados já calculados ao verificar a
  possibilidade de alternar o ferro. Não há cache persistente que possa ficar
  desatualizado quando uma peça muda de posição.
- HUD: formatadores numéricos são compartilhados. A apresentação contínua tem
  limite de 30 atualizações por segundo; os eventos continuam imediatos e a
  simulação conserva o passo de 100 ms e o relógio real de 1x/2x/3x.
- Mochilas da batalha: referências de armas e consumíveis são ligadas uma vez.
  Legendas e transparências mudam somente quando necessário; formas de recarga
  não são redesenhadas quando o progresso permanece igual.
- Loja: comprar, fixar e alterar o ouro atualizam os cartões existentes. Só uma
  oferta que muda de item precisa de outro cartão. O teste verifica que os seis
  objetos sobrevivem a uma compra.
- Rivais: histórico interno compartilha snapshots imutáveis. A batalha recebe
  apenas a cópia dos dados que utiliza. Uma alternativa de clonagem mantém a
  compatibilidade com navegadores sem `structuredClone`.
- Arena: repetir o mesmo redimensionamento não destrói os objetos. Animações
  são encerradas ao destruir a arte. A largura lógica máxima é 2560, limitando
  o custo de renderização em telas muito largas. O loop fica limitado a 60 FPS.
- Efeitos: Pre FX desativados, pois não são usados. O desfoque de diálogos fica
  desativado quando o navegador indica até 4 GB, até 4 núcleos ou preferência
  por movimento reduzido. A janela mantém seu fundo escurecido e a pausa.
- Itens: cópias preservam a categoria, cor e resumo do ID de catálogo, inclusive
  Ferro refinado. Conferidos os atributos, efeitos, receitas e formatos dos 29 itens.
- Logo: uma única textura WebP de 900×507 é compartilhada pela home e pelo menu.
  Há fallback PNG de 283.928 bytes e fallback textual caso ambas falhem. O arquivo
  original foi preservado na raiz.

## Validação

- `npm test`: 200 testes aprovados, incluindo combate determinístico, todos os
  efeitos, fusões, posicionamento, filas, vitórias, economia e velocidades.
- `npm run build`: produção compilada com sucesso.
- `node scripts/smoke-preparation.mjs`: mouse em 1440×900 e toque emulado em
  390×844; compra, arraste, venda, reserva, fusão escolhida, consulta, resize e
  retorno da batalha mantendo a mesma sessão.
- `node scripts/smoke-performance.mjs --production`: build servido em 4173,
  WebGL, home/menu com a logo, navegação pelos 29 itens, reaproveitamento dos
  cartões e da arena. Em 120 chamadas controladas de update, o HUD atualizou
  44 vezes e a simulação avançou exatamente 2 segundos.
- `node scripts/smoke-performance.mjs --production --canvas --slow --png`:
  Canvas forçado, CPU emulada 4× mais lenta, indicação de 4 GB/4 núcleos e WebP
  bloqueado. Logo PNG carregou; telas e os mesmos controles passaram sem exceções.
- `node scripts/smoke-weapons.mjs --speed-only`: três ciclos de ocultar/retomar
  a aba. O combate pausou em segundo plano e retomou próximo de 3× o tempo real,
  sem perder a velocidade selecionada.

Os testes de navegador usam Edge local. Emulação não substitui medições de
temperatura, bateria, memória e fluidez em Android/iPhone físicos ou testes em Safari.

## Limites e próximos passos

O arquivo do motor ainda tem cerca de 653 kB minificados / 173 kB com gzip e o
Vite mantém o aviso de chunk acima de 500 kB. Ele não foi ocultado. Reduções
adicionais exigem manter um build mais específico do Phaser ou mudar o motor,
com maior custo de compatibilidade e manutenção.

As telas estáticas ainda usam o loop do Phaser. Um modo de desenho sob demanda
pode reduzir consumo, mas precisa de testes de retomada de entrada e animações.
A IA continua síncrona; mover seu treinamento para um worker deve ser considerado
se um perfil em celulares físicos ainda mostrar travamentos ao entrar na batalha.

Para reproduzir as medições: `npm run build` e
`node scripts/benchmark-performance.mjs`. Os testes de produção exigem
`npm run preview -- --port 4173`; a revisão de desenvolvimento usa o servidor 5173.
