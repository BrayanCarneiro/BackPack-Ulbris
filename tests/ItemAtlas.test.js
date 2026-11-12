import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { itemArt } from '../src/data/itemArt.js';
import { itemAtlases } from '../src/data/itemAtlases.js';
import { allItems } from '../src/data/shopCatalog.js';
import { getClassItemAssets } from '../src/data/sceneAssets.js';
import { getItemArt } from '../src/utils/itemArt.js';

test('atlases contain every equipment art exactly once, in its catalog pool, preserving source dimensions', async () => {
  const seen = new Set();
  for (const atlas of itemAtlases) {
    const png = await readFile(new URL(`../public/assets/${atlas.path}`, import.meta.url));
    const { w, h } = atlas.atlas.meta.size;
    assert.equal(png.readUInt32BE(16), w);
    assert.equal(png.readUInt32BE(20), h);
    assert.ok(w <= 2048 && h <= 2048, 'fits our 2048px texture budget');
    const rectangles = [];
    for (const [id, frame] of Object.entries(atlas.atlas.frames)) {
      assert.ok(!seen.has(id), `duplicate frame: ${id}`);
      seen.add(id);
      assert.equal(atlas.pool, allItems.find(item => item.id === id)?.pool ?? 'general');
      const source = await readFile(new URL(`../public/assets/items/${itemArt[id].file}.png`, import.meta.url));
      assert.deepEqual(frame.sourceSize, { w: source.readUInt32BE(16), h: source.readUInt32BE(20) });
      assert.equal(frame.rotated, false);
      assert.equal(frame.trimmed, false);
      assert.equal(frame.frame.w, frame.sourceSize.w);
      assert.equal(frame.frame.h, frame.sourceSize.h);
      const box = { x: frame.frame.x - 2, y: frame.frame.y - 2, w: frame.frame.w + 4, h: frame.frame.h + 4 };
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.w <= w && box.y + box.h <= h);
      for (const other of rectangles) assert.ok(box.x + box.w <= other.x || other.x + other.w <= box.x
        || box.y + box.h <= other.y || other.y + other.h <= box.y, `overlapping frames near ${id}`);
      rectangles.push(box);
    }
  }
  assert.deepEqual([...seen].sort(), Object.keys(itemArt).sort());
});

test('item copies resolve to their named atlas frame; absent frames keep the geometric fallback', () => {
  const scene = { textures: { exists: key => itemAtlases.some(atlas => atlas.key === key),
    get: key => ({ has: frame => Boolean(itemAtlases.find(atlas => atlas.key === key).atlas.frames[frame]) }) } };
  for (const id of Object.keys(itemArt)) {
    const art = getItemArt(scene, { id: `${id}#2`, catalogId: id });
    assert.equal(art.frame, id);
    assert.ok(scene.textures.get(art.key).has(id));
  }
  assert.equal(getItemArt(scene, { id: 'traveler-bag' }), null);
  assert.equal(getItemArt({ textures: { exists: () => false } }, { id: 'sword' }), null);
  assert.equal(getItemArt({ textures: { exists: () => true, get: () => ({has: () => false}) } }, { id: 'sword' }), null);
  assert.ok(getClassItemAssets({classId:'arthur'}).every(atlas => ['general','arthur'].includes(atlas.pool)));
});
