import { rotateFootprint, getFootprintCells, occupiesCell } from '../utils/rotation.js';
import { cycleIronFusion } from '../utils/itemFusions.js';

function overlaps(first, second) {
  if (first.x >= second.x + second.width || first.x + first.width <= second.x
    || first.y >= second.y + second.height || first.y + first.height <= second.y) return false;
  if (!first.cells && !second.cells) return true;
  return getFootprintCells(first).some(cell => occupiesCell(second, first.x + cell.x, first.y + cell.y));
}

function coversCell(rectangle, x, y) {
  return occupiesCell(rectangle, x, y);
}

export default class PackingBoard {
  constructor({ columns, rows, bags, items }) {
    this.columns = columns;
    this.rows = rows;
    this.bags = bags.map((bag) => ({ ...bag }));
    this.items = items.map((item) => ({ ...item }));
  }

  getPieces(kind) {
    return kind === 'bag' ? this.bags : this.items;
  }

  hasSupport(item, bags = this.bags) {
    return getFootprintCells(item).every(cell => bags.some(bag =>
      coversCell(bag, item.x + cell.x, item.y + cell.y)));
  }

  getDisplacedBags(candidate) {
    return this.bags.filter((bag) => bag.id !== candidate.id
      && bag.x !== null && overlaps(candidate, bag));
  }

  bagHasItems(bag) {
    return bag.x !== null && this.items.some((item) => item.x !== null && overlaps(bag, item));
  }

  getPlacementError(kind, id, x, y, quarterTurns = 0) {
    const pieces = this.getPieces(kind);
    const piece = pieces.find((entry) => entry.id === id);
    if (!piece) return 'Peça não encontrada.';
    if (kind === 'bag' && this.bagHasItems(piece)) {
      return 'Retire todos os itens da mochila antes de movê-la ou girá-la.';
    }
    const candidate = { ...rotateFootprint(piece, quarterTurns), x, y };

    if (!Number.isInteger(x) || !Number.isInteger(y)
      || x < 0 || y < 0
      || x + candidate.width > this.columns || y + candidate.height > this.rows) {
      return 'A peça precisa ficar dentro da área.';
    }

    if (kind === 'item'
      && pieces.some((other) => other.id !== id && other.x !== null && overlaps(candidate, other))) {
      return 'Esse espaço já tem um item.';
    }

    if (kind === 'item' && !this.hasSupport(candidate)) {
      return 'Todas as células do item precisam de mochila.';
    }

    if (kind === 'bag') {
      const displaced = this.getDisplacedBags(candidate);
      if (displaced.some((bag) => this.bagHasItems(bag))) {
        return 'Mochilas com itens têm prioridade. Escolha outro espaço.';
      }
      if (displaced.length === 0) {
        const nextBags = this.bags.map((bag) => bag.id === id ? candidate : bag);
        if (this.items.some((item) => item.x !== null && !this.hasSupport(item, nextBags))) {
          return 'Retire os itens que ficariam sem mochila.';
        }
      }
    }

    return null;
  }

  move(kind, id, x, y, quarterTurns = 0) {
    const error = this.getPlacementError(kind, id, x, y, quarterTurns);
    if (error) return error;
    const piece = this.getPieces(kind).find((entry) => entry.id === id);
    const samePosition = piece.x === x && piece.y === y;
    const candidate = { ...rotateFootprint(piece, quarterTurns), x, y };
    if (kind === 'bag') {
      const displaced = this.getDisplacedBags(candidate);
      displaced.forEach((bag) => Object.assign(bag, { x: null, y: null }));
      Object.assign(piece, candidate);
      if (displaced.length > 0) {
        this.items.filter((item) => item.x !== null && !this.hasSupport(item))
          .forEach((item) => Object.assign(item, { x: null, y: null }));
      }
    } else {
      Object.assign(piece, candidate);
      if (!samePosition) delete piece.fusionTargetId;
      else if (quarterTurns % 4 === 0) cycleIronFusion(this.items, id);
    }
    return null;
  }

  removeItem(id) {
    return this.store('item', id);
  }

  store(kind, id, quarterTurns = 0) {
    const piece = this.getPieces(kind).find((entry) => entry.id === id);
    if (!piece) return 'Peça não encontrada.';
    if (kind === 'bag' && this.bagHasItems(piece)) {
      return 'Retire todos os itens da mochila antes de guardá-la.';
    }
    Object.assign(piece, rotateFootprint(piece, quarterTurns), { x: null, y: null });
    delete piece.fusionTargetId;
    return null;
  }
}
