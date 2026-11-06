import Phaser from 'phaser';

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    // Future assets will be loaded here from public/assets/.
    this.load.setPath('assets/');
  }

  create() {
    this.scene.start('MenuScene');
  }
}
