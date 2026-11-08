import Phaser from 'phaser';
import TextButton from '../components/TextButton.js';
import PackingBoardView from '../components/PackingBoardView.js';
import ShoppingSession from '../systems/ShoppingSession.js';
import { theme } from '../config/theme.js';
import { openItemInfo } from '../utils/openItemInfo.js';
import { runProgress } from '../data/runRules.js';
import { sellPrice } from '../data/economy.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create(data) {
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
    const view = new PackingBoardView(this, board, (text) => message.setText(text), piece => openItemInfo(this, piece));
    new TextButton(this, 172, 205, 'Girar · 90°', () => view.rotateSelected(),
      { width: 188, height: 54, fontSize: 22 });
    new TextButton(this, 370, 205, 'Informações', () => {
      if (view.selected) openItemInfo(this, view.selected.piece);
      else message.setText('Selecione uma peça para ver suas informações.');
    }, { width: 188, height: 54, fontSize: 22 });
    const sellButton = new TextButton(this, 568, 205, 'Vender', () => {
      if (view.dragging) { message.setText('Solte a peça antes de vender.'); return; }
      if (!view.selected) { message.setText('Selecione a peça que deseja vender.'); return; }
      const selected = view.selected;
      const value = sellPrice(selected.piece);
      const error = session.sell(selected.kind, selected.piece.id);
      if (error) { message.setText(error); return; }
      view.views.splice(view.views.indexOf(selected), 1);
      selected.object.destroy();
      view.selected = null;
      view.stars.clear();
      view.refresh();
      progress.setText(`${runProgress(session)} · Ouro: ${session.gold}`);
      message.setText(`${selected.piece.name} vendido por ${value} de ouro.`);
    }, { width: 188, height: 54, fontSize: 22 });
    const updateSellLabel = () => sellButton.setLabel(view.selected
      ? `Vender · ${sellPrice(view.selected.piece)} ouro` : 'Vender');
    this.events.on('update', updateSellLabel);
    this.events.once('shutdown', () => this.events.off('update', updateSellLabel));

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
