import { getFootprintCells } from './rotation.js';

// Coordinates are the top-left of the bounding box; holes stay transparent.
export function drawFootprint(graphics, piece, x, y, cell, { gap = 2, progress = 1 } = {}) {
  const fillTop = piece.height * cell * (1 - progress);
  for (const slot of getFootprintCells(piece)) {
    const top = Math.max(slot.y * cell + gap / 2, fillTop);
    const bottom = (slot.y + 1) * cell - gap / 2;
    if (bottom > top) graphics.fillRoundedRect(x + slot.x * cell + gap / 2, y + top,
      cell - gap, bottom - top, Math.min(2, (bottom - top) / 2));
  }
}
