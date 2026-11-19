/**
 * Las agencias del panel: el servidor manda una fila por persona y aquí se
 * agrupan por el nombre de su agencia, sumando lo que sus miembros reciben en
 * regalos. Así el dueño ve de un golpe qué agencia mueve más diamantes.
 */

export type AgencyPerson = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  level: number;
  diamonds: number;
  agency_name: string | null;
  assigned_badge: string | null;
  diamonds_received: number;
  diamonds_received_30d: number;
};

export type AgencyGroup = {
  /** Nombre ya limpio, o null para quienes llevan la insignia sin agencia. */
  name: string | null;
  members: AgencyPerson[];
  diamonds: number;
  diamonds30d: number;
};

/**
 * Agrupa por agencia sin distinguir mayúsculas ni espacios sobrantes, y deja
 * al final a quienes todavía no tienen agencia escrita. Las agencias con más
 * diamantes recibidos van primero.
 */
export function groupAgencies(people: AgencyPerson[]): AgencyGroup[] {
  const groups = new Map<string, AgencyGroup>();

  for (const person of people) {
    const clean = (person.agency_name ?? '').trim();
    const key = clean.toLocaleLowerCase('es');
    const group = groups.get(key) ?? { name: clean || null, members: [], diamonds: 0, diamonds30d: 0 };
    group.members.push(person);
    group.diamonds += person.diamonds_received ?? 0;
    group.diamonds30d += person.diamonds_received_30d ?? 0;
    groups.set(key, group);
  }

  return [...groups.values()]
    .map(group => ({
      ...group,
      members: [...group.members].sort((a, b) => b.diamonds_received - a.diamonds_received || a.display_name.localeCompare(b.display_name, 'es')),
    }))
    .sort((a, b) => {
      if (a.name === null) return 1;
      if (b.name === null) return -1;
      return b.diamonds - a.diamonds || b.members.length - a.members.length || a.name.localeCompare(b.name, 'es');
    });
}

/** Lo que suma un grupo para las tarjetas de arriba. */
export function agencyTotals(groups: AgencyGroup[]) {
  const named = groups.filter(group => group.name !== null);
  return {
    agencies: named.length,
    people: named.reduce((sum, group) => sum + group.members.length, 0),
    diamonds: named.reduce((sum, group) => sum + group.diamonds, 0),
    diamonds30d: named.reduce((sum, group) => sum + group.diamonds30d, 0),
    withoutAgency: groups.find(group => group.name === null)?.members.length ?? 0,
  };
}
