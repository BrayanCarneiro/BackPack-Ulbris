import Phaser from 'phaser';
import TextButton from '../components/TextButton.js';
import { theme } from '../config/theme.js';
import addBrandLogo from '../components/BrandLogo.js';
import addSavedJourney from '../components/SavedJourney.js';
import addMenuBackdrop, { addDivider } from '../components/MenuBackdrop.js';
import { showAccountPanel } from '../ui/AccountPanel.js';

export default class LobbyScene extends Phaser.Scene {
  constructor() {
    super('LobbyScene');
  }

  create() {
    showAccountPanel(this);
    addMenuBackdrop(this);
    this.logo = addBrandLogo(this, 360, 425, { width: 1060, height: 597 });
    this.add.text(360, 660, 'Prepare sua próxima jornada.', {
      fontFamily: theme.displayFont, fontSize: '25px', color: theme.text,
    }).setOrigin(0.5);
    addDivider(this, 360, 706, 300);
    const hasSave = addSavedJourney(this, 360, 780);
    new TextButton(this, 360, hasSave ? 930 : 780, hasSave ? 'Nova jornada' : 'Jogar', () => this.scene.start('CharacterSelectScene'),
      { height: 76, secondary: hasSave });
    new TextButton(this, 360, hasSave ? 1040 : 900, 'Coleção de itens', () => this.scene.start('ItemCatalogScene'),
      { height: 76, secondary: true });
  }
}
