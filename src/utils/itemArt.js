import { itemArt } from '../data/itemArt.js';

export function getItemArt(scene, piece) {
  const art = itemArt[piece.catalogId ?? piece.id];
  return art && scene.textures.exists(art.key) ? art : null;
}

// Fit the upright source into the item's unrotated bounds, then rotate it with
// its footprint. This preserves proportions for 1x3 swords at every orientation.
export function fitItemArt(image, piece, width, height) {
  const angle = ((piece.rotation ?? 0) % 360 + 360) % 360;
  const sideways = angle % 180 === 90;
  const availableWidth = sideways ? height : width;
  const availableHeight = sideways ? width : height;
  const scale = Math.min(availableWidth / image.frame.realWidth, availableHeight / image.frame.realHeight);
  return image.setScale(scale).setAngle(angle);
}

export function addItemArt(scene, piece, x, y, width, height) {
  const art = getItemArt(scene, piece);
  if (!art) return null;
  return fitItemArt(scene.add.image(x, y, art.key).setData('itemArtId', piece.catalogId ?? piece.id), piece, width, height);
}
