import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Building2, ChevronDown, ChevronUp, Coins, RefreshCw, Users } from 'lucide-react-native';
import { AvatarPhoto } from '@/components/avatar-photo';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { adminAgencyPeople } from '@/lib/admin';
import { agencyTotals, groupAgencies, type AgencyGroup, type AgencyPerson } from '@/lib/agencies';
import { Badge, EmptyNote, GOLD, Stat } from './shared';

/**
 * Agencias: las personas agrupadas por la agencia que representan, con lo que
 * cada una reúne en diamantes. El nombre se escribe en Personas; aquí se lee
 * el resultado y se abre cada grupo para ver a su gente.
 */
export function AdminAgencies() {
  const [people, setPeople] = useState<AgencyPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setPeople(await adminAgencyPeople());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos leer las agencias.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const groups = groupAgencies(people);
  const totals = agencyTotals(groups);

  function toggle(group: AgencyGroup) {
    const key = group.name ?? '__sin_agencia__';
    setOpen(current => ({ ...current, [key]: !current[key] }));
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}
      showsVerticalScrollIndicator={false}>
      <View className="flex-row items-center justify-between px-1">
        <Text className="text-muted-foreground text-[11.5px] leading-4" style={{ flex: 1, paddingRight: 8 }}>
          Personas agrupadas por su agencia. Los diamantes son los que recibieron en regalos.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Actualizar agencias"
          onPress={() => void load(true)}
          className="flex-row items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 active:opacity-70">
          <Icon as={RefreshCw} className="text-muted-foreground size-3" />
          <Text className="text-muted-foreground text-[11px] font-semibold">Actualizar</Text>
        </Pressable>
      </View>

      {error ? <Text className="text-destructive px-1 text-[12px]">{error}</Text> : null}
      {loading && people.length === 0 ? <ActivityIndicator color={GOLD} className="mt-8" /> : null}

      {!loading || people.length > 0 ? (
        <View className="flex-row gap-2">
          <Stat label="Agencias" value={totals.agencies} hint={`${totals.people} personas`} />
          <Stat label="Diamantes" value={totals.diamonds.toLocaleString('es-US')} hint={`${totals.diamonds30d.toLocaleString('es-US')} en 30 días`} tone="gold" />
        </View>
      ) : null}

      {!loading && groups.length === 0 ? (
        <EmptyNote
          icon={Building2}
          title="Sin agencias todavía"
          body="En Personas, pon la insignia de Agencia y escribe el nombre de su agencia. Aquí se agruparán solas."
        />
      ) : null}

      {groups.map(group => {
        const key = group.name ?? '__sin_agencia__';
        const expanded = Boolean(open[key]);
        const unnamed = group.name === null;
        const shown = expanded ? group.members : group.members.slice(0, 3);
        return (
          <View key={key} className="border-border bg-card gap-2 rounded-[18px] border p-3.5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${unnamed ? 'Personas sin agencia' : `Agencia ${group.name}`}, ${group.members.length} personas. ${expanded ? 'Cerrar' : 'Abrir'} la lista.`}
              onPress={() => toggle(group)}
              className="flex-row items-center gap-2.5 active:opacity-80">
              <View className={`size-9 items-center justify-center rounded-full ${unnamed ? 'bg-muted' : 'bg-[#60A5FA]/15'}`}>
                <Icon as={unnamed ? Users : Building2} size={16} className={unnamed ? 'text-muted-foreground' : 'text-[#60A5FA]'} />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-foreground text-[13.5px] font-semibold" numberOfLines={1}>
                  {unnamed ? 'Sin agencia escrita' : group.name}
                </Text>
                <Text className="text-muted-foreground text-[11.5px]" numberOfLines={1}>
                  {unnamed
                    ? 'Llevan la insignia de Agencia; escribe su agencia en Personas.'
                    : `${group.members.length} ${group.members.length === 1 ? 'persona' : 'personas'} · ${group.diamonds30d.toLocaleString('es-US')} en 30 días`}
                </Text>
              </View>
              {unnamed ? <Badge label="Sin nombre" /> : (
                <View className="flex-row items-center gap-1">
                  <Icon as={Coins} size={12} className="text-primary" />
                  <Text className="text-primary text-[12.5px] font-bold tabular-nums">{group.diamonds.toLocaleString('es-US')}</Text>
                </View>
              )}
              <Icon as={expanded ? ChevronUp : ChevronDown} size={15} className="text-muted-foreground" />
            </Pressable>

            {shown.map(person => (
              <View key={person.id} className="flex-row items-center gap-2.5 border-t border-border/60 pt-2">
                <View className="border-border size-8 overflow-hidden rounded-full border">
                  <AvatarPhoto uri={person.avatar_url} name={person.display_name} textClassName="text-[12px]" />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-foreground text-[12.5px] font-semibold" numberOfLines={1}>{person.display_name}</Text>
                  <Text className="text-muted-foreground text-[11px]" numberOfLines={1}>
                    Nivel {person.level} · {person.diamonds_received.toLocaleString('es-US')} recibidos
                  </Text>
                </View>
                {person.assigned_badge === 'agency' ? <Badge label="Agencia" tone="blue" /> : <Badge label="Sin insignia" />}
              </View>
            ))}

            {group.members.length > 3 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={expanded ? 'Ver menos personas' : 'Ver todas las personas'}
                onPress={() => toggle(group)}
                className="h-9 items-center justify-center rounded-full bg-muted active:opacity-70">
                <Text className="text-muted-foreground text-[11.5px] font-semibold">
                  {expanded ? 'Ver menos' : `Ver las ${group.members.length} personas`}
                </Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}
