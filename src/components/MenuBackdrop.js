import { theme } from '../config/theme.js';

export default function addMenuBackdrop(scene) {
  return scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height,
    Number.parseInt(theme.background.slice(1), 16)).setOrigin(0);
}

export function addDivider(scene, x, y, width = 300) {
  const g = scene.add.graphics().lineStyle(1, theme.accent, 0.28);
  g.lineBetween(x - width / 2, y, x - 14, y).lineBetween(x + 14, y, x + width / 2, y);
  g.fillStyle(theme.accent, 0.8).fillPoints([
    { x, y: y - 4 }, { x: x + 4, y }, { x, y: y + 4 }, { x: x - 4, y },
  ], true);
  return g;
}
