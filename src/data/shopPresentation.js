import { getCombatItem } from './combatItems.js';

const summaries = {
  'traveler-bag': 'Mais espaço para seus itens.',
  'long-bag': 'Espaço extra e +1 estamina.',
  pouch: 'Espaço extra e +1,2 armadura.',
  sword: 'Ataques com chance de repetir.',
  shield: 'Armadura e chance de bloqueio.',
  potion: 'Recupera vida quando ela cai.',
  'refined-iron': 'Melhora equipamentos por fusão.',
  'vigor-potion': 'Recupera estamina quando falta.',
  'protection-potion': 'Protege ao ficar sem armadura.',
  'regeneration-potion': 'Cura e regenera ao perder vida.',
  whetstone: 'Mais dano às armas nas estrelas.',
  'haste-stone': 'Acelera armas nas estrelas.',
  'vital-crystal': '+4 de vida máxima.',
  'armored-crystal': '+4 de armadura inicial.',
  'energy-crystal': '+1 de estamina máxima.',
  'leather-helmet': 'Protege de críticos e atordoamento.',
  'leather-chestplate': 'Gera armadura com peças nas estrelas.',
  'carmine-stone': 'A arma na estrela pode roubar vida.',
  'quick-daggers': 'Ataques rápidos e leves.',
  hatchet: 'Junte duas para criar um machado.',
  bow: 'Golpes fortes com críticos maiores.',
  'fire-stone': 'Armas nas estrelas podem queimar.',
};

export function getShopPresentation(offer) {
  const id = offer.catalogId ?? offer.id;
  const stats = getCombatItem(offer);
  let category = 'SUPORTE';
  let color = 0xb5a3c7;
  if (offer.kind === 'bag') { category = 'MOCHILA'; color = 0x8eb9ae; }
  else if (stats.damage) { category = 'ARMA'; color = 0xd5bd87; }
  else if (stats.isArmor) { category = 'ARMADURA'; color = 0x91bf9b; }
  else if (id.includes('potion')) { category = 'POÇÃO'; color = 0x9ebacb; }
  else if (id === 'refined-iron') { category = 'FUSÃO'; color = 0xc4b39b; }
  return { category, color, summary: summaries[id] ?? 'Toque para conhecer o efeito.' };
}
