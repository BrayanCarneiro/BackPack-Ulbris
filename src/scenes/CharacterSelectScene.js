import AssetScene from './AssetScene.js';
import { selectionAssets } from '../data/sceneAssets.js';
import { characters } from '../data/characters.js';

const gold = 0xcbb88d;
const serif = 'Georgia, "Times New Roman", serif';

export default class CharacterSelectScene extends AssetScene {
  constructor() { super('CharacterSelectScene', selectionAssets); }

  createReady() {
    this.detailsOpen = false;
    const arthur = this.textures.get('arthur-portrait');
    if (!arthur.has('body')) arthur.add('body', 0, 284, 43, 699, 1175);
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
      const center = wide && this.detailsOpen ? width * 0.28 : width / 2;
      const bg = this.add.image(width / 2, height / 2, character.background);
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
      const titleY = wide ? 85 : this.detailsOpen ? 90 : 145;
      const frameTop = wide ? 194 : this.detailsOpen ? 225 : 310;
      const frameBottom = wide ? 636 : this.detailsOpen ? 540 : 870;
      const half = wide ? 115 : this.detailsOpen ? 90 : 154;
      const title = this.add.text(width / 2, titleY, 'SELECIONE SEU PERSONAGEM', {
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
        this.detailsOpen = true;
        this.renderSelection();
      });
      if (this.detailsOpen) {
        this.selectButton.setVisible(false).disableInteractive();
        this.renderDetails(character, wide, width);
      }
      this.backButton = this.button(center, this.detailsOpen && !wide ? 1200 : selectY + 76, 260, 54, 'VOLTAR', () => {
        if (this.detailsOpen) {
          this.detailsOpen = false;
          this.renderSelection();
        } else this.scene.start('LobbyScene');
      }, true);
    } finally { this.drawing = false; }
  }

  renderDetails(character, wide, width) {
    const left = wide ? Math.round(width * 0.53) : 36;
    const top = wide ? 230 : 635;
    const panelWidth = wide ? Math.round(width * 0.43) : width - 72;
    const panelHeight = wide ? 500 : 435;
    const panel = this.add.graphics();
    const x = left + 30;
    const textWidth = panelWidth - 60;
    const text = (y, value, size, color = '#c2cbca', family = 'Arial') => this.add.text(x, y, value, {
      fontFamily: family, fontSize: `${size}px`, color, wordWrap: { width: textWidth }, lineSpacing: 6,
    });
    let y = top + 25;
    const name = text(y, `${character.name} — ${character.className}`, 30, '#eadbb9', serif);
    y += name.height + 16;
    const description = text(y, character.description, 21);
    y += description.height + 22;
    text(y, 'PASSIVA DO CAVALEIRO', 14, '#ab9b77');
    y += 25;
    const passiveName = text(y, character.passive.name, 28, '#e7cc8f', serif);
    y += passiveName.height + 12;
    const effect = text(y, character.passive.description, 23, '#f4efdf');
    y += effect.height + 14;
    const detail = text(y, character.passive.detail, 18);
    // Keep confirmation below the copy even on the narrowest desktop layout.
    const buttonY = wide ? Math.max(top + panelHeight - 48, detail.y + detail.height + 45) : 1120;
    const actualHeight = wide ? buttonY + 48 - top : Math.max(panelHeight, detail.y + detail.height + 24 - top);
    panel.fillStyle(0x101f24, 0.96).fillRoundedRect(left, top, panelWidth, actualHeight, 16)
      .lineStyle(1, gold, 0.45).strokeRoundedRect(left, top, panelWidth, actualHeight, 16);
    this.startButton = this.button(left + panelWidth / 2, buttonY, Math.min(360, panelWidth - 48), 62,
      'INICIAR JORNADA', () => {
        this.registry.set('selectedCharacter', character.id);
        this.scene.start('ShopScene', { session: null, classId: character.id });
      });
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
