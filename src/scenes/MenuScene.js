import Phaser from 'phaser';
import TextButton from '../components/TextButton.js';
import { theme } from '../config/theme.js';
import addBrandLogo from '../components/BrandLogo.js';
import addSavedJourney from '../components/SavedJourney.js';
import addMenuBackdrop, { addDivider } from '../components/MenuBackdrop.js';
import { showAccountPanel } from '../ui/AccountPanel.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    showAccountPanel(this);
    const { width, height } = this.scale;
    const centerX = width / 2;

    addMenuBackdrop(this);
    this.add.text(centerX, height * 0.16, 'ORGANIZE. PLANEJE. AVANCE.', {
      fontFamily: theme.fontFamily,
      fontSize: '18px', letterSpacing: 3,
      color: theme.muted,
    }).setOrigin(0.5);

    this.logo = addBrandLogo(this, centerX, height * 0.35, { width: 1060, height: 597 });

    this.add.text(centerX, height * 0.57, 'Cada espaço, uma possibilidade.', {
      fontFamily: theme.displayFont,
      fontSize: '25px',
      color: theme.muted,
    }).setOrigin(0.5);

    addDivider(this, centerX, height * 0.61, 340);
    const hasSave = addSavedJourney(this, centerX, height * 0.69);
    new TextButton(this, centerX, height * (hasSave ? 0.84 : 0.70), hasSave ? 'Menu do jogo' : 'Iniciar', () => {
      this.scene.start('LobbyScene');
    }, { height: 76, secondary: hasSave });
  }
}
