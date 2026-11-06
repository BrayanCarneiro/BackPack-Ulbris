import Phaser from 'phaser';
import BootScene from '../scenes/BootScene.js';
import PreloadScene from '../scenes/PreloadScene.js';
import MenuScene from '../scenes/MenuScene.js';
import GameScene from '../scenes/GameScene.js';
import { theme } from './theme.js';

export const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: theme.background,
  input: { activePointers: 2 },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 720,
    height: 1280,
  },
  render: {
    antialias: true,
    powerPreference: 'low-power',
  },
  scene: [BootScene, PreloadScene, MenuScene, GameScene],
};
