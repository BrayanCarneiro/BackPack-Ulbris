import { generalItems } from './generalItems.js';

export const shopCatalog = [
  { id: 'traveler-bag', kind: 'bag', label: 'Viajante', name: 'Mochila viajante', width: 4, height: 4, price: 4 },
  { id: 'long-bag', kind: 'bag', label: 'Alongada', name: 'Mochila alongada', width: 5, height: 1, price: 3 },
  { id: 'pouch', kind: 'bag', label: 'Bolsa', name: 'Bolsa de couro', width: 2, height: 2, price: 2 },
  { id: 'sword', kind: 'item', label: 'Espada', name: 'Espada de treino', width: 1, height: 3, price: 3 },
  { id: 'shield', kind: 'item', label: 'Escudo', name: 'Escudo de madeira', width: 2, height: 2, price: 4 },
  { id: 'potion', kind: 'item', label: 'Poção', name: 'Poção de vida', width: 1, height: 1, price: 2 },
  { id: 'refined-iron', kind: 'item', label: 'Ferro', name: 'Ferro refinado', width: 1, height: 1, price: 3 },
  ...generalItems.filter(item => item.acquisition !== 'fusion'),
].map(item => ({ pool: 'general', ...item }));

export const getShopCatalog = classId => shopCatalog.filter(item => item.pool === 'general' || item.pool === classId);

// Obtained through fusion, with the training sword's footprint until defined.
export const ironSword = {
  id: 'iron-sword', pool: 'general', kind: 'item', label: 'Espada de ferro', name: 'Espada de ferro', width: 1, height: 3, price: 6,
};

export const allItems = [...shopCatalog, ...generalItems.filter(item => item.acquisition === 'fusion'), ironSword];
