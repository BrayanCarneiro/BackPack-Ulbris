import Phaser from 'phaser';
import { characters } from '../data/characters.js';
import { prepareBattleTextures } from '../utils/battleTextures.js';
import { arthurAttacks, attackFrame } from '../data/arthurAnimations.js';
import { itemArt } from '../data/itemArt.js';

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    this.logoFailed = false;
    this.failedItemArt = [];
    this.load.setPath('assets/');
    this.load.image('ulbris-logo', 'brand/ulbris-logo.webp');
    for (const art of Object.values(itemArt)) this.load.image(art.key, `items/${art.file}.webp`);
    this.load.image('arthur-battle-body', 'characters/arthur/battle-body.png');
    this.load.image('arthur-battle-sword', 'characters/arthur/battle-sword.png');
    for (const attack of Object.values(arthurAttacks)) {
      this.load.spritesheet(attack.key, `characters/arthur/${attack.file}`, attackFrame);
    }
    for (const character of characters) {
      this.load.image(character.portrait, character.portraitPath);
      this.load.image(character.background, character.backgroundPath);
    }
    this.load.on('loaderror', file => {
      if (file.key === 'ulbris-logo') this.logoFailed = true;
      const art = Object.values(itemArt).find(art => art.key === file.key);
      if (art) this.failedItemArt.push(art);
    });
  }

  create() {
    prepareBattleTextures(this);
    for (const attack of Object.values(arthurAttacks)) {
      if (!this.anims.exists(attack.key)) this.anims.create({
        key: attack.key, frames: this.anims.generateFrameNumbers(attack.key, { start: 0, end: 7 }),
        frameRate: attack.frameRate, repeat: 0,
      });
    }
    // Use a texture frame to ignore the transparent margin without rewriting the art.
    const arthur = this.textures.get('arthur-portrait');
    if (!arthur.has('body')) arthur.add('body', 0, 284, 43, 699, 1175);
    if (this.logoFailed || this.failedItemArt.length) {
      // PNG fallback for browsers that cannot decode WebP. Menus retain a text fallback too.
      if (this.logoFailed) this.load.image('ulbris-logo', 'brand/ulbris-logo.png');
      for (const art of this.failedItemArt) this.load.image(art.key, `items/${art.file}.png`);
      this.load.once('complete', () => this.scene.start('MenuScene'));
      this.load.start();
      return;
    }
    this.scene.start('MenuScene');
  }
}
