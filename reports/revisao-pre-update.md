# Revisão antes da atualização — 18/11/2026

Resultado: bateria aprovada para preparar a atualização do código. Os testes
não identificaram bloqueio nos fluxos verificados. A hospedagem de contas
continua local, conforme o escopo atual.

## Ajustes pequenos aplicados

- O sincronizador compara o valor antes de gravar em localStorage. No caso
  controlado de uma alteração confirmada, as escritas caíram de 8 para 4;
  confirmações, filas, revisões e isolamento entre contas foram preservados.
- Um rascunho com JSON corrompido agora é ignorado individualmente, permitindo
  recuperar outros rascunhos válidos. Antes ele interrompia a varredura e podia
  gerar um conflito desnecessário ao recuperar uma resposta perdida.
- O teste de desempenho passou a descobrir todas as páginas do catálogo;
  o total antigo de 34 estava desatualizado. Agora foram revisados os 41 itens.
  O relógio real da batalha é restaurado após a simulação controlada do teste.
- O microbenchmark aceita um caminho de saída, preservando o relatório histórico.

## Validação

- `npm.cmd test`: 301 testes passaram, cerca de 10,6 segundos nesta execução.
- `npm.cmd run build`: aprovado.
- `node scripts/smoke-performance.mjs --production --slow`: aprovado no build
  servido pelo preview, em Edge headless/WebGL com CPU emulada 4× mais lenta.
  Conferiu loja, reutilização dos seis cartões, indisponibilidade por falta de
  ouro, arena reutilizada, relógio exato e fichas dos 41 itens sem ultrapassar
  o limite de conteúdo verificado. A HUD atualizou 42 vezes em 120 passos
  controlados, preservando os 2.000 ms simulados. Isso não é uma medição de FPS.
- `node scripts/smoke-accounts.mjs`: aprovado, com banco temporário isolado.
  Login, logout, duas contas, proteção do dono da jornada, recuperação do banco,
  cache apagado, falha de conexão e resolução de conflitos foram verificados.
- `node scripts/smoke-battle-background.mjs`: aprovado. Início sem evento de
  foco, progresso em aba realmente oculta, pausa da ficha, resultado salvo uma
  única vez, retorno à loja e limpeza do temporizador entre batalhas.
- `git diff --check`: sem erros de whitespace. Banco local confirmado no gitignore.

## Medições locais

Dados em [performance-pre-update.json](performance-pre-update.json).

| Medida | Resultado |
| --- | ---: |
| JavaScript minificado total | 788.830 bytes |
| JavaScript total com gzip (`node:zlib`) | 217.404 bytes |
| 10.000 consultas de geometria/vizinhança, mediana | 55,05 ms |
| Rival da rodada 11 com semente nova, mediana | 87,20 ms |
| 10.000 formatações numéricas, mediana | 9,47 ms |
| Arquivos WebP existentes em public/assets | 51 arquivos / 1.875.330 bytes |

O aviso de chunk acima de 500 kB vem do motor Phaser (611.745 bytes minificados),
que continua separado do código do jogo para reaproveitar cache entre versões.
Não é uma falha de compilação. As medições de CPU são microbenchmarks locais
com cinco amostras; os testes headless e a CPU emulada não substituem um teste
em celular físico ou garantem determinada taxa de FPS.

O GitHub Pages continua servindo o jogo de visitante: publicar os arquivos do
site não publica a API Node nem o SQLite. Não foram alterados versão do pacote,
contas reais ou dados do banco local para preparar esta revisão.
