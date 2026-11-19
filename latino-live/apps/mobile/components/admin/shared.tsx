import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import type { StaffRole } from '@/lib/admin';

export const GOLD = '#FFC24B';

export function Badge({ label, tone = 'muted' }: { label: string; tone?: 'gold' | 'red' | 'green' | 'blue' | 'muted' }) {
  const styles = {
    gold: 'border-primary/40 bg-primary/15 text-primary',
    red: 'border-destructive/40 bg-destructive/15 text-destructive',
    green: 'border-[#34D399]/40 bg-[#34D399]/15 text-[#34D399]',
    blue: 'border-[#60A5FA]/40 bg-[#60A5FA]/15 text-[#60A5FA]',
    muted: 'border-border bg-muted text-muted-foreground',
  }[tone];
  return (
    <View className={`rounded-full border px-2 py-[2px] ${styles.split(' ').slice(0, 2).join(' ')}`}>
      <Text className={`text-[11px] font-semibold ${styles.split(' ').slice(2).join(' ')}`}>{label}</Text>
    </View>
  );
}

export function roleTone(role: StaffRole | null): 'gold' | 'blue' | 'green' | 'muted' {
  if (role === 'owner') return 'gold';
  if (role === 'admin') return 'blue';
  if (role === 'moderator') return 'green';
  return 'muted';
}

export function Stat({ label, value, hint, tone = 'default' }: { label: string; value: string | number; hint?: string; tone?: 'default' | 'gold' | 'red' }) {
  const color = tone === 'gold' ? 'text-primary' : tone === 'red' ? 'text-destructive' : 'text-foreground';
  return (
    <View className="border-border bg-card flex-1 gap-0.5 rounded-[16px] border px-3.5 py-3">
      <Text className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">{label}</Text>
      <Text className={`text-[22px] font-bold tabular-nums ${color}`}>{value}</Text>
      {hint ? <Text className="text-muted-foreground text-[11.5px] leading-4">{hint}</Text> : null}
    </View>
  );
}

export function EmptyNote({ icon, title, body }: { icon: Parameters<typeof Icon>[0]['as']; title: string; body: string }) {
  return (
    <View className="border-border bg-card items-center gap-1.5 rounded-[20px] border px-6 py-8">
      <Icon as={icon} className="text-muted-foreground size-5" />
      <Text className="text-foreground mt-1 text-center text-[14px] font-semibold">{title}</Text>
      <Text className="text-muted-foreground text-center text-[12px] leading-5">{body}</Text>
    </View>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <View className={`border-border bg-card rounded-[20px] border p-4 ${className}`}>{children}</View>;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('es-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function formatDay(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-US', { weekday: 'short' }).format(new Date(`${iso}T12:00:00`)).replace('.', '');
  } catch {
    return iso.slice(5);
  }
}

export const ACTION_LABEL: Record<string, string> = {
  account_ban: 'Suspendió una cuenta',
  account_unban: 'Levantó una suspensión',
  role_grant: 'Asignó un rol',
  role_revoke: 'Quitó un rol',
  room_close: 'Cerró una sala',
  badge_set: 'Cambió una insignia',
  agency_set: 'Cambió una agencia',
};

export function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action.replace(/_/g, ' ');
}
