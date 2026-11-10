import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const phaserFeatures = {
  CANVAS_RENDERER: true, WEBGL_RENDERER: true, WEBGL_DEBUG: false,
  EXPERIMENTAL: false, PLUGIN_3D: false, PLUGIN_CAMERA3D: false,
  PLUGIN_FBINSTANT: false, FEATURE_SOUND: false,
};
// Phaser uses `typeof FLAG` as a build-time switch. Apply the official switches
// before CommonJS conversion in both Vite's dev optimizer and production build.
const phaserFeaturePlugin = () => ({
  name: 'phaser-feature-switches',
  enforce: 'pre',
  transform(code, id) {
    if (!/[/\\]phaser[/\\]src[/\\]/.test(id)) return null;
    return code.replace(/\bglobal\.Phaser\b/g, 'globalThis.Phaser')
      .replace(/\btypeof (CANVAS_RENDERER|WEBGL_RENDERER|WEBGL_DEBUG|EXPERIMENTAL|PLUGIN_3D|PLUGIN_CAMERA3D|PLUGIN_FBINSTANT|FEATURE_SOUND)\b/g,
      (_, key) => String(phaserFeatures[key]));
  },
});

export default defineConfig({
  // Relative asset URLs work both locally and under the GitHub repository path.
  base: './',
  plugins: [phaserFeaturePlugin()],
  optimizeDeps: {
    rolldownOptions: {
      plugins: [phaserFeaturePlugin()],
      transform: { define: { global: 'globalThis' } },
    },
  },
  resolve: {
    alias: [{ find: /^phaser$/, replacement: fileURLToPath(new URL('./src/lib/phaser.js', import.meta.url)) }],
  },
  build: {
    target: 'es2020',
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: 'engine', test: /node_modules/ }] } },
    },
  },
});
