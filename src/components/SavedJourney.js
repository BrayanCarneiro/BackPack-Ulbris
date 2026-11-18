import TextButton from './TextButton.js';
import { loadRun, getRunSync, refreshRunSave, subscribeRunStatus, getRunStatus, getRunOwner } from '../systems/RunSave.js';
import { theme } from '../config/theme.js';

export default function addSavedJourney(scene, x, y) {
  scene.continueJourneyButton = null;
  scene.reloadJourneyButton = null;
  const owner = getRunOwner();
  const sync = getRunSync();
  if (sync) {
    const label = scene.add.text(x, y + 96, '', { fontFamily: theme.fontFamily, fontSize: '14px',
      color: theme.muted, align: 'center', wordWrap: { width: 600 } }).setOrigin(0.5);
    const update = value => label.setText(value?.message ?? '');
    update(getRunStatus());
    const unsubscribe = subscribeRunStatus(update);
    scene.events.once('shutdown', unsubscribe);
    if (['conflict', 'error', 'auth'].includes(sync.state().status)
      || (sync.state().status === 'offline' && loadRun().status !== 'ok')) {
      const conflict = sync.state().status === 'conflict';
      scene.reloadJourneyButton = new TextButton(scene, x, y,
        conflict ? 'Usar versão do banco' : 'Tentar reconectar', async () => {
          scene.reloadJourneyButton.setEnabled(false);
          await refreshRunSave({ useDatabase: conflict });
          if (scene.sys.isActive() && getRunOwner() === owner) scene.scene.restart();
        }, { width: 480, height: 76, fontSize: 26, secondary: true });
      // Reserve the same space as a saved journey for the recovery action.
      return true;
    }
  }
  const saved = loadRun();
  const message = scene.registry.get('saveWarning')
    ?? (saved.status === 'unavailable' ? saved.message : null);
  if (message) {
    scene.add.text(x, y + 78, message, { fontFamily: theme.fontFamily, fontSize: '18px',
      color: '#e7b49a', align: 'center', wordWrap: { width: 620 } }).setOrigin(0.5);
  }
  if (saved.status !== 'ok') return false;
  const { session, phase } = saved;
  const button = new TextButton(scene, x, y, owner ? 'Continuar jornada' : 'Continuar como visitante', async () => {
    button.setEnabled(false);
    await refreshRunSave();
    if (!scene.sys.isActive() || getRunOwner() !== owner || scene.continueJourneyButton !== button) return;
    // Read again at click time so a changed save is never resumed from stale UI data.
    const current = loadRun();
    if (current.status !== 'ok') { scene.scene.restart(); return; }
    scene.registry.set('selectedCharacter', current.session.classId);
    scene.scene.start(current.phase === 'victory' ? 'VictoryChoiceScene' : 'ShopScene',
      { session: current.session });
  }, { width: 480, height: 76, fontSize: 28 });
  scene.continueJourneyButton = button;
  if (!message) scene.add.text(x, y + 64,
    `${owner ? '' : 'Visitante · '}Arthur · Rodada ${session.round} · ${session.wins} vitórias · ${session.lives} vidas${phase === 'victory' ? '\nEscolha: terminar ou modo infinito' : session.endless ? ' · Infinito' : ''}`,
    { fontFamily: theme.fontFamily, fontSize: '18px', color: theme.muted,
      align: 'center', wordWrap: { width: 640 } }).setOrigin(0.5);
  return true;
}
