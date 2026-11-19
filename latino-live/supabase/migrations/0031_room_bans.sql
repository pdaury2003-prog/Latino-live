-- Being expelled now keeps the person out: the room remembers the expulsion
-- for a day, the app takes them out of the room, and only the host can forgive.

create table if not exists public.room_bans (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  banned_by uuid references auth.users (id) on delete set null,
  banned_at timestamptz not null default now(),
  until timestamptz not null default now() + interval '24 hours',
  primary key (room_id, user_id)
);

alter table public.room_bans enable row level security;

drop policy if exists room_bans_own on public.room_bans;
create policy room_bans_own on public.room_bans
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists room_bans_host on public.room_bans;
create policy room_bans_host on public.room_bans
  for select to authenticated
  using (public.room_is_host(room_id));

comment on table public.room_bans is 'People a host expelled from a room and cannot rejoin until forgiven or the ban expires.';

/** Whether this person is still kept out of the room, with the time left. */
create or replace function public.room_ban_state(p_room uuid, p_user uuid default auth.uid())
returns table (banned boolean, until timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select true, b.until
  from public.room_bans b
  where b.room_id = p_room and b.user_id = p_user and b.until > now()
  limit 1;
$$;
grant execute on function public.room_ban_state(uuid, uuid) to authenticated;

-- One place checks the ban, so seating, writing and speaking all respect it.
create or replace function public.assert_not_banned(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  blocked_until timestamptz;
begin
  select b.until into blocked_until
    from public.room_bans b
   where b.room_id = p_room and b.user_id = auth.uid() and b.until > now();
  if blocked_until is not null then
    raise exception 'El anfitrión te expulsó de esta sala. Podrás volver en %',
      greatest(1, ceil(extract(epoch from (blocked_until - now())) / 3600))::text || ' h';
  end if;
end;
$$;
grant execute on function public.assert_not_banned(uuid) to authenticated;

create or replace function public.take_seat(p_room uuid, p_seat integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  capacity integer;
  taken uuid;
begin
  if uid is null then raise exception 'Inicia sesión para ocupar un asiento'; end if;
  select max_seats into capacity from public.rooms where id = p_room;
  if capacity is null then raise exception 'La sala ya no existe'; end if;
  perform public.assert_not_banned(p_room);
  if p_seat < 1 or p_seat > capacity then raise exception 'Ese asiento no está disponible'; end if;
  select user_id into taken from public.room_seats where room_id = p_room and seat_no = p_seat;
  if taken is not null and taken <> uid then raise exception 'Ese asiento está ocupado'; end if;
  delete from public.room_seats where room_id = p_room and user_id = uid;
  insert into public.room_seats (room_id, seat_no, user_id, display_name, avatar_url)
  values (p_room, p_seat, uid, public.my_display_name(), (select avatar_url from public.profiles where id = uid))
  on conflict (room_id, seat_no) do update
    set user_id = excluded.user_id,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        muted = false,
        speaking = false;
end;
$$;
grant execute on function public.take_seat(uuid, integer) to authenticated;

create or replace function public.post_room_message(p_room uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean text := left(btrim(coalesce(p_body, '')), 400);
begin
  if uid is null then raise exception 'Inicia sesión para escribir'; end if;
  if clean = '' then return; end if;
  if not exists (select 1 from public.rooms where id = p_room) then raise exception 'La sala ya no existe'; end if;
  perform public.assert_not_banned(p_room);
  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (p_room, uid, public.my_display_name(), 'user', clean);
end;
$$;
grant execute on function public.post_room_message(uuid, text) to authenticated;

-- Expelling also writes the ban; a repeated expulsion extends it.
create or replace function public.moderate_member(p_room uuid, p_user uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target text;
  room_host uuid;
begin
  if not public.room_can_moderate(p_room) then raise exception 'Solo el anfitrión o un moderador pueden moderar'; end if;
  if p_user = auth.uid() then raise exception 'No puedes moderarte a ti mismo'; end if;
  select host_id into room_host from public.rooms where id = p_room;
  if p_user = room_host then raise exception 'No puedes moderar al anfitrión'; end if;
  select display_name into target from public.room_seats where room_id = p_room and user_id = p_user;
  if target is null then raise exception 'Esa persona ya no está en la sala'; end if;
  if p_action = 'mute' then
    update public.room_seats set muted = true, speaking = false where room_id = p_room and user_id = p_user;
    insert into public.room_messages (room_id, user_id, author, kind, body)
    values (p_room, auth.uid(), public.my_display_name(), 'system', target || ' fue silenciado por la moderación');
  elsif p_action = 'unmute' then
    update public.room_seats set muted = false, speaking = false where room_id = p_room and user_id = p_user;
    insert into public.room_messages (room_id, user_id, author, kind, body)
    values (p_room, auth.uid(), public.my_display_name(), 'system', target || ' fue activado por la moderación');
  elsif p_action = 'kick' then
    delete from public.room_seats where room_id = p_room and user_id = p_user;
    delete from public.room_moderators where room_id = p_room and user_id = p_user;
    insert into public.room_bans (room_id, user_id, banned_by, banned_at, until)
    values (p_room, p_user, auth.uid(), now(), now() + interval '24 hours')
    on conflict (room_id, user_id) do update
      set banned_at = now(), banned_by = excluded.banned_by, until = excluded.until;
    insert into public.room_messages (room_id, user_id, author, kind, body)
    values (p_room, auth.uid(), public.my_display_name(), 'system', target || ' fue expulsado de la sala por 24 h');
  else
    raise exception 'Acción desconocida';
  end if;
end;
$$;
grant execute on function public.moderate_member(uuid, uuid, text) to authenticated;

-- Only the host may let someone back in before the day is over.
create or replace function public.forgive_room_member(p_room uuid, p_user uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.room_is_host(p_room) then raise exception 'Solo el anfitrión puede perdonar'; end if;
  if p_user is null then
    delete from public.room_bans where room_id = p_room;
  else
    delete from public.room_bans where room_id = p_room and user_id = p_user;
  end if;
end;
$$;
grant execute on function public.forgive_room_member(uuid, uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_bans'
  ) then
    alter publication supabase_realtime add table public.room_bans;
  end if;
end;
$$;
