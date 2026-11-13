import AssetScene from './AssetScene.js';
import { menuAssets, selectionAssets, itemAssets, battleAssets } from '../data/sceneAssets.js';
import { prepareBattleTextures } from '../utils/battleTextures.js';

export default class PreloadScene extends AssetScene {
  constructor() {
    super('PreloadScene', [...menuAssets, ...selectionAssets, ...itemAssets, ...battleAssets]);
  }

  createReady() {
    prepareBattleTextures(this);
    this.scene.start('MenuScene');
  }
}
