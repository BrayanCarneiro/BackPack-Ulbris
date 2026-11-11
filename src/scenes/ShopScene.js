import Phaser from 'phaser';
import RoundedButton from '../components/RoundedButton.js';
import MenuBackButton from '../components/MenuBackButton.js';
import PackingBoardView from '../components/PackingBoardView.js';
import ShopOfferCard from '../components/ShopOfferCard.js';
import ShoppingSession from '../systems/ShoppingSession.js';
import { shopCatalog } from '../data/shopCatalog.js';
import { theme } from '../config/theme.js';
import { openItemInfo } from '../utils/openItemInfo.js';
import { runProgress } from '../data/runRules.js';
import { opponentName } from '../data/opponents.js';
import { economy, roundIncome } from '../data/economy.js';
import { getPreparationLayout } from '../config/preparationLayout.js';

export default class ShopScene extends Phaser.Scene {
  constructor(key = 'ShopScene') { super(key); }

  create(data = {}) {
    this.session = data.session ?? new ShoppingSession({ classId: data.classId ?? this.registry.get('selectedCharacter') ?? 'arthur' });
    if (this.session.runResult) {
      this.scene.start('RunEndScene', { session: this.session });
      return;
    }
    this.offerPage = 0;
    this.boardView = null;
    const report = data.report;
    this.lastMessage = report
      ? `${{ victory: 'Vitória!', defeat: 'Derrota: −1 vida.', draw: 'Empate: −1 vida.' }[report.result]} +${report.income} ouro.${report.fusions ? `\nFusão: ${[...new Set(report.fusionNames)].join(', ')}!` : ''}${report.storedFusionNames?.length ? '\nResultado sem espaço está na reserva.' : ''}`
      : 'Compre, arraste da reserva e monte sua mochila.';
    this.renderLayout();
    const onResize = () => {
      this.scale.getParentBounds();
      const next = getPreparationLayout(window.innerWidth, window.innerHeight);
      if (next.width !== this.preparationLayout.width || next.height !== this.preparationLayout.height) this.renderLayout();
      else this.scale.refresh();
    };
    window.addEventListener('resize', onResize);
    this.events.once('shutdown', () => {
      window.removeEventListener('resize', onResize);
      this.boardView?.destroy();
      this.boardView = null;
      this.scale.setGameSize(720, 1280);
    });
  }

  text(x, y, value, size = 22, options = {}) {
    return this.add.text(x, y, value, {
      fontFamily: theme.fontFamily, fontSize: `${size}px`, color: theme.text, ...options,
    });
  }

  setMessage(value) {
    this.lastMessage = value;
    this.status?.setText(value);
  }

  renderLayout() {
    const selectedId = this.boardView?.selected?.piece.id;
    const expanded = this.boardView?.reserve.expanded ?? false;
    this.boardView?.destroy();
    this.children.removeAll(true);
    this.boardView = null;
    const layout = getPreparationLayout(window.innerWidth, window.innerHeight);
    this.preparationLayout = layout;
    this.scale.getParentBounds();
    this.scale.setGameSize(layout.width, layout.height);
    this.cameras.main.setScroll(0, 0);
    const { wide, width, shopX, boardCenter } = layout;
    new MenuBackButton(this, { x: wide ? (width - 1560) / 2 + 40 : 30 });
    this.text(width / 2, 62, 'PREPARE SUA JORNADA', wide ? 32 : 28, { fontStyle: 'bold' }).setOrigin(0.5);
    this.goldText = this.text(width / 2, 112, '', 24, { color: '#e7d3a9' }).setOrigin(0.5);
    this.text(width / 2, 153, `Rodada ${this.session.round} · ${runProgress(this.session)} · ${opponentName(this.session.round)}`, 17,
      { color: theme.muted }).setOrigin(0.5);
    this.text(wide ? shopX - 302 : 58, wide ? 210 : 177, 'LOJA', wide ? 26 : 20,
      { color: theme.muted, letterSpacing: 2 }).setOrigin(0, 0.5);
    this.text(layout.board.x, layout.boardTitleY, 'MOCHILA', wide ? 26 : 22,
      { color: theme.muted, letterSpacing: 2 }).setOrigin(0, 0.5);
    if (wide) this.add.graphics().lineStyle(1, theme.accent, 0.12)
      .lineBetween(shopX + 396, 195, shopX + 396, 1220);
    this.status = this.text(wide ? shopX : width / 2, wide ? 1040 : layout.messageY,
      this.lastMessage, wide ? 21 : 18, { align: 'center', wordWrap: { width: 604 }, lineSpacing: 4 }).setOrigin(0.5);
    this.boardMessage = wide ? this.text(boardCenter, layout.messageY, 'Arraste uma peça para organizar.', 18,
      { color: theme.muted, align: 'center', wordWrap: { width: 576 } }).setOrigin(0.5) : this.status;
    this.fusionStatus = this.text(wide ? boardCenter : width / 2, layout.fusionY, '', wide ? 18 : 16,
      { color: theme.muted, align: 'center', wordWrap: { width: wide ? layout.board.cellSize * 8 : 640 }, lineSpacing: 3 }).setOrigin(0.5);
    this.offersLayer = this.add.container(0, 0);
    const paged = !wide && layout.offersPerPage < this.session.offers.length;
    this.rerollButton = new RoundedButton(this, paged ? 472 : shopX, layout.rerollY,
      `Renovar · ${economy.rerollCost} ouro`, () => {
        const error = this.session.reroll();
        this.setMessage(error ?? 'Novas ofertas. As fixadas foram preservadas.');
        this.refreshStock();
      }, { width: paged ? 380 : 604, height: wide ? 56 : 46, fontSize: wide ? 23 : 20, secondary: true });
    this.counter = wide ? this.text(shopX, 952, '', 18, { color: theme.muted }).setOrigin(0.5) : null;
    if (paged) {
      this.pageText = this.text(146, layout.rerollY, '', 20, { color: theme.muted }).setOrigin(0.5);
      this.pageButtons = [-1, 1].map(direction => new RoundedButton(this, direction < 0 ? 78 : 214, layout.rerollY,
        direction < 0 ? '‹' : '›', () => {
          this.offerPage = (this.offerPage + direction + this.pageCount()) % this.pageCount();
          this.refreshStock();
        }, { width: 42, height: 46, fontSize: 26, secondary: true }));
    } else {
      this.pageText = null;
      this.pageButtons = [];
    }
    const view = new PackingBoardView(this, this.session.board, message => {
      this.boardMessage.setText(message);
      if (!wide) this.lastMessage = message;
    }, piece => openItemInfo(this, piece), (kind, piece) => {
      const error = this.session.sell(kind, piece.id);
      if (!error) this.refreshStock();
      return error;
    }, status => {
      this.fusionStatus.setText(status?.text ?? 'Toque para consultar · arraste para organizar')
        .setColor(status?.ready ? '#91bf9b' : theme.muted);
    }, { layout: layout.board });
    this.boardView = view;
    view.selected = view.views.find(entry => entry.piece.id === selectedId) ?? null;
    view.reserve.expanded = expanded;
    view.refresh();
    this.clearButton = new RoundedButton(this,
      wide ? layout.board.x + layout.board.cellSize * 8 - 88 : 268,
      layout.boardTitleY, wide ? '🧹 Limpar tudo' : '🧹 Limpar', () => {
        if (view.dragging) {
          view.onMessage('Solte a peça antes de limpar a mochila.');
          return;
        }
        const error = this.session.clearBoard();
        if (error) {
          view.onMessage(error);
          return;
        }
        view.selected = null;
        view.preview.clear();
        view.stars.clear();
        view.reserve.expanded = true;
        view.refresh();
        view.onMessage('Tudo guardado na reserva. Posicione as mochilas para reorganizar.');
      }, { width: wide ? 176 : 146, height: wide ? 48 : 42, fontSize: 18, secondary: true });
    this.rotateButton = new RoundedButton(this, wide ? boardCenter - 110 : 424, layout.controlsY,
      'Girar · 90°', () => view.rotateSelected(), { width: wide ? 188 : 124, height: wide ? 48 : 42, fontSize: wide ? 21 : 18, secondary: true });
    this.infoButton = new RoundedButton(this, wide ? boardCenter + 110 : 574, layout.controlsY,
      'Informações', () => {
        if (view.selected) openItemInfo(this, view.selected.piece);
        else this.boardMessage.setText('Selecione uma peça para consultar.');
      }, { width: wide ? 188 : 148, height: wide ? 48 : 42, fontSize: wide ? 21 : 18, secondary: true });
    this.battleButton = new RoundedButton(this, wide ? shopX : width / 2, layout.battleY, 'Batalhar', () => {
      const error = this.session.getCompletionError();
      if (error) this.setMessage(error);
      else this.scene.start('BattleScene', { session: this.session });
    }, { width: 604, height: 64, fontSize: 26 });
    this.refreshStock();
  }

  pageCount() { return Math.max(1, Math.ceil(this.session.offers.length / this.preparationLayout.offersPerPage)); }

  refreshStock() {
    this.offerPage = Math.min(this.offerPage, this.pageCount() - 1);
    const { offersPerPage } = this.preparationLayout;
    const start = this.offerPage * offersPerPage;
    const visible = this.session.offers.slice(start, start + offersPerPage);
    const previous = [...this.offersLayer.list];
    visible.forEach((stock, index) => {
      const card = previous[index];
      if (card?.offer.id === stock.id && card.offerIndex === start + index) {
        card.updateState(stock, this.session.gold >= card.offer.price);
      } else {
        if (card) this.offersLayer.remove(card, true);
        this.offersLayer.addAt(this.createOffer(stock, start + index, index), index);
      }
    });
    for (const card of previous.slice(visible.length)) this.offersLayer.remove(card, true);
    const { bags, items } = this.session.board;
    this.counter?.setText(`${bags.length} mochila(s) · ${items.length} item(ns) · Fixar preserva a oferta`);
    this.goldText.setText(`Ouro: ${this.session.gold} · Próxima renda: +${roundIncome(this.session.round + 1)}`);
    this.rerollButton.setEnabled(this.session.gold >= economy.rerollCost && this.session.offers.some(offer => !offer.locked || offer.sold));
    this.pageText?.setText(`${this.offerPage + 1} / ${this.pageCount()}`);
    this.pageButtons.forEach(button => button.setEnabled(this.pageCount() > 1));
  }

  createOffer(stock, index, localIndex) {
    const offer = shopCatalog.find(entry => entry.id === stock.id);
    const layout = this.preparationLayout;
    const x = layout.shopX - 156 + (localIndex % 2) * 312;
    const y = layout.offerY + Math.floor(localIndex / 2) * 200;
    const card = new ShopOfferCard(this, x, y, offer, stock, {
      affordable: this.session.gold >= offer.price,
      onInspect: () => openItemInfo(this, offer),
      onLock: () => {
        const error = this.session.toggleOfferLock(index);
        this.setMessage(error ?? (this.session.offers[index].locked ? 'Oferta fixada.' : 'Oferta liberada.'));
        this.refreshStock();
      },
      onBuy: () => {
        const error = this.session.buy(offer.id, index);
        this.setMessage(error ?? `Na reserva: ${offer.name}.`);
        this.refreshStock();
        if (!error) this.boardView.refresh();
      },
    });
    card.offerIndex = index;
    return card;
  }
}
