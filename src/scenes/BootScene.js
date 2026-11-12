import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    const logo = document.getElementById('front-logo');
    if (logo?.complete && logo.naturalWidth > 0) {
      if (!this.textures.exists('ulbris-logo')) this.textures.addImage('ulbris-logo', logo);
      this.scene.start('MenuScene');
      return;
    }
    this.scene.start('PreloadScene');
  }
}
