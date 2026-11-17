import PackingBoard from './PackingBoard.js';
import { getShopCatalog, allItems } from '../data/shopCatalog.js';
import { catalogId } from '../utils/itemStars.js';
import { getReadyFusions } from '../utils/itemFusions.js';
import { runRules } from '../data/runRules.js';
import { economy, roundIncome, sellPrice } from '../data/economy.js';
import { rotateFootprint } from '../utils/rotation.js';
import { getShopDistribution, rollShopItem } from '../data/itemRarities.js';
import { cloneData } from '../utils/cloneData.js';
import { difficultyForRun } from '../data/difficulty.js';
import { oathRules, oathProgress } from '../data/oathRules.js';

export default class ShoppingSession {
  constructor({ random = Math.random, classId = null, campaign = true, opponentSeed = Math.floor(Math.random() * 32) } = {}) {
    this.board = new PackingBoard({ columns: 8, rows: 8, bags: [], items: [] });
    if (classId) this.board.classId = classId;
    this.purchaseCounts = new Map();
    this.round = 1;
    this.pendingFusions = null;
    this.pendingOathIds = [];
    this.wins = 0;
    this.losses = 0;
    this.draws = 0;
    this.lives = runRules.startingLives;
    this.runResult = null;
    this.endless = false;
    this.endlessBattles = 0;
    this.winningBoard = null;
    this.random = random;
    this.classId = classId;
    this.campaign = campaign;
    this.opponentSeed = opponentSeed;
    this.catalog = getShopCatalog(classId);
    if (classId === 'arthur') {
      const bag = allItems.find(item => item.id === 'knight-bag');
      this.board.bags.push({ ...bag, catalogId: bag.id, startingEquipment: true, x: 0, y: 0 });
      this.purchaseCounts.set(bag.id, 1);
    }
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
    const distribution = getShopDistribution(this.catalog, this.round);
    this.offers = this.offers.map(offer => {
      if (offer.locked && !offer.sold) return offer;
      return { id: rollShopItem(distribution, this.random()).id, sold: false, locked: false };
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

  clearBoard() {
    const error = this.getShoppingError();
    if (error) return error;
    this.board.storeAll();
    return null;
  }

  beginBattle() {
    if (this.runResult || this.pendingFusions !== null) return false;
    this.pendingFusions = getReadyFusions(this.board.items, this.classId);
    this.pendingOathIds = this.classId === 'arthur' ? this.board.items
      .filter(item => catalogId(item) === oathRules.sword && item.x !== null && item.y !== null)
      .map(item => item.id) : [];
    return true;
  }

  finishBattle(result) {
    if (this.runResult || !['victory', 'defeat', 'draw'].includes(result) || this.pendingFusions === null) return null;
    if (this.campaign && !this.endless && result === 'victory' && this.wins + 1 >= runRules.targetWins) {
      // Preserve what fought, before post-battle fusions transform or consume it.
      this.winningBoard = cloneData({ ...(this.classId ? { classId: this.classId } : {}), columns: this.board.columns, rows: this.board.rows,
        bags: this.board.bags, items: this.board.items });
    }
    for (const id of this.pendingOathIds) {
      const sword = this.board.items.find(item => item.id === id && catalogId(item) === oathRules.sword);
      if (sword) sword.oathBattles = Math.min(oathRules.requiredBattles, oathProgress(sword) + 1);
    }
    this.pendingOathIds = [];
    let fusions = 0;
    const fusionNames = [];
    const storedFusionNames = [];
    for (const { consumedIds, targetId, resultId, resultAlignment } of this.pendingFusions) {
      const ingredients = consumedIds.map(id => this.board.items.find(item => item.id === id));
      const target = this.board.items.find(item => item.id === targetId);
      const resultItem = allItems.find(item => item.id === resultId);
      if (ingredients.some(item => !item) || !target || !resultItem) continue;
      const shape = rotateFootprint(resultItem, (target.rotation ?? 0) / 90);
      if (resultAlignment === 'center') {
        target.x += (target.width - shape.width) / 2;
        target.y += (target.height - shape.height) / 2;
      }
      Object.assign(target, { catalogId: resultItem.id, name: resultItem.name, label: resultItem.label,
        price: resultItem.price, pool: resultItem.pool, rarity: resultItem.rarity, width: shape.width, height: shape.height,
        rotation: shape.rotation });
      delete target.oathBattles;
      if (shape.cells) target.cells = shape.cells;
      else delete target.cells;
      for (const ingredient of ingredients) this.board.items.splice(this.board.items.indexOf(ingredient), 1);
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
    if (this.endless) this.endlessBattles += 1;
    if (this.campaign && !this.endless && this.wins >= runRules.targetWins) this.runResult = 'victory';
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
    this.pendingOathIds = [];
  }

  get difficulty() {
    return difficultyForRun(this);
  }

  continueEndless() {
    if (!this.campaign || this.endless || this.runResult !== 'victory' || this.lives <= 0) return false;
    this.endless = true;
    this.runResult = null;
    this.round += 1;
    this.gold += roundIncome(this.round);
    this.refreshOffers();
    return true;
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
