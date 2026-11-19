/**
 * The sixteen animated stickers of the room. Each name is the animation the
 * owner asked for; the panel groups them and each one has its own acting.
 */

export type StickerGroup = "saludos" | "emociones" | "fiesta" | "carteles";

export type Sticker = {
  id: string;
  name: string;
  label: string;
  group: StickerGroup;
  tint: [string, string];
  burst: string[];
  shout?: string;
  sign?: string;
};

export const STICKER_GROUPS: { key: StickerGroup; label: string; emoji: string }[] = [
  { key: "saludos", label: "Saludos", emoji: "👋" },
  { key: "emociones", label: "Emociones", emoji: "🔥" },
  { key: "fiesta", label: "Fiesta", emoji: "🎉" },
  { key: "carteles", label: "Carteles", emoji: "🪧" },
];

export const STICKERS: Sticker[] = [
  { id: "idle", name: "Idle", label: "Idle", group: "saludos", tint: ["#FFD79B", "#B4761A"], burst: ["✨", "💫", "⭐"] },
  { id: "beso-izquierda", name: "Beso_Izquierda", label: "Beso izq.", group: "saludos", tint: ["#FF8FAE", "#B01236"], burst: ["💋", "💕", "💖", "❤️"] },
  { id: "beso-derecha", name: "Beso_Derecha", label: "Beso der.", group: "saludos", tint: ["#FFA6C0", "#C11D45"], burst: ["💋", "💗", "💘", "✨"] },
  { id: "aplaudir", name: "Aplaudir", label: "Aplaudir", group: "saludos", tint: ["#FFE9A8", "#A67500"], burst: ["👏", "✨", "🌟"], shout: "¡BRAVO!" },
  { id: "fuego", name: "Fuego", label: "Fuego", group: "emociones", tint: ["#FFB35C", "#A81806"], burst: ["🔥", "💥", "✨", "🐲"], shout: "¡FUEGO!" },
  { id: "llorar", name: "Llorar", label: "Llorar", group: "emociones", tint: ["#8FD8FF", "#1160AE"], burst: ["💧", "😢", "💦"] },
  { id: "triste", name: "Triste", label: "Triste", group: "emociones", tint: ["#A9C4E8", "#3A506E"], burst: ["💧", "😔", "💙"] },
  { id: "burla", name: "Burla", label: "Burla", group: "emociones", tint: ["#FFE066", "#A67400"], burst: ["😂", "🤣", "😜"], shout: "JA JA JA" },
  { id: "monedas", name: "Monedas", label: "Monedas", group: "fiesta", tint: ["#FFD873", "#96620A"], burst: ["🪙", "💰", "✨"], shout: "¡ORO!" },
  { id: "bailar", name: "Bailar", label: "Bailar", group: "fiesta", tint: ["#C3B8FF", "#4630A8"], burst: ["🎵", "🎶", "✨"] },
  { id: "sombrero-enojado", name: "Sombrero_Enojado", label: "Sombrero", group: "fiesta", tint: ["#FF9B6B", "#A01608"], burst: ["🎩", "💢", "💥"], shout: "¡GRRR!" },
  { id: "pensando", name: "Pensando", label: "Pensando", group: "fiesta", tint: ["#B8E0FF", "#2A5E8C"], burst: ["💭", "❓", "✨"] },
  { id: "cartel-bienvenido", name: "Cartel_Bienvenido", label: "Bienvenido", group: "carteles", tint: ["#9BE7A8", "#167A3C"], burst: ["🎉", "👋", "✨"], sign: "BIENVENIDO" },
  { id: "cartel-nomoney", name: "Cartel_NoMoney", label: "No money", group: "carteles", tint: ["#FFB35C", "#A83606"], burst: ["🚫", "💸", "😅"], sign: "NO MONEY" },
  { id: "cartel-soypobre", name: "Cartel_SoyPobre", label: "Soy pobre", group: "carteles", tint: ["#C9CBD1", "#4A4E58"], burst: ["🪙", "🥺", "💧"], sign: "SOY POBRE" },
  { id: "cartel-latino", name: "Cartel_latino live", label: "Latino Live", group: "carteles", tint: ["#FFD873", "#B01236"], burst: ["🎤", "🌴", "✨"], sign: "LATINO LIVE" },
];

export function stickersFor(group: StickerGroup) {
  return STICKERS.filter(item => item.group === group);
}

export function stickerById(id: string): Sticker | null {
  return STICKERS.find(item => item.id === id) ?? null;
}

export type StickerSignal = {
  id: string;
  stickerId: string;
  senderName: string;
  fromSeat: number | null;
  toSeat: number | null;
};

/**
 * The dragon animation that belongs to each emotion. The 3D model carries the
 * owner's own clips, so a sticker is an order to the dragon and never a
 * picture of a sticker travelling through the room.
 */
const CLIP_BY_STICKER: Record<string, string> = {
  idle: "Idle",
  "beso-izquierda": "Beso",
  "beso-derecha": "Beso",
  aplaudir: "Feliz",
  fuego: "Enojado",
  llorar: "Llorar",
  triste: "Llorar",
  burla: "Reir",
  monedas: "Emocionado",
  bailar: "Feliz",
  "sombrero-enojado": "Enojado",
  pensando: "Idle",
  "cartel-bienvenido": "Feliz",
  "cartel-nomoney": "Llorar",
  "cartel-soy-pobre": "Llorar",
  "cartel-latino": "Corazon",
};

export function clipForSticker(stickerId: string): string {
  return CLIP_BY_STICKER[stickerId] ?? "Feliz";
}
