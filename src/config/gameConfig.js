import Phaser from 'phaser';
import BootScene from '../scenes/BootScene.js';
import PreloadScene from '../scenes/PreloadScene.js';
import MenuScene from '../scenes/MenuScene.js';
import GameScene from '../scenes/GameScene.js';
import ShopScene from '../scenes/ShopScene.js';
import BattleScene from '../scenes/BattleScene.js';
import ItemInfoScene from '../scenes/ItemInfoScene.js';
import ExitConfirmScene from '../scenes/ExitConfirmScene.js';
import RunEndScene from '../scenes/RunEndScene.js';
import WinningBackpackScene from '../scenes/WinningBackpackScene.js';
import LobbyScene from '../scenes/LobbyScene.js';
import ItemCatalogScene from '../scenes/ItemCatalogScene.js';
import { theme } from './theme.js';

const reduceEffects = (navigator.deviceMemory > 0 && navigator.deviceMemory <= 4)
  || (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4)
  || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: theme.background,
  input: { activePointers: 2 },
  fps: { target: 60, limit: 60 },
  disablePreFX: true,
  disablePostFX: reduceEffects,
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
  scene: [BootScene, PreloadScene, MenuScene, LobbyScene, ItemCatalogScene, ShopScene, GameScene, BattleScene, ItemInfoScene, ExitConfirmScene, RunEndScene, WinningBackpackScene],
};
