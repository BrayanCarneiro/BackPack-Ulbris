export const itemRarities = {
  common: { name: 'Comum', color: 0xb9c6ce },
  uncommon: { name: 'Incomum', color: 0x89c79b },
  rare: { name: 'Raro', color: 0x76b7ef },
  epic: { name: 'Épico', color: 0xc39af0 },
  legendary: { name: 'Lendário', color: 0xefc75f },
};

// Power, versatility and recipe access inform these tiers. Rarity adds no stats.
export const itemRarityIds = {
  'traveler-bag': 'common', 'long-bag': 'common', pouch: 'common',
  sword: 'common', shield: 'common', potion: 'common',
  'quick-daggers': 'common', hatchet: 'common',
  'refined-iron': 'uncommon', 'vigor-potion': 'uncommon', 'protection-potion': 'uncommon',
  whetstone: 'uncommon', 'vital-crystal': 'uncommon', 'armored-crystal': 'uncommon',
  'energy-crystal': 'uncommon', 'leather-helmet': 'uncommon', 'leather-chestplate': 'uncommon',
  bow: 'rare', 'fire-stone': 'rare', 'haste-stone': 'rare', 'carmine-stone': 'rare',
  'regeneration-potion': 'rare', 'blue-crystal': 'rare', 'red-crystal': 'rare',
  'white-crystal': 'rare', 'black-crystal': 'rare',
  'iron-sword': 'rare', 'iron-shield': 'rare', 'iron-helmet': 'rare',
  'battle-axe': 'rare', 'flaming-daggers': 'rare',
  'iron-armor': 'epic', 'vampiric-chestplate': 'epic', 'golden-crystal': 'epic',
};

export function getItemRarity(item) {
  const catalogId = typeof item === 'string' ? item : item.catalogId ?? item.id;
  const id = itemRarityIds[catalogId] ?? 'common';
  return { id, ...itemRarities[id], cssColor: `#${itemRarities[id].color.toString(16).padStart(6, '0')}` };
}

export function getShopRarityChances(round) {
  if (round <= 2) return { common: 0.7, uncommon: 0.25, rare: 0.05, epic: 0, legendary: 0 };
  if (round <= 5) return { common: 0.55, uncommon: 0.3, rare: 0.15, epic: 0, legendary: 0 };
  return { common: 0.4, uncommon: 0.35, rare: 0.25, epic: 0, legendary: 0 };
}

// Choose a tier by its total chance, then an item uniformly inside that tier.
// One random draw per offer keeps seeded shopping reproducible.
export function getShopDistribution(catalog, round) {
  const chances = getShopRarityChances(round);
  const available = catalog.filter(item => item.acquisition !== 'fusion' && chances[getItemRarity(item).id] > 0);
  if (!available.length) throw new RangeError('Nenhum item disponível para sortear nesta loja.');
  const counts = new Map();
  for (const item of available) {
    const id = getItemRarity(item).id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const total = [...counts.keys()].reduce((sum, id) => sum + chances[id], 0);
  let end = 0;
  const distribution = available.map(item => {
    const id = getItemRarity(item).id;
    const chance = chances[id] / counts.get(id) / total;
    const start = end;
    end += chance;
    return { item, chance, start, end };
  });
  distribution.at(-1).end = 1;
  return distribution;
}

export function rollShopItem(distribution, value) {
  const sample = Math.max(0, Math.min(1 - Number.EPSILON, value));
  return (distribution.find(entry => sample < entry.end) ?? distribution.at(-1)).item;
}
