-- The room DJ: a personal music library, a playlist of ten songs per room,
-- one shared playback state (song, pause, position, volume) and the person the
-- host put in charge of the music.

create table if not exists public.dj_tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  storage_path text not null,
  duration_ms integer not null default 0 check (duration_ms between 0 and 1800000),
  created_at timestamptz not null default now()
);

create index if not exists dj_tracks_owner_idx on public.dj_tracks (user_id, created_at desc);

create table if not exists public.room_playlist (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  track_id uuid not null references public.dj_tracks (id) on delete cascade,
  added_by uuid not null references auth.users (id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (room_id, track_id)
);

create index if not exists room_playlist_room_idx on public.room_playlist (room_id, position, created_at);

create table if not exists public.room_playback (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  track_id uuid references public.dj_tracks (id) on delete set null,
  playing boolean not null default false,
  position_ms integer not null default 0 check (position_ms >= 0),
  started_at timestamptz not null default now(),
  volume numeric not null default 0.8 check (volume >= 0 and volume <= 1),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.room_dj (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  assigned_by uuid references auth.users (id) on delete set null,
  assigned_at timestamptz not null default now()
);

alter table public.dj_tracks enable row level security;
alter table public.room_playlist enable row level security;
alter table public.room_playback enable row level security;
alter table public.room_dj enable row level security;

drop policy if exists dj_tracks_read on public.dj_tracks;
create policy dj_tracks_read on public.dj_tracks for select to authenticated using (true);

drop policy if exists dj_tracks_own on public.dj_tracks;
create policy dj_tracks_own on public.dj_tracks for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists dj_tracks_delete_own on public.dj_tracks;
create policy dj_tracks_delete_own on public.dj_tracks for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists room_playlist_read on public.room_playlist;
create policy room_playlist_read on public.room_playlist for select to authenticated using (true);

drop policy if exists room_playback_read on public.room_playback;
create policy room_playback_read on public.room_playback for select to authenticated using (true);

drop policy if exists room_dj_read on public.room_dj;
create policy room_dj_read on public.room_dj for select to authenticated using (true);

/** The host, a moderator or the person the host named may change the music. */
create or replace function public.room_can_dj(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.room_is_host(p_room)
    or public.room_can_moderate(p_room)
    or exists (select 1 from public.room_dj d where d.room_id = p_room and d.user_id = auth.uid());
$$;

grant execute on function public.room_can_dj(uuid) to authenticated;

/** Saves one song in the person's own DJ library. */
create or replace function public.save_dj_track(p_title text, p_path text, p_duration_ms integer default 0)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean text := left(btrim(coalesce(p_title, '')), 80);
  new_id uuid;
begin
  if uid is null then raise exception 'Inicia sesión para guardar música'; end if;
  if clean = '' then raise exception 'La música necesita un nombre'; end if;
  if p_path is null or p_path = '' then raise exception 'Falta el archivo de la música'; end if;
  if (storage.foldername(p_path))[1] <> uid::text then raise exception 'Esa música no es tuya'; end if;
  insert into public.dj_tracks (user_id, title, storage_path, duration_ms)
  values (uid, clean, p_path, greatest(0, least(1800000, coalesce(p_duration_ms, 0))))
  returning id into new_id;
  return new_id;
end;
$$;

grant execute on function public.save_dj_track(text, text, integer) to authenticated;

create or replace function public.delete_dj_track(p_track uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  delete from public.dj_tracks where id = p_track and user_id = auth.uid();
end;
$$;

grant execute on function public.delete_dj_track(uuid) to authenticated;

/** Adds one of the person's saved songs to the room, ten songs at most. */
create or replace function public.add_room_track(p_room uuid, p_track uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owner uuid;
  total integer;
  next_position integer;
begin
  if uid is null then raise exception 'Inicia sesión para compartir música'; end if;
  if not exists (select 1 from public.rooms where id = p_room and closed_at is null) then
    raise exception 'La sala ya no está abierta';
  end if;
  select user_id into owner from public.dj_tracks where id = p_track;
  if owner is null then raise exception 'Esa música ya no existe'; end if;
  if owner <> uid then raise exception 'Solo puedes compartir tu propia música'; end if;
  if exists (select 1 from public.room_playlist where room_id = p_room and track_id = p_track) then
    raise exception 'Esa música ya está en la playlist de la sala';
  end if;
  select count(*) into total from public.room_playlist where room_id = p_room;
  if total >= 10 then
    raise exception 'La playlist de la sala ya tiene 10 músicas. Quita una para añadir otra.';
  end if;
  select coalesce(max(position), 0) + 1 into next_position from public.room_playlist where room_id = p_room;
  insert into public.room_playlist (room_id, track_id, added_by, position)
  values (p_room, p_track, uid, next_position);
  return total + 1;
end;
$$;

grant execute on function public.add_room_track(uuid, uuid) to authenticated;

create or replace function public.remove_room_track(p_room uuid, p_track uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  mine integer;
begin
  if uid is null then raise exception 'Inicia sesión'; end if;
  if not public.room_can_dj(p_room) then
    select count(*) into mine from public.room_playlist
     where room_id = p_room and track_id = p_track and added_by = uid;
    if mine = 0 then raise exception 'Solo el DJ puede quitar esa música'; end if;
  end if;
  delete from public.room_playlist where room_id = p_room and track_id = p_track;
  update public.room_playback
     set playing = false, track_id = null, position_ms = 0, updated_at = now()
   where room_id = p_room and track_id = p_track;
end;
$$;

grant execute on function public.remove_room_track(uuid, uuid) to authenticated;

/**
 * Plays, pauses or moves a song. Everyone computes the position from the same
 * timestamp, so the room hears the same second on every phone.
 */
create or replace function public.set_room_playback(
  p_room uuid,
  p_track uuid,
  p_playing boolean,
  p_position_ms integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.room_can_dj(p_room) then raise exception 'Solo el DJ de la sala pone la música'; end if;
  if p_track is not null and not exists (select 1 from public.room_playlist where room_id = p_room and track_id = p_track) then
    raise exception 'Esa música no está en la playlist de la sala';
  end if;
  insert into public.room_playback (room_id, track_id, playing, position_ms, started_at, updated_by, updated_at)
  values (p_room, p_track, coalesce(p_playing, false), greatest(0, coalesce(p_position_ms, 0)),
          now(), auth.uid(), now())
  on conflict (room_id) do update
    set track_id = excluded.track_id,
        playing = excluded.playing,
        position_ms = excluded.position_ms,
        started_at = now(),
        updated_by = auth.uid(),
        updated_at = now();
end;
$$;

grant execute on function public.set_room_playback(uuid, uuid, boolean, integer) to authenticated;

/** One volume for the whole room: the DJ sets it, every phone follows. */
create or replace function public.set_room_volume(p_room uuid, p_volume numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.room_can_dj(p_room) then raise exception 'Solo el DJ cambia el volumen'; end if;
  insert into public.room_playback (room_id, volume, updated_by, updated_at)
  values (p_room, greatest(0, least(1, coalesce(p_volume, 0.8))), auth.uid(), now())
  on conflict (room_id) do update
    set volume = excluded.volume, updated_by = auth.uid(), updated_at = now();
end;
$$;

grant execute on function public.set_room_volume(uuid, numeric) to authenticated;

/** Only the host names the DJ, or takes the role back. */
create or replace function public.set_room_dj(p_room uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target text;
begin
  if not public.room_is_host(p_room) then raise exception 'Solo el anfitrión elige al DJ'; end if;
  if p_user is null then
    delete from public.room_dj where room_id = p_room;
    return;
  end if;
  select display_name into target from public.room_seats where room_id = p_room and user_id = p_user;
  if target is null then raise exception 'Esa persona debe estar sentada en la sala'; end if;
  insert into public.room_dj (room_id, user_id, assigned_by, assigned_at)
  values (p_room, p_user, auth.uid(), now())
  on conflict (room_id) do update
    set user_id = excluded.user_id, assigned_by = auth.uid(), assigned_at = now();
  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (p_room, auth.uid(), public.my_display_name(), 'system', target || ' ahora es el DJ de la sala');
end;
$$;

grant execute on function public.set_room_dj(uuid, uuid) to authenticated;

-- Storage: songs up to 35 MB, read by everyone, written by their owner.
insert into storage.buckets (id, name, public, file_size_limit)
values ('room-music', 'room-music', true, 36700160)
on conflict (id) do update set public = true, file_size_limit = 36700160;

drop policy if exists room_music_read on storage.objects;
create policy room_music_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'room-music');

drop policy if exists room_music_insert on storage.objects;
create policy room_music_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'room-music' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists room_music_delete on storage.objects;
create policy room_music_delete on storage.objects for delete to authenticated
  using (bucket_id = 'room-music' and (storage.foldername(name))[1] = auth.uid()::text);

do $$
declare
  t text;
begin
  foreach t in array array['dj_tracks', 'room_playlist', 'room_playback', 'room_dj'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
