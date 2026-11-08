export const itemClasses = {
  general: { symbol: 'G', name: 'Geral' },
  arthur: { symbol: '🗡', name: 'Arthur' },
};

export function getItemClass(item) {
  const id = item.pool ?? 'general';
  return { id, ...(itemClasses[id] ?? { symbol: '?', name: id }) };
}
