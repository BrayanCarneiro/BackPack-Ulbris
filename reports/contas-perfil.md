# Contas e perfil inicial

Entrega local em 18/11/2026. Usuário/senha sem e-mail; Arthur como avatar inicial.
Atualização posterior: jornadas de contas passaram a ser salvas no banco;
veja [jornada no banco local](jornada-banco-local.md). As referências a saves
somente no navegador abaixo descrevem a primeira entrega de autenticação.
O perfil aparece no canto superior esquerdo do menu e lobby do PC, com adaptação
ao celular. Cadastro, login e saída usam uma API real, sem senhas ou tokens
gravados em localStorage. O jogador ainda pode jogar como visitante.

## Implementação

- Node.js e SQLite nativos, sem novas dependências de execução. Banco persistente
  na pasta `.local-data`, ignorada pelo Git e bloqueada pelo servidor do Vite.
- Usuário único sem distinguir caixa, 3–24 caracteres ASCII alfanuméricos ou `_`;
  senha de 8–128 caracteres, com confirmação no cadastro.
- scrypt assíncrono, N=131072, r=8, p=1, salt de 16 bytes, hash de 64 bytes.
  Comparação com `timingSafeEqual`; usuário desconhecido também executa scrypt.
- Token aleatório de 32 bytes, com somente SHA-256 no banco. Cookie HttpOnly,
  SameSite=Strict, sete dias, Secure em NODE_ENV=production. Logout revoga o
  token no servidor, e trocar a conta revoga a sessão anterior desse navegador.
- Validação de origem nos POSTs, limites de corpo/tentativas e no máximo duas
  derivações de senha simultâneas. SQL usa parâmetros.
- O perfil público retorna apenas id, usuário, avatar e data de criação.
  O esquema de avatar guarda tipo e identificador, mas seleção/upload ainda não
  estão implementados.
- Saves locais separados por ID da conta; o save de visitante anterior continua
  disponível ao sair da conta. Saves pendentes capturam o dono original.

Inicializar a sessão precede a entrada nos menus, para escolher o espaço de save
correto. A consulta inicial tem timeout de três segundos e permite continuar como
visitante quando a API não está disponível. Campos são formulários HTML nativos,
com autocomplete, rótulos, foco e fechamento por Escape; fechar devolve os
controles ao jogo. O perfil só permite trocar contas fora de uma jornada ativa.

## Verificação

- `npm.cmd test`: 287 testes passaram.
- `npm.cmd run build`: passou; permanece o aviso de tamanho do motor Phaser.
- `node scripts/smoke-accounts.mjs`: passou no Edge headless em 1440×900 e
  390×844, usando Vite e banco temporários próprios.
- Verificados cadastro sem e-mail, confirmação divergente, senha incorreta,
  login sem distinguir caixa, sessão após reload, logout, separação dos saves,
  ausência de senha/token em armazenamento acessível ao JavaScript, bloqueio de
  arquivos privados, posição do perfil e tamanho da janela no celular.
- Testes HTTP verificam duplicação, expiração e revogação de sessão, persistência
  após reiniciar o servidor, hash com custo de produção, validação de origem,
  limites de tentativas e recusa de arquivos fora do build.

## Limites da entrega

A API não foi publicada; contas funcionam nos servidores locais Vite/preview e
`npm start`. GitHub Pages continua como jogo de visitante. Publicar contas requer
hospedar Node com HTTPS e disco persistente para o banco. A hospedagem precisa
fornecer a origem pública correta para a validação de requisições.

Não há e-mail, recuperação de senha, mudança de usuário, upload/seleção de avatar,
conquistas, histórico, PvP ou ranking. As jornadas continuam no navegador, mesmo
com login: sincronização e validação de progresso oficial pertencem à próxima fase.
Não houve migração de saves de visitante para contas, nem contratação de serviços.

Referências: [SQLite no Node.js](https://nodejs.org/api/sqlite.html),
[scrypt no Node.js](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback),
[armazenamento de senhas — OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
