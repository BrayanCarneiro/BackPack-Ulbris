import { theme } from '../config/theme.js';
import { sellPrice } from '../data/economy.js';
import { packingLayout } from '../config/packingLayout.js';

export default class SellDropZone {
  constructor(scene) {
    this.scene = scene;
    this.hovered = false;
    const offsetX = packingLayout.tray.x + packingLayout.tray.width + 50 - 602;
    this.bounds = { x: 602 + offsetX, y: 958, width: 100, height: 146 };
    this.graphics = scene.add.graphics().setPosition(offsetX, 0).setDepth(8);
    this.lid = scene.add.graphics().setPosition(612 + offsetX, 994).setDepth(9);
    this.lid.once('destroy', () => scene.tweens.killTweensOf(this.lid));
    this.label = scene.add.text(650 + offsetX, 1076, 'Vender', {
      fontFamily: theme.fontFamily, fontSize: '18px', color: theme.muted,
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(8);
    this.refresh();
  }

  contains(pointer) {
    const { x, y, width, height } = this.bounds;
    return pointer.x >= x && pointer.x <= x + width
      && pointer.y >= y && pointer.y <= y + height;
  }

  refresh(piece, hovered = false) {
    const color = hovered ? theme.accentHover : theme.accent;
    this.graphics.clear().lineStyle(4, color);
    this.graphics.strokeRoundedRect(622, 1002, 56, 62, 6);
    for (const x of [636, 650, 664]) this.graphics.lineBetween(x, 1015, x, 1051);
    this.lid.clear().lineStyle(4, color);
    this.lid.lineBetween(0, 0, 76, 0);
    this.lid.strokeRoundedRect(25, -13, 26, 12, 3);
    if (hovered !== this.hovered) {
      this.hovered = hovered;
      this.scene.tweens.killTweensOf(this.lid);
      this.scene.tweens.add({ targets: this.lid, rotation: hovered ? -0.45 : 0,
        y: hovered ? 984 : 994, duration: 140, ease: 'Sine.easeOut' });
    }
    this.label.setText(piece ? `${sellPrice(piece)} ouro` : 'Vender');
  }
}
