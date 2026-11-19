import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RoomRow, SeatRow } from '@/lib/rooms';

const KEY = 'latino-live.billboard.v1';
/** The billboard is public and changes slowly: a copy is safe to show first. */
export type CachedBillboard = { rooms: RoomRow[]; seats: Record<string, SeatRow[]>; at: number };

let memory: CachedBillboard | null = null;

/**
 * The last billboard this phone saw. Opening the app shows it at once, then
 * the network replaces it; a slow connection no longer means an empty screen.
 * Only the public list is kept: nothing personal is stored here.
 */
export async function readBillboard(): Promise<CachedBillboard | null> {
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBillboard;
    if (!Array.isArray(parsed?.rooms) || typeof parsed?.seats !== 'object') return null;
    memory = parsed;
    return parsed;
  } catch {
    return null;
  }
}

/** Saves the billboard after it arrives, without holding the screen. */
export function writeBillboard(rooms: RoomRow[], seats: Record<string, SeatRow[]>) {
  const value: CachedBillboard = { rooms, seats, at: Date.now() };
  memory = value;
  void AsyncStorage.setItem(KEY, JSON.stringify(value)).catch(() => undefined);
}
