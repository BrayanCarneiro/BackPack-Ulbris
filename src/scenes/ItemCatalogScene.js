import Phaser from 'phaser';
import TextButton from '../components/TextButton.js';
import { theme } from '../config/theme.js';
import { itemCatalog, getItemDetails } from '../utils/itemDetails.js';
import { openItemInfo } from '../utils/openItemInfo.js';

export default class ItemCatalogScene extends Phaser.Scene {
  constructor() {
    super('ItemCatalogScene');
  }

  create() {
    const textStyle = { fontFamily: theme.fontFamily, color: theme.text, align: 'center' };
    this.add.text(360, 80, 'ITENS', { ...textStyle, fontSize: '42px', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(360, 145, `${itemCatalog.length} itens · Toque para ver as informações`, {
      ...textStyle, fontSize: '21px', color: theme.muted,
    }).setOrigin(0.5);

    itemCatalog.forEach((item, index) => {
      const x = 152 + index % 3 * 208;
      const y = 270 + Math.floor(index / 3) * 170;
      const card = this.add.rectangle(x, y, 192, 154, theme.surface)
        .setStrokeStyle(1, theme.accent, 0.35);
      const cell = Math.min(12, 72 / item.width, 36 / item.height);
      const graphics = this.add.graphics().fillStyle(item.kind === 'bag' ? theme.bag : theme.accent);
      for (let row = 0; row < item.height; row++) {
        for (let column = 0; column < item.width; column++) {
          graphics.fillRoundedRect(x - item.width * cell / 2 + column * cell,
            y - 49 - item.height * cell / 2 + row * cell, cell - 2, cell - 2, 2);
        }
      }
      this.add.text(x, y + 2, item.name, {
        ...textStyle, fontSize: '20px', wordWrap: { width: 174 },
      }).setOrigin(0.5);
      const { itemClass } = getItemDetails(item);
      this.add.text(x, y + 53, `${itemClass.symbol} · ${item.width}×${item.height}`, {
        ...textStyle, fontSize: '16px', color: theme.muted,
      }).setOrigin(0.5);
      const zone = this.add.zone(x, y, 192, 154).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => card.setStrokeStyle(2, theme.accent, 0.9));
      zone.on('pointerdown', pointer => { zone.pressedPointer = pointer.id; });
      zone.on('pointerout', () => {
        zone.pressedPointer = null;
        card.setStrokeStyle(1, theme.accent, 0.35);
      });
      zone.on('pointerup', pointer => {
        if (zone.pressedPointer !== pointer.id) return;
        zone.pressedPointer = null;
        openItemInfo(this, item);
      });
    });
    const back = () => this.scene.start('LobbyScene');
    new TextButton(this, 360, 1160, 'Voltar', back, { height: 62, fontSize: 24 });
    this.input.keyboard.on('keydown-ESC', back);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown-ESC', back));
  }
}
