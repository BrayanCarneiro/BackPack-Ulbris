import Phaser from 'phaser';
import TextButton from './TextButton.js';
import { theme } from '../config/theme.js';
import { getShopPresentation } from '../data/shopPresentation.js';
import { drawFootprint } from '../utils/drawFootprint.js';
import { getFootprintCells } from '../utils/rotation.js';
import { getItemRarity } from '../data/itemRarities.js';
import { addItemArt } from '../utils/itemArt.js';
import { drawBag } from '../utils/bagAppearance.js';

export default class ShopOfferCard extends Phaser.GameObjects.Container {
  constructor(scene, x, y, offer, stock, { affordable, onInspect, onBuy, onLock, compact = false }) {
    super(scene, x, y);
    scene.add.existing(this);
    this.offer = offer;
    this.stock = stock;
    if (compact) {
      this.createCompact(scene, { affordable, onInspect, onBuy, onLock });
      return;
    }
    const { category, color, summary } = getShopPresentation(offer);
    const rarity = getItemRarity(offer);
    const cssColor = `#${color.toString(16).padStart(6, '0')}`;
    const graphics = scene.add.graphics();
    this.add(graphics);
    const drawCard = (hover = false) => {
      graphics.clear().fillStyle(0x080f13, 0.25).fillRoundedRect(-146, -86, 292, 180, 14);
      graphics.fillStyle(hover ? 0x1e373c : theme.surface).fillRoundedRect(-146, -90, 292, 180, 14);
      graphics.lineStyle(this.stock.locked ? 2 : 1, this.stock.locked ? theme.accent : rarity.color,
        this.stock.locked ? 0.9 : hover ? 0.85 : 0.5).strokeRoundedRect(-146, -90, 292, 180, 14);
      graphics.fillStyle(rarity.color, theme.rarityFillAlpha).fillRoundedRect(-132, -56, 66, 66, 9);
      graphics.lineStyle(1, rarity.color, 0.15).strokeRoundedRect(-132, -56, 66, 66, 9);
      graphics.fillStyle(theme.accent, 0.12).fillRoundedRect(76, -79, 58, 26, 13);
      graphics.fillStyle(theme.accent).fillCircle(90, -66, 5);
      graphics.lineStyle(1, theme.accent, 0.12).lineBetween(-130, 38, 130, 38);
    };
    this.drawCard = drawCard;
    const text = (tx, ty, value, size, style = {}) => {
      const object = scene.add.text(tx, ty, value, {
        fontFamily: theme.fontFamily, fontSize: `${size}px`, color: theme.text, ...style,
      });
      this.add(object);
      return object;
    };
    this.categoryText = text(-130, -77, category, 12, { color: cssColor, letterSpacing: 1.5 });
    this.rarityText = text(-5, -77, rarity.name.toUpperCase(), 12,
      { color: rarity.cssColor, fontStyle: 'bold' }).setOrigin(0.5, 0);
    this.priceText = text(113, -66, `${offer.price}`, 17, {
      color: !this.stock.sold && !affordable ? '#ce8275' : '#e7d3a9', fontStyle: 'bold',
    }).setOrigin(0.5);
    const shape = scene.add.graphics();
    this.shape = shape;
    this.add(shape);
    const cell = Math.min(19, 54 / offer.width, 54 / offer.height);
    shape.fillStyle(rarity.color, theme.rarityFillAlpha);
    (offer.kind === 'bag' ? drawBag : drawFootprint)(shape, offer,
      -99 - offer.width * cell / 2, -23 - offer.height * cell / 2, cell);
    this.art = addItemArt(scene, offer, -99, -23, 54, 58);
    if (this.art) { this.add(this.art); shape.setVisible(false); }
    this.nameText = text(-54, -47, offer.name, 19, {
      fontStyle: 'bold', wordWrap: { width: 186 }, lineSpacing: 0, color: rarity.cssColor,
    });
    this.summaryText = text(-54, 0, summary, 16, {
      color: theme.muted, wordWrap: { width: 186 }, lineSpacing: 0,
    });
    const spaces = getFootprintCells(offer).length;
    this.sizeText = text(-99, 18, `${offer.width}×${offer.height}`, 14, { color: theme.muted }).setOrigin(0.5, 0);
    if (offer.cells) this.sizeText.setText(`${spaces} slots`);
    this.infoZone = scene.add.zone(0, -25, 292, 130).setInteractive({ useHandCursor: true });
    this.add(this.infoZone);
    this.infoZone.on('pointerover', () => drawCard(true));
    this.infoZone.on('pointerout', () => { this.infoZone.pressedPointer = null; drawCard(); });
    this.infoZone.on('pointerdown', pointer => { this.infoZone.pressedPointer = pointer.id; });
    this.infoZone.on('pointerup', pointer => {
      const pressedHere = this.infoZone.pressedPointer === pointer.id;
      this.infoZone.pressedPointer = null;
      if (pressedHere) onInspect();
    });
    // A quiet information mark makes the whole upper section's tap action discoverable.
    text(59, -74, 'i', 13, { color: theme.muted }).setOrigin(0.5);
    this.lockButton = new TextButton(scene, -92, 63, this.stock.locked ? 'Fixado' : 'Fixar', onLock,
      { width: 80, height: 38, fontSize: 16, secondary: true });
    this.buyButton = new TextButton(scene, 44, 63, this.stock.sold ? 'Comprado' : affordable ? 'Comprar' : 'Sem ouro', onBuy,
      { width: 176, height: 38, fontSize: 18 });
    this.add([this.lockButton, this.buyButton]);
    this.setSize(292, 180);
    this.updateState(stock, affordable);
  }

  createCompact(scene, { affordable, onInspect, onBuy, onLock }) {
    const offer = this.offer;
    const rarity = getItemRarity(offer);
    const graphics = scene.add.graphics();
    this.add(graphics);
    this.drawCard = () => {
      graphics.clear().fillStyle(theme.surface).fillRoundedRect(-102, -68, 204, 136, 10)
        .lineStyle(this.stock.locked ? 2 : 1, this.stock.locked ? theme.accent : rarity.color, 0.7)
        .strokeRoundedRect(-102, -68, 204, 136, 10);
    };
    const text = (x, y, value, size, style = {}) => {
      const label = scene.add.text(x, y, value, {
        fontFamily: theme.fontFamily, fontSize: `${size}px`, color: theme.text, ...style,
      });
      this.add(label);
      return label;
    };
    this.rarityText = text(-92, -61, rarity.name.toUpperCase(), 12, { color: rarity.cssColor });
    this.priceText = text(92, -61, `${offer.price} ouro`, 14, { color: '#e7d3a9' }).setOrigin(1, 0);
    this.shape = scene.add.graphics().fillStyle(rarity.color, theme.rarityFillAlpha);
    this.add(this.shape);
    const cell = Math.min(16, 40 / offer.width, 48 / offer.height);
    (offer.kind === 'bag' ? drawBag : drawFootprint)(this.shape, offer,
      -70 - offer.width * cell / 2, -13 - offer.height * cell / 2, cell);
    this.art = addItemArt(scene, offer, -70, -13, 40, 48);
    if (this.art) { this.add(this.art); this.shape.setVisible(false); }
    this.nameText = text(-40, -34, offer.name, 17, {
      color: rarity.cssColor, fontStyle: 'bold', wordWrap: { width: 134 },
    });
    for (let size = 16; this.nameText.height > 56 && size >= 12; size--) this.nameText.setFontSize(size);
    this.infoZone = scene.add.zone(0, -20, 204, 96).setInteractive({ useHandCursor: true });
    this.add(this.infoZone);
    this.infoZone.on('pointerdown', pointer => { this.infoZone.pressedPointer = pointer.id; });
    this.infoZone.on('pointerout', () => { this.infoZone.pressedPointer = null; });
    this.infoZone.on('pointerup', pointer => {
      const pressedHere = this.infoZone.pressedPointer === pointer.id;
      this.infoZone.pressedPointer = null;
      if (pressedHere) onInspect();
    });
    this.lockButton = new TextButton(scene, -65, 44, 'Fixar', onLock,
      { width: 60, height: 40, fontSize: 14, secondary: true });
    this.buyButton = new TextButton(scene, 32, 44, 'Comprar', onBuy,
      { width: 126, height: 40, fontSize: 17 });
    this.add([this.lockButton, this.buyButton]);
    this.setSize(204, 136);
    this.updateState(this.stock, affordable);
  }

  updateState(stock, affordable) {
    this.stock = stock;
    const state = [stock.sold, stock.locked, affordable].join(':');
    if (state === this.visualState) return;
    this.visualState = state;
    for (const object of [this.categoryText, this.rarityText, this.nameText, this.summaryText, this.sizeText, this.priceText]) object?.setAlpha(stock.sold ? 0.4 : 1);
    this.shape.setAlpha(stock.sold ? 0.35 : 1);
    this.art?.setAlpha(stock.sold ? 0.35 : 1);
    this.priceText.setColor(!stock.sold && !affordable ? '#ce8275' : '#e7d3a9');
    this.lockButton.setLabel(stock.locked ? 'Fixado' : 'Fixar').setVisible(!stock.sold);
    this.lockButton.setSelected(stock.locked).setEnabled(!stock.sold);
    this.buyButton.setLabel(stock.sold ? 'Comprado' : affordable ? 'Comprar' : 'Sem ouro');
    this.buyButton.setEnabled(!stock.sold && affordable);
    this.drawCard();
  }
}
