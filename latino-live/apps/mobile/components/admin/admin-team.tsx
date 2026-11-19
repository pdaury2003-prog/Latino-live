import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Crown, KeyRound, Shield, ShieldCheck, UserCog, Users, X } from 'lucide-react-native';
import { useAuth } from '@/features/auth';
import { AvatarPhoto } from '@/components/avatar-photo';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  ROLE_LABEL,
  adminStaff,
  adminSetRole,
  type StaffMember,
  type StaffRole,
} from '@/lib/admin';
import { Badge, EmptyNote, formatDateTime, GOLD, roleTone } from './shared';
import { ConfirmDialog, type ConfirmRequest } from './confirm';

/** Lo que cada rol puede hacer, dicho como se lo explicarías a alguien. */
const CAN_DO: Record<StaffRole, string[]> = {
  owner: ['Todo el panel', 'Asigna y quita roles', 'Suspende cuentas', 'Cierra salas'],
  admin: ['Ve resumen, personas y auditoría', 'Suspende cuentas', 'Cierra salas'],
  moderator: ['Ve el panel y las personas', 'Suspende cuentas'],
};

/**
 * Quién puede entrar al panel: una lista corta con el rol de cada persona y lo
 * que ese rol permite. Solo el dueño cambia el acceso, y todo queda auditado.
 */
export function AdminTeam({ role }: { role: StaffRole }) {
  const { session } = useAuth();
  const me = session?.user.id ?? null;
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<ConfirmRequest | null>(null);

  const load = useCallback(async () => {
    try {
      setStaff(await adminStaff());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos leer el equipo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const canManage = role === 'owner';

  function change(member: StaffMember, next: StaffRole | null) {
    const what = next ? `darle el rol de ${ROLE_LABEL[next]}` : 'quitarle el acceso al panel';
    setConfirming({
      title: next ? 'Cambiar el acceso' : 'Quitar el acceso',
      body: `¿Quieres ${what} a ${member.display_name}? El cambio queda registrado en la auditoría.`,
      action: 'Confirmar',
      destructive: !next,
      run: async () => {
        setBusy(true);
        try {
          await adminSetRole(member.user_id, next);
          await load();
          setEditing(null);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'No se pudo cambiar el acceso.');
        } finally {
          setBusy(false);
        }
      },
    });
  }

  return (
    <View className="flex-1">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }} showsVerticalScrollIndicator={false}>
        <View className="border-primary/25 bg-primary/10 flex-row items-center gap-2.5 rounded-[16px] border px-3.5 py-3">
          <View className="bg-primary/20 size-9 items-center justify-center rounded-full">
            <Icon as={KeyRound} className="text-primary size-4" />
          </View>
          <View className="flex-1">
            <Text className="text-foreground text-[13px] font-semibold">
              {staff.length} {staff.length === 1 ? 'persona puede entrar' : 'personas pueden entrar'}
            </Text>
            <Text className="text-muted-foreground text-[11.5px] leading-4">
              Entran desde Ajustes → Panel Owner, con su usuario y su contraseña.
            </Text>
          </View>
        </View>

        {error ? <Text className="text-destructive px-1 text-[12px]">{error}</Text> : null}
        {loading && staff.length === 0 ? <ActivityIndicator color={GOLD} className="mt-8" /> : null}
        {!loading && staff.length === 0 ? (
          <EmptyNote icon={Users} title="Nadie tiene acceso" body="Solo el dueño puede dar acceso al panel." />
        ) : null}

        {staff.map(member => (
          <Pressable
            key={member.user_id}
            accessibilityRole={canManage && member.role !== 'owner' ? 'button' : undefined}
            accessibilityLabel={
              canManage && member.role !== 'owner'
                ? `${member.display_name}, ${ROLE_LABEL[member.role]}. Cambiar su acceso.`
                : `${member.display_name}, ${ROLE_LABEL[member.role]}`
            }
            disabled={!canManage || member.role === 'owner'}
            onPress={() => setEditing(member)}
            className="border-border bg-card flex-row items-center gap-3 rounded-[16px] border px-3 py-3 active:bg-muted">
            <View className="border-border size-10 overflow-hidden rounded-full border">
              <AvatarPhoto uri={member.avatar_url} name={member.display_name} />
            </View>
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-foreground text-[13px] font-semibold" numberOfLines={1}>
                  {member.display_name}
                </Text>
                {member.user_id === me ? <Badge label="Tú" /> : null}
              </View>
              <Text className="text-muted-foreground text-[11.5px]" numberOfLines={1}>
                #{member.user_number ?? '—'}
                {member.granted_by_name ? ` · lo dio ${member.granted_by_name}` : ''}
              </Text>
            </View>
            {member.banned ? <Badge label="Suspendida" tone="red" /> : null}
            <Badge label={ROLE_LABEL[member.role]} tone={roleTone(member.role)} />
          </Pressable>
        ))}

        <View className="border-border bg-card mt-1 gap-2 rounded-[18px] border p-3.5">
          <Text className="text-foreground text-[13px] font-semibold">Qué puede hacer cada rol</Text>
          {(Object.keys(CAN_DO) as StaffRole[]).map(key => (
            <View key={key} className="border-border/60 gap-1 border-t pt-2">
              <View className="flex-row items-center gap-1.5">
                <Icon
                  as={key === 'owner' ? Crown : key === 'admin' ? ShieldCheck : Shield}
                  size={12}
                  className={key === 'owner' ? 'text-primary' : 'text-muted-foreground'}
                />
                <Text className="text-foreground text-[12px] font-semibold">{ROLE_LABEL[key]}</Text>
              </View>
              <Text className="text-muted-foreground text-[11px] leading-4">{CAN_DO[key].join(' · ')}</Text>
            </View>
          ))}
          <Text className="text-muted-foreground/80 text-[11px] leading-4">
            El dueño no se puede cambiar ni suspender desde aquí. Cada cambio aparece en la auditoría.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={Boolean(editing)} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditing(null)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.handle} />
            {editing ? (
              <>
                <View className="flex-row items-center gap-3">
                  <View className="border-border size-12 overflow-hidden rounded-full border">
                    <AvatarPhoto uri={editing.avatar_url} name={editing.display_name} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-foreground text-[16px] font-semibold" numberOfLines={1}>{editing.display_name}</Text>
                    <Text className="text-muted-foreground text-[11.5px]">
                      {ROLE_LABEL[editing.role]} desde {formatDateTime(editing.since)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar"
                    onPress={() => setEditing(null)}
                    className="bg-muted size-9 items-center justify-center rounded-full active:opacity-70">
                    <Icon as={X} className="text-muted-foreground size-4" />
                  </Pressable>
                </View>

                <Text className="text-muted-foreground mt-3 text-[11.5px] leading-4">
                  {editing.role === 'owner'
                    ? 'La cuenta del dueño está protegida: no se puede cambiar ni suspender.'
                    : 'Elige el acceso que tendrá desde ahora.'}
                </Text>

                {editing.role !== 'owner' ? (
                  <View className="mt-3 gap-2">
                    {(['admin', 'moderator'] as const).map(next => (
                      <Pressable
                        key={next}
                        accessibilityRole="button"
                        accessibilityLabel={`Dar rol de ${ROLE_LABEL[next]}`}
                        disabled={busy}
                        onPress={() => change(editing, next)}
                        className={`flex-row items-center gap-2 rounded-[14px] border px-3 py-3 ${editing.role === next ? 'border-primary bg-primary/10' : 'border-border bg-background'} active:opacity-80`}>
                        <Icon as={next === 'admin' ? ShieldCheck : Shield} size={15} className={editing.role === next ? 'text-primary' : 'text-muted-foreground'} />
                        <View className="flex-1">
                          <Text className={`text-[13px] font-semibold ${editing.role === next ? 'text-primary' : 'text-foreground'}`}>
                            {ROLE_LABEL[next]}
                          </Text>
                          <Text className="text-muted-foreground text-[11px] leading-4">{CAN_DO[next][0]}</Text>
                        </View>
                        {editing.role === next ? <Badge label="Actual" tone="gold" /> : null}
                      </Pressable>
                    ))}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Quitar el acceso al panel"
                      disabled={busy}
                      onPress={() => change(editing, null)}
                      className="border-destructive/35 bg-destructive/10 flex-row items-center gap-2 rounded-[14px] border px-3 py-3 active:opacity-80">
                      <Icon as={UserCog} size={15} className="text-destructive" />
                      <Text className="text-destructive text-[13px] font-semibold">Quitar el acceso al panel</Text>
                    </Pressable>
                  </View>
                ) : null}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmDialog
        request={confirming}
        busy={busy}
        onCancel={() => { if (!busy) setConfirming(null); }}
        onConfirm={() => {
          if (!confirming || busy) return;
          void confirming.run().finally(() => setConfirming(null));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(3,4,3,0.72)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#14110E',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,194,75,0.22)',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
  },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,194,75,0.35)', marginBottom: 12 },
});
