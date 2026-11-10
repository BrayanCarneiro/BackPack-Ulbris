import { theme } from '../config/theme.js';
import { sellPrice } from '../data/economy.js';
import { packingLayout } from '../config/packingLayout.js';

export default class SellDropZone {
  constructor(scene, bounds = { x: packingLayout.tray.x + packingLayout.tray.width + 50,
    y: 958, width: 100, height: 146 }) {
    this.scene = scene;
    this.hovered = false;
    this.bounds = bounds;
    this.lidY = bounds.y + (bounds.compact ? 15 : 36);
    this.graphics = scene.add.graphics().setPosition(bounds.x, bounds.y).setDepth(8);
    this.lid = scene.add.graphics().setPosition(bounds.x + (bounds.compact ? 14 : 10), this.lidY).setDepth(9);
    this.lid.once('destroy', () => scene.tweens.killTweensOf(this.lid));
    this.label = scene.add.text(bounds.x + (bounds.compact ? bounds.width / 2 : 48), bounds.y + (bounds.compact ? 26 : 118), 'Vender', {
      fontFamily: theme.fontFamily, fontSize: '18px', color: theme.muted,
      align: 'center',
    }).setOrigin(0.5, bounds.compact ? 0.5 : 0).setDepth(8);
    this.refresh();
  }

  contains(pointer) {
    const { x, y, width, height } = this.bounds;
    return pointer.x >= x && pointer.x <= x + width
      && pointer.y >= y && pointer.y <= y + height;
  }

  refresh(piece, hovered = false) {
    const color = hovered ? theme.accentHover : theme.accent;
    this.graphics.clear();
    this.lid.clear();
    if (this.bounds.compact) {
      this.graphics.fillStyle(0x20383c).fillRoundedRect(0, 0, this.bounds.width, this.bounds.height, 10)
        .lineStyle(1, color, hovered ? 0.85 : 0.25).strokeRoundedRect(0, 0, this.bounds.width, this.bounds.height, 10)
        .lineStyle(2, color).strokeRoundedRect(18, 19, 18, 22, 3);
      this.lid.lineStyle(2, color).lineBetween(0, 0, 26, 0).strokeRoundedRect(8, -5, 10, 5, 2);
    } else {
      this.graphics.lineStyle(4, color).strokeRoundedRect(20, 44, 56, 62, 6);
      for (const x of [34, 48, 62]) this.graphics.lineBetween(x, 57, x, 93);
      this.lid.lineStyle(4, color).lineBetween(0, 0, 76, 0).strokeRoundedRect(25, -13, 26, 12, 3);
    }
    if (hovered !== this.hovered) {
      this.hovered = hovered;
      this.scene.tweens.killTweensOf(this.lid);
      this.scene.tweens.add({ targets: this.lid, rotation: hovered ? -0.45 : 0,
        y: this.lidY - (hovered ? this.bounds.compact ? 4 : 10 : 0), duration: 140, ease: 'Sine.easeOut' });
    }
    this.label.setText(piece ? `${sellPrice(piece)} ouro` : 'Vender');
  }
}
