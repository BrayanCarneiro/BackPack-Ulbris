import TextButton from './TextButton.js';
import { theme } from '../config/theme.js';
import { openModal } from '../utils/openModal.js';

export default class MenuBackButton extends TextButton {
  constructor(scene, { onBack = () => scene.scene.start('LobbyScene'), disabled = false,
    x = scene.scale.width / 2 - 320 + scene.cameras.main.scrollX, y = 62 } = {}) {
    // Anchor to the centered 720px content, including scenes with a scrolled camera.
    super(scene, x, y, '<', () => {
      if (disabled || !scene.sys.isActive()) return;
      const session = scene.session;
      if (session && !session.runResult && (session.pendingFusions !== null || session.round > 1)) {
        openModal(scene, 'ExitConfirmScene', { onConfirm: onBack });
      } else onBack();
    },
      { width: 36, height: 36, fontSize: 24 });
    this.setDepth(30);
    if (disabled) {
      this.disableInteractive().setAlpha(0.3);
      return;
    }
    const hint = scene.add.text(x, y + 30, 'Voltar pro menu', {
      fontFamily: theme.fontFamily, color: theme.text, fontSize: '14px',
      backgroundColor: '#101e24', padding: { x: 4, y: 8 },
      align: 'center', wordWrap: { width: 64 },
    }).setOrigin(0.5, 0).setDepth(31).setVisible(false);
    this.on('pointerover', () => hint.setVisible(true));
    this.on('pointerout', () => hint.setVisible(false));
  }
}
