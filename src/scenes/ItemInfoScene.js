import Phaser from 'phaser';
import TextButton from '../components/TextButton.js';
import { theme } from '../config/theme.js';
import { getItemDetails, itemCatalog } from '../utils/itemDetails.js';
import { getShopPresentation } from '../data/shopPresentation.js';
import { drawFootprint } from '../utils/drawFootprint.js';
import { getFootprintCells } from '../utils/rotation.js';
import { getItemRarity } from '../data/itemRarities.js';
import { addItemArt } from '../utils/itemArt.js';

export default class ItemInfoScene extends Phaser.Scene {
  constructor() { super('ItemInfoScene'); }

  create({ item, sourceKey }) {
    this.item = item;
    this.sourceKey = sourceKey;
    this.recipesVisible = false;
    this.recipeIndex = 0;
    this.renderPanel();
    this.scale.on('resize', this.renderPanel, this);
    this.input.keyboard.on('keydown-ESC', this.close, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.renderPanel, this);
      this.input.keyboard.off('keydown-ESC', this.close, this);
    });
  }

  text(x, y, value, size = 22, options = {}) {
    return this.add.text(x, y, value, {
      fontFamily: theme.fontFamily, fontSize: `${size}px`, color: theme.text, ...options,
    });
  }

  surface(x, y, width, height, { color = 0x101e24, border = theme.accent, alpha = 0.18 } = {}) {
    return this.add.graphics().fillStyle(color).fillRoundedRect(x, y, width, height, 12)
      .lineStyle(1, border, alpha).strokeRoundedRect(x, y, width, height, 12);
  }

  button(x, y, label, onClick, { width = 280, height = 50, active = false } = {}) {
    const button = new TextButton(this, x, y, label, onClick, { width, height, fontSize: 21 });
    button.list[0].setVisible(false);
    const background = this.add.graphics();
    button.addAt(background, 0);
    const draw = (hover = false) => {
      background.clear().fillStyle(active ? hover ? theme.accentHover : theme.accent : hover ? 0x294348 : 0x20383c)
        .fillRoundedRect(-width / 2, -height / 2, width, height, 10)
        .lineStyle(1, theme.accent, active ? 0.6 : 0.2)
        .strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
    };
    button.label.setColor(active ? theme.buttonText : theme.muted);
    button.on('pointerover', () => draw(true));
    button.on('pointerout', () => draw());
    draw();
    return button;
  }

  renderPanel() {
    this.children.removeAll(true);
    this.details = getItemDetails(this.item);
    if (!this.details) { this.close(); return; }
    const center = this.scale.width / 2;
    const offsetY = Math.max(0, (this.scale.height - 1280) / 2);
    this.cameras.main.setScroll(0, -offsetY);
    this.left = center - 320;
    this.effectTexts = [];
    this.recipeZones = [];
    this.add.rectangle(0, -offsetY, this.scale.width, this.scale.height, 0x080f13, 0.88).setOrigin(0).setInteractive();
    this.add.zone(center, 640, 640, 1100).setInteractive();
    this.surface(this.left, 90, 640, 1100, { color: theme.surface, border: this.details.rarity.color, alpha: 0.55 });
    const { piece, itemClass, rarity } = this.details;
    const { category, color } = getShopPresentation(piece);
    this.text(this.left + 28, 120, 'FICHA DO ITEM', 14, { color: theme.muted, letterSpacing: 2 });
    this.button(center + 280, 129, '×', () => this.close(), { width: 40, height: 38 });
    this.surface(this.left + 28, 178, 108, 108, { color: 0x20383c, border: color, alpha: 0.25 });
    this.drawFootprint(this.left + 82, 232, piece, 25);
    this.text(this.left + 160, 172, category, 14, { color: `#${color.toString(16).padStart(6, '0')}`, letterSpacing: 1.5 });
    this.rarityText = this.text(this.left + 608, 172, rarity.name.toUpperCase(), 14,
      { color: rarity.cssColor, fontStyle: 'bold', letterSpacing: 1 }).setOrigin(1, 0);
    this.nameText = this.text(this.left + 160, 201, this.details.name, 29, {
      fontStyle: 'bold', wordWrap: { width: 445 }, lineSpacing: 0,
    });
    this.text(this.left + 160, 278, `${piece.width}×${piece.height} · ${getFootprintCells(piece).length} espaços · ${itemClass.name}`, 18, { color: theme.muted });
    this.detailsButton = this.button(center - 150, 340, 'Atributos e efeitos', () => {
      this.recipesVisible = false;
      this.renderPanel();
    }, { active: !this.recipesVisible });
    this.recipeButton = this.button(center + 150, 340, `Receitas${this.details.recipes.length ? ` · ${this.details.recipes.length}` : ''}`, () => {
      this.recipesVisible = true;
      this.renderPanel();
    }, { active: this.recipesVisible });
    if (this.recipesVisible) this.renderRecipes(center);
    else this.renderDetails();
    this.add.graphics().lineStyle(1, theme.accent, 0.15).lineBetween(this.left + 28, 1093, this.left + 612, 1093);
    this.text(center, 1114, `Valor: ${piece.price} ouro     ·     Venda: ${this.details.sellPrice} ouro`, 18, { color: theme.muted }).setOrigin(0.5);
    this.closeButton = this.button(center, 1156, 'Fechar', () => this.close(), { width: 300, active: true });
  }

  drawFootprint(x, y, piece, maxCell) {
    if (addItemArt(this, piece, x, y, 80, 84)) return;
    const cell = Math.min(maxCell, 88 / piece.width, 80 / piece.height);
    const graphics = this.add.graphics();
    graphics.fillStyle(getItemRarity(piece).color);
    drawFootprint(graphics, piece, x - piece.width * cell / 2, y - piece.height * cell / 2, cell);
  }

  renderDetails() {
    const { attributes, effectRows } = this.details;
    const compact = effectRows.length > 5;
    let y = 397;
    if (attributes.length) {
      this.text(this.left + 28, y, 'ATRIBUTOS', 14, { color: theme.muted, letterSpacing: 1.5 });
      attributes.forEach(([label, value], index) => {
        const x = this.left + 28 + (index % 2) * 300;
        const top = 425 + Math.floor(index / 2) * 78;
        this.surface(x, top, 284, 68, { alpha: 0.08 });
        this.text(x + 16, top + 9, label, 15, { color: theme.muted });
        this.text(x + 16, top + 30, value, 24, { fontStyle: 'bold' });
      });
      y = 425 + Math.ceil(attributes.length / 2) * 78 + 12;
    }
    this.text(this.left + 28, y, 'EFEITOS', 14, { color: theme.muted, letterSpacing: 1.5 });
    y += 31;
    for (const { label, value, note } of effectRows) {
      const background = this.add.graphics();
      const heading = this.text(this.left + 44, y + (compact ? 8 : 10), label, compact ? 13 : 15, { color: theme.muted });
      const main = this.text(this.left + 44, y + (compact ? 25 : 32), value, compact ? 18 : 22, { wordWrap: { width: 552 }, fontStyle: 'bold' });
      const sub = note ? this.text(this.left + 44, main.y + main.height + (compact ? 4 : 5), note, compact ? 14 : 16, { color: theme.muted, wordWrap: { width: 552 } }) : null;
      const bottom = sub ? sub.y + sub.height : main.y + main.height;
      const height = bottom - y + 12;
      background.fillStyle(0x101e24, 0.65).fillRoundedRect(this.left + 28, y, 584, height, 10);
      this.effectTexts.push(heading, main, ...(sub ? [sub] : []));
      y += height + 8;
    }
    this.contentBottom = y - 8;
  }

  recipeCard(x, id, role, width = 152) {
    const item = itemCatalog.find(entry => entry.id === id);
    const rarity = getItemRarity(item);
    this.surface(x - width / 2, 449, width, 208, { border: rarity.color, alpha: id === this.details.id ? 0.8 : 0.4 });
    this.text(x, 463, role, 12, { color: theme.muted }).setOrigin(0.5, 0);
    this.text(x, 482, rarity.name, 11, { color: rarity.cssColor }).setOrigin(0.5, 0);
    this.drawFootprint(x, 528, item, 20);
    this.text(x, 582, item.name, 18, { align: 'center', wordWrap: { width: width - 16 } }).setOrigin(0.5, 0);
    const zone = this.add.zone(x, 553, width, 208).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', pointer => { zone.pressedPointer = pointer.id; });
    zone.on('pointerout', () => { zone.pressedPointer = null; });
    zone.on('pointerup', pointer => {
      if (zone.pressedPointer !== pointer.id) return;
      zone.pressedPointer = null;
      this.item = item;
      this.recipesVisible = false;
      this.recipeIndex = 0;
      this.renderPanel();
    });
    this.recipeZones.push(zone);
  }

  renderRecipes(center) {
    const recipe = this.details.recipes[this.recipeIndex % this.details.recipes.length];
    this.text(this.left + 28, 397, recipe ? 'INGREDIENTES E RESULTADO' : 'RECEITAS', 14, { color: theme.muted, letterSpacing: 1.5 });
    if (!recipe) {
      this.recipeCard(center, this.details.id, 'ITEM');
      this.text(center, 735, 'Sem receitas para este item.', 22, { color: theme.muted }).setOrigin(0.5);
      this.contentBottom = 760;
      return;
    }
    const components = [...new Set(recipe.ingredients)].map(id => ({ id, count: recipe.ingredients.filter(ingredient => ingredient === id).length }));
    const step = Math.min(210, 600 / (components.length + 1));
    const cardWidth = Math.min(152, step - 28);
    components.forEach(({ id, count }, index) => {
      const x = center + (index - components.length / 2) * step;
      this.recipeCard(x, id, count > 1 ? `INGREDIENTE ×${count}` : 'INGREDIENTE', cardWidth);
      this.text(x + step / 2, 553, index === components.length - 1 ? '→' : '+', 24, { color: theme.muted }).setOrigin(0.5);
    });
    this.recipeCard(center + components.length / 2 * step, recipe.result, 'RESULTADO', cardWidth);
    const name = id => itemCatalog.find(item => item.id === id).name;
    const rules = [ ['Encaixe', recipe.placementInstructions ?? (recipe.placement === 'adjacent' ? 'Ingredientes encostados por uma borda.' : `${name(recipe.ingredients[0])} nas estrelas de ${name(recipe.anchor)}.`)] ];
    if (recipe.extraPlacement === 'adjacent') rules.push(['Ingrediente extra', 'Cristal vital encostado na armadura.']);
    rules.push(['Quando', 'Após uma batalha completa.']);
    const consumed = recipe.ingredients.slice(1);
    rules.push(['Consome', [...new Set(consumed)].map(id => `${name(id)}${consumed.filter(entry => entry === id).length > 1 ? ` ×${consumed.filter(entry => entry === id).length}` : ''}`).join(' + ')]);
    const target = itemCatalog.find(item => item.id === recipe.ingredients[0]);
    const result = itemCatalog.find(item => item.id === recipe.result);
    if (result.width > target.width || result.height > target.height) rules.push(['Sem espaço', 'Resultado vai para a reserva.']);
    if (recipe.anchor === 'refined-iron') rules.push(['Alternar escolha', 'Solte o ferro na mesma posição.']);
    let y = 690;
    for (const [label, value] of rules) {
      this.text(this.left + 32, y, label, 14, { color: theme.muted });
      const row = this.text(this.left + 32, y + 22, value, 20, { wordWrap: { width: 576 } });
      y = row.y + row.height + 15;
    }
    this.contentBottom = y - 15;
    if (this.details.recipes.length > 1) {
      this.text(center, 1057, `${this.recipeIndex + 1} / ${this.details.recipes.length}`, 19, { color: theme.muted }).setOrigin(0.5);
      for (const direction of [-1, 1]) this.button(center + direction * 125, 1057, direction < 0 ? '‹' : '›', () => {
        this.recipeIndex = (this.recipeIndex + direction + this.details.recipes.length) % this.details.recipes.length;
        this.renderPanel();
      }, { width: 62, height: 40 });
    }
  }

  close() { this.scene.stop(); }
}
