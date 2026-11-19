-- Two kinds of hall: a voice room, with the round seats the app always had,
-- and a camera room, whose places are squares that hold a live picture. The
-- mode belongs to the room, so every phone draws the same shape.
--
-- Existing rooms become voice rooms, which keeps their seats exactly as they
-- were, and a camera room always starts with its cameras allowed.

alter table public.rooms
  add column if not exists room_mode text not null default 'audio';

alter table public.rooms drop constraint if exists rooms_room_mode_check;
alter table public.rooms
  add constraint rooms_room_mode_check check (room_mode in ('audio', 'camera'));

-- A voice room has no cameras at all; a camera room opens with them allowed.
update public.rooms
   set allow_camera = false
 where room_mode = 'audio' and allow_camera;

create or replace function public.set_room_mode(p_room uuid, p_mode text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  clean text := case when p_mode = 'camera' then 'camera' else 'audio' end;
begin
  if not public.room_can_moderate(p_room) then
    raise exception 'Solo el anfitrión o un moderador cambia el modo de la sala';
  end if;
  update public.rooms
     set room_mode = clean,
         -- A voice room keeps no camera open; a camera room starts allowing them.
         allow_camera = (clean = 'camera')
   where id = p_room;
  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (
    p_room,
    auth.uid(),
    public.my_display_name(),
    'system',
    case when clean = 'camera'
      then 'La sala pasó a modo multi de cámara'
      else 'La sala pasó a modo multi de audio'
    end
  );
  return clean;
end;
$$;

grant execute on function public.set_room_mode(uuid, text) to authenticated;

-- Opening a room can name its mode from the start.
drop function if exists public.open_room(text, text, text, text, integer);

create or replace function public.open_room(
  p_title text,
  p_cover text default 'palace',
  p_country text default 'US',
  p_layout text default null,
  p_seats integer default 10,
  p_mode text default 'audio'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
  clean text;
  existing uuid;
  clean_layout text := nullif(btrim(coalesce(p_layout, '')), '');
  places integer;
  mode text := case when p_mode = 'camera' then 'camera' else 'audio' end;
begin
  if uid is null then raise exception 'Inicia sesión para abrir una sala'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 7));
  select r.id into existing
    from public.rooms r
   where r.host_id = uid and r.closed_at is null
   order by r.created_at desc
   limit 1;
  if existing is not null then
    return existing;
  end if;
  if clean_layout is not null and clean_layout not in (
    'square4', 'square6', 'square10',
    'classic', 'neon', 'stage', 'diamond', 'galaxy', 'circle', 'heart', 'amphitheater', 'teams'
  ) then
    clean_layout := null;
  end if;
  places := greatest(4, least(20, coalesce(p_seats, 10)));
  clean := left(coalesce(nullif(btrim(p_title), ''), 'Mi sala'), 60);
  insert into public.rooms (slug, title, host_id, host_name, country, cover, max_seats, layout, room_mode, allow_camera)
  values (
    lower(regexp_replace(clean, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 6),
    clean,
    uid,
    public.my_display_name(),
    case when p_country in ('US', 'ES', 'MX', 'AR', 'CO') then p_country else 'US' end,
    case when p_cover in ('palace', 'pool', 'terrace') then p_cover else 'palace' end,
    places,
    clean_layout,
    mode,
    (mode = 'camera')
  )
  returning id into new_id;
  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (new_id, uid, public.my_display_name(), 'welcome', 'Bienvenido a la sala. Respeta a los demás. Nada de contenido para adultos, apuestas ni política.');
  return new_id;
end;
$$;

grant execute on function public.open_room(text, text, text, text, integer, text) to authenticated;
