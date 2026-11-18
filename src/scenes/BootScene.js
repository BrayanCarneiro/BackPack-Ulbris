import Phaser from 'phaser';
import { account } from '../services/account.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  async create() {
    let active = true;
    const stop = () => { active = false; };
    this.events.once('shutdown', stop);
    this.events.once('destroy', stop);
    await account.initialize();
    if (!active || !this.sys.isActive()) return;
    this.scene.start('PreloadScene');
  }
}
