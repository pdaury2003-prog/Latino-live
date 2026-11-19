import type { ReactNode } from 'react';
import type { GenderOption } from '@/lib/gender';
import { GENDER_ICONS } from '@/lib/gender-icons';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Building2, Camera, Check, Copy, Crown, Heart, Pencil, Sparkles, X } from 'lucide-react-native';
import { AvatarPhoto } from '@/components/avatar-photo';
import type { Couple } from '@/lib/couples';
import { Icon } from '@/components/ui/icon';
import { RoleBadge } from '@/components/role-badge';
import type { BadgeKind } from '@/lib/badges';
import { frameCameraSpot } from '@/lib/role-frames';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type Stat = { key: string; label: string; value: number };

/**
 * The profile's head, dressed the way the house dresses its rooms: a violet
 * galaxy, the portrait in a gold ring, the name and the numeric ID, the day's
 * influence and the four counts that matter, all on one screen without a swipe.
 */
export function ProfileHero({
  name,
  userNumber,
  copied,
  onCopyId,
  avatar,
  avatarSize = 84,
  framed = false,
  avatarBusy,
  onAvatar,
  onCover,
  coverBusy,
  coverUrl,
  editing,
  onToggleEdit,
  emblem,
  mark,
  badge,
  agency,
  gender,
  couple,
  onCoupleAnswer,
  onCoupleEnd,
  stats,
  influence,
  rank,
  onOpenConnections,
}: {
  name: string;
  userNumber: number | null;
  copied: boolean;
  onCopyId: () => void;
  avatar: ReactNode;
  avatarSize?: number;
  /** The avatar already carries its own frame, so no gold ring is added. */
  framed?: boolean;
  avatarBusy?: boolean;
  onAvatar: () => void;
  onCover: () => void;
  coverBusy?: boolean;
  coverUrl?: string | null;
  editing: boolean;
  onToggleEdit: () => void;
  emblem?: ReactNode;
  /** The one compact membership mark beside the name, already deduplicated by the screen. */
  mark?: { label: string; background: string; ink: string } | null;
  /** La insignia de rol junto al nombre. */
  badge?: BadgeKind | null;
  /** La agencia que representa, si lleva la insignia de Agencia. */
  agency?: string | null;
  /** El sexo que la persona eligió, o null si no lo dijo. */
  gender?: GenderOption | null;
  /** The person's couple, or the request waiting for an answer. */
  couple?: Couple | null;
  onCoupleAnswer?: (accept: boolean) => void;
  onCoupleEnd?: () => void;
  stats: Stat[];
  influence: number;
  rank: string;
  onOpenConnections: (tab: string) => void;
}) {
  // El botón de la cámara vive sobre la cara del marco, no en la esquina. El
  // marco mide `avatarSize` y va centrado en un cuadro 8 puntos mayor por lado,
  // así que su sitio se mide sobre el marco y luego se corre ese margen.
  const spot = badge ? frameCameraSpot(badge, avatarSize, 24) : null;
  const cameraSpot = spot ? { left: spot.x + 8, top: spot.y + 8 } : undefined;

  return (
    <View className="overflow-hidden pb-4">
      <LinearGradient
        colors={['#2C1157', '#1B0E3A', '#0D0B18', '#0A0913']}
        locations={[0, 0.5, 0.86, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 380 }}
      />
      {coverUrl ? (
        <Image source={{ uri: coverUrl }} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 380, opacity: 0.4 }} />
      ) : null}
      {/* The lights of the hall, drawn once so the head weighs nothing. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -60, right: -40, width: 230, height: 230, borderRadius: 115, backgroundColor: '#7C3AED', opacity: 0.3 }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: 110, left: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: '#E24AA8', opacity: 0.16 }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: 96, right: 18 }}>
        <Text style={{ fontSize: 84, lineHeight: 90, fontWeight: '800', color: 'rgba(255,255,255,0.045)' }}>V</Text>
      </View>

      <View className="flex-row items-center justify-between px-4 pt-2">
        <View className="flex-row items-center gap-1.5">
          <Icon as={Sparkles} size={13} color="#D8B4FE" />
          <Text className="text-[12px] font-semibold tracking-[0.22em]" style={{ color: '#EDE4FF' }}>MI PERFIL</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cambiar foto de portada desde el dispositivo"
            onPress={onCover}
            className="h-9 flex-row items-center gap-1.5 rounded-full px-3 active:opacity-70"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
            {coverBusy ? <ActivityIndicator size="small" color="#F5E9FF" /> : <Icon as={Camera} size={14} color="#F5E9FF" />}
            <Text className="text-[11px] font-medium" style={{ color: '#F5E9FF' }}>Portada</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Cerrar edición' : 'Editar perfil'}
            onPress={onToggleEdit}
            className="size-9 items-center justify-center rounded-full active:opacity-70"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
            <Icon as={editing ? X : Pencil} size={15} color="#F5E9FF" />
          </Pressable>
        </View>
      </View>

      <View className="mt-3 flex-row items-center gap-3 px-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cambiar foto de perfil desde el dispositivo"
          onPress={onAvatar}
          className="active:opacity-85">
          {framed ? (
            <View style={{ width: avatarSize + 16, height: avatarSize + 16, alignItems: 'center', justifyContent: 'center' }}>
              {avatar}
            </View>
          ) : (
            <LinearGradient
              colors={['#F8DCA0', '#D3A24C', '#8A5B18']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: avatarSize + 8, height: avatarSize + 8, borderRadius: (avatarSize + 8) / 2, alignItems: 'center', justifyContent: 'center' }}>
              <View
                className="overflow-hidden rounded-full"
                style={{ width: avatarSize, height: avatarSize, backgroundColor: '#1B1226' }}>
                {avatar}
              </View>
            </LinearGradient>
          )}
          <View
            className="absolute size-6 items-center justify-center rounded-full border-2"
            style={badge
              // Sobre el borde de la cara: el botón acompaña a la foto y no
              // cae en el metal del marco, donde parecía pegado a la nada.
              ? { ...cameraSpot, backgroundColor: '#FFC24B', borderColor: '#1D0F3E' }
              : { bottom: -2, right: -2, backgroundColor: '#FFC24B', borderColor: '#1D0F3E' }}>
            {avatarBusy ? <ActivityIndicator size="small" color="#2A1B46" /> : <Icon as={Camera} size={11} color="#2A1B46" />}
          </View>
        </Pressable>

        <View className="flex-1">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Text className="flex-shrink text-[21px] font-bold" style={{ color: '#FFFFFF' }} numberOfLines={1}>{name}</Text>
            {badge ? <RoleBadge kind={badge} height={20} /> : null}
            {mark ? (
              <View className="rounded-[6px] px-1.5 py-0.5" style={{ backgroundColor: mark.background }}>
                <Text className="text-[11px] font-bold tracking-wide" style={{ color: mark.ink }}>{mark.label}</Text>
              </View>
            ) : null}
          </View>
          {agency ? (
            <View
              className="mt-1.5 max-w-full flex-row items-center gap-1 self-start rounded-full px-2 py-0.5"
              style={{ backgroundColor: 'rgba(124,198,255,0.14)', borderWidth: 1, borderColor: 'rgba(124,198,255,0.35)' }}>
              <Icon as={Building2} size={10} color="#A9D6FF" />
              <Text className="text-[11px] font-semibold" style={{ color: '#D6EBFF' }} numberOfLines={1}>{agency}</Text>
            </View>
          ) : null}
          {userNumber ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Tu ID es ${userNumber}. Toca para copiarlo`}
              hitSlop={6}
              onPress={onCopyId}
              className="mt-1 flex-row items-center gap-1.5 self-start active:opacity-75">
              <Text className="text-[12px]" style={{ color: 'rgba(240,232,255,0.72)' }}>ID: {userNumber}</Text>
              <Icon as={copied ? Check : Copy} size={12} color={copied ? '#86EFAC' : 'rgba(240,232,255,0.72)'} />
            </Pressable>
          ) : null}
          {gender ? (
            <View
              className="mt-1.5 flex-row items-center gap-1 self-start rounded-full px-2 py-0.5"
              style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}>
              <Icon as={GENDER_ICONS[gender.key]} size={11} color="#F0D9FF" />
              <Text className="text-[11px] font-semibold" style={{ color: '#F0E4FF' }}>{gender.label}</Text>
            </View>
          ) : null}
          {emblem ? <View className="mt-1.5 self-start">{emblem}</View> : null}
        </View>
      </View>

      {/* The day's influence, the way the hall ranks its people. */}
      <View
        className="mx-4 mt-3 flex-row items-center gap-3 rounded-[14px] px-3 py-2.5"
        style={{ backgroundColor: 'rgba(40,10,60,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
        <View className="size-9 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(255,194,75,0.16)' }}>
          <Icon as={Crown} size={18} color="#FFC24B" />
        </View>
        <View className="flex-1 items-end">
          <Text className="text-[12px] font-semibold tabular-nums" style={{ color: '#FFC24B' }}>
            Influencia: {influence.toLocaleString('es-US')}
          </Text>
          <Text className="mt-0.5 text-[11px]" style={{ color: 'rgba(240,232,255,0.62)' }}>Mi rango: {rank}</Text>
        </View>
      </View>

      {/* The couple: two faces on one card, or the request still waiting. */}
      {couple ? (
        <View
          className="mx-4 mt-2 rounded-[14px] px-3 py-2.5"
          style={{ backgroundColor: 'rgba(255,110,140,0.10)', borderWidth: 1, borderColor: 'rgba(255,143,163,0.28)' }}>
          <View className="flex-row items-center gap-2.5">
            <View className="size-9 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(255,143,163,0.18)' }}>
              <Icon as={Heart} size={16} color="#FF8FA3" />
            </View>
            <View className="flex-1">
              <Text className="text-[11px]" style={{ color: 'rgba(240,232,255,0.62)' }}>
                {couple.status === 'active' ? 'En pareja con' : couple.incoming ? 'Te pidió ser pareja' : 'Esperando respuesta de'}
              </Text>
              <Text className="text-[13px] font-semibold" style={{ color: '#FFFFFF' }} numberOfLines={1}>
                {couple.partnerName}
              </Text>
            </View>
            {couple.status === 'active' ? (
              <View className="overflow-hidden rounded-full border-2" style={{ borderColor: '#FF8FA3', width: 32, height: 32 }}>
                <AvatarPhoto uri={couple.partnerAvatar} name={couple.partnerName} textClassName="text-[11px]" />
              </View>
            ) : null}
          </View>

          {couple.status === 'pending' && couple.incoming ? (
            <View className="mt-2 flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Aceptar la pareja con ${couple.partnerName}`}
                onPress={() => onCoupleAnswer?.(true)}
                className="h-9 flex-1 items-center justify-center rounded-full active:opacity-85"
                style={{ backgroundColor: '#FF8FA3' }}>
                <Text className="text-[12px] font-semibold" style={{ color: '#3A0A14' }}>Aceptar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Rechazar la pareja con ${couple.partnerName}`}
                onPress={() => onCoupleAnswer?.(false)}
                className="h-9 flex-1 items-center justify-center rounded-full border active:opacity-85"
                style={{ borderColor: 'rgba(255,143,163,0.4)' }}>
                <Text className="text-[12px] font-semibold" style={{ color: '#FFD3DB' }}>Rechazar</Text>
              </Pressable>
            </View>
          ) : couple.status === 'active' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Terminar la pareja"
              onPress={() => onCoupleEnd?.()}
              className="mt-1.5 self-start active:opacity-70">
              <Text className="text-[11px]" style={{ color: 'rgba(255,211,219,0.75)' }}>Terminar la pareja</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View className="mt-3 flex-row">
        {stats.map(item => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={`${item.value} ${item.label}`}
            onPress={() => onOpenConnections(item.key)}
            className="flex-1 items-center py-1 active:opacity-70">
            <Text className="text-[17px] font-bold tabular-nums" style={{ color: '#FFFFFF' }}>{item.value}</Text>
            <Text className="mt-0.5 text-[11px]" style={{ color: 'rgba(240,232,255,0.6)' }}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
