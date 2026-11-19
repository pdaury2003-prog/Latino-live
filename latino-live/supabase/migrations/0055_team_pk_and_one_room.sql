-- Two things people asked for in the room:
--   1. A PK inside the room itself: the seated people split into Equipo Rojo
--      and Equipo Azul, and every gift a seated person sends adds its diamonds
--      to their own team.
--   2. One account, one room: taking a seat somewhere gives up the seat it
--      held anywhere else, so nobody is in two rooms at the same time.

create table if not exists public.team_pk_battles (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  score_red bigint not null default 0,
  score_blue bigint not null default 0,
  duration_seconds integer not null default 180 check (duration_seconds between 60 and 1800),
  status text not null default 'live' check (status in ('live', 'finished')),
  winner text check (winner in ('red', 'blue')),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  ended_at timestamptz,
  created_by uuid
);

create index if not exists team_pk_battles_room on public.team_pk_battles (room_id, status, ends_at);

alter table public.team_pk_battles enable row level security;

drop policy if exists "team battles are readable" on public.team_pk_battles;
create policy "team battles are readable" on public.team_pk_battles
  for select to authenticated using (true);

/**
 * The seat decides the team: the first half of the places is red, the rest is
 * blue. A gift from someone sitting down counts for their own team; a gift to
 * a seated person counts for that person's team, so the audience can cheer too.
 */
create or replace function public.team_pk_apply_gift()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  battle public.team_pk_battles;
  capacity integer;
  split integer;
  seat_no integer;
begin
  select * into battle
    from public.team_pk_battles
   where room_id = new.room_id
     and status = 'live'
     and new.created_at >= started_at
     and new.created_at <= ends_at
   limit 1;
  if battle.id is null then return new; end if;

  select max_seats into capacity from public.rooms where id = new.room_id;
  split := (coalesce(capacity, 10) + 1) / 2;

  select seat_no into seat_no from public.room_seats
   where room_id = new.room_id and user_id = new.sender_id;
  if seat_no is null and new.recipient_id is not null then
    select seat_no into seat_no from public.room_seats
     where room_id = new.room_id and user_id = new.recipient_id;
  end if;
  if seat_no is null then return new; end if;

  if seat_no <= split then
    update public.team_pk_battles set score_red = score_red + new.cost where id = battle.id;
  else
    update public.team_pk_battles set score_blue = score_blue + new.cost where id = battle.id;
  end if;
  return new;
end;
$$;

drop trigger if exists team_pk_apply_gift on public.room_gifts;
create trigger team_pk_apply_gift
  after insert on public.room_gifts
  for each row execute function public.team_pk_apply_gift();

/** The host splits the room into two teams for a few minutes. */
create or replace function public.start_team_pk(p_room uuid, p_seconds integer default 180)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  mine public.rooms;
  seconds integer := greatest(60, least(1800, coalesce(p_seconds, 180)));
  split integer;
  red_count integer;
  blue_count integer;
  battle uuid;
begin
  select * into mine from public.rooms where id = p_room;
  if mine.id is null then raise exception 'La sala ya no existe'; end if;
  if mine.host_id is distinct from auth.uid() then raise exception 'Solo el anfitrión inicia el PK de equipos'; end if;
  if mine.closed_at is not null then raise exception 'La sala está cerrada'; end if;
  if exists (
    select 1 from public.team_pk_battles
    where room_id = p_room and status = 'live' and ends_at > now()
  ) then raise exception 'Ya hay un PK de equipos en curso'; end if;
  if exists (
    select 1 from public.pk_battles
    where status = 'live' and ends_at > now() and p_room in (room_a, room_b)
  ) then raise exception 'Termina primero la batalla entre salas'; end if;

  split := (mine.max_seats + 1) / 2;
  select count(*) filter (where seat_no <= split),
         count(*) filter (where seat_no > split)
    into red_count, blue_count
    from public.room_seats where room_id = p_room;
  if red_count = 0 or blue_count = 0 then
    raise exception 'Necesitas al menos una persona en cada equipo para empezar';
  end if;

  insert into public.team_pk_battles (room_id, duration_seconds, ends_at, created_by)
  values (p_room, seconds, now() + make_interval(secs => seconds), auth.uid())
  returning id into battle;

  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (p_room, auth.uid(), public.my_display_name(), 'system',
          'PK de equipos: Equipo Rojo (asientos 1–' || split || ') contra Equipo Azul (asientos '
          || (split + 1) || '–' || mine.max_seats || ') · ' || (seconds / 60) || ' min');
  return battle;
end;
$$;

grant execute on function public.start_team_pk(uuid, integer) to authenticated;

/**
 * The room's team battle: the live one, or the last result. Reading is also
 * what settles an expired battle, so no phone has to stay awake for it.
 */
create or replace function public.team_pk_for_room(p_room uuid)
returns table (
  id uuid, room_id uuid, score_red bigint, score_blue bigint, status text, winner text,
  ends_at timestamptz, started_at timestamptz, duration_seconds integer,
  split_seat integer, max_seats integer
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  battle public.team_pk_battles;
  capacity integer;
  split integer;
  settled boolean := false;
  changed integer := 0;
begin
  select * into battle from public.team_pk_battles
   where room_id = p_room
   order by (status = 'live') desc, started_at desc
   limit 1;
  if battle.id is null then return; end if;

  if battle.status = 'live' and battle.ends_at <= now() then
    update public.team_pk_battles
       set status = 'finished', ended_at = now(),
           winner = case when score_red > score_blue then 'red'
                         when score_blue > score_red then 'blue' else null end
     where id = battle.id and status = 'live';
    get diagnostics changed = row_count;
    settled := changed > 0;
    select * into battle from public.team_pk_battles where id = battle.id;
  end if;

  if settled then
    insert into public.room_messages (room_id, user_id, author, kind, body)
    values (battle.room_id, null, 'Sala', 'system',
            case
              when battle.winner is null then 'El PK de equipos terminó en empate · '
              when battle.winner = 'red' then 'Ganó el Equipo Rojo · '
              else 'Ganó el Equipo Azul · '
            end || battle.score_red || ' a ' || battle.score_blue);
  end if;

  select max_seats into capacity from public.rooms where id = p_room;
  capacity := coalesce(capacity, 10);
  split := (capacity + 1) / 2;

  return query
    select battle.id, battle.room_id, battle.score_red, battle.score_blue, battle.status,
           battle.winner, battle.ends_at, battle.started_at, battle.duration_seconds,
           split, capacity;
end;
$$;

grant execute on function public.team_pk_for_room(uuid) to authenticated;

/** The host closes the team battle early; the winner is settled here. */
create or replace function public.finish_team_pk(p_battle uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  battle public.team_pk_battles;
  host uuid;
  changed integer := 0;
begin
  select * into battle from public.team_pk_battles where id = p_battle;
  if battle.id is null then return; end if;
  select host_id into host from public.rooms where id = battle.room_id;
  if host is distinct from auth.uid() and battle.ends_at > now() then
    raise exception 'Solo el anfitrión cierra el PK antes de tiempo';
  end if;
  update public.team_pk_battles
     set status = 'finished', ended_at = now(),
         winner = case when score_red > score_blue then 'red'
                       when score_blue > score_red then 'blue' else null end
   where id = p_battle and status = 'live'
  ;
  get diagnostics changed = row_count;
  if changed > 0 then
    select * into battle from public.team_pk_battles where id = p_battle;
    insert into public.room_messages (room_id, user_id, author, kind, body)
    values (battle.room_id, null, 'Sala', 'system',
            case
              when battle.winner is null then 'El PK de equipos terminó en empate · '
              when battle.winner = 'red' then 'Ganó el Equipo Rojo · '
              else 'Ganó el Equipo Azul · '
            end || battle.score_red || ' a ' || battle.score_blue);
  end if;
end;
$$;

grant execute on function public.finish_team_pk(uuid) to authenticated;

-- One room cannot run both kinds of battle at once: the gifts would count twice.
create or replace function public.start_pk(p_room uuid, p_rival uuid, p_seconds integer default 180)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  mine public.rooms;
  rival public.rooms;
  seconds integer := greatest(30, least(1800, coalesce(p_seconds, 180)));
  battle uuid;
begin
  select * into mine from public.rooms where id = p_room;
  if mine.id is null then raise exception 'La sala ya no existe'; end if;
  if mine.host_id <> auth.uid() then raise exception 'Solo el anfitrión inicia una batalla PK'; end if;
  if mine.closed_at is not null then raise exception 'Tu sala está cerrada'; end if;
  if p_rival = p_room then raise exception 'Elige otra sala'; end if;
  select * into rival from public.rooms where id = p_rival;
  if rival.id is null then raise exception 'Esa sala ya no existe'; end if;
  if rival.closed_at is not null then raise exception 'Esa sala está cerrada'; end if;
  if exists (
    select 1 from public.pk_battles
    where status = 'live' and ends_at > now()
      and (room_a in (p_room, p_rival) or room_b in (p_room, p_rival))
  ) then raise exception 'Una de las salas ya está en batalla'; end if;
  if exists (
    select 1 from public.team_pk_battles
    where status = 'live' and ends_at > now() and room_id = p_room
  ) then raise exception 'Termina primero el PK de equipos'; end if;

  insert into public.pk_battles (room_a, room_b, host_a, host_b, duration_seconds, ends_at, created_by)
  values (p_room, p_rival, mine.host_id, rival.host_id, seconds, now() + make_interval(secs => seconds), auth.uid())
  returning id into battle;

  insert into public.room_messages (room_id, user_id, author, kind, body)
  values
    (p_room, auth.uid(), public.my_display_name(), 'system',
     'Batalla PK contra ' || rival.title || ' · ' || (seconds / 60) || ' minutos'),
    (p_rival, auth.uid(), public.my_display_name(), 'system',
     'Batalla PK contra ' || mine.title || ' · ' || (seconds / 60) || ' minutos');
  return battle;
end;
$$;

/**
 * One account, one room. Sitting down here releases every other seat the
 * account holds, and the room it leaves says so, so the people there are not
 * left with an avatar that never speaks again.
 */
drop function if exists public.take_seat(uuid, integer);

create or replace function public.take_seat(p_room uuid, p_seat integer)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  capacity integer;
  taken uuid;
  previous record;
  previous_title text;
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

  for previous in
    select s.room_id, r.title
      from public.room_seats s
      join public.rooms r on r.id = s.room_id
     where s.user_id = uid and s.room_id <> p_room
  loop
    delete from public.room_seats where room_id = previous.room_id and user_id = uid;
    insert into public.room_messages (room_id, user_id, author, kind, body)
    values (previous.room_id, uid, public.my_display_name(), 'system',
            public.my_display_name() || ' entró en otra sala');
    previous_title := previous.title;
  end loop;

  delete from public.room_seats where room_id = p_room and user_id = uid;
  insert into public.room_seats (room_id, seat_no, user_id, display_name, avatar_url)
  values (p_room, p_seat, uid, public.my_display_name(), (select avatar_url from public.profiles where id = uid))
  on conflict (room_id, seat_no) do update
    set user_id = excluded.user_id,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        muted = false,
        speaking = false;
  return previous_title;
end;
$$;

grant execute on function public.take_seat(uuid, integer) to authenticated;

/** Where the account is sitting right now: the one room, or none. */
create or replace function public.my_current_room()
returns table (room_id uuid, title text, slug text)
language sql
security definer
set search_path to 'public'
as $$
  select s.room_id, r.title, r.slug
    from public.room_seats s
    join public.rooms r on r.id = s.room_id
   where s.user_id = auth.uid()
   limit 1;
$$;

grant execute on function public.my_current_room() to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.team_pk_battles;
exception
  when duplicate_object then null;
end $$;
