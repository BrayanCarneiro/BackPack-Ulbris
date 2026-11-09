export const ironSwordRecipe = {
  ingredients: ['sword', 'refined-iron'],
  result: 'iron-sword',
  anchor: 'refined-iron',
  instructions: 'Coloque a Espada de treino em uma estrela do Ferro refinado e complete uma batalha. A fusão acontece ao voltar às compras.',
};

export const ironShieldRecipe = {
  ingredients: ['shield', 'refined-iron'],
  result: 'iron-shield',
  anchor: 'refined-iron',
  instructions: 'Coloque o Escudo de madeira em uma estrela do Ferro refinado e complete uma batalha. A fusão acontece ao voltar às compras.',
};

export const battleAxeRecipe = {
  ingredients: ['hatchet', 'hatchet'], result: 'battle-axe', anchor: 'hatchet',
  placement: 'adjacent',
  instructions: 'Encoste duas Machadinhas por uma borda e complete uma batalha. Não exige estrelas. O Machado ocupa 4 espaços; se não couber após a fusão, vai para a reserva.',
};

export const flamingDaggersRecipe = {
  ingredients: ['quick-daggers', 'fire-stone'], result: 'flaming-daggers', anchor: 'fire-stone',
  instructions: 'Coloque as Adagas rápida em uma estrela da Pedra de fogo e complete uma batalha. A pedra é consumida ao voltar às compras.',
};

export const itemRecipes = [ironSwordRecipe, ironShieldRecipe, battleAxeRecipe, flamingDaggersRecipe];

export function getItemRecipes(id) {
  return itemRecipes.filter(recipe => recipe.result === id || recipe.ingredients.includes(id));
}
