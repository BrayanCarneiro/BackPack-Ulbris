import { allItems } from '../data/shopCatalog.js';
import { combatRules, getCombatItem } from '../data/combatItems.js';
import { getItemRecipes } from '../data/itemRecipes.js';
import { catalogId } from './itemStars.js';
import { sellPrice } from '../data/economy.js';
import { getItemClass } from '../data/itemClasses.js';
import { getFootprintCells } from './rotation.js';

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
  if (getItemRecipes(id).some(recipe => recipe.anchor === id && recipe.placement === 'adjacent')) {
    effects.push('Fusão por contato: encoste duas Machadinhas por uma borda e complete uma batalha. Não exige estrelas.');
  }
  if (piece.cells) effects.push(`Formato ${definition.shapeName ?? 'irregular'}: ocupa ${getFootprintCells(piece).length} espaços. Os espaços vazios podem receber outros itens; o formato acompanha a rotação.`);
  if (stats.damage) {
    attributes.push(['Dano', number(stats.damage)], ['Precisão', percent(stats.accuracy)],
      ['Estamina por ataque', number(stats.staminaCost)], ['Recarga', `${number(stats.cooldown)} s`],
      ['Chance crítica', percent(stats.criticalChance)],
      ['Dano crítico', `${number(stats.damage * stats.criticalMultiplier)} (+${percent(stats.criticalMultiplier - 1)})`]);
    if (stats.extraAttackChance) effects.push(`Ao acertar: ${percent(stats.extraAttackChance)} de chance de um segundo golpe imediato.`);
    if (stats.followUpAttackChance) effects.push(`Se o segundo acertar: ${percent(stats.followUpAttackChance)} de chance de um terceiro golpe.`);
    if (stats.thirdAttackCriticalChance) effects.push(`O terceiro golpe tem ${percent(stats.thirdAttackCriticalChance)} de chance crítica e causa ${number(stats.damage * stats.criticalMultiplier)} de dano quando crítico.`);
    if (stats.extraAttackChance) effects.push(`Extras não gastam estamina e têm precisão própria. A sequência termina ${stats.followUpAttackChance ? 'no terceiro' : 'no segundo'} golpe.`);
  }
  if (stats.burnChance) {
    effects.push(`${stats.burnRequiresUnblockedHit ? 'Acertos que não sejam totalmente bloqueados' : 'Golpes que acertam'} têm ${percent(stats.burnChance)} de chance de aplicar 1 acúmulo de queimadura no alvo.`);
    effects.push(`Queimadura: cada acúmulo causa ${number(stats.burnDamage)} de dano direto à vida por turno, durante ${stats.burnTurns} turnos, e depois desaparece. Cada acúmulo tem sua própria duração. Um turno equivale a ${number(combatRules.statusTurnSeconds)} segundo de combate.`);
  }
  if (stats.stunChance) {
    effects.push(`Golpes que acertam têm ${percent(stats.stunChance)} de chance de atordoar o alvo por ${number(stats.stunSeconds)} segundo.`);
    effects.push('Atordoamento: impede ataques e pausa as recargas das armas. A estamina continua regenerando; poções e queimaduras continuam funcionando. Novos atordoamentos renovam a duração restante.');
  }
  if (stats.fusionCatalyst) {
    const vertical = ((piece.rotation ?? 0) % 180 + 180) % 180 === 90;
    effects.push(`Estrelas de fusão: ${vertical ? 'acima e abaixo' : 'esquerda e direita'}. Gire em 90° para alternar. Veja os componentes em Receitas e complete uma batalha para fundir.`);
    if (!stats.damage) effects.push('Ingrediente de fusão; não causa dano nem aplica queimadura sozinho.');
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
      effects.push(`Concede dano às armas nas duas estrelas. O bônus combinado das pedras de amolar é limitado a +${number(combatRules.weaponDamageBonusLimit)} por arma. Também beneficia ataques extras e críticos.`);
    }
    if (stats.weaponCooldownMultiplier) {
      attributes.push(['Redução de recarga', percent(1 - stats.weaponCooldownMultiplier)]);
      effects.push(`Reduz a recarga das armas nas duas estrelas. A redução combinada é limitada a ${percent(1 - combatRules.weaponCooldownMinimum)}. O custo de estamina permanece igual.`);
      effects.push(`As pedras combinam multiplicando a recarga: duas reduzem ${percent(1 - stats.weaponCooldownMultiplier ** 2)}; três, ${percent(Math.min(1 - combatRules.weaponCooldownMinimum, 1 - stats.weaponCooldownMultiplier ** 3))}.`);
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
