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

test('intervalos sem frames avançam em 3x e não são contados novamente no próximo tick', () => {
  const { timer, elapse } = clock();
  for (let cycle = 0; cycle < 5; cycle++) {
    elapse(60000);
    assert.equal(timer.tick(3), 180000);
    assert.equal(timer.tick(3), 0);
    elapse(100);
    assert.equal(timer.tick(3), 300);
  }
});

test('somente fechar todas as pausas explícitas retoma o relógio, sem acumular tempo do modal', () => {
  const { timer, elapse } = clock();
  timer.pause('scene'); timer.pause('sleep');
  elapse(5000);
  timer.resume('sleep');
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
    elapse(200);
    events.push(...actual.advance(timer.tick(speed)));
  }
  assert.deepEqual(events, expected.advance(6300));
  assert.deepEqual(actual.fighters, expected.fighters);
});
