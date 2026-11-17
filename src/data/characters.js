// Each character owns both its portrait and its selection scenery.
export const characters = [
  {
    id: 'arthur', name: 'Arthur', className: 'Cavaleiro',
    description: 'Um cavaleiro que transforma proteção em poder. Combine qualquer tipo de arma com armaduras para fortalecer seus ataques.',
    passive: {
      name: 'Aço e Honra',
      description: 'Cada arma causa +5% de dano por peça de armadura encostada nela, até +15% por arma.',
      detail: 'Elmos, peitorais e escudos contam. O contato deve ser pelos lados, sem diagonais. Cada peça conta uma vez por arma e pode beneficiar várias armas.',
    },
    portrait: 'arthur-portrait', portraitFrame: 'body', background: 'arthur-background',
    portraitPath: 'characters/arthur/portrait.png',
    backgroundPath: 'characters/arthur/background.png',
  },
];

export const getCharacter = id => characters.find(character => character.id === id) ?? characters[0];
