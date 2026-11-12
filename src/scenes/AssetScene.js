import Phaser from 'phaser';
import TextButton from '../components/TextButton.js';
import { theme } from '../config/theme.js';

// Load each screen's image group before creating its controls. Phaser's global
// textures let subsequent visits reuse the images without requests or decoding.
export default class AssetScene extends Phaser.Scene {
  constructor(key, assets) {
    super(key);
    this.requiredAssets = assets;
  }

  preload() {
    this.assetsReady = false;
    this.pngAttempted = false;
    this.assetStatus = null;
    this.assetRetry = null;
    this.assetResume = null;
    this.assetProgress = null;
    this.loadingAssets = typeof this.requiredAssets === 'function'
      ? this.requiredAssets(this.sys.settings.data ?? {}, this.registry) : this.requiredAssets;
    this.load.setPath('assets/');
    const missing = this.missingAssets();
    if (missing.length) {
      this.assetStatus = this.add.text(this.scale.width / 2, this.scale.height / 2,
        'Carregando... 0%', { fontFamily: theme.fontFamily, fontSize: '28px', color: theme.text,
          align: 'center', wordWrap: { width: 600 } }).setOrigin(0.5);
      this.assetProgress = progress => this.assetStatus?.setText(`Carregando... ${Math.round(progress * 100)}%`);
      this.load.on('progress', this.assetProgress);
      this.queueAssets(missing, 'webp');
    }
    this.events.once('shutdown', () => {
      this.assetsReady = false;
      if (this.assetProgress) this.load.off('progress', this.assetProgress);
      if (this.assetResume) this.load.off('complete', this.assetResume);
    });
  }

  missingAssets() {
    return this.loadingAssets.filter(asset => !this.textures.exists(asset.key));
  }

  queueAssets(assets, format) {
    for (const asset of assets) {
      const path = asset.path.replace(/\.png$/, `.${format}`);
      if (asset.atlas) this.load.atlas(asset.key, path, asset.atlas);
      else if (asset.frame) this.load.spritesheet(asset.key, path, asset.frame);
      else this.load.image(asset.key, path);
    }
  }

  resumeAfterLoad(data) {
    this.assetResume = () => { this.assetResume = null; this.create(data); };
    this.load.once('complete', this.assetResume);
    this.load.start();
  }

  create(data) {
    const missing = this.missingAssets();
    if (missing.length) {
      if (!this.pngAttempted) {
        // A WebP decode can fail without loaderror. Check textures themselves.
        this.pngAttempted = true;
        this.queueAssets(missing, 'png');
        this.resumeAfterLoad(data);
      } else {
        this.assetStatus.setText('Não foi possível carregar as imagens.\nConfira sua conexão e tente novamente.');
        this.assetRetry = new TextButton(this, this.scale.width / 2, this.scale.height / 2 + 120,
          'Tentar novamente', () => {
            this.assetRetry.destroy();
            this.assetRetry = null;
            this.pngAttempted = false;
            this.queueAssets(this.missingAssets(), 'webp');
            this.resumeAfterLoad(data);
          }, { width: 360, height: 64, fontSize: 24 });
      }
      return;
    }
    if (this.assetProgress) this.load.off('progress', this.assetProgress);
    this.assetStatus?.destroy();
    this.assetStatus = null;
    this.assetsReady = true;
    this.createReady(data);
  }
}
