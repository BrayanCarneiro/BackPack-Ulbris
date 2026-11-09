import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig.js';
import './styles.css';

const game = new Phaser.Game(gameConfig);
export default game;

// Vite can replace this module during development without leaving another canvas.
if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy(true));
}
