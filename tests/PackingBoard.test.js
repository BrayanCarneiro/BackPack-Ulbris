import test from 'node:test';
import assert from 'node:assert/strict';
import PackingBoard from '../src/systems/PackingBoard.js';
import { packingPrototype } from '../src/data/packingPrototype.js';
import { rotateFootprint } from '../src/utils/rotation.js';

test('um item exige suporte em todas as células e não pode sair dos limites', () => {
  const board = new PackingBoard(packingPrototype);
  for (const [x, y] of [[3, 3], [7, 0], [-1, 0], [0, 8], [0.5, 0], [NaN, 0]]) {
    assert.ok(board.move('item', 'item-b', x, y));
    assert.equal(board.items[1].x, null);
  }
  assert.equal(board.move('item', 'item-b', 2, 3), null);
});

test('itens não se sobrepõem e uma tentativa inválida preserva a posição', () => {
  const board = new PackingBoard(packingPrototype);
  assert.equal(board.move('item', 'item-a', 0, 0), null);
  assert.equal(board.move('item', 'item-b', 1, 0), null);
  assert.ok(board.move('item', 'item-b', 0, 0));
  assert.equal(board.items[1].x, 1);
  assert.equal(board.move('item', 'item-a', 0, 1), null);
});

test('mochilas podem encostar e não podem sair da área', () => {
  const board = new PackingBoard(packingPrototype);
  assert.ok(board.move('bag', 'long-bag', 4, 7));
  assert.equal(board.bags[1].y, 5);
  assert.equal(board.move('bag', 'long-bag', 0, 4), null);
});

test('a mochila arrastada tem prioridade sobre mochilas vazias', () => {
  const board = new PackingBoard(packingPrototype);
  assert.equal(board.move('bag', 'small-bag', 4, 1), null);
  assert.equal(board.move('bag', 'long-bag', 0, 1), null);
  assert.equal(board.bags[0].x, null);
  assert.equal(board.bags[2].x, null);
  assert.deepEqual({ x: board.bags[1].x, y: board.bags[1].y }, { x: 0, y: 1 });
});

test('mochila com itens é protegida mesmo se a substituta ainda oferecer apoio', () => {
  const board = new PackingBoard(packingPrototype);
  board.move('item', 'item-a', 0, 0);
  board.move('item', 'item-c', 1, 0);
  const before = JSON.stringify(board);
  assert.ok(board.move('bag', 'long-bag', 0, 0));
  assert.equal(JSON.stringify(board), before);
  board.removeItem('item-a');
  assert.ok(board.move('bag', 'long-bag', 0, 0));
  board.removeItem('item-c');
  assert.equal(board.move('bag', 'long-bag', 0, 0), null);
  assert.equal(board.bags[0].x, null);
});

test('atingir uma mochila ocupada e outra vazia recusa toda a troca, sem efeitos parciais', () => {
  const board = new PackingBoard(packingPrototype);
  board.move('bag', 'small-bag', 4, 1);
  board.move('item', 'item-c', 4, 1);
  const before = JSON.stringify(board);
  assert.ok(board.getPlacementError('bag', 'long-bag', 0, 1));
  assert.ok(board.move('bag', 'long-bag', 0, 1));
  assert.equal(JSON.stringify(board), before);
});

test('um item atravessando mochilas adjacentes protege ambas por inteiro', () => {
  const board = new PackingBoard({ columns: 6, rows: 3,
    bags: [
      { id: 'left', x: 0, y: 0, width: 2, height: 2 },
      { id: 'right', x: 2, y: 0, width: 2, height: 2 },
      { id: 'incoming', x: null, y: null, width: 1, height: 1 },
    ],
    items: [{ id: 'bridge', x: 1, y: 0, width: 2, height: 1 }],
  });
  const before = JSON.stringify(board);
  // The drop hits a free cell of each occupied bag, away from the item itself.
  assert.ok(board.move('bag', 'incoming', 0, 1));
  assert.ok(board.move('bag', 'incoming', 3, 1));
  assert.equal(JSON.stringify(board), before);
});

test('mochila girada vinda da reserva também respeita a proteção das ocupadas', () => {
  const board = new PackingBoard(packingPrototype);
  board.store('bag', 'long-bag');
  board.move('item', 'item-c', 0, 0);
  const before = JSON.stringify(board);
  assert.ok(board.move('bag', 'long-bag', 0, 0, 1));
  assert.equal(JSON.stringify(board), before);
});

test('arraste fora dos limites não desloca mochilas nem itens', () => {
  const board = new PackingBoard(packingPrototype);
  board.move('item', 'item-c', 0, 0);
  const before = JSON.stringify(board);
  assert.ok(board.move('bag', 'long-bag', -1, 0));
  assert.equal(JSON.stringify(board), before);
});

test('um item pode atravessar mochilas adjacentes, mas não um intervalo vazio', () => {
  const board = new PackingBoard({
    columns: 4, rows: 2,
    bags: [
      { id: 'left', x: 0, y: 0, width: 1, height: 1 },
      { id: 'right', x: 1, y: 0, width: 1, height: 1 },
    ],
    items: [{ id: 'wide', x: null, y: null, width: 2, height: 1 }],
  });
  assert.equal(board.move('item', 'wide', 0, 0), null);
  assert.ok(board.move('bag', 'right', 2, 0));
  board.removeItem('wide');
  assert.equal(board.move('bag', 'right', 2, 0), null);
  assert.ok(board.move('item', 'wide', 0, 0));
});

test('mover mochila não deixa itens sem suporte; devolver item libera o movimento', () => {
  const board = new PackingBoard(packingPrototype);
  assert.equal(board.move('item', 'item-c', 6, 2), null);
  assert.ok(board.move('bag', 'small-bag', 7, 7));
  assert.deepEqual({ x: board.bags[2].x, y: board.bags[2].y }, { x: 6, y: 2 });
  board.removeItem('item-c');
  assert.equal(board.move('bag', 'small-bag', 7, 7), null);
  assert.equal(board.move('item', 'item-c', 7, 7), null);
});

test('cada partida recebe seu próprio estado, sem alterar os dados de conteúdo', () => {
  const first = new PackingBoard(packingPrototype);
  first.move('item', 'item-c', 0, 0);
  first.move('bag', 'small-bag', 7, 7);
  const second = new PackingBoard(packingPrototype);
  assert.equal(second.items[2].x, null);
  assert.equal(second.bags[2].x, 6);
  assert.ok(second.move('item', 'missing', 0, 0));
});

test('mochila guardada não oferece suporte e pode voltar à área sem duplicação', () => {
  const board = new PackingBoard(packingPrototype);
  assert.equal(board.store('bag', 'square-bag'), null);
  assert.equal(board.bags[0].x, null);
  assert.ok(board.move('item', 'item-c', 0, 0));
  assert.equal(board.move('bag', 'square-bag', 1, 0), null);
  assert.equal(board.move('item', 'item-c', 1, 0), null);
  assert.equal(board.bags.length, 3);
});

test('guardar mochila ocupada é recusado até retirar seus itens', () => {
  const board = new PackingBoard(packingPrototype);
  board.move('item', 'item-a', 0, 0);
  assert.ok(board.store('bag', 'square-bag'));
  assert.equal(board.bags[0].x, 0);
  assert.equal(board.store('item', 'item-a'), null);
  assert.equal(board.store('bag', 'square-bag'), null);
  assert.equal(board.items[0].x, null);
  assert.equal(board.bags[0].x, null);
  assert.ok(board.store('bag', 'missing'));
});

test('girar um item troca suas dimensões e valida o espaço resultante', () => {
  const board = new PackingBoard(packingPrototype);
  assert.equal(board.move('item', 'item-a', 0, 0, 1), null);
  assert.equal(board.items[0].width, 2);
  assert.equal(board.items[0].height, 1);
  assert.equal(board.items[0].rotation, 90);
  const before = JSON.stringify(board);
  assert.ok(board.move('item', 'item-a', 3, 3, 2));
  assert.equal(JSON.stringify(board), before);
});

test('prévia de giro não modifica o estado e um encaixe inválido preserva a orientação', () => {
  const board = new PackingBoard(packingPrototype);
  const before = JSON.stringify(board);
  assert.equal(board.getPlacementError('bag', 'long-bag', 7, 0, 1), null);
  assert.equal(JSON.stringify(board), before);
  assert.ok(board.move('bag', 'long-bag', 7, 4, 1));
  assert.equal(JSON.stringify(board), before);
});

test('mochila girada mantém prioridade sobre as atingidas', () => {
  const board = new PackingBoard(packingPrototype);
  assert.equal(board.move('bag', 'long-bag', 0, 0, 1), null);
  assert.equal(board.bags[0].x, null);
  assert.equal(board.bags[1].width, 1);
  assert.equal(board.bags[1].height, 5);
});

test('quatro giros na reserva restauram dimensões e orientação, sem alterar o conteúdo original', () => {
  const board = new PackingBoard(packingPrototype);
  for (let turn = 0; turn < 4; turn += 1) {
    assert.equal(board.store('item', 'item-a', 1), null);
  }
  assert.equal(board.items[0].width, 1);
  assert.equal(board.items[0].height, 2);
  assert.equal(board.items[0].rotation, 0);
  assert.equal(packingPrototype.items[0].rotation, undefined);
  const square = rotateFootprint(board.bags[0], 1);
  assert.equal(square.width, 4);
  assert.equal(square.height, 4);
  assert.equal(square.rotation, 90);
});

test('mochila ocupada não se move mesmo se os itens continuassem apoiados', () => {
  const board = new PackingBoard(packingPrototype);
  board.move('item', 'item-c', 2, 2);
  const before = JSON.stringify(board);
  assert.ok(board.move('bag', 'square-bag', 1, 0));
  assert.ok(board.move('bag', 'square-bag', 0, 0, 1));
  assert.ok(board.move('bag', 'square-bag', 0, 2));
  assert.ok(board.store('bag', 'square-bag'));
  assert.equal(JSON.stringify(board), before);
});

test('mochila só destrava após retirar o último item', () => {
  const board = new PackingBoard(packingPrototype);
  board.move('item', 'item-a', 0, 0);
  board.move('item', 'item-c', 2, 2);
  board.removeItem('item-a');
  assert.ok(board.move('bag', 'square-bag', 1, 0));
  // Moving the final item to another bag also releases the original bag.
  assert.equal(board.move('item', 'item-c', 6, 2), null);
  assert.equal(board.move('bag', 'square-bag', 1, 0), null);
});

test('item entre duas mochilas impede mover ou girar qualquer uma delas', () => {
  const board = new PackingBoard({ columns: 6, rows: 4,
    bags: [
      { id: 'left', x: 0, y: 0, width: 2, height: 2 },
      { id: 'right', x: 2, y: 0, width: 2, height: 2 },
    ],
    items: [{ id: 'bridge', x: 1, y: 0, width: 2, height: 1 }],
  });
  const before = JSON.stringify(board);
  for (const id of ['left', 'right']) {
    assert.ok(board.move('bag', id, 0, 2));
    assert.ok(board.move('bag', id, id === 'left' ? 0 : 2, 0, 1));
  }
  assert.equal(JSON.stringify(board), before);
  board.removeItem('bridge');
  assert.equal(board.move('bag', 'left', 0, 2), null);
  assert.equal(board.move('bag', 'right', 2, 0, 1), null);
});
