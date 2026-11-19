import { memo, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Plus } from 'lucide-react-native';
import { AnimatedEye } from '@/components/animated-eye';
import { SvipAvatarFrame, SvipChip } from '@/components/svip-frame';
import { liveSvipLevel, svipShows } from '@/lib/svip';
import { FramedAvatar } from '@/components/framed-avatar';
import { CreatorPlate } from '@/components/gold-plate';
import { LevelChip } from '@/components/level-badge';
import { RoleBadge } from '@/components/role-badge';
import { RoleFrame } from '@/components/role-frame';
import { isBadgeKind } from '@/lib/badges';
import { cachedProfile } from '@/lib/profile-cache';
import { AvatarPhoto } from '@/components/avatar-photo';
import { getProfile, getProfileStats, toggleFollow, type ProfileRow } from '@/lib/rooms';

type Props = {
  hostId: string | null;
  hostName: string;
  hostAvatar: string | null;
  /** People in the room right now, beside the eye. */
  viewers: number;
  isSelf: boolean;
  /** The single header row of the room: smaller, to sit beside the controls. */
  compact?: boolean;
  /** Only icons and the visitor count: the room keeps its space for the show. */
  iconOnly?: boolean;
  /**
   * Un teléfono angosto: el avatar y las marcas se recogen para que el nombre
   * de la sala quepa entero en vez de quedar en «Sala de bro…».
   */
  tight?: boolean;
  /** The host's words for the room, shown inside the header itself. */
  roomTitle?: string;
  /** Tapping the title writes new words (the host only). */
  onPressTitle?: () => void;
  titleHint?: string;
  onOpenProfile: () => void;
  /** Shows the list of everyone in the room. */
  onOpenPeople: () => void;
};

/** Neon ring colours of the host card. */
const PINK = '#FF2D8A';
const VIOLET = '#8B3DFF';
const CYAN = '#33E4FF';

/** 14850 -> "14,8K", so the counter fits the card on any phone. */
function compactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace('.', ',')}K`;
  return String(Math.round(value));
}

/**
 * The host card inside the room: who is hosting, their level, what the room has
 * given them in diamonds, and a button to follow them without leaving.
 */
export const HostBadge = memo(function HostBadge({ hostId, hostName, hostAvatar, viewers, isSelf, compact = false, iconOnly = false, tight = false, roomTitle, onPressTitle, titleHint, onOpenProfile, onOpenPeople }: Props) {
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(hostAvatar);
  const [level, setLevel] = useState<number | null>(null);
  const [account, setAccount] = useState<ProfileRow | null>(null);

  useEffect(() => {
    setAvatar(hostAvatar);
    setFollowing(false);
    setLevel(null);
    setAccount(null);
    if (!hostId) return;
    // La ficha guardada del anfitrión pinta su cara y su nivel al instante,
    // mientras la versión nueva viaja por detrás.
    const saved = cachedProfile(hostId);
    if (saved) {
      if (saved.avatar_url) setAvatar(saved.avatar_url);
      if (saved.level) setLevel(saved.level);
      setAccount(saved);
    }
    let live = true;
    void Promise.all([
      getProfile(hostId).catch(() => null),
      isSelf ? Promise.resolve(null) : getProfileStats(hostId).catch(() => null),
    ]).then(([profile, stats]) => {
      if (!live) return;
      if (profile?.avatar_url) setAvatar(profile.avatar_url);
      if (profile?.level) setLevel(profile.level);
      setAccount(profile);
      if (stats) setFollowing(stats.is_following);
    });
    return () => { live = false; };
  }, [hostId, hostAvatar, isSelf]);

  const follow = useCallback(async () => {
    if (!hostId || busy) return;
    setBusy(true);
    try {
      setFollowing(await toggleFollow(hostId));
    } catch {
      // The card keeps its state; the full profile explains any failure.
    } finally {
      setBusy(false);
    }
  }, [hostId, busy]);

  const svip = liveSvipLevel(account);
  const badge = isBadgeKind(account?.badge) ? account?.badge : hostId ? 'host' : null;
  const frame = account?.equipped_frame ?? null;
  const wearFrame = svip > 0 && svipShows(account, 'frame');
  const wearEmblem = svip > 0 && svipShows(account, 'emblem');
  const avatarSize = tight ? 28 : iconOnly ? 34 : compact ? 32 : 50;
  const ring = avatarSize + 6;
  const inner = avatarSize - 2;

  const face = (
    <View style={{ width: inner, height: inner, borderRadius: inner / 2, overflow: 'hidden', borderWidth: 2, borderColor: '#120E1C' }}>
      <AvatarPhoto uri={avatar} name={hostName} textClassName={iconOnly ? 'text-[11px]' : compact ? 'text-[13px]' : 'text-[15px]'} />
    </View>
  );

  // Header icons only: the room gives its space to the seats and the screen.
  if (iconOnly) {
    return (
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: roomTitle ? 'stretch' : 'flex-start',
        minHeight: 44,
        paddingVertical: 4, paddingLeft: tight ? 3 : 4, paddingRight: tight ? 4 : 6, borderRadius: 22,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(12,10,18,0.72)',
      }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Ver el perfil de ${hostName}`} onPress={onOpenProfile} hitSlop={6} style={{ borderRadius: 999 }}>
          {wearFrame ? (
            <SvipAvatarFrame level={svip} size={ring} medal={false}>{face}</SvipAvatarFrame>
          ) : frame ? (
            <FramedAvatar frame={frame} size={ring}>{face}</FramedAvatar>
          ) : (
            <LinearGradient
              colors={[PINK, VIOLET]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: ring, height: ring, borderRadius: ring / 2, alignItems: 'center', justifyContent: 'center' }}>
              {face}
            </LinearGradient>
          )}
        </Pressable>
        {/* En un teléfono angosto el chip de nivel cede su sitio al nombre:
            el nivel sigue en el perfil y en la insignia del avatar. */}
        {level && !tight ? <LevelChip level={level} size={iconOnly ? 17 : 14} /> : null}
        {roomTitle ? (
          // The room's own words live in the header: the name, and under it how
          // many people are here, so the top row stays a single piece. The name
          // and the eye are siblings: a button inside a button breaks the tap.
          <View style={{ flex: 1, minWidth: 0 }}>
            {onPressTitle ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Cambiar el texto de la sala: ${roomTitle}`}
                onPress={onPressTitle}>
                <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 14.5, fontWeight: '800', letterSpacing: 0.1 }}>
                  {roomTitle}
                </Text>
              </Pressable>
            ) : (
              <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 14.5, fontWeight: '800', letterSpacing: 0.1 }}>
                {roomTitle}
              </Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Ver quiénes están en la sala: ${viewers}`}
                onPress={onOpenPeople}
                hitSlop={8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <AnimatedEye size={17} />
                <Text style={{ color: '#FFB3D2', fontSize: 11.5, fontWeight: '800' }}>{compactNumber(viewers)}</Text>
              </Pressable>
              <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '600', flexShrink: 1 }}>
                {titleHint ?? 'en la sala'}
              </Text>
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ver quiénes están en la sala: ${viewers}`}
            onPress={onOpenPeople}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
            <AnimatedEye size={iconOnly ? 22 : 18} />
            <Text style={{ color: '#FFB3D2', fontSize: iconOnly ? 13 : 12, fontWeight: '800' }}>{compactNumber(viewers)}</Text>
          </Pressable>
        )}
        {!isSelf && hostId ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={following ? `Dejar de seguir a ${hostName}` : `Seguir a ${hostName}`}
            accessibilityState={{ selected: following, disabled: busy }}
            disabled={busy}
            onPress={() => void follow()}
            hitSlop={6}
            style={{
              width: iconOnly ? 28 : 24, height: iconOnly ? 28 : 24, borderRadius: iconOnly ? 14 : 12, alignItems: 'center', justifyContent: 'center',
              backgroundColor: following ? 'rgba(255,255,255,0.16)' : PINK,
            }}>
            {busy
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : following ? <Check color="#FFFFFF" size={iconOnly ? 14 : 12} strokeWidth={3} /> : <Plus color="#FFFFFF" size={iconOnly ? 15 : 13} strokeWidth={3} />}
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: compact ? 7 : 11,
        paddingVertical: compact ? 5 : 9,
        paddingLeft: compact ? 5 : 9,
        paddingRight: compact ? 5 : 8,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
        backgroundColor: 'rgba(12,10,18,0.72)',
      }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver el perfil de ${hostName}`}
        onPress={onOpenProfile}
        style={{ borderRadius: 999 }}>
        {badge && !compact && !wearFrame ? (
          <RoleFrame kind={badge} size={ring + 10}>
            <AvatarPhoto uri={avatar} name={hostName} textClassName="text-[15px]" />
          </RoleFrame>
        ) : wearFrame ? (
          <SvipAvatarFrame level={svip} size={ring} medal={false}>{face}</SvipAvatarFrame>
        ) : frame ? (
          <FramedAvatar frame={frame} size={ring}>{face}</FramedAvatar>
        ) : (
          <LinearGradient
            colors={[PINK, VIOLET]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: ring, height: ring, borderRadius: ring / 2, alignItems: 'center', justifyContent: 'center' }}>
            {face}
          </LinearGradient>
        )}
      </Pressable>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver el perfil de ${hostName}`}
          onPress={onOpenProfile}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: compact ? 13.5 : 15, fontWeight: '700', flexShrink: 1 }}>
            {hostName}
          </Text>
          {level ? <LevelChip level={level} size={compact ? 16 : 18} /> : null}
          {badge ? <RoleBadge kind={badge} height={compact ? 15 : 17} /> : null}
          {wearEmblem ? <SvipChip level={svip} small /> : null}
        </Pressable>
        {!wearFrame && !compact ? <View style={{ marginTop: 2 }}><CreatorPlate level="top" width={72} /></View> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver quiénes están en la sala, ${viewers} personas`}
          onPress={onOpenPeople}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1, alignSelf: 'flex-start' }}>
          <AnimatedEye size={compact ? 30 : 34} />
          <Text numberOfLines={1} style={{ color: '#FFB3D2', fontSize: compact ? 11.5 : 13, fontWeight: '700' }}>
            {compactNumber(viewers)}
            <Text style={{ color: 'rgba(255,255,255,0.62)', fontWeight: '600' }}>{' '}en la sala</Text>
          </Text>
        </Pressable>
      </View>

      {!isSelf && hostId ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={following ? `Dejar de seguir a ${hostName}` : `Seguir a ${hostName}`}
          accessibilityState={{ selected: following, disabled: busy }}
          disabled={busy}
          onPress={() => void follow()}
          style={{ borderRadius: 999, overflow: 'hidden' }}>
          <LinearGradient
            colors={following ? ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.07)'] : [PINK, VIOLET]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              minWidth: compact ? 60 : 92,
              height: compact ? 30 : 38,
              paddingHorizontal: compact ? 8 : 14,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 3,
              borderWidth: following ? 1 : 0,
              borderColor: 'rgba(255,255,255,0.28)',
            }}>
            {busy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                {following ? null : <Plus color="#FFFFFF" size={compact ? 12 : 14} strokeWidth={3} />}
                <Text style={{ color: '#FFFFFF', fontSize: compact ? 11.5 : 13, fontWeight: '700' }}>
                  {following ? 'Siguiendo' : 'Seguir'}
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      ) : !isSelf ? (
        <View
          style={{
            paddingHorizontal: 10, height: 26, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: 'rgba(51,228,255,0.45)', backgroundColor: 'rgba(51,228,255,0.12)',
          }}>
          <Text style={{ color: CYAN, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>OFICIAL</Text>
        </View>
      ) : null}
    </View>
  );
});
