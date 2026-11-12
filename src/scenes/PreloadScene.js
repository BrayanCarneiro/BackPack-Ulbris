import AssetScene from './AssetScene.js';
import { menuAssets } from '../data/sceneAssets.js';

export default class PreloadScene extends AssetScene {
  constructor() { super('PreloadScene', menuAssets); }

  createReady() { this.scene.start('MenuScene'); }
}
