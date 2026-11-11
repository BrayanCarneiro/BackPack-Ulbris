import { getItemRarity } from './itemRarities.js';

// Shared weapons and their crafting ingredient.
export const weaponItems = [
  { id: 'quick-daggers', label: 'Adagas', name: 'Adagas rápida', width: 1, height: 2, price: 3 },
  { id: 'hatchet', label: 'Machadinha', name: 'Machadinha', width: 2, height: 2, price: 3,
    shapeName: 'de machadinha',
    cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] },
  { id: 'bow', label: 'Arco', name: 'Arco', width: 2, height: 3, price: 4, shapeName: 'em C',
    cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }] },
  { id: 'fire-stone', label: 'Fogo', name: 'Pedra de fogo', width: 1, height: 1, price: 3 },
  { id: 'battle-axe', label: 'Machado', name: 'Machado de batalha', width: 2, height: 3, price: 6,
    shapeName: 'de machado', acquisition: 'fusion',
    cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }] },
  { id: 'flaming-daggers', label: 'Flamejantes', name: 'Adagas flamejantes', width: 1, height: 2, price: 6, acquisition: 'fusion' },
].map(item => ({ ...item, kind: 'item', pool: 'general', rarity: getItemRarity(item).id }));
