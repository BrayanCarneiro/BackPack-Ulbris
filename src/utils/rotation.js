export function rotateFootprint(piece, quarterTurns = 0) {
  const swapDimensions = Math.abs(quarterTurns % 2) === 1;
  return {
    ...piece,
    width: swapDimensions ? piece.height : piece.width,
    height: swapDimensions ? piece.width : piece.height,
    rotation: ((piece.rotation ?? 0) + quarterTurns * 90) % 360,
  };
}
