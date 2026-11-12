# Carregamento de imagens por etapa

Implementado e medido em 12/11/2026. A comparação usa como referência a versão já otimizada com WebP e com a correção do crash da 0.6.11, antes de adicionar lazy loading.

## Comparação controlada

Três execuções por versão, cada uma com perfil novo do Edge headless. Mesmo modo de build de produção servido por Vite preview, viewport 390 × 844, renderer WebGL, CPU limitada em 4 vezes, latência de 100 ms e download de 400.000 bytes/s. As versões foram executadas sequencialmente na mesma máquina. O teste aguarda o menu ficar ativo, consultando a cada 100 ms; o teste funcional adicional confirma que clicar em Iniciar abre o lobby.

| Medida até o menu | Antes | Com lazy loading | Redução |
| --- | ---: | ---: | ---: |
| Tempo mediano | 6,665 s | 2,243 s | 66,3% |
| Imagens requisitadas | 39 | 1 | 38 requisições adiadas |
| Bytes das imagens | 1.339.180 | 68.424 | 94,9% |
| Recursos totais, tamanho descompactado | 2.117.175 | 847.544 | 60,0% |

Amostras antes: 6.774,9 / 6.512,3 / 6.665,2 ms. Com lazy loading: 2.375,2 / 2.238,8 / 2.243,1 ms. Foram retirados aproximadamente **4,42 segundos da espera inicial** neste teste. [Dados e condições em JSON](lazy-loading-benchmark.json).

O tamanho total usa `PerformanceResourceTiming.decodedBodySize`: inclui JavaScript descompactado e não representa transferência comprimida na conexão. Os tempos são medições locais sob limitação artificial, sem garantia de números idênticos no Pages ou em um celular físico.

## Quando cada imagem carrega

- Abertura: apenas o logo, compartilhado com o lobby.
- Seleção: retrato e cenário; o recorte do retrato só é criado depois do carregamento.
- Primeira loja, catálogo ou consulta direta: grupo de 31 artes de equipamentos. Esse grupo é compartilhado; navegar entre páginas não gera novos downloads. A implementação é por grupo de tela, não por cartão individual.
- Primeira batalha: corpo, espada e três spritesheets de ataque. Animações e variantes em memória são preparadas depois que as imagens estão disponíveis.
- Mochila vencedora: reutiliza as artes dos itens, carregando o grupo se a tela for aberta diretamente.

As texturas permanecem em memória entre as telas. Não há nova requisição nem nova decodificação de uma textura já carregada. O grupo dos itens também integra as dependências da batalha para entradas diretas e testes.

Em uma execução funcional com a mesma limitação, a primeira seleção levou cerca de **0,89 s**, a primeira loja **2,20 s** e a primeira batalha **4,06 s**. O catálogo aberto depois da loja levou 0,21 s de criação de interface, sem downloads. A espera foi distribuída entre etapas; quem chega à batalha continua precisando dessas imagens. A melhoria não significa eliminar todos esses bytes da jornada completa, nem reduzir o custo do motor Phaser.

## Falhas e validação

Cada etapa mostra o progresso e espera as texturas antes de criar seus controles. Se WebP não baixar ou não decodificar, tenta PNG. Se os dois falharem, oferece **Tentar novamente**, preservando os dados de entrada e sem iniciar o combate durante a falha.

Validações concluídas:

- 236 testes de lógica e build de produção passaram.
- `node scripts/diagnose-pages.mjs --slow --lazy`: grupos corretos por etapa, 31 equipamentos em visualizações de jogador e adversário, cliques reais, cinco ciclos de ficha e ausência de novas requisições ao revisitar seleção, loja e batalha.
- `node scripts/diagnose-pages.mjs --canvas --png --lazy`: passou com WebP bloqueado e alternativa PNG em todas as etapas.
- `node scripts/diagnose-pages.mjs --canvas --corrupt --lazy`: passou com respostas HTTP 200 contendo WebP inválido; verificou a alternativa após erro de decodificação.
- `node scripts/diagnose-pages.mjs --retry`: falha forçada nos dois formatos de um ataque, sessão preservada, combate aguardando e recuperação pelo botão de tentar novamente.
- `node scripts/smoke-preparation.mjs`: passou em 1440 e 390 px, incluindo loja, organização, fichas, filtros, batalha, vitória e exportação.
- `node scripts/smoke-character-select.mjs`: passou com cliques e toques em 1440 × 900, 390 × 844 e 844 × 390.

Para repetir as amostras iniciais, iniciar `npm.cmd run build` e `npm.cmd run preview` e executar três vezes `node scripts/diagnose-pages.mjs --slow --startup-only --lazy`. Cada execução cria um perfil novo e grava um `report.json` na pasta temporária indicada na saída. O build anterior foi medido pelo mesmo comando, omitindo `--lazy`, antes da alteração.

As alterações estão no workspace. O GitHub Pages precisa de um novo deploy para servir esta versão.
