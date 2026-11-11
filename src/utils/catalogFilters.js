import { getCombatItem } from '../data/combatItems.js';
import { getItemRarity, itemRarities } from '../data/itemRarities.js';

export const catalogTypes = [
  { id: 'armor', name: 'Armaduras' }, { id: 'weapon', name: 'Armas' },
  { id: 'potion', name: 'Poções' }, { id: 'stone', name: 'Pedras' },
  { id: 'crystal', name: 'Cristais' }, { id: 'bag', name: 'Mochilas' },
  { id: 'material', name: 'Materiais' }, { id: 'other', name: 'Outros' },
];
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
const rarityOrder = Object.keys(itemRarities);

export function getCatalogType(item) {
  const id = item.catalogId ?? item.id;
  const stats = getCombatItem(item);
  if (item.kind === 'bag') return 'bag';
  if (stats.isArmor) return 'armor';
  if (stats.damage) return 'weapon';
  if (id === 'potion' || id.endsWith('-potion')) return 'potion';
  if (id.endsWith('-crystal')) return 'crystal';
  if (['whetstone', 'haste-stone', 'fire-stone', 'carmine-stone'].includes(id)) return 'stone';
  if (id === 'refined-iron') return 'material';
  return 'other';
}

export function filterCatalog(items, { type = 'all', rarity = 'all', sort = 'type', direction = 'asc' } = {}) {
  return items.filter(item => (type === 'all' || getCatalogType(item) === type)
    && (rarity === 'all' || getItemRarity(item).id === rarity)).sort((a, b) => {
    if (sort === 'name') return collator.compare(a.name, b.name) * (direction === 'desc' ? -1 : 1);
    const primary = sort === 'rarity'
      ? rarityOrder.indexOf(getItemRarity(a).id) - rarityOrder.indexOf(getItemRarity(b).id)
      : catalogTypes.findIndex(type => type.id === getCatalogType(a)) - catalogTypes.findIndex(type => type.id === getCatalogType(b));
    return primary || collator.compare(a.name, b.name);
  });
}
