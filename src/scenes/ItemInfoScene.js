import Phaser from 'phaser';
import TextButton from '../components/TextButton.js';
import MenuBackButton from '../components/MenuBackButton.js';
import { theme } from '../config/theme.js';
import { getItemDetails, itemCatalog } from '../utils/itemDetails.js';
import { drawFootprint } from '../utils/drawFootprint.js';
import { getFootprintCells } from '../utils/rotation.js';

export default class ItemInfoScene extends Phaser.Scene {
  constructor() {
    super('ItemInfoScene');
  }

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

  renderPanel() {
    this.children.removeAll(true);
    this.details = getItemDetails(this.item);
    if (!this.details) { this.close(); return; }
    const center = this.scale.width / 2;
    this.left = center - 320;
    this.add.rectangle(0, 0, this.scale.width, 1280, 0x080f13, 0.88).setOrigin(0).setInteractive();
    this.add.rectangle(center, 640, 640, 1100, theme.surface).setStrokeStyle(2, theme.accent, 0.5).setInteractive();
    new MenuBackButton(this, { onBack: () => {
      this.scene.stop(this.sourceKey);
      this.scene.start('LobbyScene');
    } });
    this.text(this.left + 30, 125, this.recipesVisible ? 'RECEITAS DO ITEM' : 'INFORMAÇÕES DO ITEM', 17, { color: theme.muted });
    this.recipeButton = new TextButton(this, center + 224, 145, '★ Receitas', () => {
      this.recipesVisible = !this.recipesVisible;
      this.renderPanel();
    }, { width: 142, height: 48, fontSize: 19 });
    this.text(center, 211, this.details.name, 32, {
      fontStyle: 'bold', align: 'center', wordWrap: { width: 560 },
    }).setOrigin(0.5);
    const { piece } = this.details;
    this.text(center, 260, `${this.details.kind === 'bag' ? 'Mochila' : 'Equipamento'} · ${piece.cells ? `${getFootprintCells(piece).length} espaços · ` : ''}${piece.width}×${piece.height} slots`, 20,
      { color: theme.muted }).setOrigin(0.5);
    const { itemClass } = this.details;
    this.text(center, 289, `Classe: ${itemClass.symbol} — ${itemClass.name}`, 19,
      { color: theme.muted }).setOrigin(0.5);
    this.drawFootprint(center, 329, piece, 20);
    if (this.recipesVisible) this.renderRecipes(center);
    else this.renderDetails();
    new TextButton(this, center, 1140, 'Fechar', () => this.close(),
      { width: 300, height: 58, fontSize: 23 });
  }

  drawFootprint(x, y, piece, maxCell) {
    const cell = Math.min(maxCell, 100 / piece.width, 68 / piece.height);
    const graphics = this.add.graphics();
    graphics.fillStyle(piece.kind === 'bag' ? theme.bag : theme.accent);
    drawFootprint(graphics, piece, x - piece.width * cell / 2, y - piece.height * cell / 2, cell);
  }

  renderDetails() {
    const { attributes, effects } = this.details;
    this.text(this.left + 30, 365, 'ATRIBUTOS', 18, { color: theme.muted });
    if (!attributes.length) this.text(this.left + 30, 410, 'Sem bônus de atributos.', 23);
    attributes.forEach(([label, value], index) => {
      const x = this.left + 30 + (index % 2) * 300;
      const y = 405 + Math.floor(index / 2) * 65;
      this.text(x, y, label, 16, { color: theme.muted });
      this.text(x, y + 23, value, 24, { fontStyle: 'bold' });
    });
    this.text(this.left + 30, 620, 'PASSIVAS E EFEITOS', 18, { color: theme.muted });
    let y = 660;
    for (const effect of effects) {
      const line = this.text(this.left + 30, y, `• ${effect}`, 21, { wordWrap: { width: 580 }, lineSpacing: 5 });
      y += line.height + 14;
    }
  }

  recipeCard(x, id, role) {
    const item = itemCatalog.find(entry => entry.id === id);
    this.add.rectangle(x, 553, 152, 220, 0x101e24)
      .setStrokeStyle(id === this.details.id ? 2 : 1, theme.accent, id === this.details.id ? 1 : 0.4);
    this.text(x, 461, role, 13, { color: theme.muted }).setOrigin(0.5);
    this.drawFootprint(x, 520, item, 20);
    this.text(x, 578, item.name, 20, {
      align: 'center', wordWrap: { width: 132 }, lineSpacing: 4,
    }).setOrigin(0.5, 0);
    const zone = this.add.zone(x, 553, 152, 220).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', pointer => { zone.pressedPointer = pointer.id; });
    zone.on('pointerout', () => { zone.pressedPointer = null; });
    zone.on('pointerup', pointer => {
      if (zone.pressedPointer !== pointer.id) return;
      this.item = item;
      this.recipesVisible = false;
      this.recipeIndex = 0;
      this.renderPanel();
    });
  }

  renderRecipes(center) {
    const recipe = this.details.recipes[this.recipeIndex % this.details.recipes.length];
    this.text(center, 391, recipe ? 'COMPONENTES → RESULTADO' : 'ESTE ITEM', 18,
      { color: theme.muted }).setOrigin(0.5);
    if (recipe) {
      this.recipeCard(center - 210, recipe.ingredients[0], 'COMPONENTE');
      this.text(center - 105, 553, '+', 30, { color: theme.muted }).setOrigin(0.5);
      this.recipeCard(center, recipe.ingredients[1], 'COMPONENTE');
      this.text(center + 105, 553, '=', 30, { color: theme.muted }).setOrigin(0.5);
      this.recipeCard(center + 210, recipe.result, 'RESULTADO');
      this.text(center, 744, recipe.instructions, 23, {
        align: 'center', wordWrap: { width: 550 }, lineSpacing: 8,
      }).setOrigin(0.5, 0);
      this.text(center, 927, 'Toque em um item para ver seus atributos.', 18,
        { color: theme.muted }).setOrigin(0.5);
      if (this.details.recipes.length > 1) {
        this.text(center, 980, `Receita ${this.recipeIndex + 1}/${this.details.recipes.length}`, 20,
          { color: theme.muted }).setOrigin(0.5);
        for (const direction of [-1, 1]) {
          new TextButton(this, center + direction * 180, 980, direction < 0 ? '‹' : '›', () => {
            this.recipeIndex = (this.recipeIndex + direction + this.details.recipes.length) % this.details.recipes.length;
            this.renderPanel();
          }, { width: 70, height: 44, fontSize: 28 });
        }
      }
    } else {
      this.recipeCard(center, this.details.id, 'ITEM');
      this.text(center, 755, 'Este item não possui receitas.', 24,
        { color: theme.muted }).setOrigin(0.5);
    }
    new TextButton(this, center, 1045, 'Voltar aos atributos', () => {
      this.recipesVisible = false;
      this.renderPanel();
    }, { width: 360, height: 50, fontSize: 22 });
  }

  close() {
    this.scene.stop();
    this.scene.resume(this.sourceKey);
  }
}
