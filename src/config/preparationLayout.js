export function getPreparationLayout(viewportWidth, viewportHeight) {
  const wide = viewportWidth >= 1000 && viewportWidth / viewportHeight >= 1.15;
  const width = wide ? Math.min(2560, Math.max(1560, Math.round(1280 * viewportWidth / viewportHeight))) : 720;
  const offset = (width - 1560) / 2;
  const boardX = wide ? offset + 826 : 72;
  const cellSize = 72;
  const boardWidth = cellSize * 8;
  const board = {
    x: boardX, y: wide ? 284 : 626, cellSize,
    trayColumns: wide ? undefined : 3,
    tray: { x: wide ? boardX : 32, y: wide ? 996 : 1270, width: wide ? boardWidth : 656, height: wide ? 156 : 100 },
    expandedTray: { x: wide ? boardX : 32, y: wide ? 668 : 838, width: wide ? boardWidth : 656, height: wide ? 484 : 532 },
    sell: wide ? { x: boardX + boardWidth + 50, y: 1006, width: 100, height: 146 }
      : { x: 508, y: 1384, width: 180, height: 44, compact: true },
  };
  return {
    wide, width, height: wide ? 1280 : 1530, board,
    shopX: wide ? offset + 352 : 360,
    offerY: wide ? 340 : 264,
    offersPerPage: 6,
    boardCenter: boardX + boardWidth / 2,
    boardTitleY: wide ? 210 : 548,
    fusionY: wide ? 248 : 592,
    controlsY: wide ? 900 : 548,
    rerollY: wide ? 896 : 500,
    messageY: wide ? 1198 : 1436,
    battleY: wide ? 1180 : 1490,
  };
}
