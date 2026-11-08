export const ironSwordRecipe = {
  ingredients: ['sword', 'refined-iron'],
  result: 'iron-sword',
  instructions: 'Coloque a Espada de treino em uma estrela do Ferro refinado e complete uma batalha. A fusão acontece ao voltar às compras.',
};

export const ironShieldRecipe = {
  ingredients: ['shield', 'refined-iron'],
  result: 'iron-shield',
  instructions: 'Coloque o Escudo de madeira em uma estrela do Ferro refinado e complete uma batalha. A fusão acontece ao voltar às compras.',
};

export const itemRecipes = [ironSwordRecipe, ironShieldRecipe];

export function getItemRecipes(id) {
  return itemRecipes.filter(recipe => recipe.result === id || recipe.ingredients.includes(id));
}
