/**
 * The app's configuration, read from app.json and adjusted only when the
 * pieces for notices that arrive with the app closed are present.
 *
 * Two files make that work, and neither is invented here:
 *
 *   google-services.json  the Firebase project's Android app, registered for
 *                         the package com.latinolivechat.app. It ships inside the APK,
 *                         the way every Android app carries its Firebase setup.
 *   push.config.json      { "easProjectId": "…" } — the notification project
 *                         the push service knows this app by.
 *
 * Without them the configuration is exactly app.json, so a build that has no
 * Firebase setup keeps compiling and installing as it always has.
 */
const fs = require('fs');
const path = require('path');

const base = require('./app.json');

function readPushProject() {
  try {
    const file = fs.readFileSync(path.join(__dirname, 'push.config.json'), 'utf8');
    const value = JSON.parse(file);
    const projectId = typeof value?.easProjectId === 'string' ? value.easProjectId.trim() : '';
    // Expo names a project with a UUID. Anything else is a typo, and it would
    // leave the phone unable to ask for its notification address at all.
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)
      ? projectId
      : null;
  } catch {
    return null;
  }
}

module.exports = () => {
  const app = JSON.parse(JSON.stringify(base.expo));

  if (fs.existsSync(path.join(__dirname, 'google-services.json'))) {
    app.android = { ...app.android, googleServicesFile: './google-services.json' };
  }

  const projectId = readPushProject();
  if (projectId) {
    app.extra = { ...(app.extra ?? {}), eas: { projectId } };
  }

  return app;
};
