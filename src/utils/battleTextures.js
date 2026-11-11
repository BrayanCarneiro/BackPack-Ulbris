// Build reusable render variants once, including a Canvas-compatible grayscale.
// The original artwork stays intact; these are in-memory game textures.
export function prepareBattleTextures(scene) {
  const definitions = [
    ['arthur-battle-body', [201, 342, 663, 983]],
    ['arthur-battle-sword', [166, 101, 392, 1961]],
  ];
  for (const [key, [x, y, width, height]] of definitions) {
    const texture = scene.textures.get(key);
    if (!texture.has('rig')) texture.add('rig', 0, x, y, width, height);
    for (const variant of ['gray', 'burn']) {
      const variantKey = `${key}-${variant}`;
      if (scene.textures.exists(variantKey)) continue;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (variant === 'gray') context.filter = 'grayscale(1) brightness(0.65)';
      context.drawImage(texture.getSourceImage(), x, y, width, height, 0, 0, width, height);
      if (variant === 'burn') {
        context.globalCompositeOperation = 'source-in';
        context.fillStyle = '#ee4235';
        context.fillRect(0, 0, width, height);
      }
      scene.textures.addCanvas(variantKey, canvas);
    }
  }
}
