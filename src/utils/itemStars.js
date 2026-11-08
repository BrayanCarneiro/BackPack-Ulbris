export const catalogId = piece => piece.catalogId ?? piece.id;

export function getStarCells(piece) {
  const rotation = ((piece.rotation ?? 0) % 180 + 180) % 180;
  if (rotation === 90) {
    return [{ x: piece.x, y: piece.y - 1 }, { x: piece.x, y: piece.y + piece.height }];
  }
  return [{ x: piece.x - 1, y: piece.y }, { x: piece.x + piece.width, y: piece.y }];
}

export function getStarTargets(piece, items) {
  if (piece.x === null) return [];
  return items.filter(item => item.id !== piece.id && item.x !== null
    && getStarCells(piece).some(cell => cell.x >= item.x && cell.x < item.x + item.width
      && cell.y >= item.y && cell.y < item.y + item.height));
}
