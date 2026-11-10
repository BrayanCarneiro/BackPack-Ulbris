const rectangles = new Map();

export function getFootprintCells(piece) {
  if (piece.cells) return piece.cells;
  const key = `${piece.width}:${piece.height}`;
  if (!rectangles.has(key)) rectangles.set(key, Object.freeze(Array.from({ length: piece.width * piece.height }, (_, index) =>
    Object.freeze({ x: index % piece.width, y: Math.floor(index / piece.width) }))));
  return rectangles.get(key);
}

export function occupiesCell(piece, x, y) {
  if (piece.x === null || piece.y === null || x < piece.x || y < piece.y
    || x >= piece.x + piece.width || y >= piece.y + piece.height) return false;
  return !piece.cells || piece.cells.some(cell => piece.x + cell.x === x && piece.y + cell.y === y);
}

export function rotateFootprint(piece, quarterTurns = 0) {
  const swapDimensions = Math.abs(quarterTurns % 2) === 1;
  let cells = piece.cells;
  let width = piece.width, height = piece.height;
  for (let turn = 0; cells && turn < ((quarterTurns % 4) + 4) % 4; turn++) {
    cells = cells.map(cell => ({ x: height - 1 - cell.y, y: cell.x }));
    [width, height] = [height, width];
  }
  return {
    ...piece,
    ...(cells ? { cells } : {}),
    width: swapDimensions ? piece.height : piece.width,
    height: swapDimensions ? piece.width : piece.height,
    rotation: ((piece.rotation ?? 0) + quarterTurns * 90) % 360,
  };
}
