import { theme } from '../config/theme.js';
import { packingLayout as layout } from '../config/packingLayout.js';
import ReservePanel from './ReservePanel.js';
import { rotateFootprint } from '../utils/rotation.js';
import { getStarCells } from '../utils/itemStars.js';
import { getCombatItem } from '../data/combatItems.js';

export default class PackingBoardView {
  constructor(scene, board, onMessage, onInspect) {
    this.scene = scene;
    this.board = board;
    this.onMessage = onMessage;
    this.onInspect = onInspect;
    this.views = [];
    this.grid = scene.add.graphics();
    this.drawGrid();
    this.preview = scene.add.graphics().setDepth(10);
    this.stars = scene.add.graphics().setDepth(25);
    this.reserve = new ReservePanel(scene, () => {
      if (this.dragging) return;
      this.reserve.expanded = !this.reserve.expanded;
      this.refresh();
    });

    board.bags.forEach((bag) => this.createPiece('bag', bag));
    board.items.forEach((item) => this.createPiece('item', item));
    this.refresh();
    const onSpace = (event) => {
      event.preventDefault();
      if (!event.repeat) this.rotateSelected();
    };
    scene.input.keyboard.on('keydown-SPACE', onSpace);
    scene.events.once('shutdown', () => scene.input.keyboard.off('keydown-SPACE', onSpace));
  }

  drawGrid() {
    const { x, y, cellSize } = layout;
    for (let row = 0; row < this.board.rows; row += 1) {
      for (let column = 0; column < this.board.columns; column += 1) {
        this.grid.fillStyle(theme.surface);
        this.grid.fillRoundedRect(x + column * cellSize + 2, y + row * cellSize + 2,
          cellSize - 4, cellSize - 4, 5);
      }
    }
  }

  createPiece(kind, piece) {
    const width = piece.width * layout.cellSize;
    const height = piece.height * layout.cellSize;
    const isBag = kind === 'bag';
    const background = this.scene.add.rectangle(0, 0, width - 8, height - 8,
      isBag ? theme.bag : theme.accent, isBag ? 0.85 : 1)
      .setStrokeStyle(2, theme.accent, isBag ? 0.5 : 1);
    const cells = this.scene.add.graphics();
    const label = this.scene.add.text(0, 0, '', {
        fontFamily: theme.fontFamily,
        fontSize: isBag ? '18px' : '20px',
        fontStyle: 'bold',
        color: isBag ? theme.text : theme.buttonText,
        align: 'center',
      }).setOrigin(0.5);
    const object = this.scene.add.container(0, 0, [background, cells, label]);
    object.setSize(width, height).setInteractive({ useHandCursor: true });
    this.scene.input.setDraggable(object);
    const view = { kind, piece, object, background, cells, label, quarterTurns: 0 };
    this.views.push(view);

    object.on('pointerdown', pointer => {
      view.inspectPress = { id: pointer.id, x: pointer.x, y: pointer.y };
      view.moved = false;
      this.selected = view;
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
        layout.x + (piece.x + piece.width / 2) * layout.cellSize,
        layout.y + (piece.y + piece.height / 2) * layout.cellSize,
      );
    }
    object.setDepth(piece.x === null ? 7 : kind === 'bag' ? 1 : 2);
    object.setAlpha(1);
  }

  redraw(view) {
    const shape = rotateFootprint(view.piece, view.quarterTurns);
    const width = shape.width * layout.cellSize;
    const height = shape.height * layout.cellSize;
    view.background.setSize(width - 8, height - 8)
      .setStrokeStyle(view === this.selected ? 3 : 2, theme.accent);
    view.cells.clear().lineStyle(1, theme.accent, 0.35);
    if (view.kind === 'bag') {
      for (let column = 1; column < shape.width; column += 1) {
        const x = -width / 2 + column * layout.cellSize;
        view.cells.lineBetween(x, -height / 2 + 4, x, height / 2 - 4);
      }
      for (let row = 1; row < shape.height; row += 1) {
        const y = -height / 2 + row * layout.cellSize;
        view.cells.lineBetween(-width / 2 + 4, y, width / 2 - 4, y);
      }
    }
    view.label.setPosition(0, view.kind === 'bag' ? -height / 2 + 18 : 0)
      .setWordWrapWidth(width - 12)
      .setText(view.kind === 'bag' ? `${shape.width}×${shape.height}`
        : `${shape.label}\n${shape.width}×${shape.height}`);
    view.object.setSize(width, height);
    view.object.input.hitArea.setTo(0, 0, width, height);
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
      x: Math.round((object.x - layout.x) / layout.cellSize - shape.width / 2),
      y: Math.round((object.y - layout.y) / layout.cellSize - shape.height / 2),
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
    this.preview.strokeRect(layout.x + x * layout.cellSize, layout.y + y * layout.cellSize,
      shape.width * layout.cellSize, shape.height * layout.cellSize);
  }

  showStars(view) {
    this.stars.clear();
    const stats = getCombatItem(view.piece);
    if (!(stats.triggerArmorChance || stats.weaponDamageBonus || stats.weaponCooldownMultiplier)
      || this.reserve.contains(view.object)) return;
    const position = this.dragging === view ? this.getCandidate(view) : view.piece;
    if (position.x === null) return;
    const shape = rotateFootprint(view.piece, view.quarterTurns);
    for (const cell of getStarCells({ ...shape, ...position })) {
      if (cell.x < 0 || cell.x >= this.board.columns || cell.y < 0 || cell.y >= this.board.rows) continue;
      const x = layout.x + (cell.x + 0.5) * layout.cellSize;
      const y = layout.y + (cell.y + 0.5) * layout.cellSize;
      this.stars.fillStyle(theme.accent).fillCircle(x, y, 10);
      this.stars.lineStyle(2, 0x101e24).strokeCircle(x, y, 10);
    }
  }

  finishDrag(view, pointer) {
    if (this.reserve.contains(pointer)) {
      const error = this.board.store(view.kind, view.piece.id, view.quarterTurns);
      this.onMessage(error ?? (view.kind === 'bag' ? 'Mochila guardada na reserva.' : 'Item guardado na reserva.'));
    } else {
      const { x, y } = this.getCandidate(view);
      const displaced = view.kind === 'bag'
        && this.board.getDisplacedBags({ ...rotateFootprint(view.piece, view.quarterTurns), x, y }).length > 0;
      const error = this.board.move(view.kind, view.piece.id, x, y, view.quarterTurns);
      this.onMessage(error ?? (displaced ? 'Peças substituídas guardadas na reserva.'
        : view.kind === 'bag' ? 'Mochila posicionada.' : 'Item posicionado.'));
    }
    this.preview.clear();
    this.stars.clear();
    this.dragging = null;
    view.quarterTurns = 0;
    this.refresh();
  }

  refresh() {
    const slots = this.reserve.refresh(this.views.filter((view) => view.piece.x === null));
    this.views.forEach((view) => {
      this.redraw(view);
      const locked = view.kind === 'bag' && this.board.bagHasItems(view.piece);
      this.scene.input.setDraggable(view.object, !locked);
      view.object.input.cursor = locked ? 'default' : 'pointer';
      view.object.input.enabled = !this.dragging || this.dragging === view;
      if (view !== this.dragging) this.syncPosition(view, slots);
    });
  }
}
