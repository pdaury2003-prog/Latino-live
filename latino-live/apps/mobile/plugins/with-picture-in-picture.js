const { withAndroidManifest } = require('expo/config-plugins');

/**
 * La ventana flotante (picture-in-picture) se declara en la actividad principal:
 * sin supportsPictureInPicture el sistema no deja abrirla, y resizeableActivity
 * le permite encogerse al tamaño de la ventanita.
 *
 * configChanges avisa a la actividad de cada cambio de tamaño y de orientación
 * en lugar de recrearla: al pasar a la ventana flotante o al girar el teléfono,
 * la sala y la voz siguen donde estaban y no vuelven a cargar.
 */
const CONFIG_CHANGES = [
  'keyboard',
  'keyboardHidden',
  'orientation',
  'screenSize',
  'smallestScreenSize',
  'screenLayout',
  'uiMode',
  'density',
];

module.exports = function withPictureInPicture(config) {
  return withAndroidManifest(config, cfg => {
    const manifest = cfg.modResults.manifest;
    const application = manifest.application?.[0];
    if (!application) return cfg;

    const activities = application.activity ?? [];
    const main =
      activities.find(activity =>
        (activity['intent-filter'] ?? []).some(filter =>
          (filter.action ?? []).some(
            action => action.$?.['android:name'] === 'android.intent.action.MAIN',
          ),
        ),
      ) ?? activities[0];

    if (main) {
      main.$['android:supportsPictureInPicture'] = 'true';
      main.$['android:resizeableActivity'] = 'true';
      const current = (main.$['android:configChanges'] ?? '')
        .split('|')
        .map(value => value.trim())
        .filter(Boolean);
      const merged = [...new Set([...current, ...CONFIG_CHANGES])];
      main.$['android:configChanges'] = merged.join('|');
    }

    // Un teléfono sin ventana flotante puede instalar la app igual: la sala
    // sigue funcionando y solo se salta ese modo.
    const features = manifest['uses-feature'] ?? [];
    if (!features.some(item => item.$?.['android:name'] === 'android.software.picture_in_picture')) {
      features.push({
        $: {
          'android:name': 'android.software.picture_in_picture',
          'android:required': 'false',
        },
      });
      manifest['uses-feature'] = features;
    }

    return cfg;
  });
};
