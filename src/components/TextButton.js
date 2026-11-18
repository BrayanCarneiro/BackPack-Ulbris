import Phaser from 'phaser';
import { theme } from '../config/theme.js';

export default class TextButton extends Phaser.GameObjects.Container {
  constructor(scene, x, y, label, onClick, {
    width = 480, height = 88, fontSize = 28, secondary = false,
    fontFamily = height >= 60 ? theme.displayFont : theme.fontFamily,
  } = {}) {
    super(scene, x, y);
    this.secondary = secondary;
    this.selected = false;
    this.hovered = false;
    this.enabled = true;
    this.background = scene.add.graphics();
    this.label = scene.add.text(0, -1, label, {
      fontFamily, fontSize: `${fontSize}px`, color: theme.buttonText,
    }).setOrigin(0.5);
    this.add([this.background, this.label]);
    this.setSize(width, height);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => { this.hovered = true; this.redraw(); });
    this.on('pointerout', () => {
      this.hovered = false;
      this.pressedPointer = null;
      this.redraw();
    });
    this.on('pointerdown', pointer => {
      if (!this.enabled) return;
      this.pressedPointer = pointer.id;
      this.redraw();
    });
    this.on('pointerup', pointer => {
      const pressedHere = this.enabled && this.pressedPointer === pointer.id;
      this.pressedPointer = null;
      this.redraw();
      if (pressedHere) onClick();
    });
    scene.add.existing(this);
    this.redraw();
  }

  redraw() {
    if (!this.background || !this.label) return this;
    const { width: w, height: h } = this;
    const x = -w / 2, y = -h / 2;
    const pressed = this.pressedPointer != null && this.enabled;
    const hover = this.hovered && this.enabled;
    const secondary = this.secondary;
    const edge = this.selected || hover ? theme.accentHover : theme.accent;
    const top = secondary ? hover ? 0x2b484c : this.selected ? 0x2b403d : 0x20353a
      : pressed ? 0xae8d54 : hover ? 0xebd8ab : 0xdbc38f;
    const bottom = secondary ? 0x13252a : pressed ? 0x97733e : 0xb7955b;
    const g = this.background.clear();
    const radius = Math.min(8, h / 6);
    g.fillStyle(0x030a0d, pressed ? 0.2 : 0.5)
      .fillRoundedRect(x, y + (pressed ? 2 : 4), w, h, radius);
    g.fillGradientStyle(top, top, bottom, bottom, 1)
      .fillRoundedRect(x, y, w, h, radius);
    g.lineStyle(1, secondary ? edge : theme.goldDark, secondary ? this.selected || hover ? 0.9 : 0.45 : 1)
      .strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, radius);
    g.lineStyle(1, secondary ? edge : theme.goldLight, secondary ? 0.08 : 0.42)
      .strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, Math.max(2, radius - 3));
    g.lineStyle(1, 0xfff2cf, secondary ? 0.08 : 0.5)
      .lineBetween(x + 11, y + 2, -x - 11, y + 2);
    if (w >= 300 && h >= 60) {
      g.fillStyle(secondary ? edge : 0x785b30, secondary ? 0.65 : 0.8);
      for (const side of [-1, 1]) {
        const cx = side * (w / 2 - 23);
        g.fillPoints([{ x: cx, y: -4 }, { x: cx + 3, y: 0 },
          { x: cx, y: 4 }, { x: cx - 3, y: 0 }], true);
      }
    }
    this.label.setY(pressed ? 1 : -1)
      .setColor(secondary ? this.selected || hover ? '#efddb4' : '#c6d0c9' : '#23291f');
    const allowance = w - (w >= 300 && h >= 60 ? 78 : 16);
    this.label.setScale(Math.min(1, allowance / Math.max(1, this.label.width)));
    this.setAlpha(this.enabled ? 1 : 0.42);
    return this;
  }

  setInteractive(...args) {
    if (this.input?.enabled && this.enabled) return this;
    super.setInteractive(...args);
    this.enabled = true;
    this.redraw();
    return this;
  }

  disableInteractive(...args) {
    if (this.input && !this.input.enabled && !this.enabled) return this;
    super.disableInteractive(...args);
    this.enabled = false;
    this.hovered = false;
    this.pressedPointer = null;
    this.redraw();
    return this;
  }

  setEnabled(enabled) {
    return enabled ? this.setInteractive({ useHandCursor: true }) : this.disableInteractive();
  }

  setSelected(selected) {
    this.selected = selected;
    return this.redraw();
  }

  setLabel(label) {
    if (this.label.text === label) return this;
    this.label.setText(label);
    return this.redraw();
  }
}
