import Phaser from 'phaser';
import TextButton from '../components/TextButton.js';
import MenuBackButton from '../components/MenuBackButton.js';
import { theme } from '../config/theme.js';
import { itemCatalog, getItemDetails } from '../utils/itemDetails.js';
import { openItemInfo } from '../utils/openItemInfo.js';
import { drawFootprint } from '../utils/drawFootprint.js';

export default class ItemCatalogScene extends Phaser.Scene {
  constructor() {
    super('ItemCatalogScene');
  }

  create() {
    this.page = 0;
    this.renderCatalog();
    const back = () => this.scene.start('LobbyScene');
    this.input.keyboard.on('keydown-ESC', back);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown-ESC', back));
  }

  renderCatalog() {
    this.children.removeAll(true);
    new MenuBackButton(this);
    const textStyle = { fontFamily: theme.fontFamily, color: theme.text, align: 'center' };
    this.add.text(360, 80, 'ITENS', { ...textStyle, fontSize: '42px', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(360, 145, `${itemCatalog.length} itens · Toque para ver as informações`, {
      ...textStyle, fontSize: '21px', color: theme.muted,
    }).setOrigin(0.5);

    const pageSize = 12;
    const pages = Math.ceil(itemCatalog.length / pageSize);
    itemCatalog.slice(this.page * pageSize, (this.page + 1) * pageSize).forEach((item, index) => {
      const x = 152 + index % 3 * 208;
      const y = 270 + Math.floor(index / 3) * 170;
      const card = this.add.rectangle(x, y, 192, 154, theme.surface)
        .setStrokeStyle(1, theme.accent, 0.35);
      const cell = Math.min(12, 72 / item.width, 36 / item.height);
      const graphics = this.add.graphics().fillStyle(item.kind === 'bag' ? theme.bag : theme.accent);
      drawFootprint(graphics, item, x - item.width * cell / 2, y - 49 - item.height * cell / 2, cell);
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
    this.add.text(360, 1035, `Página ${this.page + 1}/${pages}`, {
      ...textStyle, fontSize: '22px', color: theme.muted,
    }).setOrigin(0.5);
    for (const direction of [-1, 1]) {
      new TextButton(this, 360 + direction * 210, 1035, direction < 0 ? '‹ Anterior' : 'Próxima ›', () => {
        this.page = (this.page + direction + pages) % pages;
        this.renderCatalog();
      }, { width: 175, height: 50, fontSize: 21 });
    }
    new TextButton(this, 360, 1160, 'Voltar', () => this.scene.start('LobbyScene'), { height: 62, fontSize: 24 });
  }
}
