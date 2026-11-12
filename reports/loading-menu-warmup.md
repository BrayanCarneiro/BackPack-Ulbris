# Menu leve, antecipação da batalha e motor reduzido

Implementação e medições em 12/11/2026, comparadas ao commit `6380ce9` (0.6.12).

## Resultado observado

Mesmo fluxo com cliques reais, perfil novo do Edge headless, build de produção
no Vite preview, viewport 390 × 844, CPU limitada em 4 vezes, latência de 100 ms,
download de 400.000 bytes/s e upload de 100.000 bytes/s. O teste inicia a loja,
compra e equipa mochila/espada e aguarda dez segundos antes de clicar em Batalhar.

| Medida | 0.6.12 | Com as melhorias |
| --- | ---: | ---: |
| Menu clicável desde a navegação | 2,259 s | 0,451 s (80% menos espera) |
| Primeira loja desde a navegação | 5,711 s | 5,628 s (praticamente igual) |
| Batalha desde o clique, após dez segundos na loja | 4,683 s | 1,308 s (72% menos espera) |
| Motor minificado | 652,79 KB | 611,76 KB (6,3% menor) |
| Motor com gzip, calculado pelo build | 173,62 KB | 161,44 KB (7% menor) |

São amostras individuais controladas, não garantias de tempo em todo aparelho.
O menu novo consegue responder enquanto o logo ainda termina de carregar; a
medida é de controles disponíveis, não de todas as imagens concluídas. O logo
tem prioridade alta e o motor começa depois dos primeiros frames do menu.

Os dados brutos estão em [antes](loading-before.json), [depois](loading-after.json)
e [transição rápida](loading-fast-transition.json). O ganho de 80% é da abertura
do menu. A chegada à loja não recebeu a mesma redução: o motor continua
necessário para jogar, e sua espera fica no primeiro Play caso o usuário clique
antes de terminar o carregamento em segundo plano.

Na transição rápida, aguardando apenas um segundo na loja, a batalha ainda levou
4,42 s. Isso confirma que antecipar recursos depende do tempo disponível durante
as compras. Não se deve interpretar o resultado de 1,31 s como tempo garantido
para quem batalha imediatamente.

## Implementação

- `index.html`, `src/styles.css` e `src/launcher.js`: menu e lobby iniciais em
  HTML, botões nativos e importação dinâmica do jogo. O motor não bloqueia
  Iniciar/Voltar. Importações e inicialização são compartilhadas; cliques
  repetidos não criam múltiplas instâncias. Falha de abertura oferece recarregar.
- `src/scenes/BootScene.js`: reaproveita o logo HTML quando já está disponível,
  evitando uma nova requisição e decodificação do mesmo recurso. A instância
  preparada em segundo plano dorme até o usuário entrar no jogo.
- `src/lib/phaser.js`: entrada explícita com Game, Scene, Container, constantes,
  fábricas e plugins utilizados. Removidas exposições amplas de namespaces e
  loaders sem uso. KeyboardPlugin foi mantido explicitamente para preservar
  espaço/rotação e Escape. Canvas, WebGL, máscaras, efeitos de diálogo e
  exportação de imagens continuam disponíveis. A configuração deixa de instalar
  LightsPlugin, não utilizado pelo jogo.
- `src/utils/battleWarmup.js`: antecipa corpo, espada e ataques após a primeira
  renderização da loja. Usa `fetch` com prioridade baixa, um download por vez e
  preparação das variantes em tarefas separadas, sobrepostas à rede. A
  antecipação para de iniciar novos trabalhos quando a loja é encerrada e não
  acontece em `navigator.connection.saveData`.
- `src/scenes/AssetScene.js`: espera um recurso que já está sendo baixado em
  segundo plano, usando um File do loader do Phaser. Evita uma segunda
  requisição para a mesma textura. Falhas deixam o loader seguir para a
  alternativa PNG e para a tela de tentar novamente.

Texturas e variantes continuam sendo criadas uma vez por jogo e reutilizadas.
O carregamento antecipado não aumenta o conjunto final de imagens da partida;
adianta downloads e memória que seriam usados na batalha.

## Validação

- `npm.cmd test`: 241 testes passaram, incluindo três testes específicos da
  espera por download compartilhado, sua falha e a saída da cena antes da conclusão.
- `npm.cmd run build`: passou; permanece o aviso de chunk do motor maior que 500 KB.
- `node scripts/smoke-preparation.mjs`: passou em 1440 e 390 px, incluindo
  compras, arraste, modais, filtros, batalha, vitória e exportação da mochila.
- `node scripts/smoke-item-art.mjs --png`: passou com atlas em PNG.
- `node scripts/diagnose-pages.mjs --canvas --corrupt --lazy --atlas`: passou
  com os 31 equipamentos dos dois lados, renderer Canvas e WebP inválido.
- `node scripts/benchmark-loading.mjs --blocked-engine --screenshot`: menu
  continua navegável com scripts do motor bloqueados e sem iniciar Phaser.
- O benchmark verifica ausência de exceções e de requisições duplicadas das
  imagens da batalha, incluindo a transição rápida.

Para repetir: iniciar `npm.cmd run preview` depois do build e executar
`node scripts/benchmark-loading.mjs --slow --think=10000`. Para entrada rápida,
usar `--think=1000`; `--output=reports/arquivo.json` salva o relatório escolhido.

As mudanças estão no workspace. O GitHub Pages continua na versão 0.6.12 até um
novo commit e deploy.
