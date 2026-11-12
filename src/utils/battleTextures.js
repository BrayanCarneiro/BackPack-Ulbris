// Build reusable render variants once, including a Canvas-compatible grayscale.
// The original artwork stays intact; these are in-memory game textures.
export function battleTextureTasks(scene, keys) {
  const definitions = [
    ['arthur-battle-body', [201, 342, 663, 983]],
    ['arthur-battle-sword', [166, 101, 392, 1961]],
  ];
  return definitions.filter(([key]) => !keys || keys.includes(key)).flatMap(([key, [x, y, width, height]]) => ['gray', 'burn'].map(variant => () => {
    const texture = scene.textures.get(key);
    if (!texture.has('rig')) texture.add('rig', 0, x, y, width, height);
    const variantKey = `${key}-${variant}`;
    if (scene.textures.exists(variantKey)) return;
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
  }));
}

export function prepareBattleTextures(scene) {
  for (const task of battleTextureTasks(scene)) task();
}
