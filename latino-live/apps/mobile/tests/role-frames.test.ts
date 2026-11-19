import assert from 'node:assert/strict';
import test from 'node:test';
import { ROLE_FRAME_FIT, frameCameraSpot, frameFace } from '../lib/role-frame-fit.ts';

const KINDS = Object.keys(ROLE_FRAME_FIT) as (keyof typeof ROLE_FRAME_FIT)[];

test('every role frame has a window measured inside its own art', () => {
  for (const kind of KINDS) {
    const art = ROLE_FRAME_FIT[kind];
    assert.ok(art, `falta el marco de ${kind}`);
    const face = frameFace(kind, 100);
    assert.ok(face.width > 20 && face.width < 100, `${kind}: ancho de ventana ${face.width}`);
    // La foto es redonda: su alto es su ancho, y el metal cubre lo que sobra.
    assert.equal(face.height, face.width, `${kind}: la foto dejó de ser redonda`);
    assert.ok(face.cx - face.width / 2 >= 0 && face.cx + face.width / 2 <= 100, `${kind}: la ventana se sale a los lados`);
    assert.ok(face.cy - face.height / 2 >= 0 && face.cy + face.height / 2 <= 100, `${kind}: la ventana se sale arriba o abajo`);
  }
});

test('the window sits on the centre of the art, never off to one side', () => {
  for (const kind of KINDS) {
    const art = ROLE_FRAME_FIT[kind];
    assert.ok(Math.abs(art.cx - 0.5) < 0.02, `${kind}: centro horizontal ${art.cx}`);
    assert.ok(Math.abs(art.cy - 0.49) < 0.03, `${kind}: centro vertical ${art.cy}`);
    // La foto nunca puede ser más alta que el hueco: se vería fuera del marco.
    assert.ok(art.openingWidth >= art.openingHeight * 0.9, `${kind}: la foto no llena el hueco`);
  }
});

test('the camera button rides on the face and stays inside the avatar box', () => {
  for (const kind of KINDS) {
    const size = 128;
    const spot = frameCameraSpot(kind, size, 24);
    assert.ok(spot.x > size * 0.3 && spot.x + 24 < size * 0.95, `${kind}: cámara fuera a lo ancho (${spot.x})`);
    assert.ok(spot.y > size * 0.3 && spot.y + 24 < size * 0.95, `${kind}: cámara fuera a lo alto (${spot.y})`);
  }
});
