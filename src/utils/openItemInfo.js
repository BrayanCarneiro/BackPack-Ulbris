export function openItemInfo(scene, item) {
  if (!scene.sys.isActive() || scene.scene.isActive('ItemInfoScene')) return;
  scene.scene.launch('ItemInfoScene', { item: { ...item }, sourceKey: scene.scene.key });
  scene.scene.pause();
}
