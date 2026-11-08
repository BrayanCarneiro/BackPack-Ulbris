// The first opponent uses the same item rules as the player.
export const battlePreview = {
  enemyBoard: {
    columns: 8,
    rows: 8,
    bags: [{ id: 'enemy-bag', catalogId: 'traveler-bag', width: 4, height: 4, x: 2, y: 2 }],
    items: [
      { id: 'enemy-sword', catalogId: 'sword', label: 'Espada', width: 1, height: 3, x: 2, y: 2 },
      { id: 'enemy-shield', catalogId: 'shield', label: 'Escudo', width: 2, height: 2, x: 3, y: 2 },
      { id: 'enemy-potion', catalogId: 'potion', label: 'Poção', width: 1, height: 1, x: 3, y: 4 },
    ],
  },
};
