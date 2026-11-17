export const itemRarities = {
  common: { name: 'Comum', color: 0xb9c6ce },
  uncommon: { name: 'Incomum', color: 0x89c79b },
  rare: { name: 'Raro', color: 0x76b7ef },
  epic: { name: 'Épico', color: 0xc39af0 },
  legendary: { name: 'Lendário', color: 0xefc75f },
};

// Power, versatility and recipe access inform these tiers. Rarity adds no stats.
export const itemRarityIds = {
  'oath-ring': 'uncommon', 'knight-bag': 'uncommon', 'commander-helmet': 'rare',
  'bastion-chestplate': 'epic', 'bloody-sword': 'rare', 'knight-greatsword': 'epic', excalibur: 'legendary',
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
  'iron-armor': 'rare', 'vampiric-chestplate': 'epic', 'golden-crystal': 'epic',
};

export function getItemRarity(item) {
  const catalogId = typeof item === 'string' ? item : item.catalogId ?? item.id;
  const id = itemRarityIds[catalogId] ?? 'common';
  return { id, ...itemRarities[id], cssColor: `#${itemRarities[id].color.toString(16).padStart(6, '0')}` };
}

export function getShopRarityChances(round) {
  if (round < 6) {
    const growth = Math.max(0, Math.floor(round) - 1);
    return { common: (70 - 5 * growth) / 100, uncommon: (25 + 2.5 * growth) / 100,
      rare: (5 + 2.5 * growth) / 100, epic: 0, legendary: 0 };
  }
  // Each subsequent round shifts 2 percentage points from common to rare/epic.
  // Cap the progression so basic recipe ingredients remain available in endless.
  const growth = Math.min(15, Math.floor(round) - 6);
  return { common: (40 - 2 * growth) / 100, uncommon: 0.3,
    rare: (20 + growth) / 100, epic: (10 + growth) / 100, legendary: 0 };
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
