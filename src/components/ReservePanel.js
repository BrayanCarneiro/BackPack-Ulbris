import TextButton from './TextButton.js';
import { theme } from '../config/theme.js';
import { packingLayout as defaultLayout } from '../config/packingLayout.js';

export default class ReservePanel {
  constructor(scene, onToggle, layout = defaultLayout) {
    this.layout = layout;
    this.expanded = false;
    this.background = scene.add.rectangle(0, 0, 1, 1, 0x101e24)
      .setOrigin(0).setStrokeStyle(2, theme.accent, 0.35)
      .setDepth(5).setInteractive();
    this.title = scene.add.text(88, 0, 'RESERVA', {
      fontFamily: theme.fontFamily, fontSize: '21px', color: theme.text,
    }).setDepth(6);
    this.button = new TextButton(scene, 552, 0, 'Expandir', onToggle,
      { width: 160, height: 48, fontSize: 22 }).setDepth(6);
  }

  get bounds() {
    const tray = this.expanded ? this.layout.expandedTray : this.layout.tray;
    return { x: tray.x, y: tray.y - 56, width: tray.width, height: tray.height + 56 };
  }

  contains(pointer) {
    const { x, y, width, height } = this.bounds;
    return pointer.x >= x && pointer.x <= x + width
      && pointer.y >= y && pointer.y <= y + height;
  }

  refresh(storedViews) {
    const { x, y, width, height } = this.bounds;
    this.background.setPosition(x, y).setSize(width, height);
    // Rectangle geometry and input bounds both follow the expanded panel.
    this.background.input.hitArea.setTo(0, 0, width, height);
    this.title.setPosition(x + 16, y + 17).setText(`RESERVA · ${storedViews.length}`);
    this.button.setPosition(x + width - 96, y + 28)
      .setLabel(this.expanded ? 'Recolher' : 'Expandir');

    const columns = this.expanded ? 3 : Math.max(3, storedViews.length);
    const rows = Math.max(1, Math.ceil(storedViews.length / columns));
    const slotWidth = width / columns;
    const slotHeight = (height - 56) / rows;
    return new Map(storedViews.map((view, index) => [view, {
      x: x + (index % columns + 0.5) * slotWidth,
      y: y + 56 + (Math.floor(index / columns) + 0.5) * slotHeight,
      scale: Math.min(1, (slotWidth - 20) / (view.piece.width * this.layout.cellSize),
        (slotHeight - 20) / (view.piece.height * this.layout.cellSize)),
    }]));
  }
}
