// Official core build plus the factories this game actually uses.
// Keep both WebGL and Canvas; physics, tilemaps, particles and video are unnecessary.
import Phaser from 'phaser/src/phaser-core.js';
import Container from 'phaser/src/gameobjects/container/Container.js';
import 'phaser/src/gameobjects/container/ContainerFactory.js';
import 'phaser/src/gameobjects/zone/ZoneFactory.js';
import 'phaser/src/gameobjects/shape/arc/ArcFactory.js';
import 'phaser/src/gameobjects/shape/ellipse/EllipseFactory.js';
import 'phaser/src/gameobjects/shape/rectangle/RectangleFactory.js';

Phaser.GameObjects.Container = Container;
export default Phaser;
