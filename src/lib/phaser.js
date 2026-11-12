// Explicit engine entry: retain the scene plugins/factories we use, without
// exporting the entire core namespace and its unused loaders and utilities.
import constants from 'phaser/src/const.js';
import Game from 'phaser/src/core/Game.js';
import Scene from 'phaser/src/scene/Scene.js';
import scaleConstants from 'phaser/src/scale/const/index.js';
import Container from 'phaser/src/gameobjects/container/Container.js';
import 'phaser/src/events/EventEmitter.js';
import 'phaser/src/cameras/2d/CameraManager.js';
import 'phaser/src/gameobjects/GameObjectCreator.js';
import 'phaser/src/gameobjects/GameObjectFactory.js';
import 'phaser/src/gameobjects/DisplayList.js';
import 'phaser/src/gameobjects/UpdateList.js';
import 'phaser/src/scene/ScenePlugin.js';
import 'phaser/src/time/Clock.js';
import 'phaser/src/data/DataManagerPlugin.js';
import 'phaser/src/input/InputPlugin.js';
import 'phaser/src/input/keyboard/KeyboardPlugin.js';
import 'phaser/src/loader/LoaderPlugin.js';
import 'phaser/src/tweens/TweenManager.js';
import 'phaser/src/loader/filetypes/ImageFile.js';
import 'phaser/src/loader/filetypes/SpriteSheetFile.js';
import 'phaser/src/loader/filetypes/AtlasJSONFile.js';
import 'phaser/src/gameobjects/graphics/GraphicsFactory.js';
import 'phaser/src/gameobjects/image/ImageFactory.js';
import 'phaser/src/gameobjects/sprite/SpriteFactory.js';
import 'phaser/src/gameobjects/text/TextFactory.js';
import 'phaser/src/gameobjects/container/ContainerFactory.js';
import 'phaser/src/gameobjects/zone/ZoneFactory.js';
import 'phaser/src/gameobjects/shape/arc/ArcFactory.js';
import 'phaser/src/gameobjects/shape/ellipse/EllipseFactory.js';
import 'phaser/src/gameobjects/shape/rectangle/RectangleFactory.js';

const Scale = { ...scaleConstants.CENTER, ...scaleConstants.SCALE_MODE, ...scaleConstants.ORIENTATION, ...scaleConstants.ZOOM };
const Phaser = { ...constants, Game, Scene, Scale, GameObjects: { Container } };
globalThis.Phaser = Phaser;
export default Phaser;
