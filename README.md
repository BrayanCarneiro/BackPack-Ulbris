# Ulbris Backpack Battles

Jogo 2D em JavaScript, Phaser 3 e Vite, em formato vertical.
Etapa atual: protótipo de organização de mochilas e itens com arraste.
A paleta original foi mantida. Ainda não há compra, combate, personagens,
progressão, checkpoints ou persistência.

O ciclo planejado é preparação/compra → batalha automática de mochila contra
mochila → próximo inimigo. A primeira batalha será contra um único bot.
Os dados do RPG serão definidos posteriormente.

## Executar

Requer Node.js 22.12+ e npm.

```sh
npm install
npm run dev
```

Abra o endereço exibido pelo Vite (normalmente http://127.0.0.1:5173).
No PowerShell, se `npm.ps1` estiver bloqueado, use `npm.cmd install`
e `npm.cmd run dev`. Não é necessário alterar a política de execução.

```sh
npm run build
npm run preview
```

O build é gerado em `dist/`. O preview serve esse build localmente.
Para testar na mesma rede de um celular, execute `npm run dev -- --host 0.0.0.0`
e acesse o IP local do computador na porta indicada. Isso depende de a rede
e o firewall permitirem a conexão.

## Organização

- `src/main.js`: entrada da aplicação e encerramento da instância durante HMR.
- `src/config/`: configuração do Phaser e tema visual.
- `src/scenes/`: Boot → Preload → Menu → Game.
- `src/components/`: botões e visualização/interação da área de organização.
- `src/systems/PackingBoard.js`: regras de posicionamento, sem dependência do Phaser.
- `src/entities/`: reservado para entidades futuras.
- `src/data/packingPrototype.js`: dimensões e peças provisórias, copiadas a cada partida.
- `src/utils/`: reservado para utilitários compartilhados futuros.
- `public/assets/`: imagens, sprites e áudio; ainda sem arquivos de mídia.

Boot inicia o fluxo, Preload concentra o carregamento de recursos, Menu
apresenta a entrada e Game conecta o modelo da grade à interface.
`src/config/packingLayout.js` concentra as medidas da interface do protótipo.

A resolução lógica é 720 × 1280 (vertical), configurada em
`src/config/gameConfig.js`. `Phaser.Scale.FIT` preserva a proporção e
`CENTER_BOTH` centraliza o canvas. Telas com proporções diferentes exibem
margens; o conteúdo não é cortado nem esticado. O contêiner acompanha a altura
visível do navegador e considera as áreas seguras do dispositivo.

Não há motor de física nem loop de atualização personalizado nesta etapa.
O projeto usa recursos locais e formas/textos nativos do Phaser.
Capacitor será integrado em uma etapa futura.

## Verificação manual

1. Execute o servidor e confirme que o menu aparece sem erros no console.
2. Clique/toque em **Iniciar**. Arraste os itens A (1×2), B (2×1) e C (1×1)
   da reserva para as células de uma mochila.
3. Tente sobrepor itens ou soltá-los no espaço vazio: a posição anterior deve
   ser restaurada. O contorno verde/vermelho indica a validade durante o arraste.
4. Arraste diretamente as mochilas 4×4, 5×1 e 1×1 por uma parte livre de itens.
   Soltar sobre mochilas vazias envia as atingidas para a reserva. Uma mochila
   com itens fica protegida e impede o encaixe.
5. Devolva um item à reserva para liberar espaço. Itens e mochilas podem ser
   movidos a qualquer momento, sem selecionar um modo.
6. Use **Voltar ao menu** e entre novamente: o protótipo recomeça do estado inicial.
7. Redimensione a janela e teste as duas orientações, conferindo proporções e interação.
8. Clique/toque em **Expandir** na reserva. Ela cresce sobre a parte inferior
   da área de organização; **Recolher** restaura o tamanho compacto.
9. Arraste uma mochila ou item para a reserva. Guardar peças ou substituir
   mochilas não expande o painel: a expansão acontece apenas pelo botão. Para guardar
   uma mochila diretamente, retire seus itens primeiro.
10. Puxe uma peça guardada de volta: a reserva se recolhe automaticamente,
    liberando toda a área para posicionamento. As miniaturas voltam ao tamanho
    real durante o arraste. Recolher a reserva não apaga seu conteúdo.

## Regras provisórias de organização

A área externa tem 8×8 células; esse tamanho é ajustável nos dados do protótipo.
Mochilas podem ficar lado a lado ou uma acima da outra. A mochila arrastada
tem prioridade sobre mochilas vazias, que vão inteiras para a reserva.
Mochilas com qualquer parte de um item dentro têm prioridade sobre a arrastada:
se o encaixe atingir uma delas, a tentativa inteira é recusada, preservando
todas as peças e suas orientações. Isso também vale para peças giradas ou
vindas da reserva. Um item entre duas mochilas protege ambas, mesmo que o
encaixe atinja uma célula distante desse item.
Um item pode atravessar a divisa entre mochilas adjacentes se todas as suas
células estiverem apoiadas em mochilas e livres de outros itens.
Mochilas com itens ficam travadas: não é possível iniciar o arraste, mudar
sua posição, girá-las ou enviá-las à reserva, mesmo que os itens continuassem
apoiados na posição resultante. Retirar o último item libera a mochila
automaticamente. Itens que atravessam duas mochilas travam ambas.
Mochilas guardadas não oferecem suporte nem ocupam células da área principal.
Itens e mochilas giram em incrementos de 90° sobre o próprio centro.
Durante o arraste, pressione **Espaço** para girar. Também é possível selecionar
uma peça com clique/toque e usar **Girar · 90°**. Um segundo toque no botão durante
o arraste também é suportado. O texto permanece legível na nova orientação.
No tabuleiro, a posição final se ajusta à grade. Se o encaixe falhar, posição
e orientação anteriores são restauradas. A rotação não expande a reserva.

## Validação do protótipo

```sh
npm test
```

Vinte e um testes com o executor nativo do Node verificam limites, colisões, suporte
entre mochilas adjacentes, proteção de mochilas ocupadas, substituição de vazias, retorno à
reserva, rotação com validação de encaixe e isolamento do estado por partida.
As verificações de interface usam uma instalação temporária do Playwright,
que não faz parte das dependências do jogo.
O protótipo passou no Edge headless com mouse em 1440×900 e toque emulado
em 390×844: encaixe válido, recusa por colisão/falta de suporte, movimento
de mochilas, devolução à reserva e reinício ao retornar do menu.
Não houve erros no console durante esses testes. O build também passou.
A reserva expansível foi validada com mouse e toque emulado: expansão,
recolhimento, envio/recuperação de mochilas, prioridade sobre mochilas atingidas,
armazenamento de itens sem apoio e reinício da cena, sem erros no console.
A rotação passou na verificação no Edge: Espaço durante o arraste, botão por
toque, dois contatos simultâneos, dimensões/encaixe atualizados, restauração
após drop inválido e atalho sem duplicação depois de reiniciar a cena.

## Validação da etapa 1

- Build de produção concluído com `npm run build`.
- Navegação de ida e volta testada no Edge headless em 1440 × 900,
  390 × 844 e 844 × 390, incluindo redimensionamento e toque emulado.
- Nenhum erro de execução ou recurso ausente nesses testes.
- A validação móvel foi emulada; ainda falta testar em aparelhos físicos.

O Vite emite um aviso de chunk acima de 500 kB: o pacote inicial inclui
o Phaser completo (aproximadamente 1,20 MB minificado / 320 kB com gzip).
O build funciona; o tamanho e o tempo de abertura deverão ser acompanhados
nas próximas etapas, principalmente em dispositivos móveis.

Referências: [Vite](https://vite.dev/guide/) e
[escala no Phaser 3](https://docs.phaser.io/api-documentation/3.90.0/constant/scale).
