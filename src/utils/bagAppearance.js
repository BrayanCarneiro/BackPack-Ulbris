export function getBagAppearance(piece) {
  return (piece.catalogId ?? piece.id) === 'pouch'
    ? { fill: 0xb9bec4, border: 0x505860 }
    : { fill: 0xc49a70, border: 0x62432e };
}

// Bags show usable cells and their actual proportions, including in previews.
export function drawBag(graphics, piece, x, y, cell) {
  const { fill, border } = getBagAppearance(piece);
  const width = piece.width * cell, height = piece.height * cell;
  const inset = Math.min(2, cell * 0.08);
  graphics.fillStyle(fill).fillRoundedRect(x + inset, y + inset,
    width - inset * 2, height - inset * 2, Math.min(3, cell / 5));
  graphics.lineStyle(1, border, 0.45);
  for (let column = 1; column < piece.width; column++) {
    graphics.lineBetween(x + column * cell, y + inset, x + column * cell, y + height - inset);
  }
  for (let row = 1; row < piece.height; row++) {
    graphics.lineBetween(x + inset, y + row * cell, x + width - inset, y + row * cell);
  }
  graphics.lineStyle(Math.min(3, Math.max(1, cell / 8)), border)
    .strokeRoundedRect(x + inset, y + inset, width - inset * 2, height - inset * 2, Math.min(3, cell / 5));
  return graphics;
}
