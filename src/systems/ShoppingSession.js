import PackingBoard from './PackingBoard.js';
import { getShopCatalog, allItems } from '../data/shopCatalog.js';
import { catalogId, getStarTargets, getAdjacentTargets } from '../utils/itemStars.js';
import { itemRecipes } from '../data/itemRecipes.js';
import { runRules } from '../data/runRules.js';
import { economy, roundIncome, sellPrice } from '../data/economy.js';
import { rotateFootprint } from '../utils/rotation.js';

export default class ShoppingSession {
  constructor({ random = Math.random, classId = null, campaign = true, opponentSeed = Math.floor(Math.random() * 32) } = {}) {
    this.board = new PackingBoard({ columns: 8, rows: 8, bags: [], items: [] });
    this.purchaseCounts = new Map();
    this.round = 1;
    this.pendingFusions = null;
    this.wins = 0;
    this.losses = 0;
    this.draws = 0;
    this.lives = runRules.startingLives;
    this.runResult = null;
    this.random = random;
    this.classId = classId;
    this.campaign = campaign;
    this.opponentSeed = opponentSeed;
    this.catalog = getShopCatalog(classId);
    this.gold = economy.startingGold;
    this.offers = ['traveler-bag', 'sword', 'shield', 'potion', 'refined-iron', 'long-bag']
      .map(id => ({ id, sold: false, locked: false }));
  }

  owns(id) {
    return [...this.board.bags, ...this.board.items].some((piece) => catalogId(piece) === id);
  }

  getShoppingError() {
    if (this.runResult) return 'Esta jornada já terminou. Comece uma nova partida.';
    if (this.pendingFusions !== null) return 'Aguarde o fim da batalha.';
    return null;
  }

  buy(id, slot = this.offers.findIndex(offer => offer.id === id && !offer.sold)) {
    const error = this.getShoppingError();
    if (error) return error;
    const offer = this.catalog.find((entry) => entry.id === id);
    if (!offer) return 'Oferta não encontrada.';
    const stock = this.offers[slot];
    if (!stock || stock.id !== id || stock.sold) return 'Esta oferta já foi vendida ou não está disponível.';
    if (this.gold < offer.price) return 'Ouro insuficiente.';
    const count = (this.purchaseCounts.get(id) ?? 0) + 1;
    this.purchaseCounts.set(id, count);
    this.board.getPieces(offer.kind).push({ ...offer, catalogId: id,
      id: count === 1 ? id : `${id}#${count}`, x: null, y: null });
    this.gold -= offer.price;
    stock.sold = true;
    stock.locked = false;
    return null;
  }

  toggleOfferLock(slot) {
    const error = this.getShoppingError();
    if (error) return error;
    const offer = this.offers[slot];
    if (!offer || offer.sold) return 'Não é possível reservar uma oferta vendida.';
    offer.locked = !offer.locked;
    return null;
  }

  refreshOffers() {
    this.offers = this.offers.map(offer => {
      if (offer.locked && !offer.sold) return offer;
      const index = Math.min(this.catalog.length - 1, Math.floor(this.random() * this.catalog.length));
      return { id: this.catalog[index].id, sold: false, locked: false };
    });
  }

  reroll() {
    const error = this.getShoppingError();
    if (error) return error;
    if (this.offers.every(offer => offer.locked && !offer.sold)) return 'Libere pelo menos uma oferta para renovar.';
    if (this.gold < economy.rerollCost) return 'Ouro insuficiente para renovar.';
    this.gold -= economy.rerollCost;
    this.refreshOffers();
    return null;
  }

  sell(kind, id) {
    const error = this.getShoppingError();
    if (error) return error;
    if (!['bag', 'item'].includes(kind)) return 'Peça não encontrada.';
    const pieces = this.board.getPieces(kind);
    const index = pieces.findIndex(piece => piece.id === id);
    if (index < 0) return 'Peça não encontrada.';
    const piece = pieces[index];
    if (kind === 'bag' && this.board.bagHasItems(piece)) return 'Retire os itens da mochila antes de vendê-la.';
    this.gold += sellPrice(piece);
    pieces.splice(index, 1);
    return null;
  }

  beginBattle() {
    if (this.runResult || this.pendingFusions !== null) return false;
    const usedTargets = new Set();
    this.pendingFusions = [];
    for (const anchor of this.board.items.filter(item => item.x !== null)) {
      if (usedTargets.has(anchor.id)) continue;
      for (const recipe of itemRecipes) {
        if (catalogId(anchor) !== recipe.anchor) continue;
        const targets = recipe.placement === 'adjacent' ? getAdjacentTargets(anchor, this.board.items)
          : getStarTargets(anchor, this.board.items);
        const target = targets.find(item => catalogId(item) === recipe.ingredients[0] && !usedTargets.has(item.id));
        if (!target) continue;
        usedTargets.add(target.id);
        usedTargets.add(anchor.id);
        this.pendingFusions.push({ anchorId: anchor.id, targetId: target.id, resultId: recipe.result });
        break;
      }
    }
    return true;
  }

  finishBattle(result) {
    if (this.runResult || !['victory', 'defeat', 'draw'].includes(result) || this.pendingFusions === null) return null;
    let fusions = 0;
    const fusionNames = [];
    const storedFusionNames = [];
    for (const { anchorId, targetId, resultId } of this.pendingFusions) {
      const anchor = this.board.items.find(item => item.id === anchorId);
      const target = this.board.items.find(item => item.id === targetId);
      const resultItem = allItems.find(item => item.id === resultId);
      if (!anchor || !target || !resultItem) continue;
      const shape = rotateFootprint(resultItem, (target.rotation ?? 0) / 90);
      Object.assign(target, { catalogId: resultItem.id, name: resultItem.name, label: resultItem.label,
        price: resultItem.price, pool: resultItem.pool, width: shape.width, height: shape.height,
        rotation: shape.rotation });
      if (shape.cells) target.cells = shape.cells;
      else delete target.cells;
      this.board.items.splice(this.board.items.indexOf(anchor), 1);
      // A larger result must never overlap another item or lose bag support.
      if (this.board.getPlacementError('item', target.id, target.x, target.y)) {
        target.x = null;
        target.y = null;
        storedFusionNames.push(resultItem.name);
      }
      fusions += 1;
      fusionNames.push(resultItem.name);
    }
    this.pendingFusions = null;
    if (result === 'victory') this.wins += 1;
    else {
      if (this.campaign) this.lives -= 1;
      if (result === 'defeat') this.losses += 1;
      else this.draws += 1;
    }
    // NPC training histories use the same shopping and fusion without campaign termination.
    if (this.campaign && this.wins >= runRules.targetWins) this.runResult = 'victory';
    else if (this.campaign && this.lives <= 0) this.runResult = 'defeat';
    const report = { result, fusions, fusionNames, round: this.round, income: 0 };
    if (storedFusionNames.length) report.storedFusionNames = storedFusionNames;
    if (!this.runResult) {
      this.round += 1;
      report.income = roundIncome(this.round);
      this.gold += report.income;
      this.refreshOffers();
    }
    return report;
  }

  cancelBattle() {
    this.pendingFusions = null;
  }

  getCompletionError() {
    if (this.runResult) return 'Esta jornada já terminou. Comece uma nova partida.';
    if (!this.board.bags.some((bag) => bag.x !== null)) {
      return 'Pegue uma mochila e posicione-a na área de organização.';
    }
    if (!this.board.items.some((item) => item.x !== null)) {
      return 'Posicione pelo menos um item na mochila antes de concluir.';
    }
    return null;
  }
}
