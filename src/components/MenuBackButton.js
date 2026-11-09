import TextButton from './TextButton.js';
import { theme } from '../config/theme.js';

export default class MenuBackButton extends TextButton {
  constructor(scene, { onBack = () => scene.scene.start('LobbyScene') } = {}) {
    // Anchor to the centered 720px content, including scenes with a scrolled camera.
    const x = scene.scale.width / 2 - 320 + scene.cameras.main.scrollX;
    super(scene, x, 62, '<', onBack,
      { width: 36, height: 36, fontSize: 24 });
    this.setDepth(30);
    const hint = scene.add.text(x, 92, 'Voltar pro menu', {
      fontFamily: theme.fontFamily, color: theme.text, fontSize: '14px',
      backgroundColor: '#101e24', padding: { x: 4, y: 8 },
      align: 'center', wordWrap: { width: 64 },
    }).setOrigin(0.5, 0).setDepth(31).setVisible(false);
    this.on('pointerover', () => hint.setVisible(true));
    this.on('pointerout', () => hint.setVisible(false));
  }
}
