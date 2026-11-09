import Phaser from 'phaser';
import TextButton from '../components/TextButton.js';
import MenuBackButton from '../components/MenuBackButton.js';
import ShoppingSession from '../systems/ShoppingSession.js';
import { shopCatalog } from '../data/shopCatalog.js';
import { theme } from '../config/theme.js';
import { openItemInfo } from '../utils/openItemInfo.js';
import { runProgress, runRules } from '../data/runRules.js';
import { opponentName } from '../data/opponents.js';
import { economy, roundIncome } from '../data/economy.js';
import { drawFootprint } from '../utils/drawFootprint.js';

export default class ShopScene extends Phaser.Scene {
  constructor() {
    super('ShopScene');
  }

  create(data) {
    this.session = data.session ?? new ShoppingSession();
    if (this.session.runResult) {
      this.scene.start('RunEndScene', { session: this.session });
      return;
    }
    const textStyle = { fontFamily: theme.fontFamily, color: theme.text };
    this.add.text(400, 62, `PREPARE SUA JORNADA · RODADA ${this.session.round}`, {
      ...textStyle, fontSize: '16px', color: theme.muted, letterSpacing: 2,
    }).setOrigin(0.5);
    new MenuBackButton(this);
    const title = this.add.text(360, 120, '', {
      ...textStyle, fontSize: '44px', fontStyle: 'bold',
    }).setOrigin(0.5);
    const heading = 'Fase de compras';
    let letters = 0;
    const typing = this.time.addEvent({ delay: 65, repeat: heading.length - 1,
      callback: () => title.setText(heading.slice(0, ++letters)),
    });
    this.events.once('shutdown', () => typing.remove());
    this.goldText = this.add.text(360, 185, '', {
      ...textStyle, fontSize: '23px', color: theme.muted, align: 'center', lineSpacing: 7,
    }).setOrigin(0.5);

    this.add.text(360, 232, `${runProgress(this.session)} · Rival: ${opponentName(this.session.round)}`, {
      ...textStyle, fontSize: '17px', color: theme.muted, align: 'center',
    }).setOrigin(0.5);
    this.status = this.add.text(360, 1040, '', {
      ...textStyle, fontSize: '22px', align: 'center', wordWrap: { width: 600 },
    }).setOrigin(0.5);
    this.counter = this.add.text(360, 982, '', {
      ...textStyle, fontSize: '20px', color: theme.muted,
    }).setOrigin(0.5);
    this.offersLayer = this.add.container(0, 0);
    this.rerollButton = new TextButton(this, 360, 862, `Renovar ofertas · ${economy.rerollCost} ouro`, () => {
      const error = this.session.reroll();
      this.status.setText(error ?? 'Novas ofertas. As ofertas fixadas foram preservadas.');
      this.refreshStock();
    }, { height: 58, fontSize: 23 });
    this.add.text(360, 918, 'Fixar preserva a oferta ao renovar e entre rodadas.\nVenda peças na organização para recuperar ouro.', {
      ...textStyle, fontSize: '17px', color: theme.muted, align: 'center', lineSpacing: 5,
    }).setOrigin(0.5);
    this.refreshStock();
    const report = data.report;
    this.status.setText(report
      ? `${{ victory: 'Vitória!', defeat: 'Derrota: −1 vida.', draw: 'Empate: −1 vida.' }[report.result]} +${report.income} de ouro.${report.fusions ? `\nFusão: ${[...new Set(report.fusionNames)].join(', ')}!` : ''}`
      : `Alcance ${runRules.targetWins} vitórias antes de perder ${runRules.startingLives} vidas.\nDerrotas e empates custam 1 vida.`);
    if (report?.storedFusionNames?.length) {
      this.status.setFontSize(18).setY(1030)
        .setText(`${this.status.text}\nSem espaço: resultado guardado na reserva.`);
    }
    new TextButton(this, 360, 1120, 'Organizar mochilas', () => {
      if (!this.session.board.bags.length) {
        this.status.setText('Escolha pelo menos uma mochila para começar.');
        return;
      }
      this.scene.start('GameScene', { session: this.session });
    }, { height: 76 });
  }

  refreshCounter() {
    const { bags, items } = this.session.board;
    this.counter.setText(`Na sua coleção: ${bags.length} mochila(s) · ${items.length} item(ns)`);
    this.goldText.setText(`Ouro: ${this.session.gold} · Próxima renda: +${roundIncome(this.session.round + 1)}`);
  }

  refreshStock() {
    this.offersLayer.removeAll(true);
    this.session.offers.forEach((stock, index) => this.createOffer(stock, index));
    this.refreshCounter();
    const canReroll = this.session.gold >= economy.rerollCost
      && this.session.offers.some(offer => !offer.locked || offer.sold);
    if (canReroll) this.rerollButton.setInteractive({ useHandCursor: true }).setAlpha(1);
    else this.rerollButton.disableInteractive().setAlpha(0.4);
  }

  createOffer(stock, index) {
    const offer = shopCatalog.find(entry => entry.id === stock.id);
    const createdStart = this.children.list.length;
    const x = 204 + (index % 2) * 312;
    const y = 326 + Math.floor(index / 2) * 190;
    this.add.rectangle(x, y, 292, 170, theme.surface)
      .setStrokeStyle(stock.locked ? 3 : 1, theme.accent, stock.locked ? 0.9 : 0.3);
    const cell = Math.min(12, 80 / offer.width, 30 / offer.height);
    const grid = this.add.graphics();
    grid.fillStyle(offer.kind === 'bag' ? theme.bag : theme.accent);
    drawFootprint(grid, offer, x - offer.width * cell / 2, y - 70, cell);
    this.add.text(x, y - 15, offer.name, {
      fontFamily: theme.fontFamily, fontSize: '21px', color: theme.text,
    }).setOrigin(0.5);
    this.add.text(x, y + 15, `${offer.width}×${offer.height} · ${offer.kind === 'bag' ? 'Mochila' : 'Equipamento'}`, {
      fontFamily: theme.fontFamily, fontSize: '18px', color: theme.muted,
    }).setOrigin(0.5);
    const infoZone = this.add.zone(x, y - 27, 292, 114).setInteractive({ useHandCursor: true });
    infoZone.on('pointerdown', pointer => { infoZone.pressedPointer = pointer.id; });
    infoZone.on('pointerout', () => { infoZone.pressedPointer = null; });
    infoZone.on('pointerup', pointer => {
      if (infoZone.pressedPointer === pointer.id) openItemInfo(this, offer);
    });
    new TextButton(this, x + 116, y - 62, 'i', () => openItemInfo(this, offer),
      { width: 34, height: 34, fontSize: 21 });
    const lockButton = new TextButton(this, x - 96, y + 55, stock.locked ? 'Soltar' : 'Fixar', () => {
      const error = this.session.toggleOfferLock(index);
      this.status.setText(error ?? (stock.locked ? 'Oferta fixada.' : 'Oferta liberada.'));
      this.refreshStock();
    }, { width: 76, height: 42, fontSize: 17 });
    if (stock.sold) lockButton.disableInteractive().setAlpha(0);
    const buyButton = new TextButton(this, x + 39, y + 55, stock.sold ? 'Vendido' : `Comprar · ${offer.price} ouro`, () => {
      const error = this.session.buy(offer.id, index);
      this.status.setText(error ?? `Na reserva: ${offer.name}.`);
      this.refreshStock();
    }, { width: 178, height: 42, fontSize: 18 });
    if (stock.sold || this.session.gold < offer.price) buyButton.disableInteractive().setAlpha(0.4);
    this.offersLayer.add(this.children.list.slice(createdStart));
  }
}
