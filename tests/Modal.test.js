import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { openModal } from '../src/utils/openModal.js';
import { openItemInfo } from '../src/utils/openItemInfo.js';

function sourceScene({ webgl = true } = {}) {
  const events = new EventEmitter();
  const calls = [];
  let paused = false;
  const effects = {
    gameObject: {},
    addBlur: () => { calls.push('blur'); return {}; },
    remove: () => calls.push('unblur'),
  };
  const source = {
    sys: { isActive: () => !paused, isPaused: () => paused },
    input: { enabled: true },
    game: { renderer: { gl: webgl ? {} : null } },
    cameras: { main: { postFX: effects } },
    scene: {
      key: 'BattleScene',
      isActive: () => false,
      launch: (key, data) => calls.push({ key, data }),
      bringToTop: key => calls.push(key),
      pause: () => { paused = true; },
      resume: () => { paused = false; },
      get: () => ({ events }),
    },
  };
  return { source, calls, events };
}

test('item modal blocks source controls, pauses battle, and restores it on close', () => {
  const { source, calls, events } = sourceScene();
  const item = { id: 'sword' };
  openItemInfo(source, item);
  assert.equal(source.input.enabled, false);
  assert.equal(source.sys.isPaused(), true);
  assert.equal(calls[0], 'blur');
  assert.deepEqual(calls[1], {
    key: 'ItemInfoScene', data: { item, sourceKey: 'BattleScene' },
  });
  assert.notEqual(calls[1].data.item, item);
  openItemInfo(source, item);
  assert.equal(calls.length, 3, 'cannot open another modal from the paused background');
  events.emit('shutdown');
  assert.equal(source.input.enabled, true);
  assert.equal(source.sys.isActive(), true);
  assert.equal(calls.at(-1), 'unblur');
});

test('exit dialog cancels safely with a Canvas renderer and preserves disabled input', () => {
  const { source, calls, events } = sourceScene({ webgl: false });
  source.input.enabled = false;
  openModal(source, 'ExitConfirmScene');
  assert.equal(source.sys.isPaused(), true);
  assert.equal(calls[0].key, 'ExitConfirmScene');
  events.emit('shutdown');
  assert.equal(source.sys.isActive(), true);
  assert.equal(source.input.enabled, false);
});

test('closing after the source was stopped does not resume it or use destroyed camera effects', () => {
  const { source, events, calls } = sourceScene();
  openModal(source, 'ExitConfirmScene');
  source.sys.isPaused = () => false;
  source.cameras.main.postFX.gameObject = null;
  let resumed = false;
  source.scene.resume = () => { resumed = true; };
  events.emit('shutdown');
  assert.equal(resumed, false);
  assert.equal(calls.includes('unblur'), false);
});

test('low-memory mode opens and closes dialogs without a WebGL blur pass', () => {
  const { source, calls, events } = sourceScene();
  source.game.config = { disablePostFX: true };
  openModal(source, 'ItemInfoScene');
  assert.equal(source.sys.isPaused(), true);
  assert.equal(calls.includes('blur'), false);
  events.emit('shutdown');
  assert.equal(source.sys.isActive(), true);
  assert.equal(source.input.enabled, true);
});
