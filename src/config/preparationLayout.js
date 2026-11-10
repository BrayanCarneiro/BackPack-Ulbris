export function getPreparationLayout(viewportWidth, viewportHeight) {
  const wide = viewportWidth >= 1000 && viewportWidth / viewportHeight >= 1.15;
  const width = wide ? Math.min(2560, Math.max(1560, Math.round(1280 * viewportWidth / viewportHeight))) : 720;
  const offset = (width - 1560) / 2;
  const boardX = wide ? offset + 826 : 32;
  const cellSize = wide ? 72 : 36;
  const boardWidth = cellSize * 8;
  const board = {
    x: boardX, y: wide ? 284 : 980, cellSize,
    tray: { x: wide ? boardX : 352, y: wide ? 996 : 1036, width: wide ? boardWidth : 336, height: wide ? 156 : 232 },
    expandedTray: { x: boardX, y: wide ? 668 : 1036, width: wide ? boardWidth : 656, height: wide ? 484 : 232 },
    sell: wide ? { x: boardX + boardWidth + 50, y: 1006, width: 100, height: 146 }
      : { x: 352, y: 1290, width: 336, height: 52, compact: true },
  };
  return {
    wide, width, height: wide ? 1280 : 1530, board,
    shopX: wide ? offset + 352 : 360,
    offerY: wide ? 340 : 286,
    offersPerPage: 6,
    boardCenter: boardX + boardWidth / 2,
    boardTitleY: wide ? 210 : 886,
    fusionY: wide ? 248 : 942,
    controlsY: wide ? 900 : 886,
    rerollY: wide ? 896 : 820,
    messageY: wide ? 1198 : 1390,
    battleY: wide ? 1180 : 1460,
  };
}
