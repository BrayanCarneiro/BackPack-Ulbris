# Próxima fase do Ulbris: contas e progressão online

Registrado em 11/11/2026.

**Status em 18/11/2026:** cadastro/login/logout e perfil inicial implementados
para execução com servidor Node local. Jornadas de contas já são salvas no SQLite,
com recuperação em outros navegadores que acessem o mesmo servidor. A publicação da API,
as conquistas, o PvP e o ranking continuam pendentes.
Steam e Electron ficam fora do foco desta fase.

## Objetivo combinado

Permitir que cada jogador entre com sua conta e tenha um perfil próprio, com nome,
foto, registros de vitórias, histórico e conquistas. Depois, acrescentar ranking
e a opção de enfrentar outros jogadores.

## Primeira entrega: conta e perfil

- Implementados: cadastro, login e logout com usuário e senha, sem e-mail.
- Implementados: perfil no canto superior esquerdo dos menus, retrato do Arthur
  e data de criação; sessão persistente por sete dias.
- Implementado: jornada no banco por conta, cópia de apoio no navegador,
  recuperação após apagar o cache, revisão contra conflitos e reenvio de
  alterações pendentes. Visitante continua no navegador, sem transferência automática.
- Pendentes: recuperação de acesso, edição do perfil, seleção de ícone de classe,
  upload de avatar e resumo da trajetória do jogador.

Por decisão do usuário, o cadastro inicial não pede e-mail. O usuário aceita
3–24 letras ASCII, números ou `_`; login e unicidade ignoram diferenças entre
maiúsculas e minúsculas. Senhas têm 8–128 caracteres. O avatar inicial usa
`{ kind: 'class', id: 'arthur' }`, preparando a futura escolha de ícones.
Não há recuperação de senha nesta entrega.

## Progresso e histórico

**Já implementado:** jornada ativa no banco local, incluindo loja, inventário,
reserva, posições, rotações, Juramento, ofertas fixadas e modo infinito.
Histórico, estatísticas e mochilas de jornadas anteriores ainda são próximos passos.

- Salvar e continuar uma jornada na própria conta.
- Guardar rodada, vidas, ouro, classe, inventário, reserva, posições e rotações.
- Preservar ofertas fixadas e o estado necessário para retomar a loja corretamente.
- Registrar vitórias, derrotas, empates, jornadas concluídas e melhor sequência.
- Manter histórico de partidas e mochilas vencedoras, com opção de consultar e
  salvar a imagem novamente.
- Incluir a versão do formato do save e do balanceamento para permitir migrações
  e interpretar partidas antigas.

O salvamento local pode servir como apoio, mas a sincronização precisa de uma
regra para conflitos entre dispositivos e sessões. Não sobrescrever um progresso
mais recente silenciosamente. Também será preciso definir quais modos podem ser
jogados offline e quais resultados contam como oficiais.

## Conquistas

Guardar conquistas desbloqueadas, progresso e data de desbloqueio. Exemplos para
avaliar, sem tratar esta lista como definitiva:

- Primeira batalha vencida.
- Primeira jornada conquistada.
- Primeira fusão.
- Criar um Cristal Dourado.
- Conquistar uma jornada com Arthur.
- Alcançar uma sequência de vitórias.

As condições e recompensas serão definidas depois. O servidor deve conferir as
condições e impedir concessão duplicada pela mesma partida.

## Arquitetura recomendada

**Proposta anterior para a fase online:** Supabase com PostgreSQL, Auth e Storage, mais uma camada
de funções de servidor para as regras oficiais. O provedor ainda precisa ser
confirmado quando a implementação começar; nenhuma conta ou infraestrutura foi
criada para esta ideia. A primeira implementação com usuário/senha usa Node.js,
SQLite e scrypt, sem provedor externo. Ela funciona no Vite local e no servidor
`server/index.js`; GitHub Pages não executa essa API. A arquitetura abaixo é uma
proposta para as próximas fases, não uma descrição do backend atual.

| Componente | Responsabilidade |
| --- | --- |
| Auth | Cadastro, credenciais, sessões e recuperação de acesso. |
| PostgreSQL | Perfis, jornadas, histórico, estatísticas e conquistas. |
| Storage | Fotos de perfil e, se necessário, imagens compartilhadas. |
| Funções de servidor/API | Validar ações, calcular resultados e registrar progresso oficial. |
| Cliente do jogo | Mostrar telas, receber comandos e apresentar o combate. |

Os itens, receitas e regras continuam versionados no código do jogo. O motor
atual de combate em JavaScript pode ser preparado para reutilização no servidor;
essa adaptação ainda precisa ser implementada e validada.

## Resultado oficial e integridade do progresso

O cliente pode solicitar alteração de nome ou foto. Contadores de vitórias,
conquistas e pontuação oficial devem ser atualizados pelo servidor a partir de
partidas validadas. Receber apenas “eu ganhei” ou confiar na mochila enviada pelo
navegador não basta.

Preparar a validação de ofertas, compras, ouro, organização e fusões para impedir
que uma composição inventada seja aceita como legítima. O servidor deve escolher
ou registrar as sementes e versões necessárias para reproduzir o combate.
Uma mesma partida deve conceder resultado e recompensas uma única vez.

As permissões do banco devem restringir cada conta aos dados que ela pode editar.
Perfil e histórico públicos precisam de campos explicitamente definidos; dados
privados e credenciais não devem aparecer nas consultas públicas.

## PvP recomendado para começar: assíncrono

1. O jogador monta sua mochila seguindo a loja e as regras validadas.
2. O servidor escolhe uma formação salva de outro jogador, de etapa compatível.
3. O combate é calculado no servidor e apresentado no jogo.
4. O resultado entra no histórico e, se for um modo competitivo, no ranking.

Essa proposta combina com o combate automático e permite enfrentar uma formação
real sem exigir que seu dono esteja conectado naquele momento. Não é uma partida
ao vivo entre duas pessoas. PvP simultâneo pode ser avaliado depois, caso faça
sentido para a experiência.

A seleção de adversários deve considerar rodada, modo e versão de balanceamento.
Os critérios finais de força, idade das formações e participação em partidas
classificatórias ainda precisam ser definidos.

## Ranking

- Usar apenas resultados oficiais de um modo competitivo definido.
- Mostrar nome público, avatar, posição e pontuação.
- Definir critérios de pontuação, desempate e eventual separação por temporada.
- Manter o ranking separado das estatísticas gerais contra bots.

Não escolher antecipadamente uma fórmula de Elo/MMR: primeiro definir o formato
do PvP e quais resultados devem alterar a classificação.

## Entidades sugeridas para o banco

| Entidade | Dados principais |
| --- | --- |
| Perfis | ID da conta, nome público, avatar e criação. |
| Jornadas | Dono, estado atual, versão, datas e conclusão. |
| Partidas | Participantes, formações, sementes, versão e resultado validado. |
| Estatísticas | Totais e sequências calculados a partir dos resultados. |
| Conquistas do jogador | Conquista, progresso e desbloqueio. |
| Ranking | Modo, temporada, pontuação e posição calculada. |

São sugestões de modelagem, não um esquema SQL definitivo. Credenciais ficam
sob responsabilidade do serviço de autenticação.

## Ordem de execução após Arthur

1. Confirmar provedor, fluxo de login e regras do perfil público.
2. Implementar cadastro/login e tela de perfil com nome e avatar.
3. Implementar salvamento da jornada e histórico associado à conta.
4. Registrar estatísticas e conquistas com validação no servidor.
5. Implementar PvP assíncrono, seleção de adversários e histórico de confrontos.
6. Acrescentar ranking sobre os resultados oficiais desse modo.

A primeira entrega deve permitir entrar com a própria conta, consultar o perfil
e retomar uma jornada. Ranking e PvP vêm depois dessa base.

## Referências técnicas

- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Permissões por linha no PostgreSQL/Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security)
