import Phaser from 'phaser';
import { theme } from '../config/theme.js';

export default class TextButton extends Phaser.GameObjects.Container {
  constructor(scene, x, y, label, onClick, { width = 480, height = 88, fontSize = 28 } = {}) {
    super(scene, x, y);

    const background = scene.add.rectangle(0, 0, width, height, theme.accent);
    const text = scene.add.text(0, 0, label, {
      fontFamily: theme.fontFamily,
      fontSize: `${fontSize}px`,
      color: theme.buttonText,
    }).setOrigin(0.5);
    this.label = text;

    this.add([background, text]);
    this.setSize(width, height);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => background.setFillStyle(theme.accentHover));
    this.on('pointerout', () => {
      this.pressedPointer = null;
      background.setFillStyle(theme.accent);
    });
    this.on('pointerdown', (pointer) => { this.pressedPointer = pointer.id; });
    this.on('pointerup', (pointer) => {
      const pressedHere = this.pressedPointer === pointer.id;
      this.pressedPointer = null;
      if (pressedHere) onClick();
    });

    scene.add.existing(this);
  }

  setLabel(label) {
    this.label.setText(label);
    return this;
  }
}
