import { theme } from '../config/theme.js';
import { packingLayout as defaultLayout } from '../config/packingLayout.js';
import ReservePanel from './ReservePanel.js';
import { rotateFootprint, getFootprintCells } from '../utils/rotation.js';
import { drawFootprint } from '../utils/drawFootprint.js';
import { getStarCells } from '../utils/itemStars.js';
import { getCombatItem } from '../data/combatItems.js';
import SellDropZone from './SellDropZone.js';
import { sellPrice } from '../data/economy.js';
import { getReadyFusions, getFusionProgress, getIronFusionChoices } from '../utils/itemFusions.js';
import { allItems } from '../data/shopCatalog.js';
import { getItemRarity } from '../data/itemRarities.js';
import { addItemArt, fitItemArt } from '../utils/itemArt.js';

export default class PackingBoardView {
  constructor(scene, board, onMessage, onInspect, onSell, onFusionStatus, { layout = defaultLayout } = {}) {
    this.scene = scene;
    this.layout = layout;
    this.pieceScale = layout.cellSize / defaultLayout.cellSize;
    this.board = board;
    this.onMessage = onMessage;
    this.onInspect = onInspect;
    this.onSell = onSell;
    this.onFusionStatus = onFusionStatus;
    this.fusionHighlights = scene.add.graphics().setDepth(4);
    this.sellZone = onSell ? new SellDropZone(scene, layout.sell) : null;
    this.views = [];
    this.grid = scene.add.graphics();
    this.drawGrid();
    this.preview = scene.add.graphics().setDepth(10);
    this.stars = scene.add.graphics().setDepth(25);
    this.reserve = new ReservePanel(scene, () => {
      if (this.dragging) return;
      this.reserve.expanded = !this.reserve.expanded;
      this.refresh();
    }, layout);

    board.bags.forEach((bag) => this.createPiece('bag', bag));
    board.items.forEach((item) => this.createPiece('item', item));
    this.refresh();
    const onSpace = (event) => {
      event.preventDefault();
      if (!event.repeat) this.rotateSelected();
    };
    scene.input.keyboard.on('keydown-SPACE', onSpace);
    this.onSpace = onSpace;
    this.onShutdown = () => this.destroy();
    scene.events.once('shutdown', this.onShutdown);
  }

  drawGrid() {
    const { x, y, cellSize } = this.layout;
    for (let row = 0; row < this.board.rows; row += 1) {
      for (let column = 0; column < this.board.columns; column += 1) {
        this.grid.fillStyle(theme.surface);
        this.grid.fillRoundedRect(x + column * cellSize + 2, y + row * cellSize + 2,
          cellSize - 4, cellSize - 4, 5);
      }
    }
  }

  createPiece(kind, piece) {
    const width = piece.width * this.layout.cellSize;
    const height = piece.height * this.layout.cellSize;
    const isBag = kind === 'bag';
    const rarity = getItemRarity(piece);
    const background = this.scene.add.rectangle(0, 0, width - 8, height - 8,
      isBag ? theme.bag : rarity.color, isBag ? 0.85 : 1)
      .setStrokeStyle(2, rarity.color, isBag ? 0.5 : 1);
    const cells = this.scene.add.graphics();
    const label = this.scene.add.text(0, 0, '', {
        fontFamily: theme.fontFamily,
        fontSize: `${(isBag ? 18 : 20) * this.pieceScale}px`,
        fontStyle: 'bold',
        color: isBag ? theme.text : theme.buttonText,
        align: 'center',
      }).setOrigin(0.5);
    const object = this.scene.add.container(0, 0, [background, cells, label]);
    const art = addItemArt(this.scene, piece, 0, 0, width - 8, height - 8);
    if (art) object.add(art);
    object.setSize(width, height).setInteractive({ useHandCursor: true });
    this.scene.input.setDraggable(object);
    const view = { kind, piece, object, background, cells, label, art, quarterTurns: 0 };
    this.views.push(view);

    object.on('pointerdown', pointer => {
      view.inspectPress = { id: pointer.id, x: pointer.x, y: pointer.y };
      view.moved = false;
      this.selected = view;
      this.refreshFusions();
      this.showStars(view);
      if (kind === 'bag' && this.board.bagHasItems(piece)) {
        this.selected = view;
        this.onMessage(this.board.getPlacementError(kind, piece.id, piece.x, piece.y));
      }
    });
    object.on('pointerup', pointer => {
      if (!this.dragging) this.stars.clear();
      this.inspectTap(view, pointer);
    });
    object.on('pointerout', () => { if (!this.dragging) this.stars.clear(); });

    object.on('dragstart', () => {
      this.dragging = view;
      this.selected = view;
      view.quarterTurns = 0;
      // Close the drawer while taking a piece out, exposing the entire board.
      if (piece.x === null) this.reserve.expanded = false;
      this.refresh();
      object.setScale(1);
      object.setDepth(20).setAlpha(0.8);
      this.showStars(view);
    });
    object.on('drag', (pointer, dragX, dragY) => {
      if (view.inspectPress && Math.hypot(pointer.x - view.inspectPress.x, pointer.y - view.inspectPress.y) >= 12) view.moved = true;
      object.setPosition(dragX, dragY);
      const worldPointer = pointer.positionToCamera(this.scene.cameras.main);
      this.sellZone?.refresh(piece, this.sellZone.contains(worldPointer));
      if (this.sellZone?.contains(worldPointer)) {
        this.preview.clear();
        this.stars.clear();
        return;
      }
      this.showPreview(view);
    });
    object.on('dragend', pointer => {
      this.finishDrag(view, pointer);
      this.inspectTap(view, pointer);
    });
  }

  inspectTap(view, pointer) {
    const press = view.inspectPress;
    view.inspectPress = null;
    if (this.onInspect && press?.id === pointer.id && !view.moved
      && Math.hypot(pointer.x - press.x, pointer.y - press.y) < 12) {
      this.scene.time.delayedCall(0, () => this.onInspect(view.piece));
    }
  }

  syncPosition(view, slots) {
    const { kind, piece, object } = view;
    if (piece.x === null) {
      const slot = slots.get(view);
      object.setPosition(slot.x, slot.y).setScale(slot.scale);
    } else {
      object.setScale(1);
      object.setPosition(
        this.layout.x + (piece.x + piece.width / 2) * this.layout.cellSize,
        this.layout.y + (piece.y + piece.height / 2) * this.layout.cellSize,
      );
    }
    object.setDepth(piece.x === null ? 7 : kind === 'bag' ? 1 : 2);
    object.setAlpha(1);
  }

  redraw(view) {
    const shape = rotateFootprint(view.piece, view.quarterTurns);
    const width = shape.width * this.layout.cellSize;
    const height = shape.height * this.layout.cellSize;
    const rarity = getItemRarity(shape);
    view.rarityColor = rarity.color;
    view.background.setSize(width - 8 * this.pieceScale, height - 8 * this.pieceScale)
      .setFillStyle(view.kind === 'bag' ? theme.bag : rarity.color, view.kind === 'bag' ? 0.85 : view.art ? 0.16 : 1)
      .setStrokeStyle((view === this.selected ? 3 : 2) * this.pieceScale, view === this.selected ? theme.accent : rarity.color);
    view.cells.clear().lineStyle(1, theme.accent, 0.35);
    view.background.setVisible(!shape.cells);
    if (shape.cells) {
      view.cells.fillStyle(rarity.color);
      drawFootprint(view.cells, shape, -width / 2, -height / 2, this.layout.cellSize, { gap: 4 * this.pieceScale });
      const middle = getFootprintCells(shape).find(cell =>
        cell.x === Math.floor((shape.width - 1) / 2) && cell.y === Math.floor((shape.height - 1) / 2))
        ?? shape.cells[0];
      view.label.setPosition((middle.x + 0.5) * this.layout.cellSize - width / 2,
        (middle.y + 0.5) * this.layout.cellSize - height / 2).setWordWrapWidth(this.layout.cellSize - 4 * this.pieceScale).setText(shape.label);
    }
    if (view.kind === 'bag') {
      for (let column = 1; column < shape.width; column += 1) {
        const x = -width / 2 + column * this.layout.cellSize;
        view.cells.lineBetween(x, -height / 2 + 4, x, height / 2 - 4);
      }
      for (let row = 1; row < shape.height; row += 1) {
        const y = -height / 2 + row * this.layout.cellSize;
        view.cells.lineBetween(-width / 2 + 4, y, width / 2 - 4, y);
      }
    }
    if (!shape.cells) view.label.setPosition(0, view.kind === 'bag' ? -height / 2 + 18 * this.pieceScale : 0)
      .setWordWrapWidth(width - 12 * this.pieceScale)
      .setText(view.kind === 'bag' ? `${shape.width}×${shape.height}`
        : `${shape.label}\n${shape.width}×${shape.height}`);
    view.object.setSize(width, height);
    if (view.art) {
      fitItemArt(view.art, shape, width - 8 * this.pieceScale, height - 8 * this.pieceScale);
      view.label.setVisible(false);
    }
    view.object.input.hitArea.setTo(0, 0, width, height);
    view.object.input.hitAreaCallback = (area, x, y) => x >= 0 && y >= 0 && x < width && y < height
      && getFootprintCells(shape).some(cell => cell.x === Math.floor(x / this.layout.cellSize)
        && cell.y === Math.floor(y / this.layout.cellSize));
  }

  rotateSelected() {
    const view = this.dragging ?? this.selected;
    if (!view) {
      this.onMessage('Selecione uma peça ou segure-a para girar.');
      return;
    }
    if (this.dragging) {
      view.quarterTurns = (view.quarterTurns + 1) % 4;
      this.redraw(view);
      this.showPreview(view);
      return;
    }
    let error;
    if (view.piece.x === null) {
      error = this.board.store(view.kind, view.piece.id, 1);
    } else {
      const shape = rotateFootprint(view.piece, 1);
      const x = Math.round(view.piece.x + (view.piece.width - shape.width) / 2);
      const y = Math.round(view.piece.y + (view.piece.height - shape.height) / 2);
      error = this.board.move(view.kind, view.piece.id, x, y, 1);
    }
    this.onMessage(error ?? 'Peça girada em 90°.');
    this.refresh();
    this.showStars(view);
  }

  getCandidate({ piece, object, quarterTurns }) {
    const shape = rotateFootprint(piece, quarterTurns);
    return {
      x: Math.round((object.x - this.layout.x) / this.layout.cellSize - shape.width / 2),
      y: Math.round((object.y - this.layout.y) / this.layout.cellSize - shape.height / 2),
    };
  }

  showPreview(view) {
    this.showStars(view);
    if (this.reserve.contains({ x: view.object.x, y: view.object.y })) {
      this.preview.clear();
      return;
    }
    const { x, y } = this.getCandidate(view);
    const shape = rotateFootprint(view.piece, view.quarterTurns);
    const error = this.board.getPlacementError(view.kind, view.piece.id, x, y, view.quarterTurns);
    this.preview.clear().lineStyle(4, error ? theme.invalid : theme.valid);
    for (const cell of getFootprintCells(shape)) {
      this.preview.strokeRect(this.layout.x + (x + cell.x) * this.layout.cellSize,
        this.layout.y + (y + cell.y) * this.layout.cellSize, this.layout.cellSize, this.layout.cellSize);
    }
  }

  showStars(view) {
    this.stars.clear();
    const stats = getCombatItem(view.piece);
    if (!(stats.triggerArmorChance || stats.weaponDamageBonus || stats.weaponDamagePerBurn || stats.weaponCooldownMultiplier || stats.fusionCatalyst || stats.starArmorInterval || stats.weaponLifeStealChance)
      || this.reserve.contains(view.object)) return;
    const position = this.dragging === view ? this.getCandidate(view) : view.piece;
    if (position.x === null) return;
    const shape = rotateFootprint(view.piece, view.quarterTurns);
    for (const cell of getStarCells({ ...shape, ...position })) {
      if (cell.x < 0 || cell.x >= this.board.columns || cell.y < 0 || cell.y >= this.board.rows) continue;
      const x = this.layout.x + (cell.x + 0.5) * this.layout.cellSize;
      const y = this.layout.y + (cell.y + 0.5) * this.layout.cellSize;
      this.stars.fillStyle(theme.accent).fillCircle(x, y, 10 * this.pieceScale);
      this.stars.lineStyle(2 * this.pieceScale, 0x101e24).strokeCircle(x, y, 10 * this.pieceScale);
    }
  }

  finishDrag(view, pointer) {
    pointer = pointer.positionToCamera(this.scene.cameras.main);
    if (this.sellZone?.contains(pointer)) {
      const value = sellPrice(view.piece);
      const error = this.onSell(view.kind, view.piece);
      this.onMessage(error ?? `${view.piece.name ?? view.piece.label} vendido por ${value} de ouro.`);
      view.inspectPress = null;
      if (!error) {
        this.views.splice(this.views.indexOf(view), 1);
        view.object.destroy();
        if (this.selected === view) this.selected = null;
      }
    } else if (this.reserve.contains(pointer)) {
      const error = this.board.store(view.kind, view.piece.id, view.quarterTurns);
      this.onMessage(error ?? (view.kind === 'bag' ? 'Mochila guardada na reserva.' : 'Item guardado na reserva.'));
    } else {
      const { x, y } = this.getCandidate(view);
      const displaced = view.kind === 'bag'
        && this.board.getDisplacedBags({ ...rotateFootprint(view.piece, view.quarterTurns), x, y }).length > 0;
      const previousFusionTarget = view.piece.fusionTargetId;
      const error = this.board.move(view.kind, view.piece.id, x, y, view.quarterTurns);
      const changedFusion = !error && view.piece.fusionTargetId && view.piece.fusionTargetId !== previousFusionTarget;
      if (changedFusion) view.inspectPress = null;
      this.onMessage(error ?? (changedFusion ? 'Fusão alterada: confira o equipamento em verde.'
        : displaced ? 'Peças substituídas guardadas na reserva.'
          : view.kind === 'bag' ? 'Mochila posicionada.' : 'Item posicionado.'));
    }
    this.preview.clear();
    this.stars.clear();
    this.dragging = null;
    this.sellZone?.refresh();
    view.quarterTurns = 0;
    this.refresh();
  }

  destroy() {
    this.scene.input.keyboard.off('keydown-SPACE', this.onSpace);
    this.scene.events.off('shutdown', this.onShutdown);
  }

  refresh() {
    // New purchases join the existing board without resetting selection or the reserve.
    for (const [kind, pieces] of [['bag', this.board.bags], ['item', this.board.items]]) {
      for (const piece of pieces) {
        if (!this.views.some(view => view.kind === kind && view.piece.id === piece.id)) this.createPiece(kind, piece);
      }
    }
    const slots = this.reserve.refresh(this.views.filter((view) => view.piece.x === null));
    this.views.forEach((view) => {
      this.redraw(view);
      const locked = view.kind === 'bag' && this.board.bagHasItems(view.piece);
      this.scene.input.setDraggable(view.object, !locked);
      view.object.input.cursor = locked ? 'default' : 'pointer';
      view.object.input.enabled = !this.dragging || this.dragging === view;
      if (view !== this.dragging) this.syncPosition(view, slots);
    });
    this.refreshFusions();
  }

  refreshFusions() {
    this.fusionHighlights.clear();
    // While dragging, the board still holds the old position. Do not advertise stale readiness.
    if (this.dragging) {
      this.onFusionStatus?.(null);
      return;
    }
    const ready = getReadyFusions(this.board.items);
    if (!this.reserve.expanded) {
      const ids = new Set(ready.flatMap(fusion => [fusion.targetId, ...fusion.consumedIds]));
      this.fusionHighlights.lineStyle(3, theme.valid);
      for (const piece of this.board.items.filter(item => ids.has(item.id))) {
        const cells = getFootprintCells(piece);
        const hasCell = (x, y) => cells.some(cell => cell.x === x && cell.y === y);
        for (const { x, y } of cells) {
          const left = this.layout.x + (piece.x + x) * this.layout.cellSize + 3;
          const top = this.layout.y + (piece.y + y) * this.layout.cellSize + 3;
          const right = left + this.layout.cellSize - 6;
          const bottom = top + this.layout.cellSize - 6;
          if (!hasCell(x - 1, y)) this.fusionHighlights.lineBetween(left, top, left, bottom);
          if (!hasCell(x + 1, y)) this.fusionHighlights.lineBetween(right, top, right, bottom);
          if (!hasCell(x, y - 1)) this.fusionHighlights.lineBetween(left, top, right, top);
          if (!hasCell(x, y + 1)) this.fusionHighlights.lineBetween(left, bottom, right, bottom);
        }
      }
    }
    const name = id => allItems.find(item => item.id === id)?.name ?? id;
    const progress = getFusionProgress(this.board.items, ready);
    const partial = progress.find(entry => entry.targetId === this.selected?.piece.id)
      ?? progress.filter(entry => entry.ingredients.some(ingredient => ingredient.count > 0))
        .sort((a, b) => b.ingredients.reduce((sum, item) => sum + item.count, 0)
          - a.ingredients.reduce((sum, item) => sum + item.count, 0))[0];
    const selectedReady = ready.find(fusion => [fusion.targetId, ...fusion.consumedIds].includes(this.selected?.piece.id));
    if (partial && !selectedReady && (partial.targetId === this.selected?.piece.id || !ready.length)) {
      const counts = partial.ingredients.map(item => `${name(item.id)}: ${item.count}/${item.required}`).join(' · ');
      this.onFusionStatus?.({ ready: false, text: `${name(partial.resultId)} · ingredientes encaixados\n${counts}` });
    } else if (ready.length) {
      const first = selectedReady ?? ready[0];
      const canAlternate = first.consumedIds.some(id => getIronFusionChoices(this.board.items, id, ready).length > 1);
      this.onFusionStatus?.({ ready: true,
        text: `Fusão pronta: ${name(first.resultId)}${ready.length > 1 ? ` (+${ready.length - 1})` : ''}\n${canAlternate
          ? 'Após a batalha · solte o ferro no lugar para alternar'
          : 'Funde após a batalha · ingredientes em verde'}` });
    } else this.onFusionStatus?.(null);
  }
}
