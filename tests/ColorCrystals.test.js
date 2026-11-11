import test from 'node:test';
import assert from 'node:assert/strict';
import Combat from '../src/systems/Combat.js';
import ShoppingSession from '../src/systems/ShoppingSession.js';
import { allItems, shopCatalog } from '../src/data/shopCatalog.js';
import { getItemDetails } from '../src/utils/itemDetails.js';
import { getReadyFusions, getFusionProgress } from '../src/utils/itemFusions.js';

const item = (id, x = 0, y = 0, extra = {}) => ({ ...allItems.find(piece => piece.id === id),
  id, catalogId: id, x, y, ...extra });
const board = (items = []) => ({ bags: [], items });
const fight = (items = [], enemy = []) => new Combat(board(items), board(enemy), { random: () => 0.5 });
const burn = (remaining = 2, nextAt = 100) => ({ source: 'enemy', itemId: 'fire', damage: 2,
  remaining, nextAt, ignoresArmor: true });
const hit = (combat, damage, extra = {}, events = []) => combat.applyAttack({
  side: 'enemy', target: 'player', hit: true, damage, ...extra,
}, events);
const colors = () => [item('blue-crystal', 1, 1), item('red-crystal', 0, 1),
  item('white-crystal', 2, 1), item('black-crystal', 1, 0)];

test('cores estão na loja, dourado só na fusão, e fichas apresentam todos os poderes', () => {
  for (const id of ['blue-crystal', 'red-crystal', 'white-crystal', 'black-crystal']) {
    assert.ok(shopCatalog.some(piece => piece.id === id));
    assert.equal(getItemDetails(id).recipes[0].result, 'golden-crystal');
  }
  assert.ok(!shopCatalog.some(piece => piece.id === 'golden-crystal'));
  const details = getItemDetails('golden-crystal');
  for (const text of ['6 s', '0,5', 'críticos', 'fadiga', 'Última Luz', '20%', '25%']) {
    assert.ok(details.effects.some(effect => effect.includes(text)), text);
  }
});

test('azul ganha resistência em 6 e 12 segundos, mesmo atordoado, sem teto artificial', () => {
  const combat = fight([item('blue-crystal')]);
  const fighter = combat.fighters.player;
  fighter.stunnedUntil = 20;
  assert.equal(combat.advance(5900).filter(event => event.type === 'resistance').length, 0);
  assert.equal(fighter.resistance, 0);
  assert.equal(combat.advance(100).find(event => event.type === 'resistance').amount, 1);
  assert.equal(fighter.resistance, 1);
  combat.advance(6000);
  assert.equal(fighter.resistance, 2);
  const events = [];
  assert.equal(combat.resistDebuff({ target: 'player', side: 'enemy' }, 'burn', events), true);
  assert.equal(fighter.resistance, 1);
  combat.advance(6000);
  assert.equal(fighter.resistance, 2);
});

test('vermelho recalcula dano por acúmulo ativo, incluindo crítico, sem alterar o dano base', () => {
  const combat = fight([item('red-crystal', 1, 0), item('quick-daggers', 2, 0)]);
  const target = combat.fighters.enemy;
  const attack = { side: 'player', target: 'enemy', itemId: 'quick-daggers', hit: true, damage: 1 };
  assert.equal(combat.applyAttack(attack).damage, 1);
  target.burns = [burn(), burn(), burn(0)];
  assert.equal(combat.applyAttack(attack).damage, 2);
  assert.equal(combat.applyAttack({ ...attack, damage: 1.5, critical: true }).damage, 3);
  target.burns = [];
  assert.equal(combat.applyAttack(attack).damage, 1);
  assert.equal(combat.fighters.player.weapons[0].damage, 1);
});

test('vermelho respeita estrelas, rotação, reserva e o lado do dono', () => {
  for (const rotation of [0, 90, 180, 270]) {
    const vertical = rotation % 180 === 90;
    const source = item('red-crystal', 2, 2, { rotation });
    const on = item('quick-daggers', vertical ? 2 : 3, vertical ? 3 : 2);
    const off = item('sword', vertical ? 3 : 2, vertical ? 2 : 3);
    for (const side of ['player', 'enemy']) {
      const combat = side === 'player' ? fight([source, on, off]) : fight([], [source, on, off]);
      assert.equal(combat.fighters[side].weapons.find(piece => piece.id === on.id).damagePerBurn, 0.5);
      assert.equal(combat.fighters[side].weapons.find(piece => piece.id === off.id).damagePerBurn, 0);
    }
  }
  const stored = fight([item('red-crystal', null, null), item('quick-daggers', 1, 0)]);
  assert.equal(stored.fighters.player.weapons[0].damagePerBurn, 0);
});

test('branco reduz só críticos e combina multiplicativamente com elmos e cópias', () => {
  const combat = fight([item('white-crystal'), item('white-crystal', 1, 0, { id: 'white-2' }), item('leather-helmet')]);
  combat.fighters.player.armor = 0;
  assert.equal(hit(combat, 10).damage, 10);
  assert.equal(hit(combat, 10, { critical: true }).damage, 6.48);
});

test('preto reduz apenas fadiga, inclusive em cópias e nos dois lados', () => {
  const combat = fight([item('black-crystal'), item('black-crystal', 1, 0, { id: 'black-2' })], [item('black-crystal')]);
  assert.equal(hit(combat, 1).healthDamage, 1);
  combat.elapsedMs = 60900;
  const events = combat.advance(100).filter(event => event.type === 'fatigue');
  assert.equal(events.find(event => event.side === 'player').damage, 0.486);
  assert.equal(events.find(event => event.side === 'enemy').damage, 0.54);
});

test('Última Luz ativa no limiar, limpa estados e retira apenas a demora restante do atordoamento', () => {
  const combat = fight([item('golden-crystal'), item('sword', 1, 0)]);
  const fighter = combat.fighters.player;
  fighter.health = 8;
  fighter.burns = [burn(), burn()];
  fighter.stunnedUntil = 2;
  fighter.weapons[0].readyAt = 4;
  const events = [];
  hit(combat, 0.5, {}, events);
  assert.equal(fighter.health, 13.5);
  assert.equal(fighter.burns.length, 0);
  assert.equal(fighter.stunnedUntil, 0);
  assert.equal(fighter.weapons[0].readyAt, 2);
  assert.equal(events.find(event => event.lastLight).healing, 6);
  fighter.health = 8;
  hit(combat, 1, {}, events);
  assert.equal(fighter.health, 7);
  assert.equal(events.filter(event => event.lastLight).length, 1);
});

test('Última Luz cura proporcionalmente, não ativa acima de 25%, não revive e restaura na próxima batalha', () => {
  const pieces = [item('golden-crystal'), item('vital-crystal')];
  const combat = fight(pieces);
  const fighter = combat.fighters.player;
  fighter.health = 10;
  hit(combat, 1);
  assert.equal(fighter.health, 9);
  const events = [];
  hit(combat, 0.5, {}, events);
  assert.equal(events.find(event => event.lastLight).healing, 6.8);
  const lethal = fight(pieces);
  lethal.fighters.player.health = 1;
  const lethalEvents = [];
  hit(lethal, 2, {}, lethalEvents);
  assert.equal(lethal.fighters.player.health, 0);
  assert.equal(lethalEvents.length, 0);
  assert.equal(fight(pieces).fighters.player.lastLights[0].consumed, false);
});

test('Última Luz interrompe pulsos de queimadura removidos e funciona contra fadiga', () => {
  const combat = fight([item('golden-crystal')]);
  const fighter = combat.fighters.player;
  fighter.health = 9;
  fighter.burns = [burn(2, 1), burn(2, 1)];
  const events = combat.advance(1000);
  assert.equal(events.filter(event => event.type === 'burn').length, 1);
  assert.equal(fighter.health, 13);
  assert.equal(fighter.burns.length, 0);
  const fatigue = fight([item('golden-crystal')]);
  fatigue.fighters.player.health = 8;
  fatigue.elapsedMs = 60900;
  assert.ok(fatigue.advance(100).some(event => event.lastLight));
  assert.equal(fatigue.fighters.player.health, 13.46);
});

test('dourado herda todos os poderes e peças na reserva não têm efeitos', () => {
  const combat = fight([item('golden-crystal'), item('quick-daggers', 1, 0)]);
  const fighter = combat.fighters.player;
  assert.equal(fighter.weapons[0].damagePerBurn, 0.5);
  assert.equal(fighter.criticalDamageMultiplier, 0.9);
  assert.equal(fighter.fatigueDamageMultiplier, 0.9);
  combat.advance(6000);
  assert.equal(fighter.resistance, 1);
  const stored = fight([item('golden-crystal', null, null)]).fighters.player;
  assert.equal(stored.lastLights.length, 0);
  assert.equal(stored.resistanceGenerators.length, 0);
  assert.equal(stored.criticalDamageMultiplier, 1);
  assert.equal(stored.fatigueDamageMultiplier, 1);
});

test('Última Luz limpa a queimadura do golpe que cruza o limiar antes das poções e cura vampírica', () => {
  const combat = fight([item('golden-crystal'), item('vampiric-chestplate'), item('potion')],
    [item('flaming-daggers')]);
  combat.random = () => 0;
  const fighter = combat.fighters.player;
  fighter.armor = 0;
  fighter.health = 10;
  const events = combat.advance(1300);
  // A poção seria consumida antes de o ataque ocorrer; confira a ordem no próprio golpe.
  const direct = fight([item('golden-crystal'), item('vampiric-chestplate')]);
  direct.fighters.player.armor = 0;
  direct.fighters.player.health = 9;
  const healingEvents = [];
  hit(direct, 1, {}, healingEvents);
  assert.equal(healingEvents[0].lastLight, true);
  assert.equal(healingEvents[1].damageHealing, true);
  // Sem poção, o ataque aplica a queimadura e a Última Luz a remove no mesmo passo.
  const duel = fight([item('golden-crystal')], [item('flaming-daggers')]);
  duel.random = () => 0;
  duel.fighters.player.health = 9;
  const hitEvents = duel.advance(1300);
  assert.ok(hitEvents.some(event => event.type === 'burn-applied'));
  assert.ok(hitEvents.some(event => event.lastLight));
  assert.equal(duel.fighters.player.burns.length, 0);
  assert.ok(events.some(event => event.type === 'heal' && event.itemId === 'potion'));
});

test('cristais preservam o combate ao variar o tamanho dos frames, nos dois lados', () => {
  const pieces = [item('golden-crystal'), item('flaming-daggers', 1, 0),
    item('blue-crystal', 3, 0), item('white-crystal', 4, 0), item('black-crystal', 5, 0)];
  const once = fight(pieces, pieces);
  const frames = fight(pieces, pieces);
  const expected = once.advance(180000);
  const events = [];
  for (let i = 0; i < 180 && !frames.result; i++) events.push(...frames.advance(1000));
  assert.deepEqual(events, expected);
  assert.deepEqual(frames.fighters, once.fighters);
});

test('fusão exige quatro cores distintas em contato, sem diagonais ou reserva, e informa progresso', () => {
  assert.equal(getReadyFusions(colors())[0].resultId, 'golden-crystal');
  for (const index of [1, 2, 3]) {
    for (const [x, y] of [[null, null], [3, 3], [0, 3]]) {
      const pieces = colors();
      Object.assign(pieces[index], { x, y });
      assert.equal(getReadyFusions(pieces).length, 0);
      assert.ok(getFusionProgress(pieces).some(progress => progress.resultId === 'golden-crystal'
        && progress.ingredients.some(ingredient => ingredient.count < ingredient.required)));
    }
  }
});

test('fusão após vitória, derrota ou empate consome as quatro cores uma vez e preserva a posição do azul', () => {
  for (const result of ['victory', 'defeat', 'draw']) {
    const session = new ShoppingSession();
    session.board.bags.push(item('traveler-bag'));
    session.board.items.push(...colors());
    assert.equal(session.beginBattle(), true);
    session.finishBattle(result);
    assert.equal(session.board.items.length, 1);
    const golden = session.board.items[0];
    assert.equal(golden.catalogId, 'golden-crystal');
    assert.deepEqual([golden.x, golden.y, golden.price], [1, 1, 16]);
    assert.equal(session.finishBattle(result), null);
  }
});
