import test from 'node:test';
import assert from 'node:assert/strict';
import BattleClock from '../src/systems/BattleClock.js';
import Combat from '../src/systems/Combat.js';

function clock() {
  let time = 0;
  const timer = new BattleClock({ now: () => time });
  return { timer, elapse: ms => { time += ms; } };
}

test('3x acompanha o tempo real mesmo quando o navegador entrega poucos frames', () => {
  const { timer, elapse } = clock();
  for (const ms of [16, 50, 100, 250, 1000]) {
    elapse(ms);
    assert.equal(timer.tick(3), ms * 3);
  }
});

test('trocar de aba pausa o tempo ausente e retoma 3x já no primeiro frame', () => {
  const { timer, elapse } = clock();
  for (let cycle = 0; cycle < 5; cycle++) {
    timer.pause('focus'); timer.pause('visibility'); timer.pause('game');
    elapse(60000);
    assert.equal(timer.tick(3), 0);
    timer.resume('game'); timer.resume('visibility');
    elapse(100);
    assert.equal(timer.tick(3), 0);
    timer.resume('focus');
    elapse(50);
    assert.equal(timer.tick(3), 150);
  }
});

test('voltar para a aba não despausa a batalha enquanto a ficha do item está aberta', () => {
  const { timer, elapse } = clock();
  timer.pause('scene'); timer.pause('visibility');
  elapse(5000);
  timer.resume('visibility');
  elapse(1000);
  assert.equal(timer.tick(3), 0);
  timer.resume('scene');
  elapse(100);
  assert.equal(timer.tick(3), 300);
  timer.resume('scene'); // Duplicate notifications must not discard foreground time.
  elapse(100);
  assert.equal(timer.tick(3), 300);
});

test('trocar a velocidade é imediato e mantém o mesmo estado e eventos do combate', () => {
  const { timer, elapse } = clock();
  const board = { bags: [], items: [{ id: 'sword', x: 0, y: 0 }] };
  const actual = new Combat(board, board, { random: () => 0.5 });
  const expected = new Combat(board, board, { random: () => 0.5 });
  const events = [];
  for (const speed of [1, 3, 2, 3]) {
    elapse(500);
    events.push(...actual.advance(timer.tick(speed)));
    timer.pause('visibility'); elapse(20000); timer.resume('visibility');
  }
  assert.deepEqual(events, expected.advance(4500));
  assert.deepEqual(actual.fighters, expected.fighters);
});
