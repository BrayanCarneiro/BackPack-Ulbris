import { theme } from '../config/theme.js';
import { getCombatItem } from '../data/combatItems.js';
import { getFootprintCells } from '../utils/rotation.js';
import { drawFootprint } from '../utils/drawFootprint.js';

// A read-only view: the player's purchased pieces keep their exact arrangement.
export default class BattleBackpack {
  constructor(scene, x, board, title, { width = 188, top = 411, gridSize = 160, onInspect } = {}) {
    this.scene = scene;
    const height = gridSize + 290;
    scene.add.rectangle(x + width / 2, top + height / 2, width, height, theme.surface)
      .setStrokeStyle(1, theme.accent, 0.3);
    scene.add.text(x + width / 2, top + 38, title, {
      fontFamily: theme.fontFamily, fontSize: gridSize > 160 ? '25px' : '17px', fontStyle: 'bold', color: theme.text,
    }).setOrigin(0.5);
    scene.add.text(x + width / 2, top + 72, 'EQUIPAMENTOS', {
      fontFamily: theme.fontFamily, fontSize: gridSize > 160 ? '17px' : '13px', color: theme.muted, letterSpacing: 1,
    }).setOrigin(0.5);

    const cell = Math.min(gridSize / board.columns, gridSize / board.rows);
    const left = x + (width - board.columns * cell) / 2;
    const gridTop = top + 125;
    const graphics = scene.add.graphics();
    for (let row = 0; row < board.rows; row += 1) {
      for (let column = 0; column < board.columns; column += 1) {
        graphics.fillStyle(0x101e24);
        graphics.fillRoundedRect(left + column * cell + 1, gridTop + row * cell + 1, cell - 2, cell - 2, 2);
      }
    }
    const bags = board.bags.filter(piece => piece.x !== null);
    const items = board.items.filter(piece => piece.x !== null);
    for (const bag of bags) {
      const bx = left + bag.x * cell, by = gridTop + bag.y * cell;
      graphics.fillStyle(theme.bag);
      graphics.fillRoundedRect(bx + 1, by + 1, bag.width * cell - 2, bag.height * cell - 2, 3);
      graphics.lineStyle(1, theme.accent, 0.5);
      graphics.strokeRoundedRect(bx + 1, by + 1, bag.width * cell - 2, bag.height * cell - 2, 3);
      graphics.lineStyle(1, theme.accent, 0.16);
      for (let c = 1; c < bag.width; c += 1) {
        graphics.lineBetween(bx + c * cell, by + 2, bx + c * cell, by + bag.height * cell - 2);
      }
      for (let r = 1; r < bag.height; r += 1) {
        graphics.lineBetween(bx + 2, by + r * cell, bx + bag.width * cell - 2, by + r * cell);
      }
    }
    this.itemViews = items.map((item, index) => {
      const ix = left + item.x * cell, iy = gridTop + item.y * cell;
      const itemWidth = item.width * cell - 4, itemHeight = item.height * cell - 4;
      const hasCooldown = Boolean(getCombatItem(item).cooldown);
      const shapeGraphic = color => {
        const graphics = scene.add.graphics().fillStyle(color);
        drawFootprint(graphics, item, -item.width * cell / 2, -item.height * cell / 2, cell, { gap: 4 });
        return graphics;
      };
      const background = item.cells ? shapeGraphic(hasCooldown ? 0x687174 : theme.accent)
        : scene.add.rectangle(0, 0, itemWidth, itemHeight, hasCooldown ? 0x687174 : theme.accent);
      const colorFill = item.cells && hasCooldown ? scene.add.graphics()
        : hasCooldown ? scene.add.rectangle(0, itemHeight / 2, itemWidth, itemHeight, theme.accent)
        .setOrigin(0.5, 1).setScale(1, 0) : null;
      const extraFlash = (item.cells ? shapeGraphic(theme.extraAttack)
        : scene.add.rectangle(0, 0, itemWidth, itemHeight, theme.extraAttack)).setAlpha(0);
      const label = scene.add.text(0, 0, String(index + 1), {
        fontFamily: theme.fontFamily, fontSize: gridSize > 160 ? '23px' : '14px', fontStyle: 'bold', color: theme.buttonText,
      }).setOrigin(0.5);
      if (item.cells) {
        const middle = getFootprintCells(item).find(slot => slot.x === Math.floor((item.width - 1) / 2)
          && slot.y === Math.floor((item.height - 1) / 2)) ?? item.cells[0];
        label.setPosition((middle.x + 0.5 - item.width / 2) * cell,
          (middle.y + 0.5 - item.height / 2) * cell);
      }
      const object = scene.add.container(ix + item.width * cell / 2, iy + item.height * cell / 2,
        [background, ...(colorFill ? [colorFill] : []), extraFlash, label]);
      if (onInspect) {
        object.setSize(itemWidth, itemHeight).setInteractive({ useHandCursor: true });
        if (item.cells) {
          object.setSize(item.width * cell, item.height * cell);
          object.input.hitArea.setTo(0, 0, item.width * cell, item.height * cell);
          object.input.hitAreaCallback = (area, x, y) => getFootprintCells(item).some(slot =>
            slot.x === Math.floor(x / cell) && slot.y === Math.floor(y / cell));
        }
        object.on('pointerdown', pointer => { object.pressedPointer = pointer.id; });
        object.on('pointerout', () => { object.pressedPointer = null; });
        object.on('pointerup', pointer => {
          if (object.pressedPointer === pointer.id) onInspect(item);
        });
      }
      object.once('destroy', () => scene.tweens.killTweensOf([object, extraFlash]));
      return { item, object, background, colorFill, extraFlash, label, cell };
    });
    scene.add.text(x + width / 2, gridTop + gridSize + 31, `${bags.length} mochila(s) · ${items.length} item(ns)`, {
      fontFamily: theme.fontFamily, fontSize: gridSize > 160 ? '20px' : '14px', color: theme.muted,
    }).setOrigin(0.5);
    this.legend = scene.add.text(x + 20, gridTop + gridSize + 63, items.map((item, i) => `${i + 1}. ${item.label}`).join('\n'), {
      fontFamily: theme.fontFamily, fontSize: gridSize > 160 ? '23px' : '17px', color: theme.text,
      wordWrap: { width: width - 28 }, lineSpacing: 7,
    });
  }

  refresh(fighter, time) {
    const consumed = new Set(fighter.potions.filter(potion => potion.consumed).map(potion => potion.id));
    const weapons = new Map(fighter.weapons.map(weapon => [weapon.id, weapon]));
    this.itemViews.forEach(({ item, background, colorFill, label, cell }) => {
      background.setAlpha(consumed.has(item.id) ? 0.25 : 1);
      label.setAlpha(consumed.has(item.id) ? 0.4 : 1);
      const weapon = weapons.get(item.id);
      if (colorFill && weapon) {
        const progress = Math.max(0, Math.min(1,
          1 - (weapon.readyAt - Math.max(time, fighter.stunnedUntil ?? 0)) / weapon.cooldown));
        if (item.cells) {
          colorFill.clear().fillStyle(theme.accent);
          drawFootprint(colorFill, item, -item.width * cell / 2, -item.height * cell / 2, cell, { gap: 4, progress });
        } else colorFill.setScale(1, progress);
      }
    });
    const rows = this.itemViews.map(({ item }, i) =>
      `${i + 1}. ${item.label}${consumed.has(item.id) ? ' (usada)' : ''}`);
    this.legend.setText((rows.length > 3 ? [...rows.slice(0, 2), `+ ${rows.length - 2} equipamentos`] : rows).join('\n'));
  }

  activate(itemId, { extra = false } = {}) {
    const view = this.itemViews.find(({ item }) => item.id === itemId);
    if (!view) return;
    const { object, extraFlash } = view;
    if (extra) {
      this.scene.tweens.killTweensOf(extraFlash);
      extraFlash.setAlpha(1);
      this.scene.tweens.add({
        targets: extraFlash, alpha: 0, duration: 180, ease: 'Sine.easeIn',
      });
    }
    this.scene.tweens.killTweensOf(object);
    object.setScale(1).setDepth(2);
    this.scene.tweens.add({
      targets: object, scaleX: 1.12, scaleY: 1.12, duration: 120,
      ease: 'Sine.easeOut', yoyo: true,
      onComplete: () => object.setScale(1).setDepth(0),
    });
  }
}
