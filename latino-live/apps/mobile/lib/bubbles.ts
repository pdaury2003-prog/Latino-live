/** The three bubble colours a moderator can wear in the room chat. */
export type BubbleColor = 'rose' | 'blue' | 'red';

export const BUBBLES: { key: BubbleColor; label: string; fill: string; border: string; ink: string }[] = [
  { key: 'rose', label: 'Rosa', fill: 'rgba(242,155,184,0.70)', border: 'rgba(242,155,184,0.95)', ink: '#2A0B16' },
  { key: 'blue', label: 'Azul', fill: 'rgba(96,170,255,0.70)', border: 'rgba(96,170,255,0.95)', ink: '#04162B' },
  { key: 'red', label: 'Rojo', fill: 'rgba(232,86,86,0.70)', border: 'rgba(232,86,86,0.95)', ink: '#2B0505' },
];

export function bubble(color: string | null | undefined) {
  return BUBBLES.find(item => item.key === color) ?? BUBBLES[0];
}
