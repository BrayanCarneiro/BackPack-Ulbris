export const ironSwordRecipe = {
  ingredients: ['sword', 'refined-iron'],
  result: 'iron-sword',
  anchor: 'refined-iron',
  placement: 'adjacent',
  instructions: 'Encoste o Ferro refinado por uma borda na Espada de treino e complete uma batalha. Não exige estrelas. Se houver mais de uma fusão possível, pegue e solte o ferro na mesma posição para alternar o resultado destacado em verde.',
};

export const ironShieldRecipe = {
  ingredients: ['shield', 'refined-iron'],
  result: 'iron-shield',
  anchor: 'refined-iron',
  placement: 'adjacent',
  instructions: 'Encoste o Ferro refinado por uma borda no Escudo de madeira e complete uma batalha. Não exige estrelas. Se houver mais de uma fusão possível, pegue e solte o ferro na mesma posição para alternar o resultado destacado em verde.',
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

export const ironHelmetRecipe = {
  ingredients: ['leather-helmet', 'refined-iron'], result: 'iron-helmet', anchor: 'refined-iron',
  placement: 'adjacent',
  instructions: 'Encoste o Ferro refinado por uma borda no Elmo de couro e complete uma batalha. Não exige estrelas. Se houver mais de uma fusão possível, pegue e solte o ferro na mesma posição para alternar o resultado destacado em verde.',
};

export const ironArmorRecipe = {
  ingredients: ['leather-chestplate', 'refined-iron', 'refined-iron'], result: 'iron-armor', anchor: 'refined-iron',
  placement: 'adjacent',
  instructions: 'Encoste dois Ferros refinados diferentes por uma borda no Peitoral de couro e complete uma batalha. Não exige estrelas. Os dois ferros são consumidos ao voltar às compras.',
};

export const vampiricChestplateRecipe = {
  ingredients: ['iron-armor', 'carmine-stone', 'vital-crystal'], result: 'vampiric-chestplate', anchor: 'carmine-stone',
  extraPlacement: 'adjacent', resultAlignment: 'center',
  instructions: 'Coloque a Armadura de ferro na estrela da Pedra Carmim e encoste um Cristal vital na armadura. Complete uma batalha para fundir. A pedra e o cristal são consumidos; se as ombreiras não couberem, o resultado vai para a reserva.',
};

export const itemRecipes = [ironSwordRecipe, ironShieldRecipe, battleAxeRecipe, flamingDaggersRecipe,
  ironHelmetRecipe, ironArmorRecipe, vampiricChestplateRecipe];

export function getItemRecipes(id) {
  return itemRecipes.filter(recipe => recipe.result === id || recipe.ingredients.includes(id));
}
