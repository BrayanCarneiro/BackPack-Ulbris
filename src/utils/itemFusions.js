import { catalogId, getStarTargets, getAdjacentTargets } from './itemStars.js';
import { itemRecipes } from '../data/itemRecipes.js';

function getFusionOptions(items, anchor, used = new Set()) {
  if (!anchor || anchor.x === null || anchor.y === null || used.has(anchor.id)) return [];
  const equipped = items.filter(item => item.x !== null && item.y !== null);
  const options = [];
  for (const recipe of itemRecipes) {
    if (catalogId(anchor) !== recipe.anchor) continue;
    const targets = recipe.placement === 'adjacent' ? getAdjacentTargets(anchor, items)
      : getStarTargets(anchor, items);
    for (const target of targets.filter(item => catalogId(item) === recipe.ingredients[0] && !used.has(item.id))) {
      const remaining = recipe.ingredients.slice(1);
      const anchorIndex = remaining.indexOf(catalogId(anchor));
      if (anchorIndex < 0) continue;
      remaining.splice(anchorIndex, 1);
      const consumed = [anchor];
      for (const id of remaining) {
        const ingredient = equipped.find(item => catalogId(item) === id && item.id !== target.id
          && !used.has(item.id) && !consumed.some(selected => selected.id === item.id)
          && ((recipe.extraPlacement ?? recipe.placement) === 'adjacent' ? getAdjacentTargets(item, items)
            : getStarTargets(item, items)).some(neighbor => neighbor.id === target.id));
        if (!ingredient) break;
        consumed.push(ingredient);
      }
      if (consumed.length !== recipe.ingredients.length - 1) continue;
      options.push({ anchorId: anchor.id, targetId: target.id, resultId: recipe.result,
        consumedIds: consumed.map(item => item.id), resultAlignment: recipe.resultAlignment });
    }
  }
  return options;
}

// Shared by preparation and battle. Reading readiness never changes the selected fusion.
export function getReadyFusions(items) {
  const used = new Set();
  const fusions = [];
  for (const anchor of items) {
    const options = getFusionOptions(items, anchor, used);
    const fusion = options.find(option => option.targetId === anchor.fusionTargetId) ?? options[0];
    if (!fusion) continue;
    used.add(fusion.targetId);
    fusion.consumedIds.forEach(id => used.add(id));
    fusions.push(fusion);
  }
  return fusions;
}

export function getIronFusionChoices(items, ironId, ready = getReadyFusions(items)) {
  const iron = items.find(item => item.id === ironId && catalogId(item) === 'refined-iron');
  if (!iron) return [];
  const current = ready.find(fusion => fusion.consumedIds.includes(ironId));
  const used = new Set(ready.filter(fusion => fusion !== current)
    .flatMap(fusion => [fusion.targetId, ...fusion.consumedIds]));
  return getFusionOptions(items, iron, used);
}

export function cycleIronFusion(items, ironId) {
  const iron = items.find(item => item.id === ironId && catalogId(item) === 'refined-iron');
  if (!iron) return false;
  const ready = getReadyFusions(items);
  const options = getIronFusionChoices(items, ironId, ready);
  if (options.length < 2) return false;
  const current = ready.find(fusion => fusion.consumedIds.includes(ironId));
  const index = options.findIndex(option => option.targetId === current?.targetId);
  iron.fusionTargetId = options[(index + 1) % options.length].targetId;
  return true;
}

// Progress counts only distinct, equipped ingredients in the recipe's required positions.
export function getFusionProgress(items, ready = getReadyFusions(items)) {
  const reserved = new Set(ready.flatMap(fusion => [fusion.targetId, ...fusion.consumedIds]));
  const equipped = items.filter(item => item.x !== null && item.y !== null && !reserved.has(item.id));
  const progress = [];
  for (const target of equipped) {
    for (const recipe of itemRecipes.filter(recipe => recipe.ingredients[0] === catalogId(target))) {
      const selected = new Set([target.id]);
      let hasAnchor = false;
      const ingredients = [];
      for (const id of recipe.ingredients.slice(1)) {
        const isAnchor = id === recipe.anchor && !hasAnchor;
        const placement = isAnchor ? recipe.placement : (recipe.extraPlacement ?? recipe.placement);
        const ingredient = equipped.find(item => catalogId(item) === id && !selected.has(item.id)
          && (placement === 'adjacent' ? getAdjacentTargets(item, items) : getStarTargets(item, items))
            .some(neighbor => neighbor.id === target.id));
        if (ingredient) selected.add(ingredient.id);
        if (isAnchor) hasAnchor = true;
        const entry = ingredients.find(entry => entry.id === id);
        if (entry) { entry.required++; entry.count += ingredient ? 1 : 0; }
        else ingredients.push({ id, required: 1, count: ingredient ? 1 : 0 });
      }
      progress.push({ targetId: target.id, resultId: recipe.result, ingredients });
    }
  }
  return progress;
}
