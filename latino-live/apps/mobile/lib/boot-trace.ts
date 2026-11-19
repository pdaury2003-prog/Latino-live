const KEY = 'spk:boot-trace';
const reached: string[] = [];

/** The steps reached during this launch, in order. */
export function reachedSteps() {
  return [...reached];
}

type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

let storage: Storage | null | undefined;

/** Loaded on first use: a phone without the storage module must still open. */
function store(): Storage | null {
  if (storage !== undefined) return storage;
  try {
    storage = require('@react-native-async-storage/async-storage').default as Storage;
  } catch {
    storage = null;
  }
  return storage;
}

export type BootTrace = {
  /** The last step the app finished on its previous launch. */
  step: string;
  at: number;
  error?: string;
};

/**
 * One write per launch instead of one per step. The steps stay in memory for
 * the stalled screen; the phone's storage hears about them once, after the
 * first screens are drawn, so the launch never waits on the bridge.
 */
let pending: BootTrace | null = null;
let flush: ReturnType<typeof setTimeout> | null = null;
let failed = false;

function schedule(value: BootTrace) {
  pending = value;
  if (failed || flush) return;
  flush = setTimeout(() => {
    flush = null;
    const next = pending;
    pending = null;
    if (!next) return;
    try {
      void store()?.setItem(KEY, JSON.stringify(next)).catch(() => { failed = true; });
    } catch {
      failed = true;
    }
  }, 1600);
}

/**
 * Records how far the app got, so a phone that shows nothing can tell us
 * exactly where it stopped instead of leaving a black window.
 */
export function markStep(step: string) {
  if (!reached.includes(step)) reached.push(step);
  // A trace is only a help for the next launch; it never blocks this one.
  schedule({ step, at: Date.now() });
}

export function markFailure(step: string, error: unknown) {
  // A failure is written at once: the app may not live long enough to flush.
  const value: BootTrace = {
    step,
    at: Date.now(),
    error: error instanceof Error ? error.message : String(error),
  };
  pending = value;
  if (flush) { clearTimeout(flush); flush = null; }
  try {
    void store()?.setItem(KEY, JSON.stringify(value)).catch(() => undefined);
  } catch {
    // Same as above.
  }
}

export async function readTrace(): Promise<BootTrace | null> {
  try {
    const raw = await store()?.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as BootTrace;
    return typeof value?.step === 'string' ? value : null;
  } catch {
    return null;
  }
}

/** Names in Spanish for the step list shown when a launch does not finish. */
export const STEP_LABELS: Record<string, string> = {
  brand: 'pantalla de inicio',
  'root-loaded': 'carga de la aplicación',
  'fonts-ready': 'carga de las letras',
  'theme-ready': 'colores de la app',
  'welcome-ready': 'pantalla de bienvenida',
  'ready': 'todo listo',
};

export function stepLabel(step: string) {
  return STEP_LABELS[step] ?? step;
}
