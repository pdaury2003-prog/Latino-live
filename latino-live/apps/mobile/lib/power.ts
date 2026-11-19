import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The two saving modes the phone keeps for itself.
 *
 * They are a device choice, not an account one: the same person may want the
 * full show on a tablet at home and the quiet version on a phone with little
 * battery. Every screen reads them from one small store, so flipping a switch
 * changes what is on screen at once and never waits for the network.
 */
export type PowerSettings = {
  /** Turns the looping decoration off: frames, auras, waves and flames. */
  battery: boolean;
  /** Stops videos from loading on their own and keeps remote photos out. */
  data: boolean;
  /** False until the phone has told us what was saved. */
  ready: boolean;
};

const STORAGE_KEY = 'latino-live.power.v1';

let settings: PowerSettings = { battery: false, data: false, ready: false };
const listeners = new Set<() => void>();
let hydration: Promise<void> | null = null;

function emit(next: PowerSettings) {
  if (
    next.battery === settings.battery &&
    next.data === settings.data &&
    next.ready === settings.ready
  ) return;
  settings = next;
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function snapshot() {
  return settings;
}

/**
 * Los modos de ahorro tal como están ahora, sin esperar a un dibujo nuevo.
 * Lo usan las cargas que corren por detrás (calentar imágenes, clips) para no
 * gastar datos cuando la persona pidió justo lo contrario.
 */
export function powerNow(): PowerSettings {
  return settings;
}

/** Reads the saved modes once, as early as the app starts. */
export function hydratePower(): Promise<void> {
  if (hydration) return hydration;
  hydration = AsyncStorage.getItem(STORAGE_KEY)
    .then(raw => {
      if (!raw) {
        emit({ ...settings, ready: true });
        return;
      }
      try {
        const saved = JSON.parse(raw) as { battery?: unknown; data?: unknown };
        emit({ battery: saved.battery === true, data: saved.data === true, ready: true });
      } catch {
        emit({ ...settings, ready: true });
      }
    })
    .catch(() => emit({ ...settings, ready: true }));
  return hydration;
}

function persist() {
  void AsyncStorage
    .setItem(STORAGE_KEY, JSON.stringify({ battery: settings.battery, data: settings.data }))
    .catch(() => undefined);
}

export function setBatterySaver(on: boolean) {
  emit({ ...settings, battery: on, ready: true });
  persist();
}

export function setDataSaver(on: boolean) {
  emit({ ...settings, data: on, ready: true });
  persist();
}

/** The saved modes, re-rendering the screen that asked when one changes. */
export function usePowerSettings(): PowerSettings {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** True when decorative motion may run. Seats and dense lists pass false on top. */
export function useMotion(): boolean {
  return !usePowerSettings().battery;
}

/** True while the phone asks us to keep mobile data down. */
export function useDataSaver(): boolean {
  return usePowerSettings().data;
}
