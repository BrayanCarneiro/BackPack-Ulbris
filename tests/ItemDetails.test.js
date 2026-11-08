import test from 'node:test';
import assert from 'node:assert/strict';
import { getItemDetails, itemCatalog } from '../src/utils/itemDetails.js';
import { getItemRecipes, ironSwordRecipe, ironShieldRecipe, itemRecipes } from '../src/data/itemRecipes.js';

test('todos os itens da loja e da fusão possuem informações sem alterar o catálogo', () => {
  const before = JSON.stringify(itemCatalog);
  for (const item of itemCatalog) {
    const details = getItemDetails(item.id);
    assert.equal(details.name, item.name);
    assert.ok(details.effects.length > 0);
    assert.ok(details.attributes.every(([label, value]) => label && value));
  }
  assert.equal(JSON.stringify(itemCatalog), before);
  assert.equal(getItemDetails('unknown'), null);
});

test('a ficha da espada de ferro exibe seus atributos reais e a passiva do terceiro golpe', () => {
  const details = getItemDetails('iron-sword');
  const attributes = Object.fromEntries(details.attributes);
  assert.equal(attributes.Dano, '3');
  assert.equal(attributes.Precisão, '90%');
  assert.equal(attributes['Estamina por ataque'], '1,5');
  assert.equal(attributes.Recarga, '2,5 s');
  assert.equal(attributes['Chance crítica'], '3%');
  assert.equal(attributes['Dano crítico'], '4,5 (+50%)');
  assert.ok(details.effects.some(effect => effect.includes('60%') && effect.includes('4,5')));
});

test('cópias e itens girados mantêm tamanho e direção próprios na ficha', () => {
  const copy = { id: 'refined-iron#2', catalogId: 'refined-iron', width: 1, height: 1, rotation: 90 };
  const details = getItemDetails(copy);
  assert.equal(details.name, 'Ferro refinado');
  assert.ok(details.effects.some(effect => effect.includes('acima e abaixo')));
  const rotated = getItemDetails({ id: 'sword#2', catalogId: 'iron-sword', width: 3, height: 1, rotation: 90 });
  assert.equal(rotated.name, 'Espada de ferro');
  assert.equal(rotated.piece.width, 3);
  assert.equal(rotated.piece.height, 1);
});

test('a mesma receita aparece para os dois ingredientes e o resultado, e não para itens sem fusão', () => {
  for (const id of ['sword', 'iron-sword']) {
    assert.deepEqual(getItemRecipes(id), [ironSwordRecipe]);
    assert.deepEqual(getItemDetails(id).recipes[0].ingredients, ['sword', 'refined-iron']);
    assert.equal(getItemDetails(id).recipes[0].result, 'iron-sword');
  }
  assert.deepEqual(getItemRecipes('refined-iron'), [ironSwordRecipe, ironShieldRecipe]);
  for (const id of ['shield', 'iron-shield']) assert.deepEqual(getItemRecipes(id), [ironShieldRecipe]);
  for (const id of ['traveler-bag', 'long-bag', 'pouch', 'potion']) {
    assert.deepEqual(getItemDetails(id).recipes, []);
  }
});

test('cada componente e resultado da receita possui uma ficha consultável', () => {
  for (const id of itemRecipes.flatMap(recipe => [...recipe.ingredients, recipe.result])) {
    assert.ok(getItemDetails(id));
  }
  const shield = getItemDetails('shield');
  assert.equal(Object.fromEntries(shield.attributes)['Armadura inicial'], '+9');
  assert.ok(shield.effects.some(effect => effect.includes('30%') && effect.includes('1,8')));
});
