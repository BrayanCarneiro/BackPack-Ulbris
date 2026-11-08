import { allItems } from '../data/shopCatalog.js';
import { getCombatItem } from '../data/combatItems.js';
import { getItemRecipes } from '../data/itemRecipes.js';
import { catalogId } from './itemStars.js';
import { sellPrice } from '../data/economy.js';
import { getItemClass } from '../data/itemClasses.js';

export const itemCatalog = allItems;
const number = value => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const percent = value => `${number(Math.round(value * 10000) / 100)}%`;

export function getItemDetails(value) {
  const id = typeof value === 'string' ? value : catalogId(value);
  const definition = itemCatalog.find(item => item.id === id);
  if (!definition) return null;
  const piece = typeof value === 'string' ? definition : { ...definition, ...value };
  const stats = getCombatItem({ catalogId: id });
  const attributes = [], effects = [];
  if (stats.damage) {
    attributes.push(['Dano', number(stats.damage)], ['Precisão', percent(stats.accuracy)],
      ['Estamina por ataque', number(stats.staminaCost)], ['Recarga', `${number(stats.cooldown)} s`],
      ['Chance crítica', percent(stats.criticalChance)],
      ['Dano crítico', `${number(stats.damage * stats.criticalMultiplier)} (+${percent(stats.criticalMultiplier - 1)})`]);
    if (stats.extraAttackChance) effects.push(`Ao acertar: ${percent(stats.extraAttackChance)} de chance de um segundo golpe imediato.`);
    if (stats.followUpAttackChance) effects.push(`Se o segundo acertar: ${percent(stats.followUpAttackChance)} de chance de um terceiro golpe.`);
    if (stats.thirdAttackCriticalChance) effects.push(`O terceiro golpe tem ${percent(stats.thirdAttackCriticalChance)} de chance crítica e causa ${number(stats.damage * stats.criticalMultiplier)} de dano quando crítico.`);
    effects.push(`Extras não gastam estamina e têm precisão própria. A sequência termina ${stats.followUpAttackChance ? 'no terceiro' : 'no segundo'} golpe.`);
  }
  if (stats.armor) attributes.push(['Armadura inicial', `+${number(stats.armor)}`]);
  if (stats.health) {
    attributes.push(['Vida máxima', `+${number(stats.health)}`]);
    effects.push('Aumenta a vida inicial e máxima enquanto estiver posicionado.');
  }
  if (stats.stamina) {
    attributes.push(['Estamina', `+${number(stats.stamina)}`]);
    effects.push('Aumenta a estamina inicial e máxima enquanto estiver posicionada.');
  }
  if (stats.blockChance) {
    effects.push(`Ao receber um acerto: ${percent(stats.blockChance)} de chance de bloquear ${number(stats.blockDamage)} de dano antes da armadura.`);
    if (stats.extraBlockChance) effects.push(`Se bloquear: ${percent(stats.extraBlockChance)} de chance de bloquear mais ${number(stats.extraBlockDamage)} no mesmo golpe.`);
  }
  if (stats.healing) {
    attributes.push(['Cura', number(stats.healing)], ['Ativa com vida em', `${percent(stats.healthThreshold)} ou menos`]);
    effects.push('É consumida após uma cura. Não revive um personagem derrotado.');
  }
  if (stats.regeneration) effects.push(`Após a cura inicial, recupera ${number(stats.regeneration)} de vida por segundo durante ${stats.regenerationTicks} segundos. Não revive e não ultrapassa a vida máxima.`);
  if (stats.restoreStamina) {
    attributes.push(['Estamina recuperada', number(stats.restoreStamina)], ['Ativa com estamina em', `${percent(stats.staminaThreshold)} ou menos`]);
    effects.push('É consumida ao ativar. A recuperação respeita a estamina máxima e não reinicia recargas.');
  }
  if (stats.restoreArmor) {
    attributes.push(['Armadura concedida', `+${number(stats.restoreArmor)}`]);
    effects.push('Ao ficar sem armadura, concede a armadura indicada e é consumida. Se começar sem armadura, ativa no primeiro passo do combate.');
  }
  if (stats.weaponDamageBonus || stats.weaponCooldownMultiplier) {
    if (stats.weaponDamageBonus) {
      attributes.push(['Dano por arma', `+${number(stats.weaponDamageBonus)}`]);
      effects.push('Concede dano às armas nas duas estrelas. O bônus combinado das pedras de amolar é limitado a +0,9 por arma. Também beneficia ataques extras e críticos.');
    }
    if (stats.weaponCooldownMultiplier) {
      attributes.push(['Redução de recarga', percent(1 - stats.weaponCooldownMultiplier)]);
      effects.push('Reduz a recarga das armas nas duas estrelas. A redução combinada é limitada a 30%. O custo de estamina permanece igual.');
    }
    const vertical = ((piece.rotation ?? 0) % 180 + 180) % 180 === 90;
    effects.push(`Estrelas atuais: ${vertical ? 'acima e abaixo' : 'esquerda e direita'}. Girar em 90° alterna a direção. Funciona com qualquer tipo de arma e não exige uma classe.`);
  }
  if (stats.triggerArmorChance) {
    attributes.push(['Chance por ativação', percent(stats.triggerArmorChance)], ['Armadura concedida', `+${number(stats.triggerArmor)}`]);
    const vertical = ((piece.rotation ?? 0) % 180 + 180) % 180 === 90;
    effects.push(`Estrelas atuais: ${vertical ? 'acima e abaixo' : 'esquerda e direita'}. Girar em 90° alterna a direção.`);
    effects.push('Cada ativação de um item em uma estrela pode conceder armadura: ataques, uso de poção e bloqueios bem-sucedidos.');
    effects.push('A armadura pode aumentar durante a luta, mesmo após zerar.');
    effects.push('Cada ferro participa de uma fusão por batalha. Se houver espada e escudo nas estrelas, a espada tem prioridade.');
  }
  if (stats.armor) effects.push('Soma à armadura no início da batalha. Ela absorve dano antes da vida e perde pontos ao proteger.');
  if (!effects.length) effects.push('Sem passivas adicionais.');
  effects.push(`Valor de venda: ${sellPrice(definition)} de ouro.`);
  return { id, piece, name: definition.name, kind: definition.kind, itemClass: getItemClass(definition), attributes, effects, recipes: getItemRecipes(id) };
}
