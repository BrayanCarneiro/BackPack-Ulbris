import Phaser from 'phaser';
import TextButton from './TextButton.js';
import { theme } from '../config/theme.js';
import { getShopPresentation } from '../data/shopPresentation.js';
import { drawFootprint } from '../utils/drawFootprint.js';
import { getFootprintCells } from '../utils/rotation.js';

export default class ShopOfferCard extends Phaser.GameObjects.Container {
  constructor(scene, x, y, offer, stock, { affordable, onInspect, onBuy, onLock }) {
    super(scene, x, y);
    scene.add.existing(this);
    this.offer = offer;
    this.stock = stock;
    const { category, color, summary } = getShopPresentation(offer);
    const cssColor = `#${color.toString(16).padStart(6, '0')}`;
    const graphics = scene.add.graphics();
    this.add(graphics);
    const drawCard = (hover = false) => {
      graphics.clear().fillStyle(0x080f13, 0.25).fillRoundedRect(-146, -86, 292, 180, 14);
      graphics.fillStyle(hover ? 0x1e373c : theme.surface).fillRoundedRect(-146, -90, 292, 180, 14);
      graphics.lineStyle(this.stock.locked ? 2 : 1, this.stock.locked ? theme.accent : color,
        this.stock.locked ? 0.9 : hover ? 0.65 : 0.25).strokeRoundedRect(-146, -90, 292, 180, 14);
      graphics.fillStyle(color, 0.1).fillRoundedRect(-132, -56, 66, 66, 9);
      graphics.lineStyle(1, color, 0.15).strokeRoundedRect(-132, -56, 66, 66, 9);
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
    this.priceText = text(113, -66, `${offer.price}`, 17, {
      color: !this.stock.sold && !affordable ? '#ce8275' : '#e7d3a9', fontStyle: 'bold',
    }).setOrigin(0.5);
    const shape = scene.add.graphics();
    this.shape = shape;
    this.add(shape);
    const cell = Math.min(19, 54 / offer.width, 54 / offer.height);
    shape.fillStyle(color);
    drawFootprint(shape, offer, -99 - offer.width * cell / 2, -23 - offer.height * cell / 2, cell);
    this.nameText = text(-54, -47, offer.name, 19, {
      fontStyle: 'bold', wordWrap: { width: 186 }, lineSpacing: 0,
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
      { width: 80, height: 38, fontSize: 16 });
    this.buyButton = new TextButton(scene, 44, 63, this.stock.sold ? 'Comprado' : affordable ? 'Comprar' : 'Sem ouro', onBuy,
      { width: 176, height: 38, fontSize: 18 });
    this.add([this.lockButton, this.buyButton]);
    for (const [button, secondary] of [[this.lockButton, true], [this.buyButton, false]]) {
      button.list[0].setVisible(false);
      const background = scene.add.graphics();
      button.addAt(background, 0);
      const drawButton = (hover = false) => {
        background.clear().fillStyle(secondary ? 0x20383c : hover ? theme.accentHover : theme.accent)
          .fillRoundedRect(-button.width / 2, -19, button.width, 38, 8);
        if (secondary) background.lineStyle(1, theme.accent, this.stock.locked || hover ? 0.85 : 0.25)
          .strokeRoundedRect(-button.width / 2, -19, button.width, 38, 8);
      };
      if (secondary) button.label.setColor(this.stock.locked ? '#e7d3a9' : theme.muted);
      button.redraw = drawButton;
      drawButton();
      button.on('pointerover', () => drawButton(true));
      button.on('pointerout', () => drawButton());
    }
    this.setSize(292, 180);
    this.updateState(stock, affordable);
  }

  updateState(stock, affordable) {
    this.stock = stock;
    const state = [stock.sold, stock.locked, affordable].join(':');
    if (state === this.visualState) return;
    this.visualState = state;
    for (const object of [this.categoryText, this.nameText, this.summaryText, this.sizeText, this.priceText]) object.setAlpha(stock.sold ? 0.4 : 1);
    this.shape.setAlpha(stock.sold ? 0.35 : 1);
    this.priceText.setColor(!stock.sold && !affordable ? '#ce8275' : '#e7d3a9');
    this.lockButton.setLabel(stock.locked ? 'Fixado' : 'Fixar').setVisible(!stock.sold);
    this.lockButton.label.setColor(stock.locked ? '#e7d3a9' : theme.muted);
    if (stock.sold) this.lockButton.disableInteractive();
    else this.lockButton.setInteractive({ useHandCursor: true });
    this.buyButton.setLabel(stock.sold ? 'Comprado' : affordable ? 'Comprar' : 'Sem ouro');
    if (stock.sold || !affordable) this.buyButton.disableInteractive().setAlpha(0.4);
    else this.buyButton.setInteractive({ useHandCursor: true }).setAlpha(1);
    this.drawCard();
    this.lockButton.redraw();
    this.buyButton.redraw();
  }
}
