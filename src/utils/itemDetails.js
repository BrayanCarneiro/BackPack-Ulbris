import { allItems } from '../data/shopCatalog.js';
import { combatRules, getCombatItem } from '../data/combatItems.js';
import { getItemRecipes } from '../data/itemRecipes.js';
import { catalogId } from './itemStars.js';
import { sellPrice } from '../data/economy.js';
import { getItemClass } from '../data/itemClasses.js';
import { getFootprintCells } from './rotation.js';
import { formatNumber as number } from './formatNumber.js';

export const itemCatalog = allItems;
const percent = value => `${number(Math.round(value * 10000) / 100)}%`;

export function getItemDetails(value) {
  const id = typeof value === 'string' ? value : catalogId(value);
  const definition = itemCatalog.find(item => item.id === id);
  if (!definition) return null;
  const piece = typeof value === 'string' ? definition : { ...definition, ...value };
  const stats = getCombatItem({ catalogId: id });
  const attributes = [], effectRows = [];
  const effect = (label, value, note = '') => effectRows.push({ label, value, note });
  const vertical = ((piece.rotation ?? 0) % 180 + 180) % 180 === 90;
  const stars = vertical ? 'acima e abaixo' : 'esquerda e direita';
  if (id === 'hatchet') effect('Fusão por contato', '2 Machadinhas → Machado de batalha', 'Encoste por uma borda · após a batalha.');
  if (piece.cells) effect(`Formato ${definition.shapeName ?? 'irregular'}`, `${getFootprintCells(piece).length} espaços`, 'Os vazios ficam livres para outros itens.');
  if (stats.damage) {
    attributes.push(['Dano', number(stats.damage)], ['Precisão', percent(stats.accuracy)],
      ['Estamina por ataque', number(stats.staminaCost)], ['Recarga', `${number(stats.cooldown)} s`],
      ['Chance crítica', percent(stats.criticalChance)],
      ['Dano crítico', `${number(stats.damage * stats.criticalMultiplier)} (+${percent(stats.criticalMultiplier - 1)})`]);
    if (stats.extraAttackChance) effect('Golpe extra', `${percent(stats.extraAttackChance)} de chance ao acertar`, 'Sem custo de estamina · exige acerto próprio.');
    if (stats.followUpAttackChance) effect('Terceiro golpe', `${percent(stats.followUpAttackChance)} de chance se o segundo acertar`, 'Sem custo de estamina · exige acerto próprio.');
    if (stats.thirdAttackCriticalChance) effect('Crítico do terceiro golpe', `${percent(stats.thirdAttackCriticalChance)} de chance · ${number(stats.damage * stats.criticalMultiplier)} de dano`);
  }
  const burnDamage = (damage, turns) => `${number(damage)} de dano à vida a cada ${number(combatRules.statusTurnSeconds)} s por ${number(turns * combatRules.statusTurnSeconds)} s`;
  if (stats.burnChance) effect('Queimadura', `${percent(stats.burnChance)} de chance por acerto`,
    `${burnDamage(stats.burnDamage, stats.burnTurns)} · por acúmulo.${stats.burnRequiresUnblockedHit ? ' Exige dano após bloqueio.' : ''}`);
  if (stats.stunChance) effect('Atordoamento', `${percent(stats.stunChance)} de chance · ${number(stats.stunSeconds)} s`, 'Ao acertar · pausa ataques e recargas. Não acumula duração.');
  if (stats.armor) attributes.push(['Armadura inicial', `+${number(stats.armor)}`]);
  if (stats.damageHealingRatio) effect('Cura ao sofrer dano', `${percent(stats.damageHealingRatio)} da vida perdida`, 'Só dano à vida · não revive após dano letal.');
  if (stats.stunDurationMultiplier) effect('Proteção contra atordoamento', `−${percent(1 - stats.stunDurationMultiplier)} de duração`);
  if (stats.criticalDamageMultiplier) effect('Proteção contra críticos', `−${percent(1 - stats.criticalDamageMultiplier)} de dano recebido`);
  if (stats.resistance) {
    attributes.push(['Resistência', `+${number(stats.resistance)}`]);
    effect('Resistência', `Bloqueia ${stats.resistance} ${stats.resistance === 1 ? 'queimadura ou atordoamento' : 'queimaduras ou atordoamentos'}`, 'Por batalha · 1 resistência por aplicação.');
  }
  if (stats.starArmorInterval) effect('Armadura periódica', `+${number(stats.starArmorAmount)} de armadura a cada ${number(stats.starArmorInterval)} s`, `Por peça de armadura nas estrelas · ${stars}.`);
  if (stats.health) attributes.push(['Vida máxima', `+${number(stats.health)}`]);
  if (stats.stamina) attributes.push(['Estamina', `+${number(stats.stamina)}`]);
  if (stats.blockChance) {
    effect('Bloqueio', `${percent(stats.blockChance)} de chance · −${number(stats.blockDamage)} de dano`, 'Por acerto recebido · antes da armadura.');
    if (stats.extraBlockChance) effect('Bloqueio extra', `${percent(stats.extraBlockChance)} de chance · −${number(stats.extraBlockDamage)} de dano`, 'Após um bloqueio bem-sucedido.');
  }
  if (stats.healing) {
    attributes.push(['Cura', number(stats.healing)], ['Ativa com vida em', `${percent(stats.healthThreshold)} ou menos`]);
    effect('Uso único', `+${number(stats.healing)} de vida com vida ≤ ${percent(stats.healthThreshold)}`, '1 vez por batalha · não revive.');
  }
  if (stats.regeneration) effect('Regeneração', `+${number(stats.regeneration)} de vida/s por ${stats.regenerationTicks} s`, 'Após a cura inicial · até a vida máxima.');
  if (stats.restoreStamina) {
    attributes.push(['Estamina recuperada', number(stats.restoreStamina)], ['Ativa com estamina em', `${percent(stats.staminaThreshold)} ou menos`]);
    effect('Uso único', `+${number(stats.restoreStamina)} de estamina com estamina ≤ ${percent(stats.staminaThreshold)}`, '1 vez por batalha · até a estamina máxima.');
  }
  if (stats.restoreArmor) {
    attributes.push(['Armadura concedida', `+${number(stats.restoreArmor)}`]);
    effect('Uso único', `+${number(stats.restoreArmor)} de armadura ao chegar a 0`, '1 vez por batalha · também ativa se começar em 0.');
  }
  if (stats.weaponLifeStealChance) {
    const direction = ['direita', 'abaixo', 'esquerda', 'acima'][((piece.rotation ?? 0) % 360 + 360) % 360 / 90];
    effect('Roubo de vida', `${percent(stats.weaponLifeStealChance)} de chance · cura ${percent(stats.weaponLifeStealRatio)} do dano à vida`, `Arma na estrela: ${direction} · queimadura não ativa.`);
  }
  if (stats.weaponBurnChance) effect('Armas nas estrelas', `${percent(stats.weaponBurnChance)} de chance de queimadura por acerto`, `${burnDamage(stats.weaponBurnDamage, stats.weaponBurnTurns)} · exige dano após bloqueio.`);
  if (stats.weaponDamageBonus) {
    attributes.push(['Dano por arma', `+${number(stats.weaponDamageBonus)}`]);
    effect('Armas nas estrelas', `+${number(stats.weaponDamageBonus)} de dano por arma`, `Limite combinado: +${number(combatRules.weaponDamageBonusLimit)} por arma.`);
  }
  if (stats.weaponCooldownMultiplier) {
    attributes.push(['Redução de recarga', percent(1 - stats.weaponCooldownMultiplier)]);
    effect('Armas nas estrelas', `−${percent(1 - stats.weaponCooldownMultiplier)} de recarga`, `Limite: ${percent(1 - combatRules.weaponCooldownMinimum)} · custo de estamina igual.`);
    effect('Combinação', `2 pedras: ${percent(1 - stats.weaponCooldownMultiplier ** 2)} · 3: ${percent(Math.min(1 - combatRules.weaponCooldownMinimum, 1 - stats.weaponCooldownMultiplier ** 3))}`);
  }
  if (stats.weaponDamageBonus || stats.weaponCooldownMultiplier || stats.weaponBurnChance) effect('Estrelas', stars);
  if (stats.fusionCatalyst && !stats.triggerArmorChance) effect('Fusão', 'Nas estrelas · após a batalha', 'Veja os ingredientes na aba Receitas.');
  if (stats.triggerArmorChance) {
    attributes.push(['Chance por ativação', percent(stats.triggerArmorChance)], ['Armadura concedida', `+${number(stats.triggerArmor)}`]);
    effect('Geração de armadura', `${percent(stats.triggerArmorChance)} de chance de +${number(stats.triggerArmor)} de armadura`, 'Ativações nas estrelas: ataques, poções, bloqueios e armadura periódica.');
    effect('Estrelas', stars, `Cada item ativa no máximo ${combatRules.ironLimitPerItem} Ferros refinados.`);
    effect('Fusão por contato', 'Ferro + equipamento · após a batalha', 'Peitoral exige 2 ferros · sem exigir estrelas.');
    effect('Escolher fusão', 'Solte o ferro no mesmo lugar para alternar', 'O equipamento em verde é a escolha atual.');
  }
  if (!effectRows.length) {
    if (piece.kind === 'bag') effect('Espaço para equipamentos', `${getFootprintCells(piece).length} espaços disponíveis`, 'Posicione a mochila antes dos itens.');
    else if (stats.health || stats.stamina || stats.armor) effect('Bônus ao equipar', 'Ativo enquanto estiver na mochila');
    else effect('Efeito', 'Sem efeitos adicionais.');
  }
  const effects = effectRows.map(({ label, value, note }) => `${label}: ${value}${note ? ` · ${note}` : ''}`);
  effects.push(`Valor de venda: ${sellPrice(definition)} de ouro.`);
  return { id, piece, name: definition.name, kind: definition.kind, itemClass: getItemClass(definition),
    attributes, effects, effectRows, recipes: getItemRecipes(id), sellPrice: sellPrice(definition) };
}
