import Phaser from 'phaser';
import { characters } from '../data/characters.js';

const gold = 0xcbb88d;
const serif = 'Georgia, "Times New Roman", serif';

export default class CharacterSelectScene extends Phaser.Scene {
  constructor() { super('CharacterSelectScene'); }

  create() {
    this.selectedIndex = Math.max(0, characters.findIndex(character => character.id === this.registry.get('selectedCharacter')));
    this.redraw = () => this.renderSelection();
    this.scale.on('resize', this.redraw);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.redraw);
      this.scale.setGameSize(720, 1280);
    });
    this.renderSelection();
  }

  renderSelection() {
    if (this.drawing) return;
    this.drawing = true;
    try {
      const { width: parentWidth, height: parentHeight } = this.scale.parentSize;
      const wide = parentWidth / parentHeight >= 1.1;
      const height = wide ? 941 : 1280;
      const width = wide ? Math.min(2200, Math.max(1100, Math.round(height * parentWidth / parentHeight))) : 720;
      this.scale.setGameSize(width, height);
      this.children.removeAll(true);
      const character = characters[this.selectedIndex];
      const center = width / 2;
      const bg = this.add.image(center, height / 2, character.background);
      // Contain the wide scenery on phones; extend its dark sky above/below.
      this.cameras.main.setBackgroundColor('#101f24');
      const bgScale = wide ? Math.max(width / bg.width, height / bg.height) : Math.max(width / bg.width, 760 / bg.height);
      bg.setScale(bgScale);
      if (!wide) {
        const top = height / 2 - bg.displayHeight / 2;
        const bottom = height / 2 + bg.displayHeight / 2;
        const fade = this.add.graphics();
        for (let row = 0; row < 80; row++) {
          fade.fillStyle(0x101f24, 1 - row / 80);
          fade.fillRect(0, top + row, width, 1);
          fade.fillRect(0, bottom - row - 1, width, 1);
        }
      }
      const titleY = wide ? 85 : 145;
      const frameTop = wide ? 194 : 310;
      const frameBottom = wide ? 636 : 870;
      const half = wide ? 115 : 154;
      const title = this.add.text(center, titleY, 'SELECIONE SEU PERSONAGEM', {
        fontFamily: serif, fontSize: wide ? '44px' : '32px', color: '#d9cfb9', align: 'center',
      }).setOrigin(0.5);
      if (title.width > width - 48) title.setScale((width - 48) / title.width);
      const lines = this.add.graphics();
      lines.lineStyle(2, gold, 0.35);
      const ruleY = titleY + 48;
      const ruleWidth = Math.min(395, width / 2 - 48);
      lines.lineBetween(center - ruleWidth, ruleY, center - 25, ruleY);
      lines.lineBetween(center + 25, ruleY, center + ruleWidth, ruleY);
      lines.fillStyle(gold);
      lines.fillPoints([{ x: center, y: ruleY - 16 }, { x: center + 10, y: ruleY },
        { x: center, y: ruleY + 16 }, { x: center - 10, y: ruleY }], true);
      const points = [
        { x: center, y: frameTop }, { x: center + half, y: frameTop + 74 },
        { x: center + half, y: frameBottom - 20 }, { x: center + half - 30, y: frameBottom },
        { x: center - half + 30, y: frameBottom }, { x: center - half, y: frameBottom - 20 },
        { x: center - half, y: frameTop + 74 },
      ];
      lines.fillStyle(0x0c171d, 0.35);
      lines.fillPoints(points, true);
      lines.lineStyle(5, gold, 0.9);
      lines.strokePoints(points, true);
      const portrait = this.add.image(center, frameBottom - 8, character.portrait, character.portraitFrame).setOrigin(0.5, 1);
      portrait.setScale(Math.min((half * 2 - 28) / portrait.width, (frameBottom - frameTop - 30) / portrait.height));
      const plaqueY = frameBottom + 23;
      this.add.rectangle(center, plaqueY, half * 2 + 4, 48, 0x132126, 0.95).setStrokeStyle(3, gold, 0.9);
      this.add.text(center, plaqueY, character.className.toUpperCase(), {
        fontFamily: serif, fontSize: '26px', color: '#ded0ae',
      }).setOrigin(0.5);
      const arrowY = (frameTop + frameBottom) / 2 + 16;
      this.previousButton = this.arrow(center - half - 92, arrowY, -1);
      this.nextButton = this.arrow(center + half + 92, arrowY, 1);
      const selectY = wide ? 773 : 1045;
      this.selectButton = this.button(center, selectY, wide ? 320 : 430, 66, 'SELECIONAR', () => {
        this.registry.set('selectedCharacter', character.id);
        this.scene.start('ShopScene', { session: null, classId: character.id });
      });
      this.backButton = this.button(center, selectY + 76, 260, 54, 'VOLTAR', () => this.scene.start('LobbyScene'), true);
    } finally { this.drawing = false; }
  }

  arrow(x, y, direction) {
    const button = this.button(x, y, 76, 86, direction < 0 ? '◀' : '▶', () => {
      this.selectedIndex = (this.selectedIndex + direction + characters.length) % characters.length;
      this.renderSelection();
    }, true);
    button.setAlpha(characters.length > 1 ? 1 : 0.35);
    if (characters.length === 1) button.disableInteractive();
    return button;
  }

  button(x, y, width, height, label, onClick, quiet = false) {
    const background = this.add.rectangle(0, 0, width, height, quiet ? 0x101f24 : 0xdac18a, quiet ? 0 : 1);
    if (!quiet) background.setStrokeStyle(2, 0xf0d7a1);
    const text = this.add.text(0, 0, label, {
      fontFamily: serif, fontSize: '26px', color: quiet ? '#c5b58e' : '#142127', fontStyle: 'bold',
    }).setOrigin(0.5);
    const button = this.add.container(x, y, [background, text]).setSize(width, height).setInteractive({ useHandCursor: true });
    button.on('pointerover', () => text.setAlpha(0.75));
    button.on('pointerout', () => { button.pressedPointer = null; text.setAlpha(1); });
    button.on('pointerdown', pointer => { button.pressedPointer = pointer.id; });
    button.on('pointerup', pointer => {
      const pressedHere = button.pressedPointer === pointer.id;
      button.pressedPointer = null;
      if (pressedHere) onClick();
    });
    return button;
  }
}
