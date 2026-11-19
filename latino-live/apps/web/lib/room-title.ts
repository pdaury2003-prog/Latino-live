/**
 * The name a room link already carries. A shared link must look like a room
 * even when the server cannot read the database at that moment, and the
 * address always holds the room's own words: "noche-en-el-palacio" becomes
 * "Noche en el palacio".
 */
export function titleFromKey(key: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
    return "Sala en vivo";
  }
  const words = key
    .split("-")
    .filter(word => word && !/^[0-9a-f]{5,6}$/i.test(word));
  if (!words.length) return "Sala en vivo";
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
