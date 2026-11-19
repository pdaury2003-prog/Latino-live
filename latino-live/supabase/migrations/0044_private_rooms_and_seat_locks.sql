-- A room can be private, and the host can put a padlock on a seat.

alter table public.rooms add column if not exists is_private boolean not null default false;
alter table public.rooms add column if not exists join_code text;

create table if not exists public.room_seat_locks (
  room_id uuid not null references public.rooms (id) on delete cascade,
  seat_no integer not null check (seat_no > 0),
  locked_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (room_id, seat_no)
);

alter table public.room_seat_locks enable row level security;

drop policy if exists seat_locks_read on public.room_seat_locks;
create policy seat_locks_read on public.room_seat_locks for select
  using (true);

drop policy if exists seat_locks_host_write on public.room_seat_locks;
create policy seat_locks_host_write on public.room_seat_locks for insert to authenticated
  with check (
    exists (select 1 from public.rooms r where r.id = room_id and r.host_id = auth.uid())
  );

drop policy if exists seat_locks_host_delete on public.room_seat_locks;
create policy seat_locks_host_delete on public.room_seat_locks for delete to authenticated
  using (
    exists (select 1 from public.rooms r where r.id = room_id and r.host_id = auth.uid())
  );

/**
 * The host makes the room private (with a short code) or public again.
 * Returns the code it is using, so the host can share it.
 */
create or replace function public.set_room_private(p_room uuid, p_private boolean, p_code text default null)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  host uuid;
  current_code text;
  code text;
begin
  if uid is null then raise exception 'Inicia sesión'; end if;
  select host_id, join_code into host, current_code from public.rooms where id = p_room;
  if host is null then raise exception 'La sala ya no existe'; end if;
  if host <> uid then raise exception 'Solo el dueño de la sala puede cambiarlo'; end if;

  if p_private then
    code := coalesce(nullif(trim(p_code), ''), current_code, upper(substr(md5(random()::text), 1, 6)));
    update public.rooms set is_private = true, join_code = code where id = p_room;
    return code;
  end if;

  update public.rooms set is_private = false, join_code = null where id = p_room;
  return null;
end;
$$;

/** True when the words match the room's own code; the code is never returned. */
create or replace function public.room_code_matches(p_room uuid, p_code text)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select upper(trim(join_code)) = upper(trim(p_code)) from public.rooms
      where id = p_room and is_private and join_code is not null),
    false);
$$;

/** The host puts a padlock on a seat, or takes it off. */
create or replace function public.set_seat_lock(p_room uuid, p_seat integer, p_locked boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  host uuid;
begin
  if uid is null then raise exception 'Inicia sesión'; end if;
  select host_id into host from public.rooms where id = p_room;
  if host is null then raise exception 'La sala ya no existe'; end if;
  if host <> uid then raise exception 'Solo el dueño de la sala puede cerrar asientos'; end if;

  if p_locked then
    insert into public.room_seat_locks (room_id, seat_no, locked_by)
    values (p_room, p_seat, uid)
    on conflict (room_id, seat_no) do nothing;
    -- A locked seat cannot stay taken.
    delete from public.room_seats where room_id = p_room and seat_no = p_seat;
  else
    delete from public.room_seat_locks where room_id = p_room and seat_no = p_seat;
  end if;
end;
$$;

/**
 * Sitting down now also respects the padlock. The check lives here, not in the
 * app, so no client can slip into a locked seat.
 */
create or replace function public.take_seat(p_room uuid, p_seat integer)
returns void
language plpgsql
security definer
set search_path to 'public'
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
  if exists (select 1 from public.room_seat_locks where room_id = p_room and seat_no = p_seat) then
    raise exception 'Ese asiento tiene candado';
  end if;
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

grant execute on function public.set_room_private(uuid, boolean, text) to authenticated;
grant execute on function public.room_code_matches(uuid, text) to anon, authenticated;
grant execute on function public.set_seat_lock(uuid, integer, boolean) to authenticated;
