import { characters } from './characters.js';
import { itemAtlases } from './itemAtlases.js';
import { arthurAttacks, attackFrame } from './arthurAnimations.js';

export const menuAssets = [{ key: 'ulbris-logo', path: 'brand/ulbris-logo.png' }];
export const itemAssets = itemAtlases;
export function getClassItemAssets(data = {}, registry) {
  const classId = data.item?.pool ?? data.session?.classId ?? data.classId ?? registry?.get('selectedCharacter') ?? 'arthur';
  return itemAtlases.filter(atlas => atlas.pool === 'general' || atlas.pool === classId);
}
export const selectionAssets = characters.flatMap(character => [
  { key: character.portrait, path: character.portraitPath },
  { key: character.background, path: character.backgroundPath },
]);
export const battleAssets = [
  { key: 'arthur-battle-body', path: 'characters/arthur/battle-body.png' },
  { key: 'arthur-battle-sword', path: 'characters/arthur/battle-sword.png' },
  ...Object.values(arthurAttacks).map(attack => ({
    key: attack.key, path: `characters/arthur/${attack.file}`, frame: attackFrame,
  })),
];
