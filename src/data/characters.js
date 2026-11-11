// Each character owns both its portrait and its selection scenery.
export const characters = [
  {
    id: 'arthur', name: 'Arthur', className: 'Cavaleiro',
    portrait: 'arthur-portrait', portraitFrame: 'body', background: 'arthur-background',
    portraitPath: 'characters/arthur/portrait.png',
    backgroundPath: 'characters/arthur/background.png',
  },
];

export const getCharacter = id => characters.find(character => character.id === id) ?? characters[0];
