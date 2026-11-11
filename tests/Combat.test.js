import test from 'node:test';
import assert from 'node:assert/strict';
import Combat from '../src/systems/Combat.js';
import { battlePreview } from '../src/data/battlePreview.js';
import ShoppingSession from '../src/systems/ShoppingSession.js';

function board(ids = ['sword'], bags = ['traveler-bag']) {
  return { bags: bags.map(id => ({ id, x: 0, y: 0 })), items: ids.map(id => ({ id, x: 0, y: 0 })) };
}
function sequence(values) {
  let index = 0;
  return () => {
    assert.ok(index < values.length, 'Sorteio extra inesperado');
    return values[index++];
  };
}

test('bônus são somados somente das peças equipadas; o adversário segue as mesmas regras', () => {
  const player = board(['sword', 'shield'], ['traveler-bag', 'long-bag', 'pouch']);
  player.bags.push({ id: 'stored', catalogId: 'pouch', x: null, y: null });
  player.items.push({ id: 'stored-shield', catalogId: 'shield', x: null, y: null });
  const before = JSON.stringify(player);
  const combat = new Combat(player, battlePreview.enemyBoard);
  assert.equal(combat.fighters.player.health, 30);
  assert.equal(combat.fighters.player.maxHealth, 30);
  assert.equal(combat.fighters.enemy.health, 30);
  assert.equal(combat.fighters.enemy.maxHealth, 30);
  assert.equal(combat.fighters.player.stamina, 5.4);
  assert.equal(combat.fighters.player.armor, 6.2);
  assert.equal(combat.fighters.enemy.armor, 5);
  assert.equal(combat.fighters.enemy.weapons.length, 1);
  combat.advance(3000);
  assert.equal(JSON.stringify(player), before);
});

test('ambos atacam no mesmo instante após a recarga de dois segundos', () => {
  const combat = new Combat(board(), board(), { random: () => 0.5 });
  assert.deepEqual(combat.advance(1900), []);
  assert.equal(combat.fighters.player.health, 30);
  const events = combat.advance(100).filter(event => event.type === 'attack');
  assert.deepEqual(events.map(event => event.side), ['player', 'enemy']);
  assert.equal(combat.fighters.player.health, 28.2);
  assert.equal(combat.fighters.enemy.health, 28.2);
  assert.equal(combat.fighters.player.stamina, 3.2);
});

test('estamina regenera 0,10 por passo (1 por segundo), tem limite e espera energia suficiente', () => {
  const combat = new Combat(board(), board([]), { random: () => 0.5 });
  combat.fighters.player.stamina = 0;
  combat.fighters.player.weapons[0].readyAt = 0;
  assert.deepEqual(combat.advance(1100), []);
  assert.equal(combat.fighters.player.stamina, 1.1);
  const events = combat.advance(100);
  assert.equal(events.filter(event => event.type === 'attack').length, 1);
  assert.equal(combat.fighters.player.stamina, 0);
  assert.equal(combat.fighters.enemy.stamina, 4.4);
  combat.advance(1000);
  assert.equal(combat.fighters.player.stamina, 1);
});

test('errar usa energia e recarga, mas não causa dano nem gera ataque extra', () => {
  const combat = new Combat(board(), board([]), { random: () => 0.99 });
  const [event] = combat.advance(2000);
  assert.equal(event.hit, false);
  assert.equal(combat.fighters.enemy.health, 30);
  assert.equal(combat.fighters.player.stamina, 3.2);
  assert.deepEqual(combat.advance(1900), []);
});

test('precisão e crítico respeitam os limites das probabilidades', () => {
  const miss = new Combat(board(), board([]), { random: sequence([0.88]) });
  assert.equal(miss.advance(2000)[0].hit, false);
  const hit = new Combat(board(), board([]), { random: sequence([0.879, 0.03, 0.1]) });
  const events = hit.advance(2000);
  assert.equal(events.length, 1);
  assert.equal(events[0].damage, 1.8);
});

test('crítico causa 50% a mais de dano, inclusive valores fracionados', () => {
  const combat = new Combat(board(), board([]), { random: sequence([0.1, 0.01, 0.9]) });
  const [event] = combat.advance(2000);
  assert.equal(event.critical, true);
  assert.equal(event.damage, 2.7);
  assert.equal(combat.fighters.enemy.health, 27.3);
});

test('ataque extra é imediato, gratuito e não gera outro extra', () => {
  const combat = new Combat(board(), board([]), { random: sequence([0.1, 0.9, 0.01, 0.1, 0.9]) });
  const events = combat.advance(2000);
  assert.equal(events.length, 2);
  assert.equal(events[0].extra, false);
  assert.equal(events[1].extra, true);
  assert.equal(combat.fighters.enemy.health, 26.4);
  assert.equal(combat.fighters.player.stamina, 3.2);
});

test('armadura é consumida antes da vida e apenas o excesso atravessa', () => {
  const combat = new Combat(board(), board([], ['pouch']), { random: () => 0.5 });
  const [event] = combat.advance(2000);
  assert.equal(event.armorDamage, 1.2);
  assert.equal(event.healthDamage, 0.6);
  assert.equal(combat.fighters.enemy.armor, 0);
  assert.equal(combat.fighters.enemy.health, 29.4);
  combat.advance(2000);
  assert.equal(combat.fighters.enemy.health, 27.6);
});

test('escudo bloqueia 1,8 de dano e pode bloquear mais 1,8 no mesmo golpe', () => {
  const single = new Combat(board(), board(['shield']), { random: sequence([0.1, 0.01, 0.9, 0.1, 0.9]) });
  const [first] = single.advance(2000);
  assert.equal(first.blocked, 1.8);
  assert.equal(first.armorDamage, 0.9);
  assert.equal(single.fighters.enemy.armor, 4.1);
  const double = new Combat(board(), board(['shield']), { random: sequence([0.1, 0.01, 0.9, 0.1, 0.05]) });
  const [second] = double.advance(2000);
  assert.equal(second.blocked, 2.7);
  assert.equal(second.armorDamage, 0);
  assert.equal(double.fighters.enemy.armor, 5);
});

test('poção cura 12 ao cruzar 45% de vida e é consumida uma única vez', () => {
  const combat = new Combat(board(), board(['potion']), { random: () => 0.5 });
  combat.fighters.enemy.health = 14.4;
  const events = combat.advance(2000);
  assert.equal(events.filter(event => event.type === 'heal').length, 1);
  assert.equal(combat.fighters.enemy.health, 24.6);
  assert.equal(combat.fighters.enemy.potions[0].consumed, true);
  combat.fighters.enemy.health = 14.4;
  assert.equal(combat.advance(2000).filter(event => event.type === 'heal').length, 0);
  assert.equal(combat.fighters.enemy.health, 12.6);
});

test('poção não revive personagem morto; vitória encerra a simulação', () => {
  const combat = new Combat(board(), board(['potion']), { random: () => 0.5 });
  combat.advance(1900);
  combat.fighters.enemy.health = 1.2;
  combat.advance(100);
  assert.equal(combat.fighters.enemy.health, 0);
  assert.equal(combat.fighters.enemy.potions[0].consumed, false);
  assert.equal(combat.result, 'victory');
  const before = JSON.stringify(combat.fighters);
  assert.deepEqual(combat.advance(100000), []);
  assert.equal(JSON.stringify(combat.fighters), before);
});

test('receber um golpe letal resulta em derrota, inclusive sem arma equipada', () => {
  const combat = new Combat(board([]), board(), { random: () => 0.5 });
  combat.fighters.player.health = 1.8;
  combat.advance(2000);
  assert.equal(combat.result, 'defeat');
  assert.equal(combat.fighters.player.health, 0);
  assert.equal(combat.fighters.enemy.health, 30);
});

test('golpes letais simultâneos resultam em empate, sem prioridade para um lado', () => {
  const combat = new Combat(board(), board(), { random: () => 0.5 });
  combat.fighters.player.health = 1.8;
  combat.fighters.enemy.health = 1.8;
  const events = combat.advance(2000);
  assert.equal(events.filter(event => event.type === 'attack').length, 2);
  assert.equal(combat.fighters.player.health, 0);
  assert.equal(combat.fighters.enemy.health, 0);
  assert.equal(combat.result, 'draw');
});

test('resultado independe da divisão do tempo entre frames e rejeita tempo inválido', () => {
  const first = new Combat(board(), board(), { random: () => 0.5 });
  const second = new Combat(board(), board(), { random: () => 0.5 });
  first.advance(20000);
  for (let i = 0; i < 200; i++) second.advance(100);
  assert.deepEqual(first.fighters, second.fighters);
  assert.equal(first.elapsedMs, second.elapsedMs);
  assert.throws(() => first.advance(-1), RangeError);
  assert.throws(() => first.advance(NaN), RangeError);
});

function ironBoard() {
  return { bags: [{ id: 'traveler-bag', x: 0, y: 0, width: 4, height: 4 }], items: [
    { id: 'sword', x: 0, y: 0, width: 1, height: 3 },
    { id: 'refined-iron', x: 1, y: 1, width: 1, height: 1 },
  ] };
}

test('ferro concede 2,4 de armadura por ativação lateral e pode recuperar armadura zerada', () => {
  const combat = new Combat(ironBoard(), board([]), { random: () => 0.2 });
  assert.equal(combat.fighters.player.armor, 0);
  let events = combat.advance(2000);
  assert.equal(events.filter(event => event.type === 'armor').length, 1);
  assert.equal(combat.fighters.player.armor, 2.4);
  combat.fighters.player.armor = 0;
  events = combat.advance(2000);
  assert.equal(events.filter(event => event.type === 'armor').length, 1);
  assert.equal(combat.fighters.player.armor, 2.4);
});

test('as estrelas giradas concedem armadura por uma arma acima, sem afetar os lados antigos', () => {
  for (const rotation of [0, 90, 180, 270]) {
    const player = ironBoard();
    player.items[0].x = 1;
    Object.assign(player.items[1], { x: 1, y: 3, rotation });
    const combat = new Combat(player, board([]), { random: () => 0.2 });
    combat.advance(2000);
    assert.equal(combat.fighters.player.armor, rotation % 180 === 90 ? 2.4 : 0);
  }
});

test('o ferro usa 30% por ativação mesmo em erro, mas não reage a vizinhos fora das estrelas ou na reserva', () => {
  const miss = new Combat(ironBoard(), board([]), { random: sequence([0.99, 0.2]) });
  const events = miss.advance(2000);
  assert.equal(events.find(event => event.type === 'attack').hit, false);
  assert.equal(miss.fighters.player.armor, 2.4);
  const boundary = new Combat(ironBoard(), board([]), { random: sequence([0.2, 0.5, 0.5, 0.3]) });
  boundary.advance(2000);
  assert.equal(boundary.fighters.player.armor, 0);
  for (const position of [{ x: null, y: null }, { x: 1, y: 3 }]) {
    const player = ironBoard();
    Object.assign(player.items[1], position);
    const combat = new Combat(player, board([]), { random: () => 0.2 });
    assert.equal(combat.advance(2000).filter(event => event.type === 'armor').length, 0);
  }
});

test('ataque extra faz outro sorteio do ferro sem criar cadeias de ativações', () => {
  const combat = new Combat(ironBoard(), board([]), {
    random: sequence([0.2, 0.5, 0.05, 0.2, 0.5, 0.2, 0.2]),
  });
  const events = combat.advance(2000);
  assert.equal(events.filter(event => event.type === 'attack').length, 2);
  assert.equal(events.filter(event => event.type === 'armor').length, 2);
  assert.equal(combat.fighters.player.armor, 4.8);
});

test('duas cópias do ferro e da arma preservam suas próprias estrelas e recargas', () => {
  const player = ironBoard();
  player.items.push({ id: 'sword#2', catalogId: 'sword', x: 3, y: 0, width: 1, height: 3 });
  player.items.push({ id: 'refined-iron#2', catalogId: 'refined-iron', x: 2, y: 1, width: 1, height: 1 });
  const combat = new Combat(player, board([]), { random: () => 0.2 });
  const events = combat.advance(2000);
  assert.deepEqual(events.filter(event => event.type === 'armor').map(event => event.sourceItemId), ['sword', 'sword#2']);
  assert.equal(combat.fighters.player.armor, 4.8);
  assert.equal(combat.fighters.player.weapons.length, 2);
});

test('ativar uma poção ou bloquear com escudo em uma estrela também pode ativar o ferro', () => {
  const potionBoard = ironBoard();
  Object.assign(potionBoard.items[0], { id: 'potion', x: 0, y: 1, width: 1, height: 1 });
  const healing = new Combat(potionBoard, board([]), { random: () => 0.2 });
  healing.fighters.player.health = 12;
  const events = healing.advance(100);
  assert.equal(events.filter(event => event.type === 'heal').length, 1);
  assert.equal(healing.fighters.player.armor, 2.4);
  const shieldBoard = ironBoard();
  Object.assign(shieldBoard.items[0], { id: 'shield', x: 0, y: 1, width: 1, height: 1 });
  const blocking = new Combat(shieldBoard, board(), {
    random: sequence([0.2, 0.5, 0.5, 0.2, 0.5, 0.2]),
  });
  blocking.advance(2000);
  assert.equal(blocking.fighters.player.armor, 7.4);
});

test('espada de ferro usa dano, precisão, energia e recarga próprios', () => {
  const combat = new Combat(board(['iron-sword']), board([]), { random: () => 0.5 });
  assert.deepEqual(combat.advance(2400), []);
  const [event] = combat.advance(100);
  assert.equal(event.damage, 3);
  assert.equal(combat.fighters.enemy.health, 27);
  assert.equal(combat.fighters.player.stamina, 2.6);
  assert.equal(combat.fighters.player.weapons[0].readyAt, 5);
  const miss = new Combat(board(['iron-sword']), board([]), { random: sequence([0.9]) });
  assert.equal(miss.advance(2500)[0].hit, false);
  const hit = new Combat(board(['iron-sword']), board([]), { random: sequence([0.899, 0.03, 0.1]) });
  assert.equal(hit.advance(2500)[0].damage, 3);
});

test('espada de ferro permite no máximo três golpes e cobra energia só pelo primeiro', () => {
  const combat = new Combat(board(['iron-sword']), board([]), {
    random: sequence([0.2, 0.9, 0.05, 0.2, 0.9, 0.1, 0.2, 0.99]),
  });
  const events = combat.advance(2500);
  assert.deepEqual(events.map(event => event.attackNumber), [1, 2, 3]);
  assert.deepEqual(events.map(event => event.extra), [false, true, true]);
  assert.equal(combat.fighters.enemy.health, 21);
  assert.equal(combat.fighters.player.stamina, 2.6);
  assert.equal(combat.fighters.player.weapons[0].readyAt, 5);
});

test('só o terceiro golpe tem exatamente 60% de chance crítica, mantendo dano adicional de 50%', () => {
  for (const roll of [0.599, 0.6, 0.62]) {
    const combat = new Combat(board(['iron-sword']), board([]), {
      random: sequence([0.2, 0.04, 0.05, 0.2, 0.04, 0.1, 0.2, roll]),
    });
    const events = combat.advance(2500);
    assert.equal(events.length, 3);
    assert.equal(events[0].critical, false);
    assert.equal(events[1].critical, false);
    assert.equal(events[2].critical, roll < 0.6);
    assert.equal(events[2].damage, roll < 0.6 ? 4.5 : 3);
    assert.equal(combat.fighters.player.stamina, 2.6);
  }
});

test('terceiro golpe ainda exige precisão e não causa dano ao errar', () => {
  const combat = new Combat(board(['iron-sword']), board([]), {
    random: sequence([0.2, 0.9, 0.05, 0.2, 0.9, 0.1, 0.9]),
  });
  const events = combat.advance(2500);
  assert.equal(events.length, 3);
  assert.equal(events[2].attackNumber, 3);
  assert.equal(events[2].hit, false);
  assert.equal(events[2].critical, false);
  assert.equal(events[2].damage, 0);
  assert.equal(combat.fighters.enemy.health, 24);
});

test('sequência da espada de ferro para no erro ou ao falhar o sorteio de 20%', () => {
  const miss = new Combat(board(['iron-sword']), board([]), {
    random: sequence([0.2, 0.9, 0.05, 0.95]),
  });
  const events = miss.advance(2500);
  assert.equal(events.length, 2);
  assert.equal(events[1].hit, false);
  assert.equal(miss.fighters.enemy.health, 27);
  const boundary = new Combat(board(['iron-sword']), board([]), {
    random: sequence([0.2, 0.9, 0.05, 0.2, 0.9, 0.2]),
  });
  assert.equal(boundary.advance(2500).length, 2);
});

test('cada golpe da espada de ferro pode ativar um ferro vizinho', () => {
  const player = ironBoard();
  player.items[0].catalogId = 'iron-sword';
  const combat = new Combat(player, board([]), {
    random: sequence([0.2, 0.9, 0.05, 0.2, 0.9, 0.1, 0.2, 0.99, 0.2, 0.2, 0.2]),
  });
  const events = combat.advance(2500);
  assert.equal(events.filter(event => event.type === 'attack').length, 3);
  assert.equal(events.filter(event => event.type === 'armor').length, 3);
  assert.equal(combat.fighters.player.armor, 7.2);
});

test('espada obtida por fusão já entra na próxima batalha com os novos atributos', () => {
  const session = new ShoppingSession();
  for (const id of ['traveler-bag', 'sword', 'refined-iron']) session.buy(id);
  session.board.move('bag', 'traveler-bag', 0, 0);
  session.board.move('item', 'sword', 0, 0);
  session.board.move('item', 'refined-iron', 1, 1);
  session.beginBattle();
  assert.equal(session.finishBattle('victory').fusions, 1);
  const combat = new Combat(session.board, board([]), { random: () => 0.5 });
  const weapon = combat.fighters.player.weapons[0];
  assert.equal(weapon.id, 'sword');
  assert.equal(weapon.damage, 3);
  assert.equal(weapon.cooldown, 2.5);
  assert.equal(weapon.staminaCost, 1.8);
  assert.equal(combat.advance(2500)[0].damage, 3);
});
