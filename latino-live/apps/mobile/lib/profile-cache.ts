import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProfileRow } from '@/lib/rooms';

const KEY = 'latino-live.profiles.v1';
/** Cuántas fichas se guardan: las últimas personas con las que se cruzó. */
const LIMIT = 80;

type Entry = { row: ProfileRow; at: number };

let memory: Record<string, Entry> | null = null;
let reading: Promise<void> | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Las fichas de las personas, guardadas en el teléfono.
 *
 * Un perfil cambia poco: el nombre, la foto, el marco, el nivel. Guardarlo
 * permite abrir una ficha al instante con lo último que se vio —aunque no haya
 * conexión— y pedir la versión nueva por detrás. Es la parte de la app que se
 * siente instantánea porque ya no espera a la red para dibujar.
 *
 * Vive solo en el almacenamiento privado de la app y se vacía al cerrar sesión.
 */
export function hydrateProfiles(): Promise<void> {
  if (memory) return Promise.resolve();
  if (reading) return reading;
  reading = AsyncStorage.getItem(KEY)
    .then(raw => {
      if (!raw) {
        memory = {};
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, Entry>;
      memory = parsed && typeof parsed === 'object' ? parsed : {};
    })
    .catch(() => {
      memory = {};
    });
  return reading;
}

/** La última versión guardada de una persona, al instante y sin red. */
export function cachedProfile(userId: string | null | undefined): ProfileRow | null {
  if (!userId || !memory) return null;
  return memory[userId]?.row ?? null;
}

/** Las fichas guardadas de varias personas, en el orden pedido. */
export function cachedProfiles(ids: string[]): ProfileRow[] {
  if (!memory) return [];
  return ids.map(id => memory?.[id]?.row).filter((row): row is ProfileRow => Boolean(row));
}

/** Guarda lo que llegó de la red; la escritura al disco espera medio segundo. */
export function rememberProfiles(rows: ProfileRow[]) {
  if (rows.length === 0) return;
  if (!memory) memory = {};
  const now = Date.now();
  for (const row of rows) {
    if (!row?.id) continue;
    memory[row.id] = { row, at: now };
  }
  // Solo las fichas más recientes: la lista no crece sin fin en el teléfono.
  const entries = Object.entries(memory).sort((a, b) => b[1].at - a[1].at).slice(0, LIMIT);
  memory = Object.fromEntries(entries);
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    const value = memory;
    if (!value) return;
    void AsyncStorage.setItem(KEY, JSON.stringify(value)).catch(() => undefined);
  }, 500);
}

/** Al cerrar sesión, las fichas guardadas se van con ella. */
export function clearProfileCache() {
  memory = {};
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = null;
  void AsyncStorage.removeItem(KEY).catch(() => undefined);
}
