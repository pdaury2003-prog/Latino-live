import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import {
  Crown,
  DoorClosed,
  Gift,
  Hand,
  Lock,
  Mic,
  MicOff,
  Plus,
  Share2,
  Shield,
  Sparkles,
  Trash2,
  UserMinus,
  Users,
  Camera,
  Video,
  VideoOff,
  SwitchCamera,
  Heart,
  Minus,
  X,
  Youtube,
  Play,
  Search,
  Swords,
  Trophy,
  LayoutGrid,
  Undo2,
  Dices,
} from 'lucide-react-native';
import { AvatarPhoto } from '@/components/avatar-photo';
import { SvipAvatarFrame } from '@/components/svip-frame';
import { FramedAvatar } from '@/components/framed-avatar';
import { RoomEntryBanner, type RoomEntry } from '@/components/room-entry-banner';
import { EntryVideoOverlay } from '@/components/entry-video-overlay';
import { Dragon3D } from '@/components/dragon-3d';
import type { Dragon3DHandle } from '@/components/dragon-3d-types';
import { isBadgeKind, type BadgeKind } from '@/lib/badges';
import { liveEntryVideo } from '@/lib/entry-video';
import { useStickerChannel } from '@/lib/stickers';
import { capped, columnStyle } from '@/lib/responsive';
import { PictureInPicture } from '@/modules/picture-in-picture';
import { cachedProfiles } from '@/lib/profile-cache';
import { warmRoomImages } from '@/lib/media-warmup';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth';
import {
  findRoomBySlug,
  getGifts,
  getMessages,
  getProfile,
  listProfiles,
  getRoom,
  getSeats,
  getSeatsForRooms,
  getSeatGiftTotals,
  getSeatLocks,
  setSeatLock,
  setRoomPrivate,
  roomCodeMatches,
  getRoomCode,
  withTimeout,
  leaveSeat,
  moderate,
  postMessage,
  sendGift,
  setAnnouncement,
  setSeats,
  setRoomLayout,
  setRoomCamera,
  setRoomMode,
  setRoomTitle,
  setRoomBackground,
  setRoomVideo,
  clearRoomVideo,
  sendRoomPhoto,
  clearRoomChat,
  getModerators,
  getModeratorColors,
  listRooms,
  setModeratorBubble,
  setModerator,
  roomPhotoUrl,
  roomBan,
  forgiveRoomBans,
  listRoomBans,
  closeRoom,
  takeSeat,
  useRoomLive,
  MAX_MESSAGES,
  type GiftRow,
  type MessageRow,
  type ProfileRow,
  type RoomRow,
  type SeatGiftTotal,
  type SeatRow,
} from '@/lib/rooms';
import { useRoomSession } from '@/features/room-session';
import { UserProfileSheet } from '@/components/user-profile-sheet';
import { LuckSheet } from '@/components/luck-sheet';
import { HostBadge } from '@/components/host-badge';
import { RoomPeopleSheet, type PersonInRoom } from '@/components/room-people-sheet';
import { RoomInviteSheet } from '@/components/room-invite-sheet';
import { RoomDj } from '@/components/room-dj';
import { setRoomDj } from '@/lib/dj';
import { RoomVideo, youtubeId } from '@/components/room-video';
import { PkBattleBanner, PkPill, TeamPkBanner, TeamPkPill } from '@/components/pk-banner';
import { RankPodium } from '@/components/rank-podium';
import {
  finishPk,
  finishTeamPk,
  getMyRoomSeat,
  getPk,
  getRoomRanking,
  getTeamPk,
  startPk,
  startTeamPk,
  usePkLive,
  useRankingLive,
  useTeamPkLive,
  type PkBattle,
  type RankedRoom,
  type TeamPkBattle,
} from '@/lib/pk';
import { searchYoutube, youtubePicks, YOUTUBE_FILTERS, type YoutubeFilter, type YoutubeResult } from '@/lib/youtube';
import { shareRoom, shareText } from '@/lib/share';
import { ACTION_ICONS } from '@/lib/gold';
import { GiftStoreSheet } from '@/components/gift-store-sheet';
import { ROOM_GIFTS, type RoomGift } from '@/lib/gift-store';
import { GiftVideoOverlay, GIFT_VIDEOS, type GiftVideoKey, type GiftVideoPlaying } from '@/components/gift-video-overlay';
import { PulseButton } from '@/components/pulse-button';
import { BUBBLES } from '@/lib/bubbles';
import { liveSvipLevel, svipShows, type SvipPiece } from '@/lib/svip';
import { useDataSaver } from '@/lib/power';
import { SvipBubble, SvipMicWave } from '@/components/svip-pieces';
import { svipKit } from '@/lib/svip-kit';
import { SvipKitBackground } from '@/components/svip-kit';
import { RoomStage } from '@/components/room-stage';
import { LayoutDots } from '@/components/room-layout-stage';
import { RoomSeat } from '@/components/room-seat';
import { RoomComposer } from '@/components/room-composer';
import { RoomChatRow, chatTone } from '@/components/room-chat-row';
import { RoleBadge } from '@/components/role-badge';
import { SeatGiftSheet } from '@/components/seat-gift-sheet';
import { PodiumCelebration } from '@/components/podium-celebration';
import { ROOM_LAYOUTS, layoutCapacity, layoutFrame, layoutPlaces, roomLayout } from '@/lib/room-layouts';
import { SeatRing } from '@/components/seat-ring';
import { KISS_TIMEOUT, neighborSeat, useKissChannel, type KissEvent } from '@/lib/kiss';
import { showSystemNotice } from '@/lib/notices';
import { pickPhotoFromLibrary } from '@/lib/pick-photo';
import { coverSource } from '@/lib/covers';
import type { VideoSource } from '@/lib/live-audio.types';
import { cn } from '@/lib/utils';
import { seatErrorText } from '@/lib/seat-error';
import { useAccent } from '@/lib/theme-accent';
import { SparklingDiamond } from '@/components/sparkling-diamond';

const VIDEO_GIFTS = ['tigre', 'demonio'] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Width of one seat column as a share of the grid, five to a row. */
const SEAT_CELL_SHARE = 0.175;

/** Vertical air between two rows of seats. */
const SEAT_ROW_GAP = 8;

/** The square shapes a camera hall is built from. */
const CAMERA_SQUARES = ['square4', 'square6', 'square10'];

/** A free seat is drawn like the photo inside a frame of that box. */
const SEAT_PHOTO_SHARE = 0.72;

/**
 * The size of the shape drawn in the host's panel before applying it. It is
 * big enough to tell two rows of four from two rows of six at a glance, and
 * still fits a short phone above the panel's buttons.
 */
const PREVIEW_SIZE = 132;

/**
 * The dragon that dresses the hall's seats: a free seat shows it inside its
 * gold ring, and a person without a photo of their own wears it too, so no
 * seat is ever an empty letter.
 */
const SEAT_PORTRAIT = require('@/assets/dragon-seat-360.webp');

// One tap searches people already know, without typing on a phone keyboard.
const QUICK_VIDEO_SEARCH = [
  { label: 'Lofi 24/7', query: 'lofi' },
  { label: 'Synthwave', query: 'synthwave' },
  { label: 'Jazz café', query: 'jazz cafe' },
  { label: 'NASA', query: 'nasa' },
  { label: 'Bad Bunny', query: 'bad bunny' },
  { label: 'Queen', query: 'queen' },
  { label: 'Bizarrap', query: 'bizarrap' },
  { label: 'The Wild Project', query: 'the wild project' },
];

export default function Sala() {
  const params = useLocalSearchParams<{ id: string; created?: string; code?: string }>();
  const accent = useAccent();
  const key = params.id ?? '';
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // La sala se dibuja como una columna de teléfono: en una tablet o una
  // ventana ancha los asientos no se estiran ni el chat queda como una franja.
  const columnWidth = capped(windowWidth);
  const column = columnStyle();
  /** En un teléfono angosto los botones ceden unos puntos al campo de texto. */
  const actionSize = windowWidth < 360 ? 40 : 44;
  /**
   * En un teléfono angosto la cabecera no cabe con todos los botones y el
   * nombre de la sala se corta. Allí compartir y los controles bajan a la
   * línea del podio, y el nombre respira.
   */
  const narrowHeader = windowWidth < 400;
  /** Una foto del chat: dos tercios de la columna, sin pasar de su tamaño. */
  const chatPhotoWidth = Math.round(Math.max(132, Math.min(210, columnWidth * 0.46)));
  const { session } = useAuth();
  const chatRef = useRef<ScrollView>(null);

  const [room, setRoom] = useState<RoomRow | null>(null);
  const [seats, setSeatRows] = useState<SeatRow[]>([]);
  const [luckOpen, setLuckOpen] = useState(false);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [gifts, setGifts] = useState<GiftRow[]>([]);
  /** Diamonds each seated person has been given today, by user id. */
  const [seatGifts, setSeatGifts] = useState<Record<string, SeatGiftTotal>>({});
  /** The seat whose counter was opened: who sent its gifts. */
  const [giftSeatNo, setGiftSeatNo] = useState<number | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftRecipient, setGiftRecipient] = useState<{ id: string; name: string } | null>(null);
  const [giftSending, setGiftSending] = useState(false);
  const [moderators, setModerators] = useState<string[]>([]);
  const [bubbles, setBubbles] = useState<Record<string, string>>({});
  const [chatPhotoBusy, setChatPhotoBusy] = useState(false);
  /** The chat shows everything or only the gifts that landed in the room. */
  const [chatFilter, setChatFilter] = useState<'todo' | 'regalo'>('todo');
  const [bgBusy, setBgBusy] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const [giftError, setGiftError] = useState<string | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  // Sharing the room with the people who already have an account.
  const [inviteOpen, setInviteOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoDraft, setVideoDraft] = useState('');
  const [videoResults, setVideoResults] = useState<YoutubeResult[]>([]);
  const [videoSearching, setVideoSearching] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoFilter, setVideoFilter] = useState<YoutubeFilter>('all');
  // The room's battle: the live one, or the result the room is still showing.
  const [pk, setPk] = useState<PkBattle | null>(null);
  const [pkRivals, setPkRivals] = useState<RoomRow[]>([]);
  const [pkBusy, setPkBusy] = useState(false);
  const [pkOpen, setPkOpen] = useState(false);
  // The battle inside this room: Equipo Rojo against Equipo Azul.
  const [teamPk, setTeamPk] = useState<TeamPkBattle | null>(null);
  const [teamPkBusy, setTeamPkBusy] = useState(false);
  const [teamPkOpen, setTeamPkOpen] = useState(false);
  // The title of the room this account sat down in on another phone.
  const [movedTo, setMovedTo] = useState<string | null>(null);
  /** A kiss a neighbour is asking for, and the seconds it has left. */
  const [kissAsk, setKissAsk] = useState<KissEvent | null>(null);
  const [kissLeft, setKissLeft] = useState(15);
  // Today's podium, read when the room asks for it.
  const [podiumOpen, setPodiumOpen] = useState(false);
  const [podium, setPodium] = useState<RankedRoom[]>([]);
  const [podiumAvatars, setPodiumAvatars] = useState<Record<string, string | null>>({});
  const [podiumBusy, setPodiumBusy] = useState(false);
  /** The room's own podium news, shown big for a few seconds when it lands. */
  const [podiumNews, setPodiumNews] = useState<string | null>(null);
  /** The chat as it was when the person walked in. Anything newer is news. */
  const seenChatId = useRef<number | null>(null);
  // The host's own words at the top of the room; null keeps them closed.
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [titleSaving, setTitleSaving] = useState(false);
  // One compact panel at a time: the sheet is a row of icons, not a long list.
  const [panel, setPanel] = useState<'seats' | 'layout' | 'cameras' | 'video' | 'announce' | 'background' | 'pk' | 'team' | 'private' | null>(null);
  /** The host is opening or closing the room's cameras right now. */
  const [cameraRuleBusy, setCameraRuleBusy] = useState(false);
  /*
   * The shape the host is looking at before it becomes the room's. It starts
   * on the room's own shape, so touching another one is a preview, not a
   * change: the room stays exactly as everyone sees it until the host applies.
   */
  const [layoutChoice, setLayoutChoice] = useState<string | null>(null);
  const [layoutBusy, setLayoutBusy] = useState(false);
  /*
   * The shape the room wore before the last change, held on this phone. It is
   * what "volver" restores; null means there is nothing to go back to yet.
   */
  const [previousLayout, setPreviousLayout] = useState<{ id: string | null } | null>(null);
  const [announceDraft, setAnnounceDraft] = useState('');
  const [bannedIds, setBannedIds] = useState<string[]>([]);
  // Seats the host has closed, and the code of a private room.
  const [seatLocks, setSeatLocks] = useState<number[]>([]);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [privateBusy, setPrivateBusy] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateCode, setGateCode] = useState('');
  const [gateBusy, setGateBusy] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  // Once the code is right, this phone may enter for the rest of the visit.
  const unlocked = useRef(false);
  // A code that came with an invitation is tried once, on its own.
  const codeTried = useRef(false);
  const [seatAreaWidth, setSeatAreaWidth] = useState(0);
  const [moderating, setModerating] = useState<SeatRow | null>(null);
  const [profileSeat, setProfileSeat] = useState<SeatRow | null>(null);
  const [peopleOpen, setPeopleOpen] = useState(false);
  // Every signal plays once on this phone, whoever sent it.
  const flownIds = useRef<Set<string>>(new Set());
  const seatBoxes = useRef<Record<number, View | null>>({});
  const roomBox = useRef<View | null>(null);
  // The room's real dragon: it stands on the seat of whoever sends an emotion.
  const dragon = useRef<Dragon3DHandle | null>(null);
  /**
   * The dragon is a 3D stage of its own (and on Android a native layer that
   * carries the page inside it). Mounting it while the room is still drawing
   * its seats and chat made every room open slower, so it joins once the room
   * is on screen. Nobody is mid-emotion in the first second.
   */
  const [dragonReady, setDragonReady] = useState(false);
  const dataSaver = useDataSaver();
  const [memberProfiles, setMemberProfiles] = useState<Record<string, ProfileRow>>({});
  const [entry, setEntry] = useState<RoomEntry | null>(null);
  // Arrivals wait their turn: a banner never restarts in the middle of another.
  const entryQueue = useRef<RoomEntry[]>([]);
  // The people already in the room when this phone arrives are not arrivals:
  // the banner belongs to someone who walks in afterwards.
  const presenceReady = useRef(false);
  const presenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Un aviso y una llegada se van solos y dejan su reloj suelto al cerrar la
  // sala: se apagan aquí para que la pantalla siguiente no cargue con ellos.
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (presenceTimer.current) clearTimeout(presenceTimer.current);
  }, []);
  const [playingGift, setPlayingGift] = useState<GiftVideoPlaying | null>(null);
  // Set when the host expelled this person: the room stays shut for a day.
  const [banUntil, setBanUntil] = useState<string | null>(null);
  const seenMembers = useRef<Set<string> | null>(null);
  const entryCounter = useRef(0);
  const sharedOnOpen = useRef(false);
  const wasSeated = useRef(false);
  const movingSelf = useRef(false);
  /** Un cambio de asiento a la vez: un toque no pisa al que va viajando. */
  const seatBusy = useRef(false);
  const lastNotifiedGift = useRef<number | null>(null);
  // One snapshot read at a time: a burst of live events waits for the running
  // one instead of starting six queries each.
  const reading = useRef(false);
  const readAgain = useRef(false);
  const myProfile = useRef<ProfileRow | null>(null);

  const roomId = room?.id ?? null;

  const load = useCallback(async () => {
    if (reading.current) {
      readAgain.current = true;
      return;
    }
    reading.current = true;
    try {
      const found = await withTimeout(UUID.test(key) ? getRoom(key) : findRoomBySlug(key), 12000);
      if (!found) {
        setError('Esta sala ya no existe.');
        return;
      }
      // A private room asks for its code before anything else: no reading of
      // the seats or the chat until this phone is let in.
      const needsCode = Boolean(found.is_private) && found.host_id !== session?.user.id && !unlocked.current;
      if (needsCode) {
        setRoom(found);
        setGateOpen(true);
        setError(null);
        return;
      }
      setGateOpen(false);
      // The room's own row is enough to draw its shell: the title, the cover
      // and the exit button paint at once while the seats and the chat travel.
      setRoom(found);
      const host = Boolean(session?.user.id && found.host_id === session.user.id);
      // Everything the room needs travels at once: one slow list no longer
      // holds the seats, the chat and the host's tools behind it. A part that
      // fails or arrives late only leaves its own place empty. The expulsion
      // check travels with them, so it costs no extra wait before the room.
      const [ban, nextSeats, nextMessages, nextGifts, nextLocks, nextModerators, nextColors, nextBans, nextProfile, nextCode, nextTotals] = await Promise.all([
        session?.user.id ? withTimeout(roomBan(found.id), 8000).catch(() => null) : Promise.resolve(null),
        withTimeout(getSeats(found.id), 14000).catch(() => [] as SeatRow[]),
        withTimeout(getMessages(found.id), 14000).catch(() => [] as MessageRow[]),
        withTimeout(getGifts(found.id), 14000).catch(() => [] as GiftRow[]),
        withTimeout(getSeatLocks(found.id), 10000).catch(() => [] as number[]),
        withTimeout(getModerators(found.id), 10000).catch(() => [] as string[]),
        withTimeout(getModeratorColors(found.id), 10000).catch(() => []),
        host ? withTimeout(listRoomBans(found.id), 10000).catch(() => []) : Promise.resolve([]),
        session?.user.id && !myProfile.current ? withTimeout(getProfile(session.user.id), 10000).catch(() => null) : Promise.resolve(null),
        host ? withTimeout(getRoomCode(found.id), 10000).catch(() => null) : Promise.resolve(null),
        withTimeout(getSeatGiftTotals(found.id), 10000).catch(() => ({} as Record<string, SeatGiftTotal>)),
      ]);
      // A link reopened after an expulsion must not sneak the person back in,
      // not even into the voice session: the room stops here, before it shows.
      if (session?.user.id) {
        if (ban) {
          setBanUntil(ban.until);
          setError(null);
          return;
        }
        setBanUntil(null);
      }
      setSeatRows(nextSeats);
      setMessages(nextMessages);
      setGifts(nextGifts);
      setSeatGifts(nextTotals);
      setSeatLocks(nextLocks);
      setModerators(nextModerators);
      setBubbles(Object.fromEntries(nextColors.map(row => [row.user_id, row.bubble_color])));
      setAnnounceDraft(current => current || found.announcement);
      if (nextCode) setJoinCode(nextCode);
      if (host) setBannedIds(nextBans.map(row => row.user_id));
      // The person's own card does not change while they sit in a room.
      if (nextProfile) {
        myProfile.current = nextProfile;
        setProfile(nextProfile);
      }
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === 'timeout'
          ? 'La sala tardó demasiado en abrir. Revisa tu conexión y reintenta.'
          : 'No pudimos cargar la sala. Revisa tu conexión.',
      );
    } finally {
      reading.current = false;
      setLoading(false);
      if (readAgain.current) {
        readAgain.current = false;
        void load();
      }
    }
  }, [key, session?.user.id]);

  useEffect(() => { void load(); }, [load]);

  /** Reads the room's battle: the live score, or the result just ended. */
  const refreshPk = useCallback(async (roomId: string) => {
    const battle = await getPk(roomId).catch(() => null);
    setPk(battle);
  }, []);
  useEffect(() => {
    if (!room) return;
    void refreshPk(room.id);
  }, [room?.id, refreshPk]);
  usePkLive(room?.id ?? null, () => {
    if (room) void refreshPk(room.id);
  });

  /** Reads the room's team battle: the live score, or the result just ended. */
  const refreshTeamPk = useCallback(async (roomId: string) => {
    const battle = await getTeamPk(roomId).catch(() => null);
    setTeamPk(battle);
  }, []);
  useEffect(() => {
    if (!room) return;
    void refreshTeamPk(room.id);
  }, [room?.id, refreshTeamPk]);
  useTeamPkLive(room?.id ?? null, () => {
    if (room) void refreshTeamPk(room.id);
  });

  // The chip under the exit button tells the room's place before it is opened.
  useEffect(() => {
    if (!room) return;
    void getRoomRanking(10)
      .then(list => setPodium(list.filter(item => Number(item.score) > 0)))
      .catch(() => undefined);
  }, [room?.id]);

  /** Reads only the day's podium: the chip's place and the full list. */
  const refreshPodium = useCallback(async () => {
    try {
      // Only rooms that have earned diamonds today hold a place, exactly like
      // the podium notices: a brand-new room with nothing is not "sixth".
      setPodium((await getRoomRanking(10)).filter(item => Number(item.score) > 0));
    } catch {
      // The next gift or opening the list corrects it.
    }
  }, []);
  // A gift in any room moves the board; the room's place follows without a reload.
  useRankingLive(() => { void refreshPodium(); });

  // Entering the podium is the room's own news: the database writes the line,
  // and here it drops in big for a few seconds. Walking into the room later
  // does not replay it, because only a newer line is announced.
  useEffect(() => {
    if (messages.length === 0) return;
    const newest = messages.reduce((max, message) => Math.max(max, message.id), 0);
    // The first read is the chat the person found on walking in: its podium
    // lines are old news and stay in the chat without a card.
    if (seenChatId.current === null) {
      seenChatId.current = newest;
      return;
    }
    const podiumLine = messages.reduce<{ id: number; body: string } | null>(
      (best, message) =>
        message.author === 'Podio' && message.id > (seenChatId.current ?? 0) && (!best || message.id > best.id)
          ? { id: message.id, body: message.body }
          : best,
      null,
    );
    if (!podiumLine) {
      seenChatId.current = Math.max(seenChatId.current ?? 0, newest);
      return;
    }
    seenChatId.current = Math.max(seenChatId.current ?? 0, podiumLine.id);
    setPodiumNews(podiumLine.body);
    void refreshPodium();
    // El aviso del ranking se queda solo tres segundos: se ve, se entiende y
    // deja libre la sala. La misma línea sigue en el chat.
    const timer = setTimeout(() => setPodiumNews(null), 3000);
    return () => clearTimeout(timer);
  }, [messages, refreshPodium]);

  useEffect(() => {
    if (sharedOnOpen.current || params.created !== '1' || !room) return;
    sharedOnOpen.current = true;
    const timer = setTimeout(() => { void invite(); }, 700);
    return () => clearTimeout(timer);
  }, [params.created, room]);

  useEffect(() => {
    if (!messages.length) return;
    const timer = setTimeout(() => chatRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [messages.length]);

  // A gift that arrives while the phone is on another app still reaches the person.
  useEffect(() => {
    const newest = gifts[0];
    if (!newest) return;
    const isVideo = VIDEO_GIFTS.includes(newest.gift_key as GiftVideoKey);
    const previous = lastNotifiedGift.current;
    if (previous === null) {
      lastNotifiedGift.current = newest.id;
      return;
    }
    if (newest.id <= previous) return;
    lastNotifiedGift.current = newest.id;
    // A video gift plays over the whole room for everyone, whoever sent it.
    if (isVideo) {
      setPlayingGift({ key: newest.gift_key as GiftVideoKey, sender: newest.sender_name, recipient: null });
    }
    if (newest.sender_id === session?.user.id || AppState.currentState === 'active') return;
    void showSystemNotice('Regalo en la sala', `${newest.sender_name} envió un regalo en ${room?.title ?? 'tu sala'}`);
  }, [gifts, session?.user.id, room?.title]);

  const isHost = Boolean(room?.host_id && room.host_id === session?.user.id);
  const isModerator = Boolean(session?.user.id && moderators.includes(session.user.id));
  const canModerate = isHost || isModerator;
  const me = seats.find(seat => seat.user_id === session?.user.id);
  const {
    enter: enterRoom, attach: attachRoom, minimize: minimizeRoom, holdMic,
    leave: leaveRoom, voice, voiceError, clearVoiceError,
  } = useRoomSession();

  useEffect(() => {
    // A private room stays silent until its code is accepted.
    if (!room || room.closed_at || gateOpen) return;
    enterRoom({
      id: room.id,
      slug: room.slug,
      title: room.title,
      hostName: room.host_name,
      // A voice hall has no cameras at all; a camera hall follows its switch.
      allowCamera: room.room_mode === 'camera' && room.allow_camera !== false,
    });
  }, [room, enterRoom, gateOpen]);

  // A person already sitting can buy an SVIP, hide a piece or change photo:
  // their card refreshes without anyone leaving the room.
  const refreshProfiles = useCallback(async () => {
    const ids = [...new Set([...voice.members, ...seats.map(seat => seat.user_id)])].filter(Boolean);
    if (ids.length === 0) return;
    try {
      const rows = await listProfiles(ids);
      if (rows.length === 0) return;
      setMemberProfiles(current => {
        const next = { ...current };
        rows.forEach(row => { next[row.id] = row; });
        return next;
      });
      if (session?.user.id) {
        const mine = rows.find(row => row.id === session.user.id);
        if (mine) {
          myProfile.current = mine;
          setProfile(mine);
        }
      }
    } catch {
      // The room keeps the last known cards; the next event tries again.
    }
  }, [voice.members, seats, session?.user.id]);

  // The expulsion arrives while the person is still in the room: their screen
  // closes the room at once instead of waiting for them to try a seat.
  const handleBan = useCallback(async () => {
    if (!roomId || !session?.user.id) return;
    const ban = await roomBan(roomId).catch(() => null);
    if (!ban) return;
    setBanUntil(ban.until);
    leaveRoom();
  }, [roomId, session?.user.id, leaveRoom]);

  // A seat is one small read: moving reaches every phone at once, without
  // reloading the chat, the gifts and the room itself.
  const refreshSeats = useCallback(async () => {
    if (!roomId) return;
    try {
      // The counter belongs to the visit: a seat that was just taken starts at
      // zero, and one that was left has no counter at all.
      const [nextSeats, nextLocks, nextTotals] = await Promise.all([
        getSeats(roomId),
        getSeatLocks(roomId),
        getSeatGiftTotals(roomId).catch(() => null),
      ]);
      setSeatRows(nextSeats);
      setSeatLocks(nextLocks);
      if (nextTotals) setSeatGifts(nextTotals);
    } catch {
      // The next event or a full reload corrects the seats.
    }
  }, [roomId]);

  // A message or a gift only re-reads the chat, never the whole room.
  const refreshChat = useCallback(async () => {
    if (!roomId) return;
    try {
      const [nextMessages, nextGifts, nextTotals] = await Promise.all([
        getMessages(roomId),
        getGifts(roomId),
        getSeatGiftTotals(roomId).catch(() => null),
      ]);
      setMessages(nextMessages);
      setGifts(nextGifts);
      if (nextTotals) setSeatGifts(nextTotals);
    } catch {
      // The chat keeps what it has until the next event.
    }
  }, [roomId]);

  /** Measures one box on the phone's screen; null while it is not drawn yet. */
  const measure = useCallback(
    (node: View | null) =>
      new Promise<{ x: number; y: number; w: number; h: number } | null>(resolve => {
        if (!node) { resolve(null); return; }
        node.measureInWindow((x, y, w, h) => resolve(w > 0 && h > 0 ? { x, y, w, h } : null));
      }),
    [],
  );

  /**
   * Plays the couple once per phone: two dragons walk to each other and kiss
   * on the two seats the yes came from.
   */
  const playPair = useCallback(async (payload: {
    id: string;
    stickerId: string;
    senderName: string;
    fromSeat: number | null;
    toSeat: number | null;
  }) => {
    if (flownIds.current.has(payload.id)) return;
    if (!payload.stickerId.startsWith('dragon-pair:')) return;
    flownIds.current.add(payload.id);
    if (flownIds.current.size > 80) {
      flownIds.current = new Set([...flownIds.current].slice(-40));
    }
    const [left, right] = payload.stickerId.slice('dragon-pair:'.length).split(':').map(Number);
    const [boardPair, leftBox, rightBox] = await Promise.all([
      measure(roomBox.current),
      measure(seatBoxes.current[left] ?? null),
      measure(seatBoxes.current[right] ?? null),
    ]);
    if (!leftBox || !rightBox) return;
    const boardX = boardPair?.x ?? 0;
    const boardY = boardPair?.y ?? 0;
    const box = (spot: { x: number; y: number; w: number; h: number }) =>
      ({ left: spot.x - boardX, top: spot.y - boardY, width: spot.w, height: spot.h });
    dragon.current?.pair(box(leftBox), box(rightBox));
  }, [measure]);

  // The couple keeps its own line so both phones start the kiss at once.
  const sendPairSignal = useStickerChannel(roomId, payload => { void playPair(payload); });

  useRoomLive(roomId, {
    onChange: () => { void load(); },
    onSeatsChange: session?.user.id ? refreshSeats : undefined,
    onChatChange: refreshChat,
    onProfileChange: refreshProfiles,
    onBanChange: session?.user.id ? handleBan : undefined,
  });

  useEffect(() => {
    attachRoom({ seated: Boolean(me), muted: Boolean(me?.muted) });
  }, [Boolean(me), me?.muted, attachRoom]);

  /**
   * Las caras de los asientos y el fondo se adelantan en la caché del teléfono
   * mientras la sala se dibuja: al llegar la señal, la foto ya está lista y no
   * aparece gris un instante. Vive aquí, antes de cualquier salida temprana de
   * la pantalla, porque todos los hooks se piden en el mismo orden siempre.
   */
  useEffect(() => {
    if (!room || dataSaver) return;
    warmRoomImages([
      room.background_path ? roomPhotoUrl(room.background_path) : null,
      ...seats.map(seat => seat.avatar_url),
    ]);
  }, [room?.id, room?.background_path, seats, dataSaver]);

  // La ventana flotante: mientras la sala está delante, salir de la app deja
  // la pantalla viva en una ventanita, con la voz y el video sin cortarse.
  // Al abrir otra pantalla se aparta, para no flotar con algo que no es la sala.
  useFocusEffect(
    useCallback(() => {
      if (!room || room.closed_at) return undefined;
      void PictureInPicture.setEnabled(true);
      return () => { void PictureInPicture.setEnabled(false); };
    }, [room?.id, room?.closed_at]),
  );

  // The room itself comes first: seats, chat and voice. The dragon is a whole
  // page of its own inside the phone, so it waits until the room is actually
  // drawn and the phone is idle — on a slow phone, loading it earlier made the
  // seats and the chat arrive behind it.
  useEffect(() => {
    if (!room || loading) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const idle = (globalThis as { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number })
      .requestIdleCallback;
    const schedule = () => {
      timer = setTimeout(() => setDragonReady(true), 900);
    };
    if (idle) idle(schedule, { timeout: 1800 });
    else schedule();
    return () => { if (timer) clearTimeout(timer); };
  }, [Boolean(room), loading]);

  // People who join only to listen have no seat row: their profile is what
  // proves they are still in the room, for both the count and the list.
  useEffect(() => {
    // Seated people need their profile too: it carries their SVIP frame.
    const ids = [...voice.members, ...seats.map(seat => seat.user_id)];
    const unknown = [...new Set(ids)].filter(id => !memberProfiles[id]);
    if (unknown.length === 0) return;
    /**
     * Offline-first: las fichas guardadas de quienes están sentados se pintan
     * en el mismo cuadro —su foto, su marco, su nivel— y la versión nueva
     * llega por detrás. Entrar a una sala ya no espera por las caras.
     */
    const saved = cachedProfiles(unknown);
    if (saved.length > 0) {
      setMemberProfiles(current => {
        const next = { ...current };
        saved.forEach(row => { if (!next[row.id]) next[row.id] = row; });
        return next;
      });
    }
    let live = true;
    void listProfiles(unknown).then(rows => {
      if (!live || rows.length === 0) return;
      setMemberProfiles(current => {
        const next = { ...current };
        rows.forEach(row => { next[row.id] = row; });
        return next;
      });
    }).catch(() => undefined);
    return () => { live = false; };
  }, [voice.members, seats, memberProfiles]);

  // Losing the seat without asking means the host removed you, or the same
  // account sat down in another room. One account lives in one room at a
  // time, so a seat elsewhere closes this one.
  useEffect(() => {
    const lost = wasSeated.current && !me && !movingSelf.current;
    wasSeated.current = Boolean(me);
    movingSelf.current = false;
    if (!lost) return;
    let live = true;
    void getMyRoomSeat()
      .then(where => {
        if (!live) return;
        if (where && where.room_id !== roomId) {
          leaveRoom();
          setMovedTo(where.title);
          return;
        }
        // Sigo en esta sala: el asiento cambió de lugar (por ejemplo, desde
        // otro teléfono con la misma cuenta). No es una expulsión.
        if (where && where.room_id === roomId) {
          void refreshSeats();
          return;
        }
        flash('El anfitrión te sacó del asiento');
      })
      .catch(() => { if (live) flash('El anfitrión te sacó del asiento'); });
    return () => { live = false; };
  }, [Boolean(me), roomId, leaveRoom]);

  // Everyone in the room sees who just walked in, with their SVIP look.
  useEffect(() => {
    const current = voice.members;
    if (seenMembers.current === null) {
      seenMembers.current = new Set(current);
      // The first list is the room as this phone found it. The banner starts
      // working once that list has settled, so nobody already here is
      // announced again, and a half-loaded presence does not queue a show.
      presenceTimer.current = setTimeout(() => {
        presenceReady.current = true;
        seenMembers.current = new Set(voice.members);
      }, 1800);
      return;
    }
    const before = seenMembers.current;
    const fresh = current.filter(id => !before.has(id) && id !== session?.user.id);
    seenMembers.current = new Set(current);
    if (!presenceReady.current) return;
    if (fresh.length === 0) return;
    const id = fresh[fresh.length - 1];
    const known = memberProfiles[id];
    entryCounter.current += 1;
    const show = (row: ProfileRow | null) => {
      // A lapsed pack or a hidden banner means the person enters quietly.
      const level = liveSvipLevel(row) > 0 && svipShows(row, 'banner') ? liveSvipLevel(row) : 0;
      const next: RoomEntry = {
        key: entryCounter.current,
        name: row?.display_name ?? seats.find(seat => seat.user_id === id)?.display_name ?? 'Alguien',
        avatar: row?.avatar_url ?? seats.find(seat => seat.user_id === id)?.avatar_url ?? null,
        svip: level,
        video: liveEntryVideo(row),
      };
      entryQueue.current.push(next);
      // Only one banner on screen: the queue plays as each one finishes.
      setEntry(currentEntry => currentEntry ?? next);
    };
    if (known) show(known);
    else {
      void listProfiles([id])
        .then(rows => show(rows[0] ?? null))
        .catch(() => show(null));
    }
  }, [voice.members, memberProfiles, seats, session?.user.id]);


  // Leaving a focused room card behind keeps it announced while the route is hidden.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') (document.activeElement as HTMLElement | null)?.blur();
  }, []);

  useEffect(() => {
    if (!voiceError) return;
    flash(voiceError);
    clearVoiceError();
  }, [voiceError, clearVoiceError]);

  const hostSeat = seats.find(seat => seat.seat_no === 1);

  // The people a gift can be addressed to: everyone sitting, host first.
  const giftTargets = useMemo(
    () =>
      [...seats]
        .sort((a, b) => a.seat_no - b.seat_no)
        .map(seat => ({ id: seat.user_id, name: seat.display_name, avatarUrl: seat.avatar_url })),
    [seats],
  );

  const allSeats = useMemo(() => {
    const capacity = room?.max_seats ?? 10;
    return Array.from({ length: capacity }, (_, index) => {
      const no = index + 1;
      return { no, seat: seats.find(item => item.seat_no === no) };
    });
  }, [room?.max_seats, seats]);

  /*
   * Los toques de cada asiento se guardan una vez por reparto. Así una persona
   * escribiendo o hablando no cambia la función de veinte asientos y el dibujo
   * de cada uno se queda quieto hasta que cambie algo suyo.
   */
  const seatTap = useRef<(no: number, seat?: SeatRow) => void>(() => undefined);
  seatTap.current = (no, seat) => { void handleSeat(no, seat); };
  const seatPress = useMemo(() => {
    const map: Record<number, () => void> = {};
    const gift: Record<number, () => void> = {};
    for (const { no, seat } of allSeats) {
      map[no] = () => seatTap.current(no, seat);
      gift[no] = () => setGiftSeatNo(no);
    }
    return { press: map, gift };
  }, [allSeats]);

  // Five seats per row, so a long name never pushes the last seat onto its own
  // line and every circle keeps the same size.
  // A video room shows fewer, smaller seats: the screen needs the space.
  const isVideo = Boolean(room?.video_url && youtubeId(room.video_url));
  const seatCols = isVideo ? 4 : 5;

  // --- The kiss of two neighbours -------------------------------------------
  /** The seat I sit on, and the taken seat beside it that I can kiss. */
  const mySeatNo = me?.seat_no ?? 0;
  const kissSeatNo = mySeatNo ? neighborSeat(mySeatNo, seats.map(seat => seat.seat_no), seatCols) : null;
  const sendKiss = useKissChannel(roomId, event => {
    if (mySeatNo > 0 && event.kind === 'ask' && event.to === mySeatNo) {
      // Only the seat that was asked answers; the rest of the room never sees it.
      setKissAsk(event);
      return;
    }
    if (event.from !== mySeatNo) return;
    if (event.kind === 'decline') flash(`${event.toName} rechazó el beso.`);
    if (event.kind === 'gone') flash(`${event.toName} no respondió el beso.`);
  });

  // The dialog counts down by itself: a request nobody answers leaves no trace.
  useEffect(() => {
    if (!kissAsk) return;
    const until = kissAsk.at + KISS_TIMEOUT;
    let told = false;
    const tick = () => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setKissLeft(left);
      if (left > 0 || told) return;
      told = true;
      setKissAsk(null);
      flash('No respondiste el beso.');
      void sendKiss({ ...kissAsk, kind: 'gone', at: Date.now() });
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [kissAsk, sendKiss]);
  /**
   * Each seat's share of the row. A voice room keeps the airy five-column grid
   * it always had, so the room's own background shows between the seats.
   */
  const seatCellShare = isVideo ? 1 / seatCols : SEAT_CELL_SHARE;
  const seatCellWidth = `${(seatCellShare * 100).toFixed(2)}%` as `${number}%`;

  const seatRows = useMemo(() => {
    const rows: { no: number; seat: (typeof allSeats)[number]['seat'] }[][] = [];
    // Every seat is the same seat: the host's place is the first one in the
    // grid, not a throne above the hall.
    for (let index = 0; index < allSeats.length; index += seatCols) rows.push(allSeats.slice(index, index + seatCols));
    return rows;
  }, [allSeats, seatCols]);

  /** ¿Hay algún contador de diamantes bajo un nombre? Entonces la fila crece. */
  const seatGiftsShown = useMemo(
    () => Object.values(seatGifts).some(gift => (gift?.diamonds ?? 0) > 0),
    [seatGifts],
  );

  // Four rows of five at most. The seats shrink to share the space the grid has
  // above the chat, so a room of twenty shows every seat at once, never a list
  // that has to be swiped.
  const seatLayout = useMemo(() => {
    const rows = Math.max(1, Math.ceil(allSeats.length / seatCols));
    // Air between rows and columns: five seats never touch, even with a frame.
    const gap = SEAT_ROW_GAP;
    // A free seat shows its number under the circle, the way a hall numbers
    // its places; a taken seat keeps only the face.
    const label = 14;
    // Un asiento con regalos lleva el contador en su propia línea bajo el
    // nombre. Su alto se reserva aquí para que dos filas nunca se toquen.
    const counter = seatGiftsShown ? 12 : 0;
    const cell = seatAreaWidth > 0 ? (seatAreaWidth * seatCellShare) : 68;
    // The grid may grow with the phone: taller screens give bigger faces.
    const budget = isVideo
      ? Math.min(120, windowHeight * 0.15)
      : Math.max(320, Math.min(540, windowHeight * 0.62));
    const rowBudget = (budget - gap * (rows - 1) - 4) / rows;
    // The frame fills its column and row; the seat inside keeps its own size,
    // so a bigger frame never turns into a bigger seat.
    const frame = Math.round(Math.max(isVideo ? 46 : 56, Math.min(cell, rowBudget - label - counter)));
    const photo = Math.round(frame * SEAT_PHOTO_SHARE);
    return {
      photo,
      frame,
      height: rows * (frame + label + counter) + gap * (rows - 1) + 4,
    };
  }, [allSeats.length, seatAreaWidth, windowHeight, seatCols, seatCellShare, isVideo, seatGiftsShown]);

  const seatAvatarSize = seatLayout.photo;
  const seatFrameSize = seatLayout.frame;

  /*
   * The design the room wears, when it has one. A design draws a fixed set of
   * places: a room whose capacity outgrew it keeps the plain grid until the
   * host picks the design again.
   *
   * A video room wears only a design that fills every place exactly: its
   * chairs are the camera squares, and an unused place would leave a hole in
   * the picture.
   */
  const design = useMemo(() => {
    if (!room) return null;
    const found = roomLayout(room.layout);
    if (!found) return null;
    const capacity = room.max_seats ?? 0;
    return isVideo
      ? layoutCapacity(found) === capacity ? found : null
      : capacity <= layoutCapacity(found) ? found : null;
  }, [room, isVideo]);
  // The design's places in the order their numbers run, so seat one is the
  // host's place and the rest follow left to right.
  const designPlaces = useMemo(() => (design ? layoutPlaces(design) : []), [design]);
  /*
   * The shape the host is looking at in the panel. The room keeps its own
   * until the host applies it, and the panel opens on the room's shape so an
   * accidental touch changes nothing.
   */
  const layoutPreview = useMemo(() => roomLayout(layoutChoice), [layoutChoice]);
  const roomLayoutId = room && roomLayout(room.layout) ? room.layout ?? null : null;
  const layoutPending = layoutChoice !== roomLayoutId;
  // The shape to go back to, when there is one and it is not the room's now.
  const layoutUndo = previousLayout && previousLayout.id !== roomLayoutId ? previousLayout : null;

  /** Each camera in the room, by the person it shows. */
  const videosById = useMemo(() => {
    const map: Record<string, VideoSource> = {};
    for (const entry of voice.videos) map[entry.id] = entry.source;
    return map;
  }, [voice.videos]);
  /**
   * The two halls are different on purpose. A camera room draws every place
   * as the rounded square a picture fills; a voice room keeps the round
   * portraits it always had, whether or not a movie is playing.
   */
  const cameraMode = room?.room_mode === 'camera';
  const cameraSeat = () => cameraMode;
  const videoOf = (userId: string) => videosById[userId] ?? null;

  // Opening the panel starts from the room's own shape, and a different room
  // forgets the one this phone was looking at.
  useEffect(() => {
    if (panel === 'layout') setLayoutChoice(roomLayoutId);
  }, [panel, roomLayoutId]);
  useEffect(() => {
    setPreviousLayout(null);
  }, [room?.id]);

  // The square fits the phone's width and the air above the chat.
  const designSize = Math.round(Math.min(
    seatAreaWidth > 0 ? seatAreaWidth : windowWidth - 32,
    // In a video room the player above already takes half the screen, so the
    // square of cameras shares the rest with the chat instead of pushing it out.
    Math.max(isVideo ? 230 : 300, windowHeight * (isVideo ? 0.32 : 0.52)),
  ));

  /**
   * How wide the name under each place may run, in points. It stops before
   * the nearest neighbour, so a packed shape never writes over the next seat.
   */
  const captionWidths = useMemo(() => {
    if (!design || designSize <= 0) return [] as number[];
    return designPlaces.map((place, index) => {
      const px = { x: (place.x / 100) * designSize, y: (place.y / 100) * designSize };
      let nearest = designSize;
      designPlaces.forEach((other, otherIndex) => {
        if (otherIndex === index) return;
        const distance = Math.hypot(px.x - (other.x / 100) * designSize, px.y - (other.y / 100) * designSize);
        if (distance < nearest) nearest = distance;
      });
      // A little air on each side, and never narrower than one short name.
      return Math.max(46, Math.round(nearest - 6));
    });
  }, [design, designPlaces, designSize]);


  // In a video room the screen is the star: edge to edge, in 16:9, and as tall
  // as the phone allows while the seats, the chat and the microphone still fit.
  // The player brings its own bar now, so the picture gives it that height back.
  const videoHeight = Math.round(Math.min((columnWidth * 9) / 16, windowHeight * 0.54));

  // Everyone in the room right now. Presence can briefly outlive a closed app
  // or a deleted account, so only people whose profile exists are counted.
  const knownIds = useMemo(() => {
    const ids = new Set(seats.map(seat => seat.user_id));
    // The host is counted only while actually here, like everyone else.
    if (room?.host_id && voice.members.includes(room.host_id)) ids.add(room.host_id);
    if (session?.user.id) ids.add(session.user.id);
    for (const id of Object.keys(memberProfiles)) ids.add(id);
    return ids;
  }, [seats, room?.host_id, session?.user.id, memberProfiles, voice.members]);
  const peopleInRoom = Math.max(knownIds.size, 1);

  function flash(text: string) {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  /** The SVIP level worn by a person on a seat, once their profile is known. */
  function seatSvip(userId: string) {
    return liveSvipLevel(memberProfiles[userId]);
  }

  /** La insignia de rol ya resuelta, más la de anfitrión de esta sala. */
  function seatBadge(userId: string): BadgeKind | null {
    const stored = memberProfiles[userId]?.badge;
    if (isBadgeKind(stored)) return stored;
    return userId === room?.host_id ? 'host' : null;
  }

  /** One piece of the pack, as that person chose to wear it. */
  function seatShows(userId: string, piece: SvipPiece) {
    return svipShows(memberProfiles[userId], piece);
  }

  /** The bought frame worn by a person on a seat, once their profile is known. */
  function seatFrame(userId: string) {
    const profile = memberProfiles[userId];
    if (liveSvipLevel(profile) > 0 && !svipShows(profile, 'frame')) return null;
    return profile?.equipped_frame ?? null;
  }

  async function invite() {
    if (!room) return;
    const outcome = await shareRoom(room);
    if (outcome === 'copied') flash('Enlace copiado. Pégalo en tu chat.');
    else if (outcome === 'shared') flash('Enlace compartido');
    else if (outcome === 'failed') flash('No pudimos compartir el enlace');
  }

  function requireSession(): boolean {
    if (session) return true;
    router.push('/entrar' as Href);
    return false;
  }

  /** Checks the words of a private room before its seats are shown. */
  async function unlockRoom(words?: string) {
    if (!room || gateBusy) return;
    const code = (words ?? gateCode).trim();
    if (!code) return;
    setGateBusy(true);
    setGateError(null);
    try {
      const open = await roomCodeMatches(room.id, code);
      if (!open) {
        setGateError('Ese código no abre esta sala. Pídeselo al anfitrión.');
        return;
      }
      unlocked.current = true;
      setGateOpen(false);
      setGateCode('');
      setLoading(true);
      await load();
    } catch {
      setGateError('No pudimos comprobar el código. Revisa tu conexión.');
    } finally {
      setGateBusy(false);
    }
  }

  // The invitation carries the code of a private room: the door opens itself.
  useEffect(() => {
    if (!gateOpen || !room || !params.code) return;
    if (codeTried.current) return;
    codeTried.current = true;
    setGateCode(params.code);
    void unlockRoom(params.code);
  }, [gateOpen, params.code, room]);

  /** The host opens or closes the room, and gets the code to share. */
  async function updatePrivate(next: boolean) {
    if (!room || privateBusy) return;
    setPrivateBusy(true);
    try {
      const code = await setRoomPrivate(room.id, next);
      setJoinCode(code);
      setRoom(current => (current ? { ...current, is_private: next } : current));
      flash(next ? `Sala privada. Código ${code}` : 'La sala vuelve a ser pública');
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : 'No pudimos cambiar la privacidad');
    } finally {
      setPrivateBusy(false);
    }
  }

  /** Puts a padlock on one seat, or takes it off. */
  async function toggleLock(no: number) {
    if (!room) return;
    const locked = seatLocks.includes(no);
    setSeatLocks(current => (locked ? current.filter(item => item !== no) : [...current, no].sort((a, b) => a - b)));
    if (!locked) setSeatRows(current => current.filter(seat => seat.seat_no !== no));
    try {
      await setSeatLock(room.id, no, !locked);
      flash(locked ? `Asiento ${no} abierto` : `Asiento ${no} con candado`);
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : 'No pudimos cambiar el candado');
      void getSeatLocks(room.id).then(setSeatLocks).catch(() => undefined);
      void refreshSeats();
    }
  }

  async function sharePrivateCode() {
    if (!room || !joinCode) return;
    const outcome = await shareText(
      room.title,
      `${room.host_name} te invita a la sala privada "${room.title}" en Latino Live.\n\nCódigo de entrada: ${joinCode}`,
    );
    if (outcome === 'copied') flash('Código copiado. Pégalo en tu chat.');
    else if (outcome === 'shared') flash('Código compartido');
  }

  /**
   * Puts this person on a seat on their own screen before the server answers,
   * so the move never waits. The server deletes the previous seat, so this does
   * the same, and a refusal simply reloads the real seats.
   */
  function placeMe(seatNo: number | null) {
    if (!room || !session?.user.id) return;
    const id = session.user.id;
    const name = profile?.display_name ?? myProfile.current?.display_name ?? 'Tú';
    const avatar = profile?.avatar_url ?? myProfile.current?.avatar_url ?? null;
    setSeatRows(current => {
      // El silencio viaja con la persona: mover de asiento no la despierta.
      const muted = current.find(seat => seat.user_id === id)?.muted ?? false;
      const withoutMe = current.filter(seat => seat.user_id !== id);
      if (seatNo === null) return withoutMe;
      return [
        ...withoutMe,
        {
          room_id: room.id,
          seat_no: seatNo,
          user_id: id,
          display_name: name,
          avatar_url: avatar,
          muted,
          speaking: false,
          joined_at: new Date().toISOString(),
        },
      ].sort((a, b) => a.seat_no - b.seat_no);
    });
  }

  async function handleSeat(no: number, seat?: SeatRow) {
    if (!room) return;
    if (!requireSession()) return;
    const mine = Boolean(seat && seat.user_id === session?.user.id);
    // Un asiento cerrado no se toma, pero el mío sí se puede dejar aunque el
    // anfitrión lo cerrara después de que me sentara.
    if (!mine && seatLocks.includes(no)) {
      flash(isHost ? 'Ese asiento tiene candado. Ábrelo en Controles → Asientos.' : 'El anfitrión cerró ese asiento.');
      return;
    }
    if (mine) {
      if (seatBusy.current) return;
      seatBusy.current = true;
      movingSelf.current = true;
      placeMe(null);
      try {
        await leaveSeat(room.id);
        flash('Dejaste tu asiento');
      } catch {
        flash('No pudimos moverte de asiento');
      } finally {
        void refreshSeats();
        seatBusy.current = false;
      }
      return;
    }
    if (seat) {
      setProfileSeat(seat);
      return;
    }
    // Un toque mientras el anterior todavía viaja no lanza un segundo cambio:
    // dos movimientos a la vez eran justo lo que rompía el asiento.
    if (seatBusy.current) return;
    seatBusy.current = true;
    const before = seats.find(item => item.user_id === session?.user.id)?.seat_no ?? null;
    placeMe(no);
    try {
      const movedFrom = await takeSeat(room.id, no);
      flash(movedFrom
        ? `Ahora estás en el asiento No. ${no} · saliste de ${movedFrom}`
        : `Ahora estás en el asiento No. ${no}`);
    } catch (cause) {
      flash(seatErrorText(cause));
      // The seat was taken meanwhile: show where this person really is.
      if (before) placeMe(before);
      else placeMe(null);
    } finally {
      // La respuesta del servidor manda: se vuelve a leer dónde está cada uno.
      void refreshSeats();
      seatBusy.current = false;
    }
  }

  async function handleStandUp() {
    if (!room || !me) return;
    if (seatBusy.current) return;
    seatBusy.current = true;
    movingSelf.current = true;
    placeMe(null);
    try {
      await leaveSeat(room.id);
      flash('Dejaste tu asiento');
    } catch {
      flash('No pudimos moverte de asiento');
    } finally {
      void refreshSeats();
      seatBusy.current = false;
    }
  }

  /** Envía lo escrito; false devuelve el texto al campo para no perderlo. */
  async function sendText(text: string) {
    if (!text || !room || !requireSession() || sending) return false;
    setSending(true);
    try {
      await postMessage(room.id, text);
      await refreshChat();
      return true;
    } catch {
      flash('No pudimos enviar tu mensaje');
      return false;
    } finally {
      setSending(false);
    }
  }

  /**
   * Two seats kiss: every phone in the room plays the couple, once. Only the
   * neighbour's yes calls this, so no pair is kissed without asking.
   */
  function pairSeats(left: number, right: number) {
    if (!session?.user.id) return;
    const signal = {
      id: `pair-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      stickerId: `dragon-pair:${left}:${right}`,
      senderName: profile?.display_name ?? session.user.email?.split('@')[0] ?? 'Alguien',
      fromSeat: left,
      toSeat: right,
    };
    void playPair(signal);
    void sendPairSignal(signal);
  }

  /** Asks the neighbour for a kiss. Nothing happens until they answer. */
  async function askKiss() {
    if (!requireSession()) return;
    if (!mySeatNo) {
      flash('Siéntate en un asiento primero.');
      return;
    }
    if (!kissSeatNo) {
      flash('Necesitas a alguien en el asiento de al lado.');
      return;
    }
    const target = seats.find(seat => seat.seat_no === kissSeatNo);
    await sendKiss({
      id: `kiss-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind: 'ask',
      from: mySeatNo,
      to: kissSeatNo,
      fromName: profile?.display_name ?? session?.user.email?.split('@')[0] ?? 'Alguien',
      toName: target?.display_name ?? 'Alguien',
      at: Date.now(),
    });
    flash(`Solicitud de beso enviada a ${target?.display_name ?? 'tu vecino'}.`);
  }

  /** The neighbour's answer: yes plays the kiss, no tells the asker. */
  function answerKiss(accept: boolean) {
    const ask = kissAsk;
    if (!ask) return;
    setKissAsk(null);
    void sendKiss({ ...ask, kind: accept ? 'accept' : 'decline', at: Date.now() });
    if (accept) pairSeats(Math.min(ask.from, ask.to), Math.max(ask.from, ask.to));
    else flash('Rechazaste el beso.');
  }

  async function pickGift(gift: RoomGift, quantity = 1) {
    if (!room || !requireSession() || giftSending) return;
    const bundle = quantity > 1 ? `${quantity} × ${gift.name}` : gift.name;
    setGiftSending(true);
    try {
      const balance = await sendGift(room.id, gift.key, giftRecipient?.id ?? null, quantity);
      setProfile(current => (current ? { ...current, diamonds: balance } : current));
      setGiftOpen(false);
      setGiftError(null);
      flash(giftRecipient ? `Enviaste ${bundle} a ${giftRecipient.name}` : `Enviaste ${bundle} a la sala`);
      // The next gift starts at the room, not at the person just gifted.
      setGiftRecipient(null);
      await refreshChat();
    } catch (cause) {
      setGiftError(cause instanceof Error ? cause.message : 'No pudimos enviar el regalo');
    } finally {
      setGiftSending(false);
    }
  }

  async function pickBackground() {
    if (!room || !session?.user.id) return;
    setBgBusy(true);
    try {
      const picked = await pickPhotoFromLibrary({ aspect: [9, 16], quality: 0.85 });
      if (picked.status === 'unavailable') {
        flash('La galería no está disponible en esta versión.');
        return;
      }
      if (picked.status === 'failed') {
        flash('No pudimos abrir la galería. Inténtalo otra vez.');
        return;
      }
      if (picked.status !== 'picked') return;
      await setRoomBackground(room.id, session.user.id, picked.photo);
      await load();
      flash('Fondo de la sala actualizado');
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : 'No pudimos cambiar el fondo');
    } finally {
      setBgBusy(false);
    }
  }

  async function resetBackground() {
    if (!room || !session?.user.id) return;
    setBgBusy(true);
    try {
      await setRoomBackground(room.id, session.user.id, null);
      await load();
      flash('Fondo original restaurado');
    } catch {
      flash('No pudimos restaurar el fondo');
    } finally {
      setBgBusy(false);
    }
  }

  async function pickChatPhoto(caption: string) {
    if (!room || !session?.user.id || chatPhotoBusy) return false;
    try {
      // La galería abre otra pantalla encima de la sala: la ventanita flotante
      // se aparta un momento y vuelve en cuanto se elige la foto.
      await PictureInPicture.setEnabled(false);
      let picked: Awaited<ReturnType<typeof pickPhotoFromLibrary>>;
      try {
        picked = await pickPhotoFromLibrary({ aspect: [4, 3], quality: 0.8 });
      } finally {
        void PictureInPicture.setEnabled(true);
      }
      if (picked.status === 'unavailable') {
        flash('La galería no está disponible en esta versión.');
        return false;
      }
      if (picked.status === 'failed') {
        flash('No pudimos abrir la galería. Inténtalo otra vez.');
        return false;
      }
      if (picked.status !== 'picked') return false;
      setChatPhotoBusy(true);
      await sendRoomPhoto(room.id, session.user.id, picked.photo, caption);
      await refreshChat();
      flash('Foto enviada al chat');
      return true;
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : 'No pudimos enviar la foto');
      return false;
    } finally {
      setChatPhotoBusy(false);
    }
  }

  async function wipeChat() {
    if (!room) return;
    try {
      await clearRoomChat(room.id);
      setClearOpen(false);
      setControlsOpen(false);
      await refreshChat();
      flash('Chat de la sala borrado');
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : 'No pudimos borrar el chat');
    }
  }

  async function forgiveBans() {
    if (!room || !isHost) return;
    try {
      await forgiveRoomBans(room.id);
      setBannedIds([]);
      await load();
      flash('Pueden volver a entrar a la sala');
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : 'No pudimos quitar la expulsión');
    }
  }

  async function makeDj(userId: string) {
    if (!room || !isHost) return;
    try {
      await setRoomDj(room.id, userId);
      const name = profileSeat?.display_name ?? 'Esa persona';
      setProfileSeat(null);
      flash(`${name} ahora pone la música de la sala`);
      await load();
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : 'No pudimos nombrar al DJ');
    }
  }

  async function saveVideo(url: string) {
    if (!room) return;
    try {
      if (url.trim() === '') await clearRoomVideo(room.id);
      else await setRoomVideo(room.id, url.trim());
      setVideoOpen(false);
      setVideoDraft('');
      await load();
      flash(url.trim() === '' ? 'La sala volvió al modo de voz' : 'La sala está en modo video');
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : 'No pudimos cambiar el video de la sala');
    }
  }

  /** Finds videos by name inside the room: nobody pastes a link. */
  async function findVideos(query: string, filter: YoutubeFilter = videoFilter) {
    const clean = query.trim();
    // A filter alone is a search too: "En vivo" finds live streams by itself.
    if ((clean.length < 2 && filter === 'all') || videoSearching) return;
    setVideoSearching(true);
    setVideoError(null);
    try {
      const found = await searchYoutube(clean, filter);
      setVideoResults(found);
      if (found.length === 0) {
        setVideoError(filter === 'live'
          ? 'No encontramos transmisiones en vivo con ese nombre. Prueba otras palabras.'
          : 'No encontramos videos con ese nombre. Prueba otras palabras.');
      }
    } catch (cause) {
      setVideoError(cause instanceof Error ? cause.message : 'No pudimos buscar en YouTube');
    } finally {
      setVideoSearching(false);
    }
  }

  /** Saves the host's words at the top of the room for everyone. */
  async function saveTitle() {
    if (!room || !isHost || titleDraft === null || titleSaving) return;
    const clean = titleDraft.trim();
    if (!clean) { flash('Escribe un texto para la sala'); return; }
    if (clean === room.title) { setTitleDraft(null); return; }
    setTitleSaving(true);
    try {
      await setRoomTitle(room.id, clean);
      setTitleDraft(null);
      await load();
      flash('Texto de la sala actualizado');
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : 'No pudimos cambiar el texto');
    } finally {
      setTitleSaving(false);
    }
  }

  async function toggleModerator(seat: SeatRow) {
    if (!room || !isHost) return;
    const isMod = moderators.includes(seat.user_id);
    try {
      await setModerator(room.id, seat.user_id, !isMod);
      setModerating(null);
      await load();
      flash(isMod ? `${seat.display_name} ya no es moderador` : `${seat.display_name} ahora es moderador`);
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : 'No pudimos cambiar el rol');
    }
  }

  async function expand(next: number) {
    if (!room) return;
    try {
      await setSeats(room.id, next);
      await load();
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : 'No pudimos cambiar los asientos');
    }
  }

  /**
   * Puts a design on the room. It brings its own number of places, so the
   * seats travel with it; a design with fewer places than people seated is
   * refused instead of leaving someone without a chair.
   *
   * The room is never closed for this: everyone stays in their chair while
   * the places move, and the shape the room wore is kept so the host can put
   * it back with one tap.
   */
  async function applyLayout(id: string | null) {
    if (!room || !isHost || layoutBusy) return;
    const found = id ? roomLayout(id) : null;
    const places = found ? layoutCapacity(found) : room.max_seats;
    if (found && seats.length > places) {
      flash(`Ese diseño tiene ${places} lugares y hay ${seats.length} personas sentadas.`);
      return;
    }
    const current = roomLayout(room.layout) ? room.layout ?? null : null;
    setLayoutBusy(true);
    try {
      await setRoomLayout(room.id, id, places);
      setPreviousLayout({ id: current });
      setLayoutChoice(id);
      await load();
      flash(found ? `Asientos: ${found.name}.` : 'Asientos en cuadrícula.');
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : 'No pudimos cambiar los asientos');
    } finally {
      setLayoutBusy(false);
    }
  }

  /**
   * The host decides whether the room shows cameras. The rule travels with
   * the room, so every phone sees it at once; a lens that is already open
   * closes by itself when the door is shut.
   */
  async function changeCameraRule(allow: boolean) {
    if (!room || !canModerate || cameraRuleBusy) return;
    setCameraRuleBusy(true);
    try {
      const now = await setRoomCamera(room.id, allow);
      await load();
      flash(now ? 'Las cámaras están activadas.' : 'Las cámaras están desactivadas.');
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : 'No pudimos cambiar las cámaras');
    } finally {
      setCameraRuleBusy(false);
    }
  }

  /**
   * Turns the hall into a voice room or a camera room. The seats stay where
   * they are; only their shape follows the mode, and a voice room keeps its
   * lenses closed.
   */
  async function changeRoomMode(mode: 'audio' | 'camera') {
    if (!room || !canModerate || cameraRuleBusy) return;
    if ((room.room_mode === 'camera') === (mode === 'camera')) return;
    setCameraRuleBusy(true);
    try {
      const now = await setRoomMode(room.id, mode);
      await load();
      flash(now === 'camera' ? 'La sala está en modo multi de cámara.' : 'La sala está en modo multi de audio.');
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : 'No pudimos cambiar el modo de la sala');
    } finally {
      setCameraRuleBusy(false);
    }
  }

  /** The open rooms the host can challenge, without this one. */
  async function openPk() {
    if (!room || !isHost) return;
    if (panel === 'pk') { setPanel(null); return; }
    setPanel('pk');
    try {
      const all = await listRooms();
      setPkRivals(all.filter(item => item.id !== room.id));
    } catch {
      setPkRivals([]);
    }
  }

  /** Reads today's podium and the host photo each frame shows. */
  async function openPodium() {
    if (podiumOpen) { setPodiumOpen(false); return; }
    setPodiumOpen(true);
    setPodiumBusy(true);
    try {
      const list = (await getRoomRanking(10)).filter(item => Number(item.score) > 0);
      setPodium(list);
      const seats: Record<string, SeatRow[]> = await getSeatsForRooms(list.map(item => item.room_id)).catch(() => ({}));
      setPodiumAvatars(
        Object.fromEntries(
          list.map(item => [item.room_id, seats[item.room_id]?.find(seat => seat.seat_no === 1)?.avatar_url ?? null]),
        ),
      );
    } catch {
      setPodium([]);
    } finally {
      setPodiumBusy(false);
    }
  }

  /** The room's place on today's podium, or 0 when it has no diamonds yet. */
  const podiumPlace = podium.findIndex(item => item.room_id === room?.id) + 1;

  async function launchPk(rivalId: string) {
    if (!room || pkBusy) return;
    setPkBusy(true);
    try {
      await startPk(room.id, rivalId, 180);
      await refreshPk(room.id);
      setPanel(null);
      flash('¡Batalla PK iniciada! Cada regalo suma a su sala.');
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : 'No pudimos iniciar la batalla');
    } finally {
      setPkBusy(false);
    }
  }

  async function closePk() {
    if (!room || !pk || !isHost) return;
    try {
      await finishPk(pk.id);
      await refreshPk(room.id);
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : 'No pudimos cerrar la batalla');
    }
  }

  /** Splits the room into Equipo Rojo and Equipo Azul for three minutes. */
  async function launchTeamPk() {
    if (!room || teamPkBusy) return;
    setTeamPkBusy(true);
    try {
      await startTeamPk(room.id, 180);
      await refreshTeamPk(room.id);
      setPanel(null);
      flash('¡PK de equipos! Cada regalo suma al equipo de quien lo envía.');
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : 'No pudimos empezar el PK');
    } finally {
      setTeamPkBusy(false);
    }
  }

  async function closeTeamPk() {
    if (!room || !teamPk || !isHost) return;
    try {
      await finishTeamPk(teamPk.id);
      await refreshTeamPk(room.id);
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : 'No pudimos cerrar el PK');
    }
  }

  async function publishAnnouncement() {
    if (!room) return;
    if (!announceDraft.trim()) return;
    try {
      await setAnnouncement(room.id, announceDraft.trim());
      setControlsOpen(false);
      await load();
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : 'No pudimos publicar el anuncio');
    }
  }

  async function aplicarBurbuja(userId: string, color: string) {
    if (!room || !isHost) return;
    const before = bubbles;
    setBubbles(current => ({ ...current, [userId]: color }));
    try {
      await setModeratorBubble(room.id, userId, color);
    } catch (cause) {
      setBubbles(before);
      flash(cause instanceof Error ? cause.message : 'No pudimos cambiar el color');
    }
  }

  async function applyModeration(action: 'mute' | 'unmute' | 'kick') {
    if (!room || !moderating) return;
    try {
      await moderate(room.id, moderating.user_id, action);
      setModerating(null);
      await load();
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : 'No pudimos moderar a esa persona');
    }
  }

  // The single microphone action of the room, used by the round mic button.
  function toggleSpeaking() {
    if (!requireSession()) return;
    if (me?.muted) { flash('El anfitrión te silenció'); return; }
    if (!me) { flash('Siéntate en un asiento para hablar'); return; }
    if (voice.status === 'requesting') return;
    if (voice.live) { holdMic(); voice.stop(); return; }
    if (voice.status !== 'idle' && voice.status !== 'error') return;
    void voice.start();
  }

  async function cerrarSala() {
    if (!room || !isHost) return;
    try {
      await closeRoom(room.id);
      leaveRoom();
      flash('Cerraste la sala');
      router.replace('/' as Href);
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : 'No pudimos cerrar la sala');
    }
  }

  const openPeople = useCallback(() => setPeopleOpen(true), []);
  const openHostProfile = useCallback(() => {
    if (!room) return;
    setProfileSeat({
      room_id: room.id,
      seat_no: hostSeat?.seat_no ?? 1,
      user_id: room.host_id ?? hostSeat?.user_id ?? '',
      display_name: room.host_name,
      avatar_url: hostSeat?.avatar_url ?? null,
      muted: false,
      speaking: false,
      joined_at: '',
    });
  }, [room, hostSeat]);

  if (loading && !room) {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-3">
        <ActivityIndicator color={accent.main} />
        <Text className="text-muted-foreground text-xs">Entrando a la sala…</Text>
      </View>
    );
  }

  if (room?.closed_at) {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-3 px-8">
        <Icon as={DoorClosed} className="text-muted-foreground size-8" />
        <Text className="text-foreground text-center text-base font-semibold">Esta sala está cerrada</Text>
        <Text className="text-muted-foreground text-center text-[13px] leading-5">
          El anfitrión la cerró. Entra a otra sala de la cartelera o abre la tuya.
        </Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/' as Href)} className="bg-primary mt-1 h-11 items-center justify-center rounded-full px-5">
          <Text className="text-primary-foreground text-sm font-semibold">Ver las salas abiertas</Text>
        </Pressable>
      </View>
    );
  }

  if (banUntil) {
    const hours = Math.max(1, Math.ceil((new Date(banUntil).getTime() - Date.now()) / 3_600_000));
    return (
      <View className="bg-background flex-1 items-center justify-center gap-3 px-8">
        <Icon as={UserMinus} className="text-destructive size-8" />
        <Text className="text-foreground text-center text-base font-semibold">El anfitrión te expulsó</Text>
        <Text className="text-muted-foreground text-center text-[13px] leading-5">
          No puedes volver a esta sala durante {hours} {hours === 1 ? 'hora' : 'horas'}. Mientras tanto puedes entrar a otras salas.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/' as Href)}
          className="bg-primary mt-1 h-11 items-center justify-center rounded-full px-5">
          <Text className="text-primary-foreground text-sm font-semibold">Ver las salas abiertas</Text>
        </Pressable>
      </View>
    );
  }

  if (!room) {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-3 px-8">
        <Text className="text-foreground text-center text-base font-semibold">{error ?? 'Sala no encontrada'}</Text>
        <View className="mt-1 flex-row items-center gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reintentar abrir la sala"
            onPress={() => { setError(null); setLoading(true); void load(); }}
            className="border-primary/50 bg-primary/10 h-11 items-center justify-center rounded-full border px-5 active:opacity-85">
            <Text className="text-primary text-sm font-semibold">Reintentar</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/' as Href)} className="bg-primary h-11 items-center justify-center rounded-full px-5 active:opacity-85">
            <Text className="text-primary-foreground text-sm font-semibold">Volver a las salas</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // A private room shows this and nothing else until its code is right.
  if (gateOpen) {
    return (
      <View className="bg-background flex-1 justify-center px-6">
        <View className="border-border bg-card items-center rounded-3xl border px-6 py-8">
          <View className="bg-primary/15 size-14 items-center justify-center rounded-full">
            <Icon as={Lock} className="text-primary size-6" />
          </View>
          <Text className="text-foreground mt-3 text-lg font-semibold">Sala privada</Text>
          <Text className="text-muted-foreground mt-1 text-center text-[12px]">
            «{room.title}» de {room.host_name} se abre con su código.
          </Text>
          <TextInput
            value={gateCode}
            onChangeText={setGateCode}
            onSubmitEditing={() => void unlockRoom()}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={12}
            placeholder="Código de la sala"
            placeholderTextColor="#8A8073"
            returnKeyType="go"
            accessibilityLabel="Código de la sala privada"
            className="border-border bg-background text-foreground mt-4 w-full rounded-xl border px-3 py-3 text-center text-[16px] font-semibold tracking-[0.28em]"
          />
          {gateError ? <Text className="text-destructive mt-2 text-center text-[12px]">{gateError}</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Entrar a la sala privada"
            disabled={gateBusy || !gateCode.trim()}
            onPress={() => void unlockRoom()}
            className={cn(
              'mt-3 h-11 w-full items-center justify-center rounded-full',
              gateBusy || !gateCode.trim() ? 'bg-muted' : 'bg-primary active:opacity-85',
            )}>
            {gateBusy
              ? <ActivityIndicator size="small" color="#1A1409" />
              : <Text className={cn('text-sm font-semibold', gateCode.trim() ? 'text-primary-foreground' : 'text-muted-foreground')}>Entrar</Text>}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => { leaveRoom(); router.replace('/' as Href); }}
            className="mt-2 h-10 items-center justify-center px-4 active:opacity-70">
            <Text className="text-muted-foreground text-[12px]">Volver a las salas</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const lastGift = gifts[0];

  // Data saving keeps the house's painted covers, which ship inside the app,
  // instead of downloading the room's photo and the host's own background.
  const backgroundSource = room.background_path && !dataSaver
    ? { uri: roomPhotoUrl(room.background_path) }
    : coverSource(room.cover);

  // The host's level can bring its own background for the room.
  const hostProfile = room.host_id ? memberProfiles[room.host_id] : undefined;
  const hostKit = svipKit(liveSvipLevel(hostProfile));
  const hostRoomKit = hostKit && svipShows(hostProfile, 'room') && !dataSaver ? hostKit : null;

  return (
    // Measured once so a sticker knows where each seat is on the screen.
    <View ref={roomBox} collapsable={false} className="bg-background flex-1" style={{ backgroundColor: '#0A0908' }}>
      {/* The room without a picture of its own is the house's stage; a room with
          its own background keeps that picture instead of the stage. */}
      {room.background_path || hostRoomKit ? (
        <ImageBackground source={backgroundSource} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      ) : (
        <RoomStage width={windowWidth} height={windowHeight} />
      )}
      {/* The host's own background, when the level brings one and it is on. */}
      {hostRoomKit ? <SvipKitBackground level={hostRoomKit.level} height={0} fill /> : null}
      {/* The room's own light: darker at the top for the bar, the picture clear
          in the middle, and deep at the bottom so the chat reads on any photo.
          The house's stage is already dark, so it takes a lighter veil. */}
      <LinearGradient
        colors={room.background_path || hostRoomKit
          ? ['rgba(4,10,13,0.62)', 'rgba(4,10,13,0.24)', 'rgba(3,7,9,0.92)']
          : ['rgba(3,6,14,0.35)', 'rgba(3,6,14,0.02)', 'rgba(3,6,14,0.72)']}
        locations={[0, 0.38, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {entry?.video && !dataSaver ? (
        <EntryVideoOverlay
          key={entry.key}
          entry={{ ...entry, video: entry.video }}
          onDone={() => {
            entryQueue.current = entryQueue.current.filter(item => item.key !== entry.key);
            setEntry(entryQueue.current[0] ?? null);
          }}
        />
      ) : (
        <RoomEntryBanner
          entry={entry}
          onDone={() => {
            entryQueue.current = entryQueue.current.filter(item => item.key !== entry?.key);
            setEntry(entryQueue.current[0] ?? null);
          }}
        />
      )}

      <RoomDj
        roomId={room.id}
        isHost={isHost}
        canModerate={canModerate}
        onFlash={flash}
      />

      <View style={{ paddingTop: insets.top + 6, ...column }} className="px-4">
        <View className="flex-row items-center gap-1.5">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Salir de la sala"
            onPress={() => {
              // Leaving the room also gives the seat back to everyone else.
              movingSelf.current = true;
              if (room && me) void leaveSeat(room.id).catch(() => undefined);
              leaveRoom();
              router.replace('/' as Href);
            }}
            className="border-border bg-card size-10 items-center justify-center rounded-full border active:opacity-70">
            <Icon as={X} className="text-foreground size-4.5" />
          </Pressable>
          <View className="flex-1">
            <HostBadge
              compact
              iconOnly
              tight={narrowHeader}
              hostId={room.host_id}
              hostName={room.host_name}
              hostAvatar={hostSeat?.avatar_url ?? null}
              viewers={peopleInRoom}
              onOpenPeople={openPeople}
              isSelf={isHost}
              onOpenProfile={openHostProfile}
              roomTitle={room.title}
              onPressTitle={isHost ? () => setTitleDraft(room.title) : undefined}
              // En un teléfono angosto la línea bajo el nombre se queda en lo
              // que de verdad importa: cuántos asientos están ocupados.
              titleHint={narrowHeader
                ? `${seats.length}/${room.max_seats}${room.is_private ? ' · privada' : ''}`
                : `· ${room.host_name} · ${seats.length}/${room.max_seats} asientos${room.is_private ? ' · privada' : ''}`}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Minimizar la sala y seguir navegando"
            onPress={() => minimizeRoom()}
            className="border-border bg-card size-9 items-center justify-center rounded-full border active:opacity-70">
            <Icon as={Minus} className="text-foreground size-4" />
          </Pressable>
          {!narrowHeader ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Compartir el enlace de la sala"
              onPress={() => setInviteOpen(true)}
              className="border-primary/40 bg-primary/15 size-9 items-center justify-center rounded-full border active:opacity-70">
              <Image source={ACTION_ICONS.share} resizeMode="contain" style={{ width: 20, height: 20 }} accessibilityIgnoresInvertColors />
            </Pressable>
          ) : null}
          {/* Los controles del dueño viven aquí, en la cabecera, y no debajo
              de los asientos: un moderador los abre igual para moderar. */}
          {canModerate && !narrowHeader ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Controles de la sala"
              onPress={() => setControlsOpen(true)}
              className="border-primary/45 bg-primary/15 size-9 items-center justify-center rounded-full border active:opacity-70">
              <Icon as={Shield} className="text-primary size-4" />
            </Pressable>
          ) : null}
        </View>

      </View>

      {/* The room's own news, only while it is fresh: entering the day's
          podium drops in here, and the same line stays in the chat. */}
      <PodiumCelebration
        message={podiumNews}
        onOpenPodium={() => { setPodiumNews(null); void openPodium(); }}
        onDismiss={() => setPodiumNews(null)}
      />

      {/* The day's podium, right under the exit button: one tap opens it. */}
      <View className="mt-1 flex-row items-center gap-2 px-4" style={column}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver el podio del día"
          onPress={() => void openPodium()}
          className="border-border bg-card h-7 flex-row items-center gap-1.5 rounded-full border px-2.5 active:opacity-80">
          <Icon as={Trophy} className="text-primary size-3.5" />
          <Text className="text-foreground text-[11px] font-semibold">
            {podiumPlace > 0 ? `Podio · #${podiumPlace}` : 'Podio del día'}
          </Text>
        </Pressable>
        {/* A kiss is asked to the seat beside mine; the neighbour decides. */}
        {mySeatNo > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              kissSeatNo
                ? `Pedir un beso a ${seats.find(seat => seat.seat_no === kissSeatNo)?.display_name ?? 'tu vecino'}`
                : 'Necesitas a alguien en el asiento de al lado para el beso'
            }
            accessibilityState={{ disabled: !kissSeatNo }}
            onPress={() => void askKiss()}
            className={cn(
              'h-7 flex-row items-center gap-1 rounded-full border px-2.5 active:opacity-80',
              kissSeatNo ? 'border-primary/50 bg-primary/15' : 'border-border bg-card opacity-50',
            )}>
            <Icon as={Heart} size={12} className={kissSeatNo ? 'text-primary' : 'text-muted-foreground'} />
            <Text className={cn('text-[11px] font-semibold', kissSeatNo ? 'text-primary' : 'text-muted-foreground')}>
              Beso al vecino
            </Text>
          </Pressable>
        ) : null}
        {/* El teléfono angosto baja aquí compartir y controles: la cabecera
            de arriba deja de cortar el nombre de la sala. */}
        {narrowHeader ? (
          <>
            <View className="flex-1" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Compartir el enlace de la sala"
              onPress={() => setInviteOpen(true)}
              hitSlop={6}
              className="border-primary/40 bg-primary/15 size-7 items-center justify-center rounded-full border active:opacity-70">
              <Image source={ACTION_ICONS.share} resizeMode="contain" style={{ width: 15, height: 15 }} accessibilityIgnoresInvertColors />
            </Pressable>
            {canModerate ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Controles de la sala"
                onPress={() => setControlsOpen(true)}
                hitSlop={6}
                className="border-primary/45 bg-primary/15 size-7 items-center justify-center rounded-full border active:opacity-70">
                <Icon as={Shield} className="text-primary size-3.5" />
              </Pressable>
            ) : null}
          </>
        ) : null}
      </View>

      {isVideo && room.video_url ? (
        <View className="mt-1" style={column}>
          <RoomVideo url={room.video_url} title={room.title} height={videoHeight} />
        </View>
      ) : null}

      <View className={isVideo ? 'mt-1.5 px-3' : 'mt-2 px-3'} style={column}>
        <View
          className="px-1"
          onLayout={event => setSeatAreaWidth(event.nativeEvent.layout.width)}>
          {design ? (
            /*
             * A laid-out room: the room's own wall stays behind, and the seats
             * stand on the places of the chosen layout, the same on every phone.
             */
            <View style={{ width: designSize, height: designSize }} className="self-center">
              {allSeats.map(({ no, seat }, index) => {
                const place = designPlaces[index] ?? designPlaces[designPlaces.length - 1];
                const size = Math.max(26, Math.round((place.size / 100) * designSize));
                return (
                  <View
                    key={no}
                    ref={node => { seatBoxes.current[no] = node; }}
                    collapsable={false}
                    style={{
                      position: 'absolute',
                      left: (place.x / 100) * designSize - size / 2,
                      top: (place.y / 100) * designSize - size / 2,
                      width: size,
                      height: size,
                      alignItems: 'center',
                    }}>
                    <RoomSeat
                      no={no}
                      seat={seat}
                      size={size}
                      mine={seat?.user_id === session?.user.id}
                      locked={seatLocks.includes(no)}
                      host={seat?.user_id === room.host_id}
                      svip={seat ? seatSvip(seat.user_id) : 0}
                      showFrame={seat ? seatShows(seat.user_id, 'frame') : false}
                      showMic={seat ? seatShows(seat.user_id, 'mic') : false}
                      frame={seat ? seatFrame(seat.user_id) : null}
                      goldPlace={place.host}
                      square={cameraSeat()}
                      video={seat ? videoOf(seat.user_id) : null}
                      mirrorVideo={
                        seat?.user_id === session?.user.id
                          ? voice.cameraFacing === 'user'
                          : false
                      }
                      captionWidth={captionWidths[index]}
                      numberInside
                      giftDiamonds={seat ? seatGifts[seat.user_id]?.diamonds ?? 0 : 0}
                      giftCount={seat ? seatGifts[seat.user_id]?.gifts ?? 0 : 0}
                      onGiftPress={seat ? seatPress.gift[no] : undefined}
                      onPress={seatPress.press[no]}
                    />
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={{ height: seatLayout.height }} className="justify-start py-1">
              {seatRows.map((row, rowIndex) => (
                <View
                  key={`row-${rowIndex}`}
                  className="flex-row justify-between"
                  style={{ marginTop: rowIndex === 0 ? 0 : SEAT_ROW_GAP }}>
                  {row.map(({ no, seat }) => (
                    <View
                      key={no}
                      ref={node => { seatBoxes.current[no] = node; }}
                      collapsable={false}
                      style={{ width: seatCellWidth, height: seatFrameSize + 16 }}
                      className="items-center justify-center">
                      <RoomSeat
                        no={no}
                        seat={seat}
                        size={seatFrameSize}
                        mine={seat?.user_id === session?.user.id}
                        locked={seatLocks.includes(no)}
                        host={seat?.user_id === room.host_id}
                        svip={seat ? seatSvip(seat.user_id) : 0}
                        showFrame={seat ? seatShows(seat.user_id, 'frame') : false}
                        showMic={seat ? seatShows(seat.user_id, 'mic') : false}
                        frame={seat ? seatFrame(seat.user_id) : null}
                        square={cameraSeat()}
                        video={seat ? videoOf(seat.user_id) : null}
                        mirrorVideo={
                          seat?.user_id === session?.user.id
                            ? voice.cameraFacing === 'user'
                            : false
                        }
                        captionWidth={Math.round((seatAreaWidth || windowWidth) * seatCellShare) - 6}
                        giftDiamonds={seat ? seatGifts[seat.user_id]?.diamonds ?? 0 : 0}
                        giftCount={seat ? seatGifts[seat.user_id]?.gifts ?? 0 : 0}
                        onGiftPress={seat ? seatPress.gift[no] : undefined}
                        onPress={seatPress.press[no]}
                      />
                    </View>
                  ))}
                  {Array.from({ length: Math.max(0, seatCols - row.length) }).map((_, emptyIndex) => (
                    <View key={`empty-${rowIndex}-${emptyIndex}`} style={{ width: seatCellWidth }} />
                  ))}
                </View>
              ))}
            </View>
          )}
          <View className="flex-row items-center justify-between gap-2 px-4 pb-1 pt-2">
            <Text className="text-muted-foreground shrink text-[11px]" numberOfLines={1}>
              {seats.length}/{room.max_seats} asientos
            </Text>
            {teamPk && (teamPk.status === 'live' || Date.now() - new Date(teamPk.ends_at).getTime() < 300_000) ? (
              <View className="shrink-0">
                <TeamPkPill battle={teamPk} onPress={() => setTeamPkOpen(true)} />
              </View>
            ) : pk ? (
              <View className="shrink-0">
                <PkPill battle={pk} roomId={room.id} onPress={() => setPkOpen(true)} />
              </View>
            ) : null}
            <Text className="text-muted-foreground shrink text-[11px]" numberOfLines={1}>
              {me ? 'Habla en vivo' : 'Toca un asiento'}
            </Text>
          </View>
        </View>
      </View>

      {/* What the host wants everyone to know, right above the chat. */}
      {room.announcement ? (
        <View className="mx-5 mt-2 rounded-[12px] px-4 py-3" style={{ backgroundColor: 'rgba(6,8,14,0.72)' }}>
          <Text className="text-center text-[13px] leading-5" style={{ color: '#E9C46A' }} numberOfLines={3}>
            {room.announcement}
          </Text>
        </View>
      ) : null}

      <View
        className={cn('flex-1 rounded-t-[22px] px-4 pt-3', isVideo ? 'mt-2' : 'mt-4')}
        style={{ backgroundColor: 'rgba(3,7,9,0.72)', ...column }}>
        {/* The DJ disc floats on this corner, so the title starts past it. */}
        <View className="mb-2 flex-row items-center gap-2 pl-14">
          <Text className="text-foreground text-sm font-semibold">Chat de la sala</Text>
          <View className="bg-muted rounded-full px-2 py-0.5">
            <Text className="text-muted-foreground text-[11px] tabular-nums">{messages.length}/{MAX_MESSAGES}</Text>
          </View>
          <View className="ml-auto flex-row items-center gap-1.5">
            <ChatFilterButton filter={chatFilter} onPress={() => setChatFilter(chatFilter === 'todo' ? 'regalo' : 'todo')} />
            <GiftShortcut onPress={() => (requireSession() ? (setGiftRecipient(null), setGiftOpen(true)) : undefined)} />
          </View>
        </View>

        <ScrollView ref={chatRef} className="flex-1" contentContainerClassName="gap-2.5 pb-3" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {(chatFilter === 'regalo' ? messages.filter(message => message.kind === 'gift') : messages).map(message => {
            const authorId = message.user_id;
            const authorProfile = authorId
              ? (authorId === session?.user.id ? myProfile.current ?? memberProfiles[authorId] : memberProfiles[authorId])
              : undefined;
            // El moderador escribe en el color que el anfitrión le dio; el
            // nivel SVIP escribe en su propia placa.
            const isModeratorAuthor = Boolean(authorId && moderators.includes(authorId));
            const tone = isModeratorAuthor && authorId ? chatTone(bubbles[authorId]) : null;
            const authorSvip = authorProfile && svipShows(authorProfile, 'bubble') ? liveSvipLevel(authorProfile) : 0;
            return (
              <RoomChatRow
                key={message.id}
                message={message}
                mine={message.user_id === session?.user.id}
                badge={authorId ? seatBadge(authorId) : null}
                tone={tone}
                svipLevel={authorSvip}
                accent={accent.main}
                photoWidth={chatPhotoWidth}
                onPhoto={setViewPhoto}
              />
            );
          })}

          {messages.length === 0 ? (
            <Text className="text-muted-foreground px-1 text-[12px]">Sé la primera persona en escribir en esta sala.</Text>
          ) : null}
        </ScrollView>

        {lastGift ? (
          <Text className="text-muted-foreground mb-1.5 px-1 text-[11px]" numberOfLines={1}>
            Último regalo: {lastGift.sender_name} envió {
              ROOM_GIFTS.find(gift => gift.key === lastGift.gift_key)?.name ?? lastGift.gift_key
            }
          </Text>
        ) : null}

        {me?.muted ? (
          <View className="border-destructive/35 bg-destructive/10 mb-2 flex-row items-center gap-2 rounded-xl border px-3 py-2">
            <Icon as={MicOff} className="text-destructive size-3.5" />
            <Text className="text-destructive flex-1 text-[11px]">El anfitrión te silenció. No puedes hablar hasta que te active.</Text>
          </View>
        ) : null}

        {voice.relay ? (
          <View className="border-border/70 bg-background/55 mb-1.5 flex-row items-center gap-1 self-start rounded-full border px-2 py-1">
            <View className="bg-emerald-400 size-1.5 rounded-full" />
            <Text className="text-muted-foreground text-[11px]">Relay mundial activo</Text>
          </View>
        ) : null}

        <View
          style={{ paddingBottom: Math.max(insets.bottom, 10), ...column }}
          className="flex-row items-center gap-2">
          <PulseButton
            accessibilityLabel={
              me?.muted ? 'Micrófono bloqueado por el anfitrión'
                : voice.live ? 'Salir del micrófono en vivo'
                : !me ? 'Siéntate para hablar'
                : 'Hablar en la sala'
            }
            disabled={Boolean(me?.muted) || voice.status === 'requesting'}
            active={voice.live}
            color={voice.live ? '#FF6B5E' : accent.main}
            onPress={toggleSpeaking}
            style={{
              width: actionSize, height: actionSize, borderRadius: actionSize / 2, alignItems: 'center', justifyContent: 'center',
              backgroundColor: me?.muted ? 'rgba(70,64,58,1)' : voice.live ? '#E24B3E' : accent.main,
            }}>
            {voice.status === 'requesting' ? (
              <ActivityIndicator size="small" color="#1A1409" />
            ) : (
              <Icon
                as={me?.muted ? MicOff : Mic}
                className={cn('size-5', me?.muted ? 'text-muted-foreground' : voice.live ? 'text-white' : 'text-primary-foreground')}
              />
            )}
          </PulseButton>
          {/*
           * The camera is a person's own choice, like the microphone: it can
           * be on while the microphone is off, and turning it off leaves the
           * person in the room listening. A voice hall has no cameras at all,
           * so the button belongs to the camera hall only.
           */}
          {cameraMode ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              voice.cameraOn ? 'Apagar mi cámara'
                : room.allow_camera === false ? 'El anfitrión desactivó las cámaras en esta sala'
                : !me ? 'Siéntate para prender tu cámara'
                : 'Prender mi cámara'
            }
            accessibilityState={{ selected: voice.cameraOn, disabled: !me || (room.allow_camera === false && !voice.cameraOn) }}
            onPress={() => {
              if (!requireSession()) return;
              void voice.toggleCamera();
            }}
            className="items-center justify-center active:opacity-80"
            style={{
              width: actionSize, height: actionSize, borderRadius: actionSize / 2,
              backgroundColor: voice.cameraOn ? '#E24B3E' : 'rgba(28,26,24,1)',
              borderWidth: 1,
              borderColor: voice.cameraOn ? '#E24B3E' : 'rgba(255,255,255,0.12)',
              opacity: !me || (room.allow_camera === false && !voice.cameraOn) ? 0.45 : 1,
            }}>
            <Icon
              as={voice.cameraOn ? Video : VideoOff}
              className={cn('size-5', voice.cameraOn ? 'text-white' : 'text-muted-foreground')}
              style={voice.cameraBusy ? { opacity: 0 } : undefined}
            />
            {voice.cameraBusy ? (
              <View className="absolute">
                <ActivityIndicator size="small" color={accent.main} />
              </View>
            ) : null}
          </Pressable>
          ) : null}
          {/*
           * Turning the picture around only matters while the camera is
           * sending. A voice room shows it with the camera, so a listener is
           * not crowded; a video room keeps it in place, dim until the lens
           * opens, so the row never shifts under the thumb.
           */}
          {cameraMode && voice.cameraOn ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={!voice.cameraOn
                ? room.allow_camera === false
                  ? 'El anfitrión desactivó las cámaras en esta sala'
                  : 'Prende tu cámara para girarla'
                : voice.cameraFacing === 'user'
                  ? 'Girar a la cámara trasera'
                  : 'Girar a la cámara frontal'
              }
              accessibilityState={{ disabled: voice.cameraSwitching, selected: voice.cameraOn }}
              disabled={voice.cameraSwitching}
              onPress={() => void voice.switchCamera()}
              className="border-border bg-card size-11 items-center justify-center rounded-full border active:opacity-80"
              style={{ opacity: voice.cameraOn ? 1 : 0.45 }}>
              {voice.cameraSwitching ? (
                <ActivityIndicator size="small" color={accent.main} />
              ) : (
                <Icon
                  as={SwitchCamera}
                  className={cn('size-5', voice.cameraOn ? 'text-foreground' : 'text-muted-foreground')}
                />
              )}
            </Pressable>
          ) : null}
          <RoomComposer
            signedIn={Boolean(session)}
            sending={sending}
            photoBusy={chatPhotoBusy}
            onSend={sendText}
            onPhoto={pickChatPhoto}
          />
          {/* La suerte de la sala: un dado y el sorteo de asientos, gratis. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Suerte de la sala: dado y ruleta de asientos"
            onPress={() => (requireSession() ? setLuckOpen(true) : undefined)}
            className="border-border bg-card items-center justify-center rounded-full border active:opacity-80"
            style={{ width: actionSize, height: actionSize }}>
            <Icon as={Dices} className="text-primary size-5" />
          </Pressable>
          {/* El regalo vive al final de la fila, para toda la sala. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enviar un regalo"
            onPress={() => (requireSession() ? (setGiftRecipient(null), setGiftOpen(true)) : undefined)}
            className="border-primary/50 bg-primary/15 items-center justify-center rounded-full border active:opacity-80"
            style={{ width: actionSize, height: actionSize }}>
            <Image source={ACTION_ICONS.gift} resizeMode="contain" style={{ width: 26, height: 26 }} accessibilityIgnoresInvertColors />
          </Pressable>
        </View>
      </View>

      {toast ? (
        <View style={{ bottom: insets.bottom + 70 }} className="border-primary/40 bg-card absolute left-6 right-6 items-center rounded-full border px-4 py-2.5">
          <Text className="text-foreground text-xs font-medium">{toast}</Text>
        </View>
      ) : null}

      <Modal visible={giftOpen} transparent animationType="slide" onRequestClose={() => setGiftOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/60" onPress={() => { setGiftOpen(false); setGiftRecipient(null); }} accessibilityLabel="Cerrar regalos">
          <Pressable onPress={() => undefined}>
            <GiftStoreSheet
              seated={giftTargets.filter(person => person.id !== session?.user.id)}
              recipientId={giftRecipient?.id ?? null}
              recipientName={giftRecipient?.name ?? null}
              balance={profile?.diamonds ?? 0}
              sending={giftSending}
              error={giftError}
              onPickTarget={target => setGiftRecipient(target ? { id: target.id, name: target.name } : null)}
              onSend={(gift, quantity) => void pickGift(gift, quantity)}
              onClose={() => { setGiftOpen(false); setGiftRecipient(null); }}
              onRecharge={() => { setGiftOpen(false); setGiftRecipient(null); router.push('/billetera' as Href); }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={controlsOpen} transparent animationType="slide" onRequestClose={() => setControlsOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/60" onPress={() => setControlsOpen(false)} accessibilityLabel="Cerrar controles">
          <Pressable className="border-border bg-card rounded-t-[28px] border px-5 pb-8 pt-3" onPress={() => undefined}>
            <View className="bg-border mx-auto mb-3 h-1 w-10 rounded-full" />
            <View className="flex-row items-center gap-2">
              <Shield className="text-primary" size={14} />
              <Text className="text-foreground flex-1 text-[14px] font-semibold">Controles</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar los controles"
                onPress={() => setControlsOpen(false)}
                className="border-border size-7 items-center justify-center rounded-full border active:bg-muted">
                <Icon as={X} className="text-foreground size-3.5" />
              </Pressable>
            </View>

            <View className="mt-3 flex-row flex-wrap gap-2">
              <ControlTile icon={Users} label="Asientos" active={panel === 'seats'} onPress={() => setPanel(panel === 'seats' ? null : 'seats')} />
              {isHost ? (
                <ControlTile icon={LayoutGrid} label="Asientos: forma" active={panel === 'layout'} onPress={() => setPanel(panel === 'layout' ? null : 'layout')} />
              ) : null}
              {isHost ? (
                <ControlTile
                  icon={cameraMode ? Video : Mic}
                  label="Modo"
                  active={panel === 'cameras'}
                  onPress={() => setPanel(panel === 'cameras' ? null : 'cameras')}
                />
              ) : null}
              <ControlTile icon={Youtube} label="Video" active={panel === 'video' || Boolean(room.video_url)} onPress={() => setPanel(panel === 'video' ? null : 'video')} />
              <ControlTile icon={Hand} label="Anuncio" active={panel === 'announce'} onPress={() => setPanel(panel === 'announce' ? null : 'announce')} />
              {isHost ? (
                <ControlTile icon={Swords} label="PK equipos" active={panel === 'team'} onPress={() => setPanel(panel === 'team' ? null : 'team')} />
              ) : null}
              {isHost ? (
                <ControlTile icon={Swords} label="PK salas" active={panel === 'pk'} onPress={() => void openPk()} />
              ) : null}
              {isHost ? (
                <ControlTile icon={Camera} label="Foto" active={panel === 'background'} onPress={() => setPanel(panel === 'background' ? null : 'background')} />
              ) : null}
              {isHost ? (
                <ControlTile icon={Lock} label="Privada" active={panel === 'private' || Boolean(room.is_private)} onPress={() => setPanel(panel === 'private' ? null : 'private')} />
              ) : null}
              <ControlTile icon={Trash2} label="Chat" danger onPress={() => setClearOpen(true)} />
              {isHost && bannedIds.length > 0 ? (
                <ControlTile icon={UserMinus} label={`${bannedIds.length}`} onPress={() => void forgiveBans()} />
              ) : null}
              {isHost ? (
                <ControlTile
                  icon={DoorClosed}
                  label="Cerrar"
                  onPress={() => {
                    Alert.alert(
                      'Cerrar la sala',
                      'La sala se cierra para todos y desaparece de la cartelera. Después puedes abrir otra.',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Cerrar sala', style: 'destructive', onPress: () => void cerrarSala() },
                      ],
                    );
                  }}
                />
              ) : null}
            </View>

            {panel === 'layout' && isHost ? (
              <View className="border-border mt-3 rounded-2xl border px-4 py-3">
                <View className="flex-row items-center gap-2">
                  <Icon as={LayoutGrid} className="text-primary size-4" />
                  <Text className="text-foreground flex-1 text-sm font-medium">Posición de los asientos</Text>
                  <View className="border-primary/35 bg-primary/12 rounded-full border px-2 py-0.5">
                    <Text className="text-primary text-[11px] font-semibold">
                      Ahora: {design ? design.name : 'Cuadrícula'}
                    </Text>
                  </View>
                </View>
                <Text className="text-muted-foreground mt-1 text-[11px] leading-4">
                  Toca una forma para verla antes de ponerla: la sala no cambia hasta que toques Aplicar.
                  Nadie sale de su asiento y la sala sigue abierta.
                  {cameraMode ? ' En modo multi de cámara, los cuadros de 4, 6 y 10 ponen una cámara por asiento.' : ''}
                </Text>

                {/*
                 * The large drawing of the shape being looked at: the same
                 * places the room would draw, big enough to judge before
                 * applying it. Nothing here changes the room by itself.
                 */}
                <View className="border-border bg-background mt-2.5 items-center rounded-2xl border px-3 py-3">
                  <View style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}>
                    {layoutPreview ? (
                      <LayoutDots layout={layoutPreview} size={PREVIEW_SIZE} />
                    ) : (
                      <View
                        style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
                        className="bg-secondary items-center justify-center rounded-[12px]">
                        <Icon as={Users} size={34} className="text-muted-foreground" />
                        <Text className="text-muted-foreground mt-1 text-[11px]">Filas de cinco</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-foreground mt-2 text-[13px] font-semibold">
                    {layoutPreview ? layoutPreview.name : 'Cuadrícula'}
                  </Text>
                  <Text className="text-muted-foreground text-[11px]">
                    {layoutPreview ? `${layoutCapacity(layoutPreview)} lugares` : `Hasta ${room.max_seats} lugares`}
                    {layoutPending ? ' · aún no está puesta' : ' · es la de ahora'}
                  </Text>
                  {layoutPreview && seats.length > layoutCapacity(layoutPreview) ? (
                    <Text className="text-destructive mt-1 text-center text-[11px] leading-4">
                      Hay {seats.length} personas sentadas y esta forma tiene {layoutCapacity(layoutPreview)} lugares.
                    </Text>
                  ) : null}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 py-2.5">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Sala en cuadrícula"
                    accessibilityState={{ selected: layoutChoice === null }}
                    onPress={() => setLayoutChoice(null)}
                    className={cn(
                      'w-[74px] items-center gap-1.5 rounded-xl border px-1.5 py-2 active:opacity-80',
                      layoutChoice === null ? 'border-primary bg-primary/12' : 'border-border bg-background',
                    )}>
                    <View className="bg-secondary size-[58px] items-center justify-center rounded-[12px]">
                      <Icon as={Users} size={20} className={layoutChoice === null ? 'text-primary' : 'text-muted-foreground'} />
                    </View>
                    <Text
                      numberOfLines={1}
                      className={cn('text-[11px] font-medium', layoutChoice === null ? 'text-primary' : 'text-muted-foreground')}>
                      Cuadrícula
                    </Text>
                  </Pressable>
                  {/* The camera squares only belong to the camera hall. */}
                  {ROOM_LAYOUTS.filter(item => cameraMode || !CAMERA_SQUARES.includes(item.id)).map(item => {
                    const active = layoutChoice === item.id;
                    return (
                      <Pressable
                        key={item.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Asientos ${item.name}, ${layoutCapacity(item)} lugares`}
                        accessibilityState={{ selected: active }}
                        onPress={() => setLayoutChoice(item.id)}
                        className={cn(
                          'w-[74px] items-center gap-1.5 rounded-xl border px-1.5 py-2 active:opacity-80',
                          active ? 'border-primary bg-primary/12' : 'border-border bg-background',
                        )}>
                        <LayoutDots layout={item} size={58} />
                        <Text
                          numberOfLines={1}
                          className={cn('text-[11px] font-medium', active ? 'text-primary' : 'text-muted-foreground')}>
                          {item.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <View className="flex-row gap-2">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={layoutPreview ? `Aplicar la forma ${layoutPreview.name}` : 'Aplicar la cuadrícula'}
                    accessibilityState={{ disabled: !layoutPending || layoutBusy }}
                    disabled={!layoutPending || layoutBusy}
                    onPress={() => void applyLayout(layoutChoice)}
                    className={cn(
                      'h-10 flex-1 items-center justify-center rounded-full active:opacity-85',
                      layoutPending ? 'bg-primary' : 'bg-muted',
                    )}>
                    {layoutBusy ? (
                      <ActivityIndicator size="small" color="#1A1409" />
                    ) : (
                      <Text
                        className={cn(
                          'text-[12px] font-semibold',
                          layoutPending ? 'text-primary-foreground' : 'text-muted-foreground',
                        )}>
                        {layoutPending ? 'Aplicar forma' : 'Ya está puesta'}
                      </Text>
                    )}
                  </Pressable>
                  {layoutUndo ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        roomLayout(layoutUndo.id)
                          ? `Volver a la forma ${roomLayout(layoutUndo.id)?.name}`
                          : 'Volver a la cuadrícula'
                      }
                      disabled={layoutBusy}
                      onPress={() => void applyLayout(layoutUndo.id)}
                      className="border-border bg-background h-10 flex-1 flex-row items-center justify-center gap-1 rounded-full border px-2 active:opacity-85">
                      <Icon as={Undo2} size={13} className="text-foreground" />
                      <Text className="text-foreground text-[12px] font-semibold" numberOfLines={1}>
                        Volver a {roomLayout(layoutUndo.id)?.name ?? 'Cuadrícula'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                <Text className="text-muted-foreground text-[11px]">
                  {design
                    ? `${layoutCapacity(design)} lugares · el mismo orden de asientos en todos los teléfonos.`
                    : 'La cuadrícula acomoda hasta 20 asientos en filas de cinco.'}
                </Text>
              </View>
            ) : null}

            {panel === 'cameras' && isHost ? (
              <View className="border-border mt-3 rounded-2xl border px-4 py-3">
                <View className="flex-row items-center gap-2">
                  <Icon as={cameraMode ? Video : Mic} className="text-primary size-4" />
                  <Text className="text-foreground flex-1 text-sm font-medium">Modo de la sala</Text>
                  <Text className="text-muted-foreground text-[11px]">{cameraMode ? 'Multi de cámara' : 'Multi de audio'}</Text>
                </View>
                <Text className="text-muted-foreground mt-1 text-[11px] leading-4">
                  El audio conserva los asientos redondos de siempre. La cámara los vuelve cuadrados y cada
                  persona puede prender la suya. Cambiar de modo no cierra la sala ni saca a nadie de su sitio.
                </Text>

                {/* The two halls, one beside the other: the shape follows the choice. */}
                <View className="mt-2.5 flex-row gap-2">
                  {([
                    { key: 'audio' as const, label: 'Multi de audio', note: 'Asientos redondos', art: Mic },
                    { key: 'camera' as const, label: 'Multi de cámara', note: 'Asientos cuadrados', art: Video },
                  ]).map(option => {
                    const active = (room.room_mode === 'camera') === (option.key === 'camera');
                    const Art = option.art;
                    return (
                      <Pressable
                        key={option.key}
                        accessibilityRole="button"
                        accessibilityLabel={`Poner la sala en ${option.label}, ${option.note}`}
                        accessibilityState={{ selected: active, disabled: cameraRuleBusy }}
                        disabled={cameraRuleBusy}
                        onPress={() => void changeRoomMode(option.key)}
                        className={cn(
                          'flex-1 gap-1 rounded-xl border px-3 py-2.5 active:opacity-85',
                          active ? 'border-primary bg-primary/12' : 'border-border bg-background',
                        )}>
                        <View className="flex-row items-center gap-1.5">
                          <Art size={13} color={active ? accent.main : '#A79E8F'} />
                          <Text className={cn('text-[12px] font-semibold', active ? 'text-primary' : 'text-foreground')}>
                            {option.label}
                          </Text>
                        </View>
                        <Text className="text-muted-foreground text-[11px]">{option.note}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Inside the camera hall, the host still decides whether the lens is offered. */}
                {cameraMode ? (
                  <Pressable
                    accessibilityRole="switch"
                    accessibilityLabel="Permitir las cámaras en la sala"
                    accessibilityState={{ checked: room.allow_camera !== false, disabled: cameraRuleBusy }}
                    disabled={cameraRuleBusy}
                    onPress={() => void changeCameraRule(room.allow_camera === false)}
                    className={cn(
                      'mt-2.5 h-11 flex-row items-center justify-between rounded-full border px-4 active:opacity-85',
                      room.allow_camera === false ? 'border-border bg-background' : 'border-primary/40 bg-primary/12',
                    )}>
                    <Text className={cn('text-[12.5px] font-semibold', room.allow_camera === false ? 'text-foreground' : 'text-primary')}>
                      Permitir las cámaras
                    </Text>
                    {cameraRuleBusy ? (
                      <ActivityIndicator size="small" color={accent.main} />
                    ) : (
                      <View
                        className="w-11 justify-center rounded-full px-0.5"
                        style={{
                          height: 24,
                          alignItems: room.allow_camera === false ? 'flex-start' : 'flex-end',
                          backgroundColor: room.allow_camera === false ? 'rgba(255,255,255,0.16)' : accent.main,
                        }}>
                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: room.allow_camera === false ? '#8A8073' : '#141210' }} />
                      </View>
                    )}
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {panel === 'seats' ? (
            <View className="border-border mt-3 rounded-2xl border px-4 py-3">
              <View className="flex-row items-center gap-2">
                <Icon as={Users} className="text-primary size-4" />
                <Text className="text-foreground text-sm font-medium">Asientos de la sala</Text>
                <Text className="text-muted-foreground text-[11px]">{room.max_seats} asientos</Text>
              </View>
              <Text className="text-muted-foreground mt-1 text-[11px]">
                {room.video_url
                  ? 'En modo video la sala tiene 4, 6, 8 o 10 asientos de audio.'
                  : 'Las salas de Latino Live tienen entre 4 y 20 asientos.'}
              </Text>
              <View className="mt-2.5 flex-row gap-2">
                {isHost ? (room.video_url ? [4, 6, 8, 10] : [4, 6, 8, 10, 12, 15, 20]).map(value => {
                  const active = room.max_seats === value;
                  const tooSmall = value < seats.length;
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityLabel={`Poner ${value} asientos`}
                      accessibilityState={{ selected: active, disabled: tooSmall }}
                      disabled={tooSmall}
                      onPress={() => void expand(value)}
                      className={cn(
                        'h-10 flex-1 items-center justify-center rounded-xl border active:opacity-80',
                        active ? 'border-primary bg-primary/15' : 'border-border bg-background',
                        tooSmall && 'opacity-40',
                      )}>
                      <Text className={cn('text-[13px] font-semibold', active ? 'text-primary' : 'text-foreground')}>{value}</Text>
                    </Pressable>
                  );
                }) : (
                  <Text className="text-muted-foreground text-[11px] py-2">Solo el anfitrión cambia el número de asientos.</Text>
                )}
              </View>
              {seats.length > 4 ? (
                <Text className="text-muted-foreground mt-1.5 text-[11px]">No puedes bajar de {seats.length} mientras haya gente sentada.</Text>
              ) : null}
              {isHost ? (
                <>
                  <View className="border-border mt-3 border-t pt-2.5">
                    <View className="flex-row items-center gap-1.5">
                      <Icon as={Lock} className="text-primary size-3.5" />
                      <Text className="text-foreground text-[12px] font-medium">Candados por asiento</Text>
                      <Text className="text-muted-foreground ml-auto text-[11px]">{seatLocks.length} cerrados</Text>
                    </View>
                    <Text className="text-muted-foreground mt-1 text-[11px]">
                      Toca un número para cerrarlo o abrirlo. Un asiento cerrado nadie lo puede ocupar.
                    </Text>
                    <View className="mt-2 flex-row flex-wrap gap-1.5">
                      {Array.from({ length: room.max_seats }).map((_, index) => {
                        const no = index + 1;
                        const locked = seatLocks.includes(no);
                        const taken = seats.some(seat => seat.seat_no === no);
                        return (
                          <Pressable
                            key={no}
                            accessibilityRole="button"
                            accessibilityLabel={locked ? `Abrir el asiento ${no}` : `Cerrar con candado el asiento ${no}`}
                            accessibilityState={{ selected: locked }}
                            onPress={() => void toggleLock(no)}
                            className={cn(
                              'h-9 min-w-9 flex-row items-center justify-center gap-0.5 rounded-lg border px-2 active:opacity-80',
                              locked ? 'border-destructive/60 bg-destructive/15' : 'border-border bg-background',
                            )}>
                            {locked ? <Icon as={Lock} className="text-destructive size-3" /> : null}
                            <Text className={cn('text-[12px] font-semibold tabular-nums', locked ? 'text-destructive' : taken ? 'text-primary' : 'text-foreground')}>
                              {no}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </>
              ) : null}
            </View>
            ) : null}

            {panel === 'private' && isHost ? (
            <View className="border-border mt-3 rounded-2xl border px-4 py-3">
              <View className="flex-row items-center gap-2">
                <Icon as={Lock} className="text-primary size-4" />
                <Text className="text-foreground text-sm font-medium">Sala privada</Text>
                {room.is_private ? (
                  <View className="bg-primary/15 ml-auto rounded-full px-2 py-0.5">
                    <Text className="text-primary text-[11px] font-semibold">Privada</Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-muted-foreground mt-1 text-[11px]">
                {room.is_private
                  ? 'Solo entra quien tenga el código, y la sala deja de aparecer en la cartelera.'
                  : 'Con la sala privada solo entra quien tenga el código y deja de aparecer en la cartelera.'}
              </Text>
              {room.is_private ? (
                <>
                  <View className="border-border bg-background mt-2 flex-row items-center gap-2 rounded-xl border px-3 py-2">
                    <Text className="text-foreground flex-1 text-center text-[18px] font-bold tracking-[0.3em]">
                      {joinCode ?? '······'}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Compartir el código de la sala privada"
                      disabled={!joinCode}
                      onPress={() => void sharePrivateCode()}
                      className={cn(
                        'size-9 items-center justify-center rounded-full border active:opacity-80',
                        joinCode ? 'border-primary/40 bg-primary/10' : 'border-border opacity-40',
                      )}>
                      <Icon as={Share2} className="text-primary size-4" />
                    </Pressable>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Hacer pública la sala"
                    disabled={privateBusy}
                    onPress={() => void updatePrivate(false)}
                    className="border-border mt-2 h-10 items-center justify-center rounded-full border active:bg-muted">
                    {privateBusy
                      ? <ActivityIndicator size="small" color={accent.main} />
                      : <Text className="text-foreground text-[13px] font-semibold">Hacer pública</Text>}
                  </Pressable>
                </>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Hacer privada la sala"
                  disabled={privateBusy}
                  onPress={() => void updatePrivate(true)}
                  className="border-primary/50 bg-primary/10 mt-2 h-10 items-center justify-center rounded-full border active:opacity-85">
                  {privateBusy
                    ? <ActivityIndicator size="small" color={accent.main} />
                    : <Text className="text-primary text-[13px] font-semibold">Hacer privada</Text>}
                </Pressable>
              )}
            </View>
            ) : null}

            {panel === 'video' ? (
            <View className="border-border mt-3 rounded-2xl border px-4 py-3">
              <View className="flex-row items-center gap-2">
                <Icon as={Youtube} className="text-primary size-4" />
                <Text className="text-foreground text-sm font-medium">Ver YouTube en la sala</Text>
              </View>
              <Text className="text-muted-foreground mt-1 text-[11px]">
                {room.video_url
                  ? `La sala está en modo video con ${room.max_seats} asientos de audio. Todos ven el mismo video.`
                  : 'Busca el video por su nombre y elígelo de la lista. No necesitas enlaces.'}
              </Text>
              {videoOpen ? (
                <>
                  <View className="mt-2 flex-row flex-wrap gap-1.5">
                    {YOUTUBE_FILTERS.map(item => {
                      const active = item.key === videoFilter;
                      return (
                        <Pressable
                          key={item.key}
                          accessibilityRole="button"
                          accessibilityLabel={`Filtrar: ${item.label}`}
                          accessibilityState={{ selected: active }}
                          onPress={() => {
                            setVideoFilter(item.key);
                            if (item.key !== 'all' || videoDraft.trim().length >= 2) void findVideos(videoDraft, item.key);
                          }}
                          className={cn(
                            'h-8 items-center justify-center rounded-full border px-3 active:opacity-85',
                            active ? 'border-primary bg-primary/15' : 'border-border bg-background/60',
                          )}>
                          <Text className={cn('text-[12px] font-semibold', active ? 'text-primary' : 'text-muted-foreground')}>{item.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View className="border-border bg-background mt-2 flex-row items-center gap-1 rounded-full border pl-3 pr-1">
                    <TextInput
                      value={videoDraft}
                      onChangeText={setVideoDraft}
                      onSubmitEditing={() => void findVideos(videoDraft, videoFilter)}
                      placeholder={videoFilter === 'live' ? 'Busca un tema en vivo' : 'Busca una canción o un video'}
                      placeholderTextColor="#8A8073"
                      returnKeyType="search"
                      accessibilityLabel="Buscar un video en YouTube"
                      className="text-foreground flex-1 text-[13px]"
                      style={{ paddingVertical: 8, minWidth: 0 }}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Buscar en YouTube"
                      onPress={() => void findVideos(videoDraft, videoFilter)}
                      disabled={videoSearching || (videoDraft.trim().length < 2 && videoFilter === 'all')}
                      className={cn('size-8 items-center justify-center rounded-full', !videoSearching && (videoDraft.trim().length >= 2 || videoFilter !== 'all') ? 'bg-primary' : 'bg-muted')}>
                      {videoSearching
                        ? <ActivityIndicator size="small" color="#1A1409" />
                        : <Icon as={Search} className={!videoSearching && (videoDraft.trim().length >= 2 || videoFilter !== 'all') ? 'text-primary-foreground size-4' : 'text-muted-foreground size-4'} />}
                    </Pressable>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    className="mt-2"
                    contentContainerStyle={{ gap: 6 }}>
                    {QUICK_VIDEO_SEARCH.map(item => (
                      <Pressable
                        key={item.label}
                        accessibilityRole="button"
                        accessibilityLabel={`Buscar ${item.label}`}
                        onPress={() => { setVideoDraft(item.query); void findVideos(item.query, videoFilter); }}
                        className="border-border bg-background/70 h-7 items-center justify-center rounded-full border px-2.5 active:opacity-80">
                        <Text className="text-foreground text-[11px] font-medium">{item.label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  {videoError ? <Text className="text-destructive mt-1.5 text-[11px]">{videoError}</Text> : null}

                  {videoResults.length > 0 ? (
                    <View className="mt-2 gap-1.5">
                      {videoResults.map(video => (
                        <Pressable
                          key={video.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Poner ${video.title}`}
                          onPress={() => void saveVideo(`https://www.youtube.com/watch?v=${video.id}`)}
                          className="border-border bg-background/60 flex-row items-center gap-2 rounded-xl border p-1.5 active:opacity-80">
                          <Image source={{ uri: video.thumbnail }} resizeMode="cover" style={{ width: 68, height: 40, borderRadius: 8 }} />
                          <View className="flex-1">
                            <Text className="text-foreground text-[12px] font-medium" numberOfLines={2}>{video.title}</Text>
                            <Text className="text-muted-foreground text-[11px]" numberOfLines={1}>
                              {[video.channel, video.duration].filter(Boolean).join(' · ') || 'YouTube'}
                            </Text>
                          </View>
                          {video.isLive ? (
                            <View className="bg-destructive/15 rounded-full px-2 py-0.5">
                              <Text className="text-destructive text-[11px] font-bold tracking-wider">EN VIVO</Text>
                            </View>
                          ) : null}
                          <Icon as={Play} className="text-primary size-4" />
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <View className="mt-2 gap-1.5">
                      <Text className="text-muted-foreground text-[11px] font-semibold">Sugeridos para ti</Text>
                      {youtubePicks(videoFilter).map(video => (
                        <Pressable
                          key={video.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Poner ${video.title}`}
                          onPress={() => void saveVideo(`https://www.youtube.com/watch?v=${video.id}`)}
                          className="border-border bg-background/60 flex-row items-center gap-2 rounded-xl border p-1.5 active:opacity-80">
                          <Image source={{ uri: video.thumbnail }} resizeMode="cover" style={{ width: 68, height: 40, borderRadius: 8 }} />
                          <View className="flex-1">
                            <Text className="text-foreground text-[12px] font-medium" numberOfLines={2}>{video.title}</Text>
                            <Text className="text-muted-foreground text-[11px]" numberOfLines={1}>
                              {[video.channel, video.duration].filter(Boolean).join(' · ') || 'YouTube'}
                            </Text>
                          </View>
                          <Icon as={Play} className="text-primary size-4" />
                        </Pressable>
                      ))}
                    </View>
                  )}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar la búsqueda de YouTube"
                    onPress={() => { setVideoOpen(false); setVideoDraft(''); setVideoResults([]); setVideoError(null); setVideoFilter('all'); }}
                    className="border-border mt-2 h-9 items-center justify-center rounded-full border active:bg-muted">
                    <Text className="text-foreground text-[12px] font-semibold">Cerrar búsqueda</Text>
                  </Pressable>
                </>
              ) : (
                <View className="mt-2 flex-row gap-2">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={room.video_url ? 'Buscar otro video de YouTube' : 'Buscar un video de YouTube'}
                    onPress={() => { setVideoOpen(true); setVideoResults([]); setVideoError(null); }}
                    className="border-primary/50 bg-primary/10 h-10 flex-1 items-center justify-center rounded-full border active:opacity-85">
                    <Text className="text-primary text-[13px] font-semibold">{room.video_url ? 'Cambiar video' : 'Buscar video'}</Text>
                  </Pressable>
                  {room.video_url ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Quitar el video y volver al modo de voz"
                      onPress={() => void saveVideo('')}
                      className="border-border h-10 flex-1 items-center justify-center rounded-full border active:bg-muted">
                      <Text className="text-foreground text-[13px] font-semibold">Quitar video</Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            </View>
            ) : null}

            {panel === 'pk' && isHost ? (
            <View className="border-border mt-3 rounded-2xl border px-4 py-3">
              <View className="flex-row items-center gap-2">
                <Icon as={Swords} className="text-primary size-4" />
                <Text className="text-foreground text-sm font-medium">Batalla PK</Text>
                {pk?.status === 'live' ? (
                  <View className="bg-primary/15 ml-auto rounded-full px-2 py-0.5">
                    <Text className="text-primary text-[11px] font-semibold">En curso</Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-muted-foreground mt-1 text-[11px]">
                {pk?.status === 'live'
                  ? 'Cada regalo en tu sala o en la rival suma diamantes. La batalla dura 3 minutos.'
                  : 'Elige una sala abierta. Durante 3 minutos, los regalos de cada sala suman a su marcador.'}
              </Text>

              {pk?.status === 'live' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Terminar la batalla ahora"
                  onPress={() => void closePk()}
                  className="border-destructive/50 mt-2 h-9 items-center justify-center rounded-full border active:bg-muted">
                  <Text className="text-destructive text-[12px] font-semibold">Terminar batalla</Text>
                </Pressable>
              ) : pkRivals.length === 0 ? (
                <Text className="text-muted-foreground mt-2 text-[11px]">
                  Buscando salas abiertas…
                </Text>
              ) : (
                <View className="mt-2 gap-1.5">
                  {pkRivals.slice(0, 6).map(rival => (
                    <Pressable
                      key={rival.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Retar a ${rival.title}`}
                      disabled={pkBusy}
                      onPress={() => void launchPk(rival.id)}
                      className="border-border bg-background/60 flex-row items-center gap-2 rounded-xl border px-2.5 py-2 active:opacity-80">
                      <View className="bg-primary/15 size-7 items-center justify-center rounded-full">
                        <Icon as={Swords} className="text-primary size-3.5" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-foreground text-[12px] font-semibold" numberOfLines={1}>{rival.title}</Text>
                        <Text className="text-muted-foreground text-[11px]" numberOfLines={1}>{rival.host_name}</Text>
                      </View>
                      <Text className="text-primary text-[11px] font-semibold">Retar</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
            ) : null}

            {panel === 'team' && isHost ? (
            <View className="border-border mt-3 rounded-2xl border px-4 py-3">
              <View className="flex-row items-center gap-2">
                <Icon as={Swords} className="text-primary size-4" />
                <Text className="text-foreground text-sm font-medium">PK de equipos</Text>
                {teamPk?.status === 'live' ? (
                  <View className="bg-primary/15 ml-auto rounded-full px-2 py-0.5">
                    <Text className="text-primary text-[11px] font-semibold">En curso</Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-muted-foreground mt-1 text-[11px] leading-4">
                La sala se divide en dos: los asientos 1–{Math.ceil(room.max_seats / 2)} son Equipo Rojo y{' '}
                {Math.ceil(room.max_seats / 2) + 1}–{room.max_seats} Equipo Azul. Cada regalo de alguien sentado
                suma a su equipo. Dura 3 minutos.
              </Text>
              {teamPk?.status === 'live' ? (
                <>
                  <View className="mt-2 flex-row items-center justify-between">
                    <Text className="text-[12px] font-semibold" style={{ color: '#FF4D5E' }}>
                      Rojo · {teamPk.score_red.toLocaleString('es')}
                    </Text>
                    <Text className="text-[12px] font-semibold" style={{ color: '#3B82F6' }}>
                      Azul · {teamPk.score_blue.toLocaleString('es')}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Terminar el PK de equipos ahora"
                    onPress={() => void closeTeamPk()}
                    className="border-destructive/50 mt-2 h-9 items-center justify-center rounded-full border active:bg-muted">
                    <Text className="text-destructive text-[12px] font-semibold">Terminar PK</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Empezar el PK de equipos"
                  disabled={teamPkBusy}
                  onPress={() => void launchTeamPk()}
                  className="bg-primary mt-2 h-9 items-center justify-center rounded-full active:opacity-85">
                  <Text className="text-primary-foreground text-[12px] font-semibold">
                    {teamPkBusy ? 'Empezando…' : 'Empezar PK · 3 minutos'}
                  </Text>
                </Pressable>
              )}
            </View>
            ) : null}

            {panel === 'announce' ? (
            <View className="border-border mt-3 rounded-2xl border px-4 py-3">
              <View className="flex-row items-center gap-2">
                <Icon as={Hand} className="text-primary size-4" />
                <Text className="text-foreground text-sm font-medium">Anuncio fijado</Text>
              </View>
              <TextInput
                value={announceDraft}
                onChangeText={setAnnounceDraft}
                placeholder="Escribe un anuncio para la sala"
                placeholderTextColor="#8A8073"
                maxLength={200}
                accessibilityLabel="Texto del anuncio de la sala"
                className="border-border bg-background text-foreground mt-2 rounded-xl border px-3 py-2.5 text-[13px]"
              />
              <Pressable accessibilityRole="button" onPress={() => void publishAnnouncement()} className="bg-primary mt-2 h-9 items-center justify-center rounded-full active:bg-primary/80">
                <Text className="text-primary-foreground text-xs font-semibold">Publicar anuncio</Text>
              </Pressable>
            </View>
            ) : null}

            {panel === 'background' && isHost ? (
              <View className="border-border mt-3 flex-row items-center gap-2 rounded-2xl border px-3 py-2.5">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Elegir la foto de la sala desde la galería"
                  disabled={bgBusy}
                  onPress={() => void pickBackground()}
                  className="border-primary/50 bg-primary/10 h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border active:opacity-85">
                  {bgBusy ? <ActivityIndicator size="small" color={accent.main} /> : <Icon as={Camera} className="text-primary size-3.5" />}
                  <Text className="text-primary text-[12px] font-semibold">{room.background_path ? 'Cambiar foto' : 'Foto de la sala'}</Text>
                </Pressable>
                {room.background_path ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Quitar la foto de la sala"
                    disabled={bgBusy}
                    onPress={() => void resetBackground()}
                    className="border-border size-10 items-center justify-center rounded-full border active:bg-muted">
                    <Icon as={X} className="text-foreground size-4" />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View className="mt-3 flex-row items-center gap-2">
              <Icon as={Lock} className="text-muted-foreground size-3.5" />
              <Text className="text-muted-foreground flex-1 text-[11px]">
                {canModerate ? 'Cierra estos controles y toca a una persona sentada para silenciarla o expulsarla.' : 'El anfitrión o un moderador pueden silenciar y borrar el chat.'}
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <RoomInviteSheet
        visible={inviteOpen}
        roomId={room.id}
        roomTitle={room.title}
        hostName={room.host_name}
        isPrivate={Boolean(room.is_private)}
        isHost={isHost}
        selfId={session?.user.id}
        onClose={() => setInviteOpen(false)}
        onNotice={flash}
      />

      <RoomPeopleSheet
        visible={peopleOpen}
        seats={seats}
        memberIds={voice.members}
        selfId={session?.user.id}
        onClose={() => setPeopleOpen(false)}
        onOpenPerson={(person: PersonInRoom) => {
          setPeopleOpen(false);
          setProfileSeat({
            room_id: room.id,
            seat_no: person.seatNo ?? 0,
            user_id: person.id,
            display_name: person.name,
            avatar_url: person.avatar,
            muted: person.muted,
            speaking: person.speaking,
            joined_at: '',
          });
        }}
      />

      <UserProfileSheet
        visible={profileSeat !== null}
        userId={profileSeat?.user_id ?? null}
        roomId={room?.id ?? null}
        fallbackName={profileSeat?.display_name ?? 'Miembro'}
        fallbackAvatar={profileSeat?.avatar_url ?? null}
        isHostSeat={Boolean(room?.host_id && profileSeat?.user_id === room.host_id)}
        isSelf={profileSeat?.user_id === session?.user.id}
        onClose={() => setProfileSeat(null)}
        onGift={() => {
          if (profileSeat) setGiftRecipient({ id: profileSeat.user_id, name: profileSeat.display_name });
          setProfileSeat(null);
          setGiftOpen(true);
        }}
        onModerate={isHost && profileSeat ? () => { setModerating(profileSeat); setProfileSeat(null); } : undefined}
        onMakeDj={isHost && profileSeat ? () => { void makeDj(profileSeat.user_id); } : undefined}
      />

      <LuckSheet
        visible={luckOpen}
        onClose={() => setLuckOpen(false)}
        roomId={room?.id ?? null}
        myName={me?.display_name ?? 'Alguien'}
        seatNumbers={Array.from({ length: room?.max_seats ?? 0 }, (_unused, index) => index + 1)}
        occupantOf={seatNumber => seats.find(seat => seat.seat_no === seatNumber)?.display_name ?? null}
        seated={Boolean(me)}
      />

      {/* The counter opened: who sent this seat's gifts, and how many. */}
      <SeatGiftSheet
        visible={giftSeatNo !== null}
        roomId={room?.id ?? null}
        userId={giftSeatNo !== null ? seats.find(item => item.seat_no === giftSeatNo)?.user_id ?? null : null}
        name={giftSeatNo !== null ? seats.find(item => item.seat_no === giftSeatNo)?.display_name ?? 'Esta persona' : ''}
        avatar={giftSeatNo !== null ? seats.find(item => item.seat_no === giftSeatNo)?.avatar_url ?? null : null}
        onClose={() => setGiftSeatNo(null)}
      />

      {/* The battle card only opens when the small chip is tapped, so it never
          sits over the seats while the room is talking. */}
      <Modal visible={podiumOpen} transparent animationType="fade" onRequestClose={() => setPodiumOpen(false)}>
        <Pressable className="flex-1 justify-center bg-black/60 px-4" onPress={() => setPodiumOpen(false)} accessibilityLabel="Cerrar el podio del día">
          <Pressable className="border-border bg-card rounded-3xl border px-3 py-4" onPress={() => undefined}>
            <View className="flex-row items-center justify-between px-2">
              <View className="flex-row items-center gap-1.5">
                <Icon as={Trophy} className="text-primary size-4" />
                <Text className="text-foreground text-base font-semibold">Podio de hoy</Text>
              </View>
              <Text className="text-muted-foreground text-[11px]">Diamantes + PK</Text>
            </View>

            <View className="mt-3">
              {podiumBusy && podium.length === 0 ? (
                <ActivityIndicator color={accent.main} />
              ) : (
                <RankPodium
                  entries={podium.slice(0, 3)}
                  roomId={room.id}
                  avatars={podiumAvatars}
                />
              )}
            </View>

            {podium.length > 3 ? (
              <View className="mt-2 gap-1">
                {podium.slice(3, 8).map((item, index) => (
                  <View key={item.room_id} className="flex-row items-center gap-2 px-2 py-1">
                    <Text className="text-muted-foreground w-6 text-center text-[12px] font-bold">#{index + 4}</Text>
                    <Text
                      className={cn('flex-1 text-[12px] font-medium', item.room_id === room.id ? 'text-primary' : 'text-foreground')}
                      numberOfLines={1}>
                      {item.title}
                    </Text>
                    <SparklingDiamond size={14} animated={false} />
                    <Text className="text-foreground text-[12px] font-semibold">{Number(item.gold).toLocaleString('es')}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View className="border-border/70 mt-3 flex-row items-center justify-between border-t px-2 pt-2.5">
              <Text className="text-muted-foreground text-[12px]">
                {podiumPlace > 0
                  ? `Tu sala va #${podiumPlace} hoy`
                  : 'Tu sala aún no suma diamantes hoy'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar el podio"
                onPress={() => setPodiumOpen(false)}
                className="border-border h-9 items-center justify-center rounded-full border px-4 active:bg-muted">
                <Text className="text-foreground text-[12px] font-semibold">Cerrar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={pkOpen && Boolean(pk)} transparent animationType="fade" onRequestClose={() => setPkOpen(false)}>
        <Pressable className="flex-1 justify-center bg-black/60 px-5" onPress={() => setPkOpen(false)} accessibilityLabel="Cerrar el marcador de la batalla">
          {pk ? (
            <Pressable className="rounded-3xl" onPress={() => undefined}>
              <PkBattleBanner battle={pk} roomId={room.id} isHost={isHost} onClose={() => { setPkOpen(false); setPk(null); }} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar el marcador"
                onPress={() => setPkOpen(false)}
                className="bg-card border-border mt-2 h-11 items-center justify-center rounded-full border active:bg-muted">
                <Text className="text-foreground text-[13px] font-semibold">Cerrar</Text>
              </Pressable>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>

      <Modal visible={teamPkOpen && Boolean(teamPk)} transparent animationType="fade" onRequestClose={() => setTeamPkOpen(false)}>
        <Pressable className="flex-1 justify-center bg-black/60 px-5" onPress={() => setTeamPkOpen(false)} accessibilityLabel="Cerrar el marcador del PK de equipos">
          {teamPk ? (
            <Pressable className="rounded-3xl" onPress={() => undefined}>
              <TeamPkBanner battle={teamPk} isHost={isHost} onClose={() => { setTeamPkOpen(false); setTeamPk(null); }} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar el marcador"
                onPress={() => setTeamPkOpen(false)}
                className="bg-card border-border mt-2 h-11 items-center justify-center rounded-full border active:bg-muted">
                <Text className="text-foreground text-[13px] font-semibold">Cerrar</Text>
              </Pressable>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>

      {/* One account lives in one room: the phone that lost its seat says so
          instead of dropping the person out of the room without a word. */}
      <Modal visible={Boolean(movedTo)} transparent animationType="fade" onRequestClose={() => undefined}>
        <View className="flex-1 justify-center bg-black/70 px-6">
          <View className="border-border bg-card rounded-3xl border p-5">
            <View className="bg-primary/15 size-11 items-center justify-center rounded-full">
              <Icon as={DoorClosed} className="text-primary size-5" />
            </View>
            <Text className="text-foreground mt-3 text-lg font-semibold">Una sala a la vez</Text>
            <Text className="text-muted-foreground mt-1 text-[13px] leading-5">
              Tu cuenta entró en «{movedTo}» desde otro teléfono, así que salió de esta sala.
              Para hablar aquí, vuelve a sentarte cuando salgas de la otra.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Volver a las salas"
              onPress={() => {
                setMovedTo(null);
                router.replace('/' as Href);
              }}
              className="bg-primary mt-4 h-11 items-center justify-center rounded-full active:opacity-85">
              <Text className="text-primary-foreground text-[13px] font-semibold">Volver a las salas</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={titleDraft !== null} transparent animationType="fade" onRequestClose={() => setTitleDraft(null)}>
        <Pressable className="flex-1 justify-center bg-black/60 px-6" onPress={() => setTitleDraft(null)} accessibilityLabel="Cerrar el texto de la sala">
          <Pressable className="border-border bg-card rounded-3xl border p-5" onPress={() => undefined}>
            <Text className="text-foreground text-lg font-semibold">Texto de la sala</Text>
            <Text className="text-muted-foreground mt-1 text-[13px] leading-5">
              Todos lo ven arriba de la sala. Puedes cambiarlo cuando quieras.
            </Text>
            <TextInput
              value={titleDraft ?? ''}
              onChangeText={setTitleDraft}
              onSubmitEditing={() => void saveTitle()}
              placeholder="Ej.: Noche de baladas con brocitord"
              placeholderTextColor="#8A8073"
              maxLength={60}
              autoFocus
              returnKeyType="done"
              accessibilityLabel="Texto de la sala"
              className="border-border bg-background text-foreground mt-3 rounded-xl border px-3 py-2.5 text-[14px]"
            />
            <View className="mt-4 flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancelar el texto de la sala"
                onPress={() => setTitleDraft(null)}
                className="border-border h-12 flex-1 items-center justify-center rounded-full border active:bg-muted">
                <Text className="text-foreground text-sm font-semibold">Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Guardar el texto de la sala"
                disabled={titleSaving}
                onPress={() => void saveTitle()}
                className={cn('h-12 flex-1 items-center justify-center rounded-full', titleSaving ? 'bg-muted' : 'bg-primary active:opacity-85')}>
                {titleSaving
                  ? <ActivityIndicator size="small" color={accent.main} />
                  : <Text className="text-primary-foreground text-sm font-semibold">Guardar</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={clearOpen} transparent animationType="fade" onRequestClose={() => setClearOpen(false)}>
        <Pressable className="flex-1 justify-center bg-black/60 px-6" onPress={() => setClearOpen(false)} accessibilityLabel="Cerrar confirmación">
          <Pressable className="border-border bg-card rounded-3xl border p-5" onPress={() => undefined}>
            <View className="bg-destructive/15 size-11 items-center justify-center rounded-full">
              <Icon as={Trash2} className="text-destructive size-5" />
            </View>
            <Text className="text-foreground mt-3 text-lg font-semibold">¿Borrar todo el chat?</Text>
            <Text className="text-muted-foreground mt-1 text-[13px] leading-5">
              Se quitan todos los mensajes y las fotos de esta sala para todos. No se puede deshacer.
            </Text>
            <View className="mt-4 flex-row gap-2">
              <Pressable accessibilityRole="button" accessibilityLabel="Conservar el chat" onPress={() => setClearOpen(false)} className="border-border h-12 flex-1 items-center justify-center rounded-full border active:bg-muted">
                <Text className="text-foreground text-sm font-semibold">Conservar</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Borrar todo el chat" onPress={() => void wipeChat()} className="bg-destructive h-12 flex-1 items-center justify-center rounded-full active:opacity-85">
                <Text className="text-white text-sm font-semibold">Borrar chat</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={viewPhoto !== null} transparent animationType="fade" onRequestClose={() => setViewPhoto(null)}>
        <Pressable className="flex-1 items-center justify-center bg-black/90 px-4" onPress={() => setViewPhoto(null)} accessibilityLabel="Cerrar la foto">
          {viewPhoto ? (
            <Image source={{ uri: roomPhotoUrl(viewPhoto) }} resizeMode="contain" style={{ width: '100%', height: '70%' }} />
          ) : null}
          <Text className="text-muted-foreground mt-4 text-[11px]">Toca en cualquier lado para cerrar</Text>
        </Pressable>
      </Modal>

      <Modal visible={moderating !== null} transparent animationType="fade" onRequestClose={() => setModerating(null)}>
        <Pressable className="flex-1 justify-end bg-black/60" onPress={() => setModerating(null)} accessibilityLabel="Cerrar opciones del usuario">
          <Pressable className="border-border bg-card rounded-t-[28px] border px-5 pb-8 pt-3" onPress={() => undefined}>
            <View className="bg-border mx-auto mb-4 h-1 w-10 rounded-full" />
            <Text className="text-foreground text-lg font-semibold">{moderating?.display_name}</Text>
            <Text className="text-muted-foreground mt-1 text-xs">Modera a esta persona en la sala.</Text>
            <View className="mt-4 flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${moderating?.muted ? 'Activar' : 'Silenciar'} a ${moderating?.display_name}`}
                onPress={() => void applyModeration(moderating?.muted ? 'unmute' : 'mute')}
                className="border-border flex-1 items-center gap-1 rounded-2xl border py-4 active:bg-muted">
                <Icon as={moderating?.muted ? Mic : MicOff} className="text-foreground size-5" />
                <Text className="text-foreground text-xs font-medium">{moderating?.muted ? 'Activar' : 'Silenciar'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Expulsar a ${moderating?.display_name}`}
                onPress={() => void applyModeration('kick')}
                className="border-destructive/40 bg-destructive/10 flex-1 items-center gap-1 rounded-2xl border py-4 active:bg-destructive/20">
                <Icon as={UserMinus} className="text-destructive size-5" />
                <Text className="text-destructive text-xs font-medium">Expulsar</Text>
              </Pressable>
            </View>
            {isHost && moderating ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${moderators.includes(moderating.user_id) ? 'Quitar moderador a' : 'Hacer moderador a'} ${moderating.display_name}`}
                  onPress={() => void toggleModerator(moderating)}
                  className="border-border mt-2 h-11 flex-row items-center justify-center gap-1.5 rounded-full border active:bg-muted">
                  <Icon as={Shield} className="text-primary size-4" />
                  <Text className="text-foreground text-xs font-medium">
                    {moderators.includes(moderating.user_id) ? 'Quitar moderador' : 'Hacer moderador'}
                  </Text>
                </Pressable>
                {moderators.includes(moderating.user_id) ? (
                  <View className="border-border mt-2 rounded-2xl border px-3 py-3">
                    <Text className="text-foreground text-xs font-medium">Color de su burbuja</Text>
                    <Text className="text-muted-foreground mt-0.5 text-[11px]">Se ve al 70% en los mensajes que escriba.</Text>
                    <View className="mt-2 flex-row gap-2">
                      {BUBBLES.map(option => {
                        const active = (bubbles[moderating.user_id] ?? 'rose') === option.key;
                        return (
                          <Pressable
                            key={option.key}
                            accessibilityRole="button"
                            accessibilityLabel={`Burbuja ${option.label} para ${moderating.display_name}`}
                            accessibilityState={{ selected: active }}
                            onPress={() => void aplicarBurbuja(moderating.user_id, option.key)}
                            className={cn('h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border active:opacity-80',
                              active ? 'border-foreground/60' : 'border-border')}
                            style={{ backgroundColor: option.fill }}>
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: option.border }} />
                            <Text className="text-[12px] font-semibold" style={{ color: option.ink }}>{option.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}
            <Pressable accessibilityRole="button" onPress={() => setModerating(null)} className="mt-3 h-10 items-center justify-center rounded-full active:bg-muted">
              <Text className="text-muted-foreground text-xs">Cerrar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      {/* The neighbour decides: only a yes makes the two dragons walk. */}
      <Modal visible={Boolean(kissAsk)} transparent animationType="fade" onRequestClose={() => answerKiss(false)}>
        <View className="flex-1 items-center justify-center bg-black/75 px-7">
          <View className="border-primary/40 bg-card w-full items-center rounded-3xl border px-5 py-5">
            <View className="bg-primary/15 size-16 items-center justify-center rounded-full">
              <Icon as={Heart} size={30} className="text-primary" />
            </View>
            <Text className="text-foreground mt-1 text-center text-[15px] font-semibold">
              {kissAsk?.fromName ?? 'Alguien'} quiere darte un beso
            </Text>
            <Text className="text-muted-foreground mt-1 text-center text-[12px]">
              Se cancela en {kissLeft}s si no respondes.
            </Text>
            <View className="mt-4 w-full flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Rechazar el beso"
                onPress={() => answerKiss(false)}
                className="border-border h-11 flex-1 items-center justify-center rounded-full border active:opacity-80">
                <Text className="text-muted-foreground text-[13px] font-semibold">Rechazar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Aceptar el beso"
                onPress={() => answerKiss(true)}
                className="bg-primary h-11 flex-1 items-center justify-center rounded-full active:opacity-90">
                <Text className="text-primary-foreground text-[13px] font-semibold">Aceptar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* The dragon draws the emotion itself, on the seat of whoever sent it. */}
      {dragonReady && !dataSaver ? <Dragon3D ref={dragon} onError={flash} /> : null}
      {/* Last in the room, so the gift plays over the seats, the chat and the modals. */}
      <GiftVideoOverlay gift={playingGift} onDone={() => setPlayingGift(null)} />
    </View>
  );
}

/** One square icon of the host controls: the whole panel is a row of these. */
function ControlTile({
  icon,
  label,
  onPress,
  active,
  danger,
}: {
  icon: typeof Users;
  label: string;
  onPress: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(active) }}
      onPress={onPress}
      style={{ width: 72 }}
      className={cn(
        'items-center gap-1 rounded-xl border py-2 active:opacity-75',
        danger ? 'border-destructive/40 bg-destructive/10'
          : active ? 'border-primary/60 bg-primary/15'
          : 'border-border bg-background',
      )}>
      <Icon as={icon} className={cn('size-4', danger ? 'text-destructive' : active ? 'text-primary' : 'text-foreground')} />
      <Text className={cn('text-[12px] font-medium', danger ? 'text-destructive' : active ? 'text-primary' : 'text-muted-foreground')}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The chat's two views: everything, or only the gifts that landed. */
function ChatFilterButton({ filter, onPress }: { filter: 'todo' | 'regalo'; onPress: () => void }) {
  const gifts = filter === 'regalo';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={gifts ? 'Ver todo el chat de la sala' : 'Ver solo los regalos de la sala'}
      onPress={onPress}
      className={cn(
        'h-7 flex-row items-center rounded-full border px-2.5 active:opacity-80',
        gifts ? 'border-primary bg-primary/25' : 'border-border bg-black/30',
      )}>
      <Text className={cn('text-[11px] font-semibold', gifts ? 'text-primary' : 'text-muted-foreground')}>
        {gifts ? 'Regalos' : 'Todo'}
      </Text>
    </Pressable>
  );
}

/** The gift button that lives next to the chat. */
function GiftShortcut({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Enviar un regalo"
      onPress={onPress}
      className="border-primary/50 bg-primary/20 size-7 items-center justify-center rounded-full border active:opacity-80">
      <Image source={ACTION_ICONS.gift} resizeMode="contain" style={{ width: 16, height: 16 }} accessibilityIgnoresInvertColors />
    </Pressable>
  );
}

