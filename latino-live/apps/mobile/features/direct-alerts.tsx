import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { MessageCircle, X } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import { getProfile } from '@/lib/rooms';
import { listConversations } from '@/lib/direct';
import { keepLiveChannel } from '@/lib/live-channel';
import { showSystemNotice } from '@/lib/notices';

type Banner = { partnerId: string; name: string; body: string };

type Value = {
  unread: number;
  refresh: () => Promise<void>;
  markRead: (partnerId: string) => void;
};

const Context = createContext<Value>({ unread: 0, refresh: async () => undefined, markRead: () => undefined });
export const useDirectUnread = () => useContext(Context);

/**
 * Watches the private inbox everywhere in the app: a new message shows a
 * phone notice when the person is in another app and a card inside the app
 * when they are looking at it, and it counts on the Mensajes tab.
 */
export function DirectAlertsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [unread, setUnread] = useState(0);
  const [banner, setBanner] = useState<Banner | null>(null);
  const names = useRef(new Map<string, string>());
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) { setUnread(0); return; }
    try {
      const rows = await listConversations();
      setUnread(rows.reduce((total, row) => total + Number(row.unread ?? 0), 0));
    } catch {
      // A missing count never blocks the screen; the next event refreshes it.
    }
  }, [userId]);

  const markRead = useCallback((partnerId: string) => {
    setUnread(current => Math.max(0, current - 1));
    void partnerId;
    void refresh();
  }, [refresh]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const client = getSupabase();
    if (!client || !userId) return;
    // Kept alive across sleep and network changes: a message that arrives
    // while the socket was down is still counted when it comes back.
    const stop = keepLiveChannel(client, `direct:alerts:${userId}`, channel =>
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${userId}` },
        async payload => {
          const row = payload.new as { sender_id: string; body: string; image_path: string | null };
          let name = names.current.get(row.sender_id);
          if (!name) {
            const profile = await getProfile(row.sender_id).catch(() => null);
            name = profile?.display_name ?? 'Un amigo';
            names.current.set(row.sender_id, name);
          }
          const body = row.image_path && !row.body ? 'Te envió una foto' : row.body || 'Nuevo mensaje';
          setUnread(current => current + 1);

          if (AppState.currentState !== 'active') {
            await showSystemNotice(`Mensaje de ${name}`, body);
            return;
          }
          setBanner({ partnerId: row.sender_id, name, body });
          if (bannerTimer.current) clearTimeout(bannerTimer.current);
          bannerTimer.current = setTimeout(() => setBanner(null), 6000);
        },
      ),
    refresh);
    return () => {
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      stop();
    };
  }, [userId, refresh]);

  return (
    <Context.Provider value={{ unread, refresh, markRead }}>
      {children}
      {banner ? (
        <View pointerEvents="box-none" className="absolute left-3 right-3 top-14 z-50">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Abrir el mensaje privado de ${banner.name}`}
            onPress={() => {
              const partnerId = banner.partnerId;
              setBanner(null);
              router.push(`/mensajes/${partnerId}` as Href);
            }}
            className="border-primary/40 bg-card flex-row items-center gap-3 rounded-2xl border p-3 active:opacity-90"
            style={{ elevation: 8 }}>
            <View className="bg-primary/20 size-9 items-center justify-center rounded-full">
              <Icon as={MessageCircle} className="text-primary size-4" />
            </View>
            <View className="flex-1">
              <Text className="text-foreground text-[12px] font-semibold" numberOfLines={1}>Mensaje de {banner.name}</Text>
              <Text className="text-muted-foreground text-[11px]" numberOfLines={1}>{banner.body}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar el aviso"
              onPress={() => setBanner(null)}
              hitSlop={10}
              className="size-7 items-center justify-center rounded-full active:bg-muted">
              <Icon as={X} className="text-muted-foreground size-3.5" />
            </Pressable>
          </Pressable>
        </View>
      ) : null}
    </Context.Provider>
  );
}
