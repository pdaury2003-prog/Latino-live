import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { BadgeCheck, Ban, ChevronRight, Search, ShieldCheck, ShieldOff, UserCog, X } from 'lucide-react-native';
import { useAuth } from '@/features/auth';
import { AvatarPhoto } from '@/components/avatar-photo';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  ROLE_LABEL,
  adminBan,
  adminPeople,
  adminPerson,
  adminSetAgency,
  adminSetBadge,
  adminSetRole,
  adminUnban,
  roleRank,
  type AdminPerson,
  type AdminPersonRow,
  type StaffRole,
} from '@/lib/admin';
import { ASSIGNABLE_BADGES, isBadgeKind } from '@/lib/badges';
import { RoleBadge } from '@/components/role-badge';
import { Badge, EmptyNote, formatDateTime, GOLD, roleTone } from './shared';
import { ConfirmDialog, type ConfirmRequest } from './confirm';

/**
 * Personas: buscar una cuenta, ver su historial reciente y, según el rol de
 * quien mira, asignar un rol o suspenderla para siempre. El servidor vuelve a
 * decidir si esa acción está permitida.
 */
export function AdminPeople({ role }: { role: StaffRole }) {
  const { session } = useAuth();
  const me = session?.user.id ?? null;
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<AdminPersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminPersonRow | null>(null);
  const [detail, setDetail] = useState<AdminPerson | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [reason, setReason] = useState('');
  const [agencyDraft, setAgencyDraft] = useState('');
  const [confirming, setConfirming] = useState<ConfirmRequest | null>(null);

  const load = useCallback(async (text: string) => {
    setLoading(true);
    try {
      setRows(await adminPeople(text));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos leer las cuentas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void load(query); }, query ? 320 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  const openDetail = useCallback(async (userId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const next = await adminPerson(userId);
      setDetail(next);
      setAgencyDraft(next?.agency_name ?? '');
    } catch (cause) {
      setDetailError(cause instanceof Error ? cause.message : 'No pudimos abrir esa cuenta.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  function open(row: AdminPersonRow) {
    setSelected(row);
    setDetail(null);
    setReason('');
    setAgencyDraft('');
    setDetailError(null);
    void openDetail(row.id);
  }

  async function refreshAfterAction() {
    if (selected) await openDetail(selected.id);
    await load(query);
  }

  function confirmRole(next: StaffRole | null) {
    if (!detail || acting) return;
    const what = next ? `darle el rol de ${ROLE_LABEL[next]}` : 'quitarle su rol del equipo';
    const target = detail.id;
    setConfirming({
      title: 'Cambiar rol',
      body: `¿Quieres ${what} a ${detail.display_name}? Queda registrado en la auditoría.`,
      action: 'Confirmar',
      run: async () => {
        setActing(true);
        try {
          await adminSetRole(target, next);
          await refreshAfterAction();
        } catch (cause) {
          setDetailError(cause instanceof Error ? cause.message : 'No se pudo cambiar el rol.');
        } finally {
          setActing(false);
        }
      },
    });
  }

  function confirmBan() {
    if (!detail || acting) return;
    const clean = reason.trim();
    if (clean.length < 3) {
      setDetailError('Escribe el motivo de la suspensión.');
      return;
    }
    const target = detail.id;
    setConfirming({
      title: 'Suspender para siempre',
      body: `${detail.display_name} no podrá volver a entrar, saldrá de todas las salas y sus salas se cerrarán. Motivo: “${clean}”.`,
      action: 'Suspender',
      destructive: true,
      run: async () => {
        setActing(true);
        try {
          await adminBan(target, clean, null);
          setReason('');
          await refreshAfterAction();
        } catch (cause) {
          setDetailError(cause instanceof Error ? cause.message : 'No se pudo suspender.');
        } finally {
          setActing(false);
        }
      },
    });
  }

  function confirmUnban() {
    if (!detail || acting) return;
    const target = detail.id;
    setConfirming({
      title: 'Levantar la suspensión',
      body: `¿Dejar que ${detail.display_name} vuelva a entrar? Queda registrado en la auditoría.`,
      action: 'Levantar',
      run: async () => {
        setActing(true);
        try {
          await adminUnban(target);
          await refreshAfterAction();
        } catch (cause) {
          setDetailError(cause instanceof Error ? cause.message : 'No se pudo levantar la suspensión.');
        } finally {
          setActing(false);
        }
      },
    });
  }

  function confirmBadge(badge: 'agency' | 'official' | 'cs' | null) {
    if (!detail || acting) return;
    const target = detail.id;
    const label = badge ? ASSIGNABLE_BADGES.find(item => item.kind === badge)?.label ?? 'esa insignia' : null;
    setConfirming({
      title: badge ? 'Dar la insignia' : 'Quitar la insignia',
      body: badge
        ? `¿Poner la insignia de ${label} junto al nombre de ${detail.display_name}? Se verá en la sala y en su perfil.`
        : `¿Quitar la insignia de ${detail.display_name}? Su nombre volverá a verse sin ella.`,
      action: badge ? 'Poner' : 'Quitar',
      run: async () => {
        setActing(true);
        try {
          await adminSetBadge(target, badge);
          await refreshAfterAction();
        } catch (cause) {
          setDetailError(cause instanceof Error ? cause.message : 'No se pudo cambiar la insignia.');
        } finally {
          setActing(false);
        }
      },
    });
  }

  async function saveAgency() {
    if (!detail || acting) return;
    const clean = agencyDraft.trim();
    if (clean.length > 0 && clean.length < 2) {
      setDetailError('El nombre de la agencia es demasiado corto.');
      return;
    }
    setActing(true);
    setDetailError(null);
    try {
      await adminSetAgency(detail.id, clean || null);
      await refreshAfterAction();
    } catch (cause) {
      setDetailError(cause instanceof Error ? cause.message : 'No se pudo guardar la agencia.');
    } finally {
      setActing(false);
    }
  }

  const canManageRoles = role === 'owner' && Boolean(detail) && detail?.role !== 'owner' && detail?.id !== me;
  const canSetBadge = role === 'owner' && Boolean(detail) && detail?.role !== 'owner' && detail?.id !== me;
  const canBan = Boolean(detail) && detail?.role !== 'owner' && detail?.id !== me && (role === 'owner' || roleRank(detail?.role) < roleRank(role));
  const sheetBadge = detail?.badge ?? selected?.badge ?? null;

  return (
    <View className="flex-1">
      <View className="px-4 pb-2">
        <View className="border-border bg-card h-12 flex-row items-center gap-2 rounded-full border px-3.5">
          <Icon as={Search} className="text-muted-foreground size-4" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Nombre, #ID o número de cuenta"
            placeholderTextColor="#8C8276"
            autoCapitalize="none"
            className="text-foreground flex-1 text-[13px]"
          />
          {query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Borrar la búsqueda" onPress={() => setQuery('')} className="size-7 items-center justify-center rounded-full bg-muted active:opacity-70">
              <Icon as={X} className="text-muted-foreground size-3.5" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 6 }} showsVerticalScrollIndicator={false}>
        {error ? <Text className="text-destructive px-1 text-[12px]">{error}</Text> : null}
        {loading && rows.length === 0 ? <ActivityIndicator color={GOLD} className="mt-8" /> : null}
        {!loading && rows.length === 0 ? (
          <EmptyNote icon={Search} title="Sin resultados" body="Prueba con el nombre, el #ID de siete cifras o el número de cuenta." />
        ) : null}
        {rows.map(row => (
          <Pressable
            key={row.id}
            accessibilityRole="button"
            accessibilityLabel={`${row.display_name}, ${row.banned ? 'suspendida' : 'activa'}. Abrir ficha.`}
            onPress={() => open(row)}
            className="border-border bg-card flex-row items-center gap-2.5 rounded-[16px] border px-3 py-2.5 active:bg-muted">
            <View className="border-border size-10 overflow-hidden rounded-full border">
              <AvatarPhoto uri={row.avatar_url} name={row.display_name} />
            </View>
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-foreground shrink text-[13px] font-semibold" numberOfLines={1}>{row.display_name}</Text>
                {isBadgeKind(row.badge) ? <RoleBadge kind={row.badge} height={14} /> : null}
              </View>
              <Text className="text-muted-foreground text-[11.5px]" numberOfLines={1}>
                #{row.user_number ?? '—'} · Nivel {row.level}
              </Text>
            </View>
            {row.role ? <Badge label={ROLE_LABEL[row.role]} tone={roleTone(row.role)} /> : null}
            {row.banned ? <Badge label="Suspendida" tone="red" /> : null}
            <Icon as={ChevronRight} className="text-muted-foreground/60 size-4" />
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.handle} />
            {selected ? (
              <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
                <View className="flex-row items-center gap-3">
                  <View className="border-primary/30 size-14 overflow-hidden rounded-full border">
                    <AvatarPhoto uri={selected.avatar_url} name={selected.display_name} />
                  </View>
                  <View className="flex-1 gap-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-foreground shrink text-[17px] font-semibold" numberOfLines={1}>{selected.display_name}</Text>
                      {isBadgeKind(sheetBadge) ? <RoleBadge kind={sheetBadge} height={18} /> : null}
                    </View>
                    <Text className="text-muted-foreground text-[11.5px]">#{selected.user_number ?? '—'} · desde {formatDateTime(selected.created_at)}</Text>
                    <View className="flex-row flex-wrap gap-1.5">
                      {selected.role ? <Badge label={ROLE_LABEL[selected.role]} tone={roleTone(selected.role)} /> : <Badge label="Miembro" />}
                      {selected.banned ? <Badge label="Suspendida" tone="red" /> : null}
                    </View>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel="Cerrar la ficha" onPress={() => setSelected(null)} className="bg-muted size-9 items-center justify-center rounded-full active:opacity-70">
                    <Icon as={X} className="text-muted-foreground size-4" />
                  </Pressable>
                </View>

                {detailLoading && !detail ? <ActivityIndicator color={GOLD} className="my-6" /> : null}
                {detailError ? <Text className="text-destructive text-[12px]">{detailError}</Text> : null}

                {detail ? (
                  <>
                    <View className="flex-row flex-wrap gap-2">
                      <MiniStat label="Nivel" value={detail.level} />
                      <MiniStat label="Diamantes" value={detail.diamonds.toLocaleString('es-US')} />
                      <MiniStat label="Oro" value={detail.gold.toLocaleString('es-US')} />
                      <MiniStat label="Mensajes 30 d" value={detail.messages_30d} />
                      <MiniStat label="Regalos 30 d" value={detail.gifts_30d.toLocaleString('es-US')} />
                      <MiniStat label="Salas" value={detail.rooms_hosted} />
                      <MiniStat label="Seguidores" value={detail.followers} />
                      <MiniStat label="Siguiendo" value={detail.following} />
                    </View>

                    <View className="border-border bg-background gap-2 rounded-[16px] border p-3.5">
                      <View className="flex-row items-center gap-1.5">
                        <Icon as={UserCog} className="text-primary size-4" />
                        <Text className="text-foreground text-[13px] font-semibold">Rol en el equipo</Text>
                      </View>
                      {detail.role === 'owner' ? (
                        <Text className="text-muted-foreground text-[11.5px] leading-4">La cuenta del dueño está protegida: no se puede cambiar ni suspender.</Text>
                      ) : canManageRoles ? (
                        <>
                          <Text className="text-muted-foreground text-[11.5px] leading-4">Solo el dueño asigna roles. Elige uno o quita el acceso al panel.</Text>
                          <View className="flex-row flex-wrap gap-2">
                            <RoleButton label="Administrador" active={detail.role === 'admin'} disabled={acting} onPress={() => confirmRole('admin')} />
                            <RoleButton label="Moderador" active={detail.role === 'moderator'} disabled={acting} onPress={() => confirmRole('moderator')} />
                            <RoleButton label="Sin rol" active={!detail.role} disabled={acting} onPress={() => confirmRole(null)} />
                          </View>
                        </>
                      ) : (
                        <Text className="text-muted-foreground text-[11.5px] leading-4">
                          {role === 'owner' ? 'Tu propia cuenta no se cambia desde aquí.' : 'Solo el dueño cambia los roles del equipo.'}
                        </Text>
                      )}
                    </View>

                    <View className="border-border bg-background gap-2 rounded-[16px] border p-3.5">
                      <View className="flex-row items-center gap-1.5">
                        <Icon as={BadgeCheck} className="text-primary size-4" />
                        <Text className="text-foreground text-[13px] font-semibold">Insignia junto al nombre</Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        {isBadgeKind(detail.badge) ? (
                          <RoleBadge kind={detail.badge} height={22} />
                        ) : (
                          <Badge label="Sin insignia" />
                        )}
                        <Text className="text-muted-foreground flex-1 text-[11.5px] leading-4">
                          {detail.badge === 'host'
                            ? 'Host: se muestra mientras tenga una sala abierta.'
                            : detail.assigned_badge
                              ? 'Se ve en la sala y en su perfil.'
                              : 'Elige una para que acompañe su nombre.'}
                        </Text>
                      </View>
                      {canSetBadge ? (
                        <>
                          <View className="flex-row flex-wrap gap-2">
                            {ASSIGNABLE_BADGES.map(item => (
                              <RoleButton
                                key={item.kind}
                                label={item.label}
                                active={detail.assigned_badge === item.kind}
                                disabled={acting}
                                onPress={() => confirmBadge(item.kind)}
                              />
                            ))}
                            <RoleButton label="Sin insignia" active={!detail.assigned_badge} disabled={acting} onPress={() => confirmBadge(null)} />
                          </View>
                          {detail.assigned_badge === 'agency' ? (
                            <View className="mt-1 gap-2">
                              <Text className="text-muted-foreground text-[11.5px] leading-4">
                                El nombre y el logo los puede poner la propia agencia en su panel; aquí el dueño también puede escribir el nombre.
                              </Text>
                              {detail.agency_photo_url ? (
                                <View className="flex-row items-center gap-2">
                                  <Image source={{ uri: detail.agency_photo_url }} resizeMode="cover" style={{ width: 34, height: 34, borderRadius: 10 }} />
                                  <Text className="text-muted-foreground flex-1 text-[11.5px]">Logo que puso la agencia</Text>
                                </View>
                              ) : null}
                              <View className="flex-row items-center gap-2">
                                <TextInput
                                  value={agencyDraft}
                                  onChangeText={setAgencyDraft}
                                  placeholder="Nombre de la agencia"
                                  placeholderTextColor="#8C8276"
                                  maxLength={40}
                                  autoCapitalize="words"
                                  className="border-border bg-card text-foreground h-10 flex-1 rounded-full border px-3 text-[12.5px]"
                                />
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel="Guardar el nombre de la agencia"
                                  disabled={acting || agencyDraft.trim() === (detail.agency_name ?? '')}
                                  onPress={() => void saveAgency()}
                                  className="bg-primary h-10 items-center justify-center rounded-full px-4 active:opacity-85 disabled:opacity-40">
                                  {acting ? <ActivityIndicator size="small" color="#2A1B46" /> : <Text className="text-primary-foreground text-[12px] font-semibold">Guardar</Text>}
                                </Pressable>
                              </View>
                            </View>
                          ) : null}
                        </>
                      ) : (
                        <Text className="text-muted-foreground text-[11.5px] leading-4">
                          {role === 'owner' ? 'Tu propia insignia es la de dueño.' : 'Solo el dueño asigna insignias.'}
                        </Text>
                      )}
                    </View>

                    <View className={`gap-2 rounded-[16px] border p-3.5 ${detail.banned ? 'border-destructive/35 bg-destructive/10' : 'border-border bg-background'}`}>
                      <View className="flex-row items-center gap-1.5">
                        <Icon as={detail.banned ? ShieldOff : Ban} className={detail.banned ? 'text-destructive size-4' : 'text-primary size-4'} />
                        <Text className={`text-[13px] font-semibold ${detail.banned ? 'text-destructive' : 'text-foreground'}`}>
                          {detail.banned ? 'Cuenta suspendida' : 'Suspender la cuenta'}
                        </Text>
                      </View>
                      {detail.banned ? (
                        <>
                          <Text className="text-foreground/85 text-[11.5px] leading-4">Motivo: {detail.ban_reason ?? 'Sin motivo'}</Text>
                          <Text className="text-muted-foreground text-[11px]">
                            {detail.ban_until ? `Hasta ${formatDateTime(detail.ban_until)}` : 'Permanente'} · {formatDateTime(detail.ban_until)}
                          </Text>
                          <Pressable
                            accessibilityRole="button"
                            disabled={acting}
                            onPress={confirmUnban}
                            className="bg-primary mt-1 h-10 flex-row items-center justify-center gap-1.5 rounded-full active:opacity-85 disabled:opacity-40">
                            {acting ? <ActivityIndicator size="small" color="#2A1B46" /> : <Icon as={ShieldCheck} size={14} className="text-primary-foreground" />}
                            <Text className="text-primary-foreground text-[12.5px] font-semibold">Levantar la suspensión</Text>
                          </Pressable>
                        </>
                      ) : canBan ? (
                        <>
                          <Text className="text-muted-foreground text-[11.5px] leading-4">
                            Cierra su sesión, la saca de las salas y le impide volver a entrar. Queda registrada en la auditoría.
                          </Text>
                          <TextInput
                            value={reason}
                            onChangeText={setReason}
                            placeholder="Motivo de la suspensión"
                            placeholderTextColor="#8C8276"
                            multiline
                            maxLength={300}
                            className="border-border bg-card text-foreground min-h-[64px] rounded-[12px] border px-3 py-2 text-[12.5px]"
                          />
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Suspender la cuenta para siempre"
                            disabled={acting || reason.trim().length < 3}
                            onPress={confirmBan}
                            className="bg-destructive/15 h-10 flex-row items-center justify-center gap-1.5 rounded-full active:opacity-85 disabled:opacity-40">
                            {acting ? <ActivityIndicator size="small" color="#F0847C" /> : <Icon as={Ban} size={14} className="text-destructive" />}
                            <Text className="text-destructive text-[12.5px] font-semibold">Suspender para siempre</Text>
                          </Pressable>
                        </>
                      ) : (
                        <Text className="text-muted-foreground text-[11.5px] leading-4">
                          No puedes suspender a alguien del mismo nivel o superior, ni a tu propia cuenta.
                        </Text>
                      )}
                    </View>

                    <Text className="text-muted-foreground text-center text-[11px]">
                      Partidas de dominó: {detail.domino_games} · El historial completo queda en la auditoría.
                    </Text>
                  </>
                ) : null}
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmDialog
        request={confirming}
        busy={acting}
        onCancel={() => { if (!acting) setConfirming(null); }}
        onConfirm={() => {
          if (!confirming || acting) return;
          void confirming.run().finally(() => setConfirming(null));
        }}
      />
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="border-border bg-background min-w-[30%] flex-1 rounded-[12px] border px-2.5 py-2">
      <Text className="text-muted-foreground text-[11.5px] font-semibold uppercase tracking-wide">{label}</Text>
      <Text className="text-foreground text-[15px] font-bold tabular-nums">{value}</Text>
    </View>
  );
}

function RoleButton({ label, active, disabled, onPress }: { label: string; active: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Asignar rol ${label}`}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`h-9 items-center justify-center rounded-full border px-3 ${active ? 'border-primary bg-primary/15' : 'border-border bg-card'} ${disabled ? 'opacity-50' : 'active:opacity-75'}`}>
      <Text className={`text-[11.5px] font-semibold ${active ? 'text-primary' : 'text-foreground'}`}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(3,4,3,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#14110E',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,194,75,0.22)',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 22,
    maxHeight: '90%',
  },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,194,75,0.35)', marginBottom: 12 },
});
