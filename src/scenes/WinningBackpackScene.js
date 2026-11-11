import Phaser from 'phaser';
import RoundedButton from '../components/RoundedButton.js';
import Combat from '../systems/Combat.js';
import { theme } from '../config/theme.js';
import { cloneData } from '../utils/cloneData.js';
import { getFootprintCells } from '../utils/rotation.js';
import { drawFootprint } from '../utils/drawFootprint.js';
import { getItemRarity } from '../data/itemRarities.js';
import { openItemInfo } from '../utils/openItemInfo.js';
import { formatNumber as number } from '../utils/formatNumber.js';
import { addItemArt, getItemArt } from '../utils/itemArt.js';

export default class WinningBackpackScene extends Phaser.Scene {
  constructor() { super('WinningBackpackScene'); }

  create({ session, report }) {
    this.session = session;
    this.report = report;
    if (session.runResult !== 'victory') {
      this.scene.start('RunEndScene', { session, report });
      return;
    }
    this.scale.setGameSize(720, 1280);
    this.board = cloneData(session.winningBoard ?? session.board);
    this.saving = false;
    this.text(360, 57, 'ULBRIS · JORNADA CONQUISTADA', 19, '#e7d3a9');
    this.text(360, 110, 'MOCHILA VENCEDORA', 36, theme.text, { fontStyle: 'bold' });
    this.text(360, 155, `${session.wins} vitórias · ${session.losses} derrotas · ${session.draws} empates · Rodada ${session.round}`, 20, theme.muted);

    const fighter = new Combat(this.board, { bags: [], items: [] }).fighters.player;
    this.add.rectangle(360, 222, 640, 80, theme.surface).setStrokeStyle(1, theme.accent, 0.25);
    const attributes = [['Vida máxima', fighter.maxHealth], ['Armadura inicial', fighter.armor],
      ['Estamina máxima', fighter.maxStamina], ['Resistência inicial', fighter.resistance]];
    attributes.forEach(([label, value], index) => {
      this.text(120 + index * 160, 205, label, 14, theme.muted);
      this.text(120 + index * 160, 236, number(value), 25, theme.text, { fontStyle: 'bold' });
    });
    this.drawBoard();
    this.controls = this.add.container(0, 0);
    this.backButton = new RoundedButton(this, 202, 1180, 'Voltar ao resultado', () => this.back(),
      { width: 280, height: 56, fontSize: 22, secondary: true });
    this.saveButton = new RoundedButton(this, 518, 1180, 'Salvar imagem', () => this.saveImage(),
      { width: 280, height: 56, fontSize: 22 });
    this.helpText = this.text(360, 1136, 'Toque nos itens para consultar · A formação está preservada', 17, theme.muted);
    this.controls.add([this.backButton, this.saveButton, this.helpText]);
    this.text(360, 1240, 'ULBRIS BACKPACK BATTLES', 15, theme.muted, { letterSpacing: 2 });
    this.input.keyboard.on('keydown-ESC', this.back, this);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown-ESC', this.back, this));
  }

  text(x, y, value, size, color = theme.text, options = {}) {
    return this.add.text(x, y, value, { fontFamily: theme.fontFamily, fontSize: `${size}px`, color,
      align: 'center', ...options }).setOrigin(0.5);
  }

  drawBoard() {
    const { board } = this;
    const cell = 512 / Math.max(board.columns, board.rows);
    const left = (720 - board.columns * cell) / 2, top = 278;
    const bags = board.bags.filter(piece => piece.x !== null);
    const items = board.items.filter(piece => piece.x !== null);
    const graphics = this.add.graphics();
    this.add.rectangle(360, top + board.rows * cell / 2, board.columns * cell + 24, board.rows * cell + 24, theme.surface)
      .setStrokeStyle(1, theme.accent, 0.25);
    // Put this layer above the panel created just after it.
    graphics.setDepth(1);
    for (let y = 0; y < board.rows; y++) for (let x = 0; x < board.columns; x++) {
      graphics.fillStyle(0x101e24).fillRoundedRect(left + x * cell + 1, top + y * cell + 1, cell - 2, cell - 2, 3);
    }
    for (const bag of bags) {
      graphics.fillStyle(theme.bag);
      drawFootprint(graphics, bag, left + bag.x * cell, top + bag.y * cell, cell);
      graphics.lineStyle(1, theme.accent, 0.5).strokeRect(left + bag.x * cell + 1, top + bag.y * cell + 1,
        bag.width * cell - 2, bag.height * cell - 2);
    }
    const groups = new Map();
    for (const item of items) {
      const id = item.catalogId ?? item.id;
      if (!groups.has(id)) groups.set(id, { number: groups.size + 1, name: item.name ?? item.label,
        rarity: getItemRarity(item), count: 0 });
      groups.get(id).count++;
    }
    this.itemZones = [];
    for (const item of items) {
      const x = left + item.x * cell, y = top + item.y * cell;
      const group = groups.get(item.catalogId ?? item.id);
      graphics.fillStyle(group.rarity.color, getItemArt(this, item) ? 0.16 : 0.95);
      drawFootprint(graphics, item, x, y, cell, { gap: 6 });
      const art = addItemArt(this, item, x + item.width * cell / 2, y + item.height * cell / 2,
        item.width * cell - 10, item.height * cell - 10);
      art?.setDepth(2);
      const firstCell = getFootprintCells(item)[0];
      this.text(x + (firstCell.x + 0.5) * cell, y + (firstCell.y + 0.5) * cell,
        `${group.number}`, art ? 17 : 25, art ? '#ffffff' : theme.buttonText,
        { fontStyle: 'bold', ...(art ? { stroke: '#101e24', strokeThickness: 3 } : {}) }).setDepth(3);
      const zone = this.add.zone(x + item.width * cell / 2, y + item.height * cell / 2,
        item.width * cell, item.height * cell).setDepth(3).setInteractive({ useHandCursor: true });
      zone.input.hitAreaCallback = (_area, px, py) => px >= 0 && py >= 0
        && getFootprintCells(item).some(slot => slot.x === Math.floor(px / cell) && slot.y === Math.floor(py / cell));
      zone.on('pointerdown', pointer => { zone.pressedPointer = pointer.id; });
      zone.on('pointerout', () => { zone.pressedPointer = null; });
      zone.on('pointerup', pointer => {
        if (zone.pressedPointer !== pointer.id) return;
        zone.pressedPointer = null;
        openItemInfo(this, item);
      });
      zone.catalogItem = item;
      this.itemZones.push(zone);
    }
    this.text(360, 822, `${items.length} equipamentos · ${bags.length} mochila(s) · Formação da batalha final`, 17, theme.muted);
    this.legendEntries = [...groups.values()];
    this.legendEntries.forEach((entry, index) => {
      this.add.text(48 + index % 3 * 212, 855 + Math.floor(index / 3) * 22,
        `${entry.number}. ${entry.name}${entry.count > 1 ? ` ×${entry.count}` : ''}`, {
          fontFamily: theme.fontFamily, fontSize: '15px', color: entry.rarity.cssColor,
        });
    });
  }

  back() { this.scene.start('RunEndScene', { session: this.session, report: this.report }); }

  saveImage() {
    if (this.saving) return;
    this.saving = true;
    this.controls.setVisible(false);
    const restore = () => { this.saving = false; this.controls.setVisible(true); };
    try {
      this.game.renderer.snapshot(image => {
        if (!this.sys.isActive()) return;
        restore();
        if (!image?.src) {
          this.helpText.setText('Não foi possível salvar a imagem. Você também pode tirar um print.');
          return;
        }
        const link = document.createElement('a');
        link.download = `ulbris-mochila-vencedora-rodada-${this.session.round}.png`;
        link.href = image.src;
        link.click();
      }, 'image/png');
    } catch {
      restore();
      this.helpText.setText('Não foi possível salvar a imagem. Você também pode tirar um print.');
    }
  }
}
