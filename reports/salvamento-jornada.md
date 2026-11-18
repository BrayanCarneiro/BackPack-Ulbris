# Salvamento local da jornada

Implementado em 18/11/2026. Um espaço de salvamento automático, sem dependências
novas, conta ou servidor. O menu inicial e o lobby oferecem Continuar jornada.

O arquivo contém estado variável da sessão e referências aos itens do catálogo.
Não inclui imagens, texturas, animações ou objetos do Phaser. O catálogo fornece
nomes, atributos e formas ao reconstruir a sessão. São preservados os IDs das
cópias, contadores de compra, rotações, reserva, seleção de fusão, Juramento,
ofertas vendidas/fixadas, progresso e semente dos adversários.

As mudanças confirmadas na loja agendam gravação com debounce de 250 ms.
Fechar a página, ocultar a aba ou sair da loja força a gravação pendente.
Estados idênticos não são regravados. Não há consulta ou gravação por frame.
Durante um arraste, o modelo mantém a posição anterior: só a posição confirmada
ao soltar a peça é persistida. O resultado processado da batalha é salvo antes
da transição de tela. Fechar durante o combate retoma a preparação anterior.

A décima vitória salva a escolha entre terminar e infinito. Continuar no infinito
salva a nova rodada sem conceder renda novamente na retomada. Encerrar uma
jornada remove seu save. Criar outra exige confirmação antes da substituição.

O formato 1 inclui a versão de regras 0.7.0; uma mudança incompatível requer
migração explícita. O carregamento valida versão, classe, números, ofertas,
itens, IDs, contadores, formas e posições. Dados incompatíveis não são apagados
automaticamente. Falhas de leitura/escrita são tratadas; falha ao gravar preserva
o último save. Este armazenamento local não valida resultados competitivos.

## Validação

- `npm.cmd test`: 278 testes passaram, incluindo cinco testes de persistência.
- `npm.cmd run build`: passou; permanece o aviso existente de tamanho do Phaser.
- Com Vite ativo, `node scripts/smoke-run-save.mjs` e
  `node scripts/smoke-run-save.mjs --mobile`: passaram no Edge headless em
  1440×900 com mouse e 390×844 com toque emulado, em sessões separadas.
- Navegador: arraste salvo, ofertas fixadas, continuação no lobby e após reload
  durante combate, cancelamento/confirmação da substituição, escolha da décima
  vitória, infinito, encerramento e recusa de save corrompido.

Na amostra de jornada inicial, o JSON ocupou 681–682 bytes em UTF-8. Em séries
de 100 operações no navegador desta máquina, a gravação média ficou na ordem de
0,007–0,010 ms e a decodificação em 0,03–0,06 ms. São medições de um save inicial
pequeno em computador, não uma medição de FPS, inventário grande ou aparelho
físico. O tamanho cresce com os itens guardados. `localStorage` usa armazenamento
síncrono, por isso as gravações são agrupadas e limitadas a mudanças de estado.

O progresso pertence ao endereço do site, navegador e dispositivo. Limpar dados
do site o apaga. Não há sincronização entre dispositivos ou resolução de
conflitos entre duas abas abertas com jornadas concorrentes.
