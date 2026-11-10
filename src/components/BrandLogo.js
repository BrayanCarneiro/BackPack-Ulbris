import { theme } from '../config/theme.js';

export default function addBrandLogo(scene, x, y, { width = 900, height = 507 } = {}) {
  if (!scene.textures.exists('ulbris-logo')) {
    return scene.add.text(x, y, 'ULBRIS\nBACKPACK BATTLES', {
      fontFamily: theme.fontFamily, fontSize: '44px', fontStyle: 'bold', color: theme.text, align: 'center',
    }).setOrigin(0.5);
  }
  const logo = scene.add.image(x, y, 'ulbris-logo');
  logo.setScale(Math.min(width / logo.width, height / logo.height));
  return logo;
}
