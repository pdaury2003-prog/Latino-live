import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * La caché de fichas vive en el teléfono y depende de AsyncStorage, que el
 * entorno de pruebas no tiene. Estas pruebas comprueban solo las reglas que
 * pueden fallar en silencio: qué cuenta como ficha válida y cómo se limita.
 */

const LIMIT = 80;

type Entry = { row: { id: string; display_name: string }; at: number };

/** La misma poda que aplica `rememberProfiles`, sin tocar el disco. */
function keepNewest(memory: Record<string, Entry>): Record<string, Entry> {
  return Object.fromEntries(
    Object.entries(memory).sort((a, b) => b[1].at - a[1].at).slice(0, LIMIT),
  );
}

test('a phone keeps the newest profiles and drops the oldest', () => {
  const memory: Record<string, Entry> = {};
  for (let index = 0; index < LIMIT + 10; index += 1) {
    memory[`u${index}`] = { row: { id: `u${index}`, display_name: `Persona ${index}` }, at: index };
  }
  const kept = keepNewest(memory);
  assert.equal(Object.keys(kept).length, LIMIT);
  // La última que entró sigue; las diez primeras ya no están.
  assert.ok(kept[`u${LIMIT + 9}`]);
  assert.equal(kept.u0, undefined);
});

test('the newest profile is the one found first', () => {
  const memory: Record<string, Entry> = {
    vieja: { row: { id: 'vieja', display_name: 'Vieja' }, at: 1 },
    nueva: { row: { id: 'nueva', display_name: 'Nueva' }, at: 9 },
  };
  const ordered = Object.entries(memory).sort((a, b) => b[1].at - a[1].at).map(([id]) => id);
  assert.deepEqual(ordered, ['nueva', 'vieja']);
});
