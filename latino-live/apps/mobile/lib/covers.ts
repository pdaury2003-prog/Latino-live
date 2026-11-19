export const COVERS = {
  palace: require('@/assets/rooms/palace.jpg'),
  pool: require('@/assets/rooms/pool.jpg'),
  terrace: require('@/assets/rooms/terrace.jpg'),
} as const;

export type CoverKey = keyof typeof COVERS;

export const COVER_OPTIONS: { key: CoverKey; label: string }[] = [
  { key: 'palace', label: 'Palacio' },
  { key: 'pool', label: 'Piscina' },
  { key: 'terrace', label: 'Terraza' },
];

export const coverSource = (key: string) => COVERS[(key as CoverKey) in COVERS ? (key as CoverKey) : 'palace'];

export const COUNTRY_LABEL: Record<string, string> = { US: 'USA', ES: 'España', MX: 'México', AR: 'Argentina', CO: 'Colombia' };
