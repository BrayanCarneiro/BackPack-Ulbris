import Phaser from 'phaser';
import TextButton from '../components/TextButton.js';
import PackingBoardView from '../components/PackingBoardView.js';
import PackingBoard from '../systems/PackingBoard.js';
import { packingPrototype } from '../data/packingPrototype.js';
import { theme } from '../config/theme.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.add.text(360, 65, 'PREPARAR MOCHILAS', {
      fontFamily: theme.fontFamily, fontSize: '34px', fontStyle: 'bold', color: theme.text,
    }).setOrigin(0.5);
    this.add.text(360, 130, 'Selecione ou arraste uma peça.\nEspaço: girar durante o arraste.', {
      fontFamily: theme.fontFamily, fontSize: '22px', color: theme.muted,
      align: 'center', lineSpacing: 8,
    }).setOrigin(0.5);
    const message = this.add.text(360, 870, 'Arraste uma peça para começar.', {
      fontFamily: theme.fontFamily, fontSize: '23px', color: theme.text,
      align: 'center', wordWrap: { width: 576 },
    }).setOrigin(0.5);

    const board = new PackingBoard(packingPrototype);
    const view = new PackingBoardView(this, board, (text) => message.setText(text));
    new TextButton(this, 360, 205, 'Girar · 90°', () => view.rotateSelected(),
      { width: 240, height: 54, fontSize: 24 });

    new TextButton(this, 360, 1190, 'Voltar ao menu', () => {
      this.scene.start('MenuScene');
    }, { height: 72, fontSize: 25 });
  }
}
