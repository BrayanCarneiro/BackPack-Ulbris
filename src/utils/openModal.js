// Pause the source so neither gameplay nor its controls run behind a dialog.
export function openModal(source, key, data = {}) {
  if (!source.sys.isActive() || source.scene.isActive(key)) return;
  const inputEnabled = source.input.enabled;
  const effects = source.cameras.main.postFX;
  const blur = source.game.renderer.gl && !source.game.config?.disablePostFX && effects ? effects.addBlur(0, 2, 2, 1) : null;
  source.input.enabled = false;
  source.scene.launch(key, { ...data, sourceKey: source.scene.key });
  source.scene.bringToTop(key);
  source.scene.pause();
  const modal = source.scene.get(key);
  modal.events.once('shutdown', () => {
    if (blur && effects.gameObject) effects.remove(blur);
    source.input.enabled = inputEnabled;
    if (source.sys.isPaused()) source.scene.resume();
  });
}
