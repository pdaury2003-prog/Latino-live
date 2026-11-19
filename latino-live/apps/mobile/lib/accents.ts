/**
 * Los tres oros del modo claro: oro viejo, oro pulido y ámbar quemado. Se usan
 * juntos como acentos pequeños (nunca como fondos grandes) para que el modo de
 * día se sienta diseñado y no un modo noche desteñido.
 */
export const GOLD = {
  deep: '#8A5B08',
  polished: '#B9913B',
  burnt: '#A8620C',
} as const;

export const GOLD_TRIO = [GOLD.deep, GOLD.burnt, GOLD.polished] as const;
