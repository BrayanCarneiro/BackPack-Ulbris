import Phaser from 'phaser';
import TextButton from '../components/TextButton.js';
import RoundedButton from '../components/RoundedButton.js';
import MenuBackButton from '../components/MenuBackButton.js';
import { theme } from '../config/theme.js';
import { itemCatalog, getItemDetails } from '../utils/itemDetails.js';
import { openItemInfo } from '../utils/openItemInfo.js';
import { drawFootprint } from '../utils/drawFootprint.js';
import { catalogTypes, filterCatalog, getCatalogType } from '../utils/catalogFilters.js';
import { itemRarities } from '../data/itemRarities.js';
import { addItemArt } from '../utils/itemArt.js';

export default class ItemCatalogScene extends Phaser.Scene {
  constructor() {
    super('ItemCatalogScene');
  }

  create() {
    this.page = 0;
    this.typeFilter = 'all';
    this.rarityFilter = 'all';
    this.sortBy = 'type';
    this.nameDirection = 'asc';
    this.filterMenu = null;
    this.renderCatalog();
    const back = () => this.filterMenu ? this.closeFilterMenu() : this.scene.start('LobbyScene');
    this.input.keyboard.on('keydown-ESC', back);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown-ESC', back));
  }

  renderCatalog() {
    this.closeFilterMenu();
    this.children.removeAll(true);
    new MenuBackButton(this);
    const textStyle = { fontFamily: theme.fontFamily, color: theme.text, align: 'center' };
    this.add.text(360, 80, 'ITENS', { ...textStyle, fontSize: '42px', fontStyle: 'bold' }).setOrigin(0.5);
    const filtered = filterCatalog(itemCatalog, { type: this.typeFilter, rarity: this.rarityFilter,
      sort: this.sortBy, direction: this.nameDirection });
    this.filteredItems = filtered;
    const order = { type: 'Tipo', name: this.nameDirection === 'asc' ? 'Nome A–Z' : 'Nome Z–A', rarity: 'Raridade' }[this.sortBy];
    this.add.text(360, 145, `${filtered.length} de ${itemCatalog.length} itens · Ordem: ${order}`, {
      ...textStyle, fontSize: '20px', color: theme.muted,
    }).setOrigin(0.5);
    this.typeButton = new RoundedButton(this, 152, 205,
      `Tipo: ${catalogTypes.find(type => type.id === this.typeFilter)?.name ?? 'Todos'} ▾`, () => this.openFilterMenu('type'),
      { width: 192, height: 46, fontSize: 18, secondary: this.sortBy !== 'type' });
    this.nameButton = new RoundedButton(this, 360, 205, `Nome: ${this.nameDirection === 'asc' ? 'A–Z' : 'Z–A'}`, () => {
      this.nameDirection = this.sortBy === 'name' && this.nameDirection === 'asc' ? 'desc' : 'asc';
      this.sortBy = 'name';this.page = 0;this.renderCatalog();
    }, { width: 192, height: 46, fontSize: 18, secondary: this.sortBy !== 'name' });
    this.rarityButton = new RoundedButton(this, 568, 205,
      `Raridade: ${itemRarities[this.rarityFilter]?.name ?? 'Todas'} ▾`, () => this.openFilterMenu('rarity'),
      { width: 192, height: 46, fontSize: 18, secondary: this.sortBy !== 'rarity' });

    const pageSize = 12;
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    this.page = Math.min(Math.max(0, this.page), pages - 1);
    this.itemZones = [];
    filtered.slice(this.page * pageSize, (this.page + 1) * pageSize).forEach((item, index) => {
      const x = 152 + index % 3 * 208;
      const y = 320 + Math.floor(index / 3) * 170;
      const { itemClass, rarity } = getItemDetails(item);
      const card = this.add.rectangle(x, y, 192, 154, theme.surface)
        .setStrokeStyle(1, rarity.color, 0.65);
      const cell = Math.min(12, 72 / item.width, 36 / item.height);
      const graphics = this.add.graphics().fillStyle(rarity.color);
      drawFootprint(graphics, item, x - item.width * cell / 2, y - 49 - item.height * cell / 2, cell);
      if (addItemArt(this, item, x, y - 43, 68, 58)) graphics.setVisible(false);
      this.add.text(x, y + 2, item.name, {
        ...textStyle, fontSize: '20px', wordWrap: { width: 174 }, color: rarity.cssColor,
      }).setOrigin(0.5);
      this.add.text(x, y + 53, `${itemClass.symbol} · ${rarity.name} · ${item.width}×${item.height}`, {
        ...textStyle, fontSize: '14px', color: rarity.cssColor,
      }).setOrigin(0.5);
      const zone = this.add.zone(x, y, 192, 154).setInteractive({ useHandCursor: true });
      this.itemZones.push(zone);
      zone.catalogItem = item;
      zone.on('pointerover', () => card.setStrokeStyle(2, rarity.color, 0.95));
      zone.on('pointerdown', pointer => { zone.pressedPointer = pointer.id; });
      zone.on('pointerout', () => {
        zone.pressedPointer = null;
        card.setStrokeStyle(1, rarity.color, 0.65);
      });
      zone.on('pointerup', pointer => {
        if (zone.pressedPointer !== pointer.id) return;
        zone.pressedPointer = null;
        openItemInfo(this, item);
      });
    });
    if (!filtered.length) this.add.text(360, 530, 'Nenhum item com esses filtros.\nUse “Limpar filtros” para ver todos.', {
      ...textStyle, fontSize: '23px', color: theme.muted, lineSpacing: 12,
    }).setOrigin(0.5);
    this.resetButton = new RoundedButton(this, 360, 970, 'Limpar filtros', () => {
      this.typeFilter = 'all';this.rarityFilter = 'all';this.sortBy = 'type';this.nameDirection = 'asc';
      this.page = 0;this.renderCatalog();
    }, { width: 208, height: 42, fontSize: 18, secondary: true });
    this.add.text(360, 1035, `Página ${filtered.length ? this.page + 1 : 0}/${filtered.length ? pages : 0}`, {
      ...textStyle, fontSize: '22px', color: theme.muted,
    }).setOrigin(0.5);
    this.pageButtons = [-1, 1].map(direction =>
      new RoundedButton(this, 360 + direction * 210, 1035, direction < 0 ? '‹ Anterior' : 'Próxima ›', () => {
        this.page = (this.page + direction + pages) % pages;
        this.renderCatalog();
      }, { width: 175, height: 50, fontSize: 21, secondary: true }).setEnabled(pages > 1));
    new TextButton(this, 360, 1160, 'Voltar', () => this.scene.start('LobbyScene'), { height: 62, fontSize: 24 });
  }

  closeFilterMenu() {
    this.filterMenu?.destroy(true);
    this.filterMenu = null;
  }

  openFilterMenu(kind) {
    this.closeFilterMenu();
    const type = kind === 'type';
    const availableTypes = catalogTypes.filter(type => itemCatalog.some(item => getCatalogType(item) === type.id));
    const choices = type ? [{ id: 'all', name: 'Todos · por tipo' }, ...availableTypes]
      : [{ id: 'all', name: 'Todas · por raridade' }, ...Object.entries(itemRarities).map(([id, rarity]) => ({ id, name: rarity.name }))];
    const x = type ? 152 : 568, top = 239;
    const menu = this.add.container(0, 0).setDepth(30);
    this.filterMenu = menu;
    const backdrop = this.add.rectangle(360, 640, 720, 1280, 0x000000, 0.35).setInteractive();
    backdrop.on('pointerup', () => this.closeFilterMenu());
    menu.add(backdrop);
    menu.add(this.add.rectangle(x, top + (choices.length * 46 + 16) / 2, 224, choices.length * 46 + 16, theme.surface)
      .setStrokeStyle(1, theme.accent, 0.5));
    this.filterOptions = choices.map((choice, index) => {
      const selected = choice.id === (type ? this.typeFilter : this.rarityFilter);
      const button = new RoundedButton(this, x, top + 31 + index * 46, choice.name, () => {
        if (type) this.typeFilter = choice.id;
        else this.rarityFilter = choice.id;
        this.sortBy = kind;this.nameDirection = 'asc';this.page = 0;
        this.renderCatalog();
      }, { width: 208, height: 42, fontSize: 18, secondary: !selected });
      button.filterValue = choice.id;
      menu.add(button);
      return button;
    });
  }
}
