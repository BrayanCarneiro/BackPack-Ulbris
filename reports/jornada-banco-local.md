# Jornada vinculada à conta no banco local

Implementada em 18/11/2026. Continua sem hospedagem externa ou novos serviços pagos.

## Comportamento

Contas autenticadas guardam a jornada ativa na tabela `journeys` do arquivo
`.local-data/accounts.sqlite`, junto das tabelas de usuários e sessões. Um espaço
por conta guarda o JSON versionado da jornada, revisão, última operação e data
de atualização. O JSON inclui classe, ouro, rodadas, vitórias/vidas, mochila,
inventário e reserva, posições/giros, ofertas, fusões/Juramento e modo infinito.

Entrar ou iniciar o jogo carrega a jornada do banco antes dos menus. **Continuar
jornada** consulta novamente o servidor, evitando começar com uma cópia antiga.
O menu e a loja mostram o estado do salvamento. Após **Jornada salva no banco
local**, limpar localStorage e entrar novamente recupera a formação do servidor.
Reiniciar o servidor também preserva os dados. Apagar o arquivo SQLite apaga
contas e jornadas; esse banco continua sendo responsabilidade do ambiente local.

O visitante continua salvando no navegador. Um save antigo da própria conta é
importado automaticamente somente quando o banco ainda não possui registro.
Não há transferência automática do visitante. O formato do save permanece na
versão 1, com regras 0.7.0; o codec é compartilhado pelo cliente e servidor.

## Falhas e concorrência

- Mudanças rápidas continuam agrupadas em 250 ms. Não há requisição por frame.
- Cada página mantém uma fila durável própria em localStorage, com a operação
  em envio e a alteração mais recente que ainda espera confirmação.
- Escritas são sequenciais. Uma resposta perdida pode ser repetida com o mesmo
  identificador, sem avançar a revisão novamente.
- Ao reabrir, o cliente reconcilia a fila com a revisão e a operação do banco.
  Alterações pendentes são reenviadas; um progresso remoto mais recente causa
  conflito, sem sobrescrita automática.
- **Usar versão do banco** preserva o rascunho em uma chave `.backup.` antes de
  adotar o estado remoto. Essas cópias permanecem no navegador e não têm ainda
  uma interface de restauração. Limpar o navegador também apaga os rascunhos que
  nunca chegaram ao banco; a interface distingue pendência de confirmação.
- Se a sessão expirar ou outra aba trocar de conta, o envio é bloqueado e a cópia
  pendente permanece com seu dono original. Entrar novamente permite reconciliar.
- Requisições pequenas usam keepalive; a fila local cobre fechamento da página
  antes da confirmação. Saves grandes não dependem de keepalive.
- Encerramento envia `raw: null` e conserva a revisão no banco, impedindo
  ressurreição por uma aba antiga. Esta entrega não adiciona histórico.

## API e proteção dos dados

`GET /api/run` consulta o espaço da conta autenticada. `POST /api/run` recebe
`revision`, `operationId` e `raw` (JSON da jornada ou null para encerramento).
O dono vem da sessão HttpOnly, e `X-Run-Owner` precisa corresponder à mesma conta;
não há ID de outro jogador selecionável pelo corpo da requisição.

Revisões são atualizadas por uma operação SQL condicional e atômica. O servidor
valida autenticação, origem do POST, tamanho, revisão, formato, classe, catálogo,
contadores e encaixes usando o codec compartilhado. Isso não equivale a reproduzir
compras ou combates no servidor: estes saves não são resultados oficiais de PvP
ou ranking. A validação competitiva continua sendo uma etapa futura.

## Verificação

- `npm.cmd test`: 299 testes passaram após a correção de isolamento da conta.
- `npm.cmd run build`: passou; permanece o aviso existente do motor Phaser.
- Testes HTTP: isolamento entre contas, sessão obrigatória, origem, restauração
  de mochila/loja, recusa de dados inválidos, idempotência, conflito, encerramento,
  reinício do servidor e novo login sem cache.
- Testes do sincronizador: migração do save anterior da conta, armazenamento
  apagado, alterações durante envio, confirmação perdida, fila offline, limpeza
  pendente, conflito com backup e banco funcionando com localStorage bloqueado.
- `node scripts/smoke-accounts.mjs`: passou no Edge com banco temporário próprio;
  verificou limpar localStorage e recarregar, falha de rede e recuperação da fila,
  progresso remoto concorrente e o botão de resolução de conflitos.

## Isolamento após sair da conta

Cada sessão de jogo tem um dono fixo durante sua vida em memória. A gravação de
uma sessão antiga é recusada se a conta atual mudou; o encerramento também não
pode apagar o espaço de outro jogador. Novos snapshots carregam `ownerId` (null
para visitante), conferido pelo carregador, pelo sincronizador e pela API.
Snapshots antigos continuam compatíveis com seu espaço de salvamento anterior.

As telas de loja, batalha, resultado, vitória e mochila vencedora verificam o
dono antes de abrir uma sessão reutilizada. Botões de continuação são recriados
ao trocar contas e uma ação assíncrona antiga é cancelada se o usuário mudou.
O save de visitante independente usa o rótulo **Continuar como visitante**.

O teste de regressão reproduziu uma gravação tardia que antes caía no espaço do
visitante. Depois da correção, ela é recusada. O teste de navegador também passou
com duas contas: a segunda não enxerga a primeira, sair sem um save de visitante
remove a continuação (inclusive após reload), e entrar novamente na primeira
restaura seu progresso. Uma jornada de visitante já existente permanece separada.

Outro navegador precisa acessar a mesma API e o mesmo banco para recuperar a
conta e sua jornada. A API ainda roda localmente; a versão estática do GitHub
Pages permanece como jogo de visitante, sem acesso ao banco do desenvolvedor.
