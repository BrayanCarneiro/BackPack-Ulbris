import TextButton from './TextButton.js';
import { theme } from '../config/theme.js';

export default class RoundedButton extends TextButton {
  constructor(scene, x, y, label, onClick, options = {}) {
    super(scene, x, y, label, onClick, options);
    const { secondary = false } = options;
    this.list[0].setVisible(false);
    const graphics = scene.add.graphics();
    this.addAt(graphics, 0);
    const draw = (hover = false) => {
      graphics.clear().fillStyle(secondary ? hover ? 0x294348 : 0x20383c : hover ? theme.accentHover : theme.accent)
        .fillRoundedRect(-this.width / 2, -this.height / 2, this.width, this.height, 10)
        .lineStyle(1, theme.accent, secondary ? 0.25 : 0.7)
        .strokeRoundedRect(-this.width / 2, -this.height / 2, this.width, this.height, 10);
    };
    if (secondary) this.label.setColor(theme.muted);
    this.on('pointerover', () => draw(true));
    this.on('pointerout', () => draw());
    draw();
  }

  setEnabled(enabled) {
    if (enabled) this.setInteractive({ useHandCursor: true }).setAlpha(1);
    else this.disableInteractive().setAlpha(0.4);
    return this;
  }
}
