import { getItemRarity } from './itemRarities.js';

export const arthurItems = [
  { id: 'oath-ring', kind: 'item', label: 'Juramento', name: 'Anel do Juramento', itemType: 'stone', width: 1, height: 1, price: 5 },
  { id: 'commander-helmet', kind: 'item', label: 'Comandante', name: 'Elmo do Comandante', width: 2, height: 1, price: 11, acquisition: 'fusion' },
  { id: 'knight-bag', kind: 'bag', label: 'Cavaleiro', name: 'Mochila do Cavaleiro', width: 4, height: 4, price: 5 },
  { id: 'bastion-chestplate', kind: 'item', label: 'Bastião', name: 'Peitoral do Bastião', width: 2, height: 3, price: 9 },
  { id: 'bloody-sword', kind: 'item', label: 'Sangrenta', name: 'Espada Sangrenta', width: 1, height: 3, price: 12, acquisition: 'fusion' },
  { id: 'knight-greatsword', kind: 'item', label: 'Espada Grande', name: 'Espada Grande do Cavaleiro', width: 2, height: 4, price: 18, acquisition: 'fusion' },
  { id: 'excalibur', kind: 'item', label: 'Excalibur', name: 'Excalibur — Lâmina do Último Juramento', width: 2, height: 4, price: 34, acquisition: 'fusion' },
].map(item => ({ ...item, pool: 'arthur', rarity: getItemRarity(item).id }));
