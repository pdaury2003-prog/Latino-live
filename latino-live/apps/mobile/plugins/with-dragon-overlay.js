const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

/**
 * The dragon's page and its two models travel with the app: they are copied
 * into the Android assets so the native layer can open them from the phone
 * itself, without needing a connection.
 *
 * The models used to be pasted inside the page in base64: the page weighed
 * thirteen megabytes and the phone had to hold two copies of the dragon at
 * once. As files beside the page, each model costs its own size only.
 */
const FOLDER = path.join('assets', 'dragon');
const FILES = ['dragon_layer.html', 'dragon_hombre.glb', 'dragon_mujer.glb'];

module.exports = function withDragonOverlay(config) {
  return withDangerousMod(config, [
    'android',
    async cfg => {
      const assets = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'assets');
      fs.mkdirSync(assets, { recursive: true });
      for (const name of FILES) {
        fs.copyFileSync(path.join(cfg.modRequest.projectRoot, FOLDER, name), path.join(assets, name));
      }
      return cfg;
    },
  ]);
};
