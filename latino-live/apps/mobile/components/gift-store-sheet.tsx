import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, Gift, Pencil, Sparkles, X } from 'lucide-react-native';
import { AvatarPhoto } from '@/components/avatar-photo';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { SparklingDiamond } from '@/components/sparkling-diamond';
import {
  GIFT_QUANTITIES,
  GIFT_TABS,
  GIFT_TAGS,
  giftArt,
  giftsFor,
  type GiftTab,
  type GiftTag,
  type RoomGift,
} from '@/lib/gift-store';
import { cn } from '@/lib/utils';

type Props = {
  /** People sitting in the room, in seat order. */
  seated: GiftTarget[];
  /** The seat the gift is addressed to, or null for the whole room. */
  recipientId: string | null;
  /** The person the gifts are addressed to, or null for the whole room. */
  recipientName: string | null;
  balance: number;
  sending?: boolean;
  error?: string | null;
  onPickTarget: (target: GiftTarget | null) => void;
  onSend: (gift: RoomGift, quantity: number) => void;
  onClose: () => void;
  onRecharge: () => void;
};

export type GiftTarget = { id: string; name: string; avatarUrl?: string | null };

/**
 * The gift shop of a room: the host's card, the groups of the catalogue, a
 * grid of gifts and the bundle the sender buys, all in one sheet.
 */
export function GiftStoreSheet({
  seated,
  recipientId,
  recipientName,
  balance,
  sending,
  error,
  onPickTarget,
  onSend,
  onClose,
  onRecharge,
}: Props) {
  const [tab, setTab] = useState<GiftTab | 'todo'>('todo');
  const [tag, setTag] = useState<GiftTag | 'todo'>('todo');
  const [pickedKey, setPickedKey] = useState('tigre');
  const [quantity, setQuantity] = useState(1);
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState('');

  const gifts = useMemo(() => giftsFor(tab, tag), [tab, tag]);
  const picked = gifts.find(gift => gift.key === pickedKey) ?? gifts[0] ?? null;
  const typed = Number.parseInt(customText, 10);
  const count = customOpen && Number.isFinite(typed) ? Math.min(999, Math.max(1, typed)) : quantity;
  const total = (picked?.cost ?? 0) * count;
  const short = Math.max(0, total - balance);
  const chosen = recipientId ? seated.find(person => person.id === recipientId) ?? null : null;
  const targetName = chosen?.name ?? recipientName ?? null;

  return (
    <View
      className="self-center rounded-t-[24px] border"
      style={{
        width: '100%',
        maxWidth: 460,
        backgroundColor: 'rgba(48,8,18,0.9)',
        borderColor: 'rgba(255,194,75,0.28)',
      }}>
      <View className="mt-2 flex-row items-center gap-2 px-4">
        <Text className="text-foreground text-[12px] font-semibold">Regalos</Text>
        <View className="flex-1" />
        <Text className="text-primary text-[11px] font-semibold" numberOfLines={1}>
          {targetName ?? 'Toda la sala'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar los regalos"
          onPress={onClose}
          className="size-7 items-center justify-center rounded-full border border-white/15 bg-black/30 active:opacity-70">
          <Icon as={X} className="text-muted-foreground size-3.5" />
        </Pressable>
      </View>

      {seated.length > 0 ? (
        <View className="mt-1.5">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2.5 px-4">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enviar el regalo a toda la sala"
              accessibilityState={{ selected: !recipientId }}
              onPress={() => onPickTarget(null)}
              className="items-center"
              style={{ width: 50 }}>
              <View
                className={cn(
                  'size-8 items-center justify-center overflow-hidden rounded-full border-2',
                  recipientId ? 'border-border bg-background' : 'border-primary bg-primary/15',
                )}>
                <Icon as={Gift} className={cn('size-4', recipientId ? 'text-muted-foreground' : 'text-primary')} />
              </View>
              <Text
                className={cn('mt-0.5 text-center text-[11px]', recipientId ? 'text-muted-foreground' : 'text-primary font-semibold')}
                numberOfLines={1}>
                Sala
              </Text>
            </Pressable>
            {seated.map(person => {
              const active = person.id === recipientId;
              return (
                <Pressable
                  key={person.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Enviar el regalo a ${person.name}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => onPickTarget(person)}
                  className="items-center"
                  style={{ width: 50 }}>
                  <View
                    className={cn(
                      'size-8 overflow-hidden rounded-full border-2',
                      active ? 'border-primary' : 'border-border',
                    )}>
                    <AvatarPhoto uri={person.avatarUrl} name={person.name} textClassName="text-[14px]" />
                  </View>
                  <Text
                    className={cn('mt-0.5 text-center text-[11px]', active ? 'text-primary font-semibold' : 'text-muted-foreground')}
                    numberOfLines={1}>
                    {person.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View className="mt-2 flex-row items-center gap-3 px-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerClassName="gap-4 pr-2">
          {[{ key: 'todo' as const, label: 'Todo' }, ...GIFT_TABS].map(item => {
            const active = tab === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={`Grupo ${item.label}`}
                accessibilityState={{ selected: active }}
                onPress={() => setTab(item.key)}
                className="items-center pb-1">
                <Text className={cn('text-[12px] font-semibold', active ? 'text-foreground' : 'text-muted-foreground')}>
                  {item.label}
                </Text>
                <View className={cn('mt-1 h-0.5 w-full rounded-full', active ? 'bg-primary' : 'bg-transparent')} />
              </Pressable>
            );
          })}
        </ScrollView>
        <View className="bg-primary/15 size-7 items-center justify-center rounded-full">
          <Icon as={Gift} className="text-primary size-3.5" />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5 px-4 pt-2">
        {GIFT_TAGS.map(item => {
          const active = tag === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={`Filtro ${item.label}`}
              accessibilityState={{ selected: active }}
              onPress={() => setTag(item.key)}
              className={cn(
                'rounded-full border px-2 py-0.5 active:opacity-80',
                active ? 'border-primary bg-primary/20' : 'border-white/12 bg-black/25',
              )}>
              <Text className={cn('text-[11px] font-medium', active ? 'text-primary' : 'text-muted-foreground')}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Conocer el evento de la semana"
        onPress={onRecharge}
        className="mx-4 mt-2 flex-row items-center gap-1.5 overflow-hidden rounded-full border border-primary/25">
        <LinearGradient
          colors={['rgba(255,194,75,0.26)', 'rgba(255,194,75,0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="flex-1 flex-row items-center gap-1.5 px-3 py-1.5">
          <Icon as={Sparkles} className="text-primary size-3" />
          <Text className="text-foreground flex-1 text-[11px] font-medium" numberOfLines={1}>
            Evento de la semana · 50.000 de oro
          </Text>
          <Icon as={ChevronDown} className="text-primary size-3" style={{ transform: [{ rotate: '-90deg' }] }} />
        </LinearGradient>
      </Pressable>

      <ScrollView style={{ maxHeight: 152 }} contentContainerClassName="px-4 pt-1.5" showsVerticalScrollIndicator={false}>
        <View className="flex-row flex-wrap justify-between gap-y-1.5">
          {gifts.map(gift => {
            const art = giftArt(gift.key);
            const active = picked?.key === gift.key;
            return (
              <Pressable
                key={gift.key}
                accessibilityRole="button"
                accessibilityLabel={`Elegir ${gift.name} por ${gift.cost} diamantes`}
                accessibilityState={{ selected: active }}
                onPress={() => setPickedKey(gift.key)}
                style={{ width: '23.5%' }}
                className={cn(
                  'items-center rounded-xl border px-1 pb-1.5 pt-1.5 active:opacity-85',
                  active ? 'border-primary bg-primary/10' : 'border-border/70 bg-muted/40',
                )}>
                <View className="h-[38px] w-full items-center justify-center">
                  {art ? (
                    <Image source={art} resizeMode="contain" style={{ width: 34, height: 34 }} accessibilityIgnoresInvertColors />
                  ) : (
                    <Icon as={Gift} className="text-primary size-6" />
                  )}
                  {gift.video ? (
                    <View className="border-primary/70 bg-background/85 absolute bottom-0 rounded-full border px-1">
                      <Text className="text-primary text-[11px] font-bold">VÍDEO</Text>
                    </View>
                  ) : null}
                  {gift.isNew ? (
                    <View className="bg-primary absolute right-0 top-0 rounded-full px-1">
                      <Text className="text-primary-foreground text-[11px] font-bold">NEW</Text>
                    </View>
                  ) : null}
                </View>
                <Text className="text-foreground mt-0.5 text-center text-[11px] font-medium" numberOfLines={1}>
                  {gift.name}
                </Text>
                <View className="mt-0.5 flex-row items-center gap-0.5">
                  <SparklingDiamond size={13} animated={false} />
                  <Text className="text-primary text-[11px] font-semibold tabular-nums">{gift.cost}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {gifts.length === 0 ? (
          <View className="items-center py-6">
            <Text className="text-muted-foreground text-xs">No hay regalos en esta combinación.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver todos los regalos"
              onPress={() => { setTab('todo'); setTag('todo'); }}
              className="border-primary/50 mt-2 rounded-full border px-3 py-1.5 active:opacity-80">
              <Text className="text-primary text-[11px] font-semibold">Ver todo</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <View className="mt-2 border-t border-primary/20 px-4 pb-3 pt-2">
        <View className="flex-row items-center gap-1.5">
          <View className="border-primary/40 bg-primary/10 h-6.5 flex-row items-center gap-1 rounded-full border pl-2 pr-2.5">
            <SparklingDiamond size={15} animated={false} />
            <Text className="text-foreground text-[11px] font-semibold tabular-nums">{balance.toLocaleString('es-US')}</Text>
          </View>
          <View className="flex-1 flex-row items-center gap-1">
          {GIFT_QUANTITIES.map(value => {
            const active = !customOpen && quantity === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`Enviar ${value} regalos`}
                accessibilityState={{ selected: active }}
                onPress={() => { setCustomOpen(false); setQuantity(value); }}
                className={cn(
                  'h-6.5 flex-1 items-center justify-center rounded-full border active:opacity-80',
                  active ? 'border-primary bg-primary' : 'border-border bg-background',
                )}>
                <Text
                  className={cn(
                    'text-[11px] font-semibold leading-[14px] tabular-nums',
                    active ? 'text-primary-foreground' : 'text-foreground',
                  )}>
                  {value}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Escribir otra cantidad"
            accessibilityState={{ selected: customOpen }}
            onPress={() => { setCustomOpen(true); setCustomText(String(count)); }}
            className={cn(
              'h-6.5 w-7 items-center justify-center rounded-full border active:opacity-80',
              customOpen ? 'border-primary bg-primary' : 'border-border bg-background',
            )}>
            <Icon as={Pencil} className={cn('size-3', customOpen ? 'text-primary-foreground' : 'text-muted-foreground')} />
          </Pressable>
          </View>
        </View>

        {customOpen ? (
          <View className="border-border bg-background mt-2 h-8 flex-row items-center rounded-full border px-3">
            <TextInput
              value={customText}
              onChangeText={value => setCustomText(value.replace(/[^0-9]/g, '').slice(0, 3))}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor="#8A8073"
              accessibilityLabel="Cantidad de regalos"
              className="text-foreground flex-1 text-[12px] tabular-nums"
              style={{ paddingVertical: 0 }}
            />
            <Text className="text-muted-foreground text-[11px]">máx. 999</Text>
          </View>
        ) : null}

        {short > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Recargar diamantes"
            onPress={onRecharge}
            className="mt-1.5 flex-row items-center gap-1.5 self-start rounded-full active:opacity-80">
            <Text className="text-destructive text-[11px] font-medium">Te faltan {short.toLocaleString('es-US')} diamantes.</Text>
            <Text className="text-primary text-[11px] font-semibold">Recargar</Text>
          </Pressable>
        ) : null}

        {error ? <Text className="text-destructive mt-1.5 text-[11px]">{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Enviar ${picked?.name ?? 'regalo'} por ${total} diamantes`}
          accessibilityState={{ disabled: !picked || sending }}
          disabled={!picked || sending}
          onPress={() => (picked ? onSend(picked, count) : undefined)}
          className={cn(
            'mt-2 h-10 flex-row items-center justify-center gap-1.5 rounded-full active:opacity-90',
            picked && !sending ? 'bg-primary' : 'bg-primary/40',
          )}>
          {sending ? <ActivityIndicator size="small" color="#1A1409" /> : <Icon as={Gift} className="text-primary-foreground size-3.5" />}
          <Text className="text-primary-foreground text-[13px] font-semibold">
            {sending ? 'Enviando…' : `Enviar ${count > 1 ? `${count} × ` : ''}· ${total.toLocaleString('es-US')}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
