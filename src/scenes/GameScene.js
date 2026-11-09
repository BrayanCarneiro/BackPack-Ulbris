import Phaser from 'phaser';
import TextButton from '../components/TextButton.js';
import MenuBackButton from '../components/MenuBackButton.js';
import PackingBoardView from '../components/PackingBoardView.js';
import ShoppingSession from '../systems/ShoppingSession.js';
import { theme } from '../config/theme.js';
import { openItemInfo } from '../utils/openItemInfo.js';
import { runProgress } from '../data/runRules.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create(data) {
    // Keep the board and reserve centered, with room for the sale zone at the side.
    this.scale.setGameSize(920, 1280);
    this.cameras.main.setScroll(-100, 0);
    this.events.once('shutdown', () => this.scale.setGameSize(720, 1280));
    new MenuBackButton(this);
    const session = data.session ?? new ShoppingSession();
    this.add.text(360, 65, 'COMPRAS · ORGANIZAR', {
      fontFamily: theme.fontFamily, fontSize: '34px', fontStyle: 'bold', color: theme.text,
    }).setOrigin(0.5);
    const progress = this.add.text(360, 96, `${runProgress(session)} · Ouro: ${session.gold}`, {
      fontFamily: theme.fontFamily, fontSize: '18px', color: theme.muted,
    }).setOrigin(0.5);
    this.add.text(360, 130, 'Toque para ver informações ou arraste uma peça.\nEspaço: girar durante o arraste.', {
      fontFamily: theme.fontFamily, fontSize: '22px', color: theme.muted,
      align: 'center', lineSpacing: 8,
    }).setOrigin(0.5);
    const message = this.add.text(360, 870, 'Arraste uma peça para começar.', {
      fontFamily: theme.fontFamily, fontSize: '23px', color: theme.text,
      align: 'center', wordWrap: { width: 576 },
    }).setOrigin(0.5);

    const board = session.board;
    const view = new PackingBoardView(this, board, (text) => message.setText(text),
      piece => openItemInfo(this, piece), (kind, piece) => {
        const error = session.sell(kind, piece.id);
        if (!error) progress.setText(`${runProgress(session)} · Ouro: ${session.gold}`);
        return error;
      });
    new TextButton(this, 260, 205, 'Girar · 90°', () => view.rotateSelected(),
      { width: 188, height: 54, fontSize: 22 });
    new TextButton(this, 460, 205, 'Informações', () => {
      if (view.selected) openItemInfo(this, view.selected.piece);
      else message.setText('Selecione uma peça para ver suas informações.');
    }, { width: 188, height: 54, fontSize: 22 });

    new TextButton(this, 360, 1144, 'Voltar à loja', () => {
      this.scene.start('ShopScene', { session });
    }, { height: 56, fontSize: 24 });
    new TextButton(this, 360, 1220, 'Concluir compras', () => {
      const error = session.getCompletionError();
      if (error) message.setText(error);
      else this.scene.start('BattleScene', { session });
    }, { height: 64, fontSize: 25 });
  }
}
