import test from 'node:test';
import assert from 'node:assert/strict';
import ShoppingSession from '../src/systems/ShoppingSession.js';
import { allItems } from '../src/data/shopCatalog.js';
import { cloneData } from '../src/utils/cloneData.js';

const item = (id, x, y) => cloneData({ ...allItems.find(item => item.id === id), catalogId: id, x, y });
function finalSession() {
  const session = new ShoppingSession();
  session.wins = 7;
  session.round = 8;
  session.board.bags.push(item('traveler-bag', 0, 0));
  session.board.items.push(item('sword', 0, 0), item('refined-iron', 1, 1), item('bow', null, null));
  return session;
}

test('vitória final preserva a formação anterior às fusões e a identidade de todas as peças', () => {
  const session = finalSession();
  const before = cloneData({ columns: session.board.columns, rows: session.board.rows,
    bags: session.board.bags, items: session.board.items });
  session.beginBattle();
  const report = session.finishBattle('victory');
  assert.equal(session.runResult, 'victory');
  assert.equal(report.fusions, 1);
  assert.deepEqual(session.winningBoard, before);
  assert.equal(session.winningBoard.items.find(item => item.id === 'sword').catalogId, 'sword');
  assert.ok(session.winningBoard.items.some(item => item.id === 'refined-iron'));
  assert.equal(session.board.items.find(item => item.id === 'sword').catalogId, 'iron-sword');
  assert.ok(!session.board.items.some(item => item.id === 'refined-iron'));
  const saved = session.winningBoard;
  assert.equal(session.finishBattle('victory'), null);
  assert.equal(session.winningBoard, saved);
});

test('snapshot é uma cópia profunda, incluindo células irregulares e posições', () => {
  const session = finalSession();
  session.beginBattle();session.finishBattle('victory');
  session.board.bags[0].x = 4;
  session.board.items.find(item => item.id === 'bow').cells[0].x = 99;
  assert.equal(session.winningBoard.bags[0].x, 0);
  assert.equal(session.winningBoard.items.find(item => item.id === 'bow').cells[0].x, 0);
  const viewerCopy = cloneData(session.winningBoard);
  viewerCopy.items[0].rotation = 90;
  assert.notEqual(session.winningBoard.items[0].rotation, 90);
});

test('derrota, cancelamento, vitórias intermediárias e treinos NPC não criam uma mochila vencedora', () => {
  const cancelled = finalSession();
  cancelled.beginBattle();cancelled.cancelBattle();
  assert.equal(cancelled.finishBattle('victory'), null);
  assert.equal(cancelled.winningBoard, null);
  const defeat = finalSession();
  defeat.beginBattle();defeat.finishBattle('defeat');
  assert.equal(defeat.winningBoard, null);
  const intermediate = new ShoppingSession();
  intermediate.beginBattle();intermediate.finishBattle('victory');
  assert.equal(intermediate.winningBoard, null);
  const npc = new ShoppingSession({ campaign: false });
  npc.wins = 7;npc.beginBattle();npc.finishBattle('victory');
  assert.equal(npc.winningBoard, null);
  assert.equal(new ShoppingSession().winningBoard, null);
});
