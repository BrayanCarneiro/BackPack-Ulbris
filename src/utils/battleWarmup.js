import File from 'phaser/src/loader/File.js';
import fileConstants from 'phaser/src/loader/const.js';
import { battleAssets } from '../data/sceneAssets.js';
import { battleTextureTasks } from './battleTextures.js';

const downloads = new WeakMap();
const warming = new WeakMap();
const { FILE_POPULATED, FILE_PROCESSING } = fileConstants;

function jobsFor(game) {
  if (!downloads.has(game)) {
    const jobs = new Map(); downloads.set(game, jobs);
    game.events.once('destroy', () => { for (const job of jobs.values()) job.controller.abort(); jobs.clear(); });
  }
  return downloads.get(game);
}

export function pendingBattleTexture(game, key) { return downloads.get(game)?.get(key)?.promise; }

// Join an in-flight background texture through Phaser's normal scene loader.
// The battle keeps its loading screen and never downloads the same key twice.
export class PendingBattleTextureFile extends File {
  constructor(loader, key, promise) {
    super(loader, {type:'pending-battle-texture',key,url:''});
    this.state = FILE_POPULATED;
    this.promise = promise;
  }

  onProcess() {
    this.state = FILE_PROCESSING;
    const finish = () => {
      if (this.loader?.isLoading() && this.loader.queue.contains(this)) this.onProcessComplete();
      else this.destroy();
    };
    // Missing textures are handled by AssetScene's PNG fallback and retry UI.
    this.promise.then(finish, finish);
  }
}

const idle = () => new Promise(resolve => {
  if ('requestIdleCallback' in window) window.requestIdleCallback(resolve, {timeout:400});
  else setTimeout(resolve, 200);
});

async function loadTexture(game, asset) {
  if (game.textures.exists(asset.key)) return;
  const jobs = jobsFor(game);
  if (jobs.has(asset.key)) return jobs.get(asset.key).promise;
  const controller = new AbortController();
  const promise = (async () => {
    for (const format of ['webp','png']) {
      const timeout = setTimeout(() => controller.abort(), 12000);
      let objectURL;
      try {
        const path = 'assets/' + asset.path.replace(/\.png$/, `.${format}`);
        const response = await fetch(new URL(path, document.baseURI), {priority:'low',signal:controller.signal});
        if (!response.ok) throw new Error(`Image ${response.status}`);
        const blob = await response.blob();
        const image = new Image(); objectURL = URL.createObjectURL(blob); image.src = objectURL;
        await image.decode();
        if (game.pendingDestroy || controller.signal.aborted) return;
        if (!game.textures.exists(asset.key)) {
          if (asset.frame) game.textures.addSpriteSheet(asset.key, image, asset.frame);
          else game.textures.addImage(asset.key, image);
        }
        return;
      } catch {
        if (controller.signal.aborted) return;
      } finally {
        clearTimeout(timeout);
        if (objectURL) URL.revokeObjectURL(objectURL);
      }
    }
  })();
  jobs.set(asset.key, {promise,controller});
  try { await promise; } finally { jobs.delete(asset.key); }
}

export function warmBattleAssets(shop) {
  const game = shop.game;
  if (warming.has(game) || navigator.connection?.saveData) return;
  game.registry.remove('battleWarmupError');
  const canContinue = () => !game.pendingDestroy && (shop.sys.isActive() || shop.sys.isPaused());
  const promise = (async () => {
    // Give the first shop frame and its controls priority over speculative work.
    await new Promise(resolve => setTimeout(resolve, 600));
    const preparations = [];
    for (const asset of battleAssets) {
      await idle();
      if (!canContinue()) return;
      await loadTexture(game, asset);
      if (['arthur-battle-body','arthur-battle-sword'].includes(asset.key) && game.textures.exists(asset.key)) {
        // Prepare small render tasks while later images are still downloading.
        preparations.push((async () => {
          for (const task of battleTextureTasks(shop, [asset.key])) {
            await idle(); if (!canContinue()) return false; task();
          }
          return true;
        })().catch(error => {
          if (!game.pendingDestroy) game.registry.set('battleWarmupError', String(error));
          return false;
        }));
      }
    }
    const prepared = await Promise.all(preparations);
    if (canContinue() && prepared.every(Boolean) && battleAssets.every(asset => game.textures.exists(asset.key))) {
      game.registry.set('battleWarmupReady', true);
    }
  })();
  warming.set(game, promise);
  void promise.catch(error => { if (!game.pendingDestroy) game.registry.set('battleWarmupError', String(error)); })
    .finally(() => warming.delete(game));
}
