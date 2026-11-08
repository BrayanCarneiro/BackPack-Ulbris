// Shared by every current and future character, including Arthur.
export const generalItems = [
  { id: 'iron-shield', kind: 'item', label: 'Escudo ferro', name: 'Escudo de ferro', width: 2, height: 2, price: 7, acquisition: 'fusion' },
  { id: 'vigor-potion', kind: 'item', label: 'Vigor', name: 'Poção de vigor', width: 1, height: 1, price: 3 },
  { id: 'protection-potion', kind: 'item', label: 'Proteção', name: 'Poção de proteção', width: 1, height: 1, price: 3 },
  { id: 'regeneration-potion', kind: 'item', label: 'Regeneração', name: 'Poção de regeneração', width: 1, height: 2, price: 4 },
  { id: 'whetstone', kind: 'item', label: 'Amolar', name: 'Pedra de amolar', width: 1, height: 1, price: 3 },
  { id: 'haste-stone', kind: 'item', label: 'Celeridade', name: 'Pedra da celeridade', width: 1, height: 1, price: 4 },
  { id: 'vital-crystal', kind: 'item', label: 'Vital', name: 'Cristal vital', width: 1, height: 1, price: 4 },
].map(item => ({ ...item, pool: 'general' }));
