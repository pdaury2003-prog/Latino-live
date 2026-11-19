import type * as Audio from 'expo-audio';
import type * as Picker from 'expo-image-picker';

let audio: typeof Audio | null | undefined;
let picker: typeof Picker | null | undefined;

/**
 * The microphone settings module. It is loaded the first time a room opens,
 * so an installed build that does not carry it still opens the rest of the app
 * instead of stopping on a black window.
 */
export function audioModule(): typeof Audio | null {
  if (audio !== undefined) return audio;
  try {
    audio = require('expo-audio') as typeof Audio;
  } catch {
    audio = null;
  }
  return audio;
}

/** The phone gallery. Same rule: a missing module disables photo choices only. */
export function imagePicker(): typeof Picker | null {
  if (picker !== undefined) return picker;
  try {
    picker = require('expo-image-picker') as typeof Picker;
  } catch {
    picker = null;
  }
  return picker;
}
