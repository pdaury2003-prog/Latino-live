-- Two rooms can face each other for a few minutes: every gift sent in either
-- room adds its diamonds to that side, and the room with the most at the end
-- wins. The same tables feed the daily ranking of rooms.

create table if not exists public.pk_battles (
  id uuid primary key default gen_random_uuid(),
  room_a uuid not null references public.rooms (id) on delete cascade,
  room_b uuid not null references public.rooms (id) on delete cascade,
  host_a uuid,
  host_b uuid,
  score_a bigint not null default 0,
  score_b bigint not null default 0,
  duration_seconds integer not null default 180 check (duration_seconds between 30 and 1800),
  status text not null default 'live' check (status in ('live', 'finished')),
  winner uuid,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  ended_at timestamptz,
  created_by uuid
);

create index if not exists pk_battles_rooms on public.pk_battles (room_a, room_b);
create index if not exists pk_battles_live on public.pk_battles (status, ends_at);

alter table public.pk_battles enable row level security;

drop policy if exists "pk battles are readable" on public.pk_battles;
create policy "pk battles are readable" on public.pk_battles
  for select to authenticated using (true);

/** Every gift sent during a battle counts for that room's side. */
create or replace function public.pk_apply_gift()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  touched uuid;
begin
  update public.pk_battles
     set score_a = score_a + new.cost
   where status = 'live'
     and room_a = new.room_id
     and new.created_at >= started_at
     and new.created_at <= ends_at
  returning id into touched;
  if touched is null then
    update public.pk_battles
       set score_b = score_b + new.cost
     where status = 'live'
       and room_b = new.room_id
       and new.created_at >= started_at
       and new.created_at <= ends_at;
  end if;
  return new;
end;
$$;

drop trigger if exists pk_apply_gift on public.room_gifts;
create trigger pk_apply_gift
  after insert on public.room_gifts
  for each row execute function public.pk_apply_gift();

/** Starts a battle between the host's room and another open room. */
create or replace function public.start_pk(p_room uuid, p_rival uuid, p_seconds integer default 180)
returns uuid
language plpgsql
security definer
set search_path = public
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

grant execute on function public.start_pk(uuid, uuid, integer) to authenticated;

/** The room's battle: the live one, or the last result shown for a while. */
create or replace function public.pk_for_room(p_room uuid)
returns table (
  id uuid, room_a uuid, room_b uuid, title_a text, title_b text,
  score_a bigint, score_b bigint, status text, winner uuid,
  ends_at timestamptz, duration_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  battle public.pk_battles;
begin
  select * into battle from public.pk_battles
   where room_a = p_room or room_b = p_room
   order by (status = 'live') desc, started_at desc
   limit 1;
  if battle.id is null then return; end if;

  -- Reading is also what closes an expired battle: no timer has to survive a
  -- phone going to sleep.
  if battle.status = 'live' and battle.ends_at <= now() then
    update public.pk_battles
       set status = 'finished', ended_at = now(),
           winner = case when score_a > score_b then room_a when score_b > score_a then room_b else null end
     where id = battle.id
    returning * into battle;
  end if;

  return query
    select battle.id, battle.room_a, battle.room_b, a.title, b.title,
           battle.score_a, battle.score_b, battle.status, battle.winner,
           battle.ends_at, battle.duration_seconds
      from public.rooms a, public.rooms b
     where a.id = battle.room_a and b.id = battle.room_b;
end;
$$;

grant execute on function public.pk_for_room(uuid) to authenticated;

/** The hosts close the battle early or start over; the winner is settled here. */
create or replace function public.finish_pk(p_battle uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  battle public.pk_battles;
begin
  select * into battle from public.pk_battles where id = p_battle;
  if battle.id is null then return; end if;
  if auth.uid() not in (battle.host_a, battle.host_b) and battle.ends_at > now() then
    raise exception 'Solo los anfitriones cierran la batalla antes de tiempo';
  end if;
  update public.pk_battles
     set status = 'finished', ended_at = now(),
         winner = case when score_a > score_b then room_a when score_b > score_a then room_b else null end
   where id = p_battle and status = 'live';
end;
$$;

grant execute on function public.finish_pk(uuid) to authenticated;

/** Today's best rooms: diamonds received plus a bonus for each PK won. */
create or replace function public.room_ranking(p_limit integer default 10)
returns table (room_id uuid, title text, host_name text, cover text, gold bigint, pk_wins bigint, score numeric)
language sql
security definer
set search_path = public
as $$
  with since as (select date_trunc('day', now()) as at),
  gifts as (
    select g.room_id, sum(g.cost)::bigint as gold
      from public.room_gifts g, since
     where g.created_at >= since.at
     group by g.room_id
  ),
  wins as (
    select case when b.winner = b.room_a then b.room_a else b.room_b end as room_id,
           count(*)::bigint as total
      from public.pk_battles b, since
     where b.status = 'finished' and b.winner is not null and b.ended_at >= since.at
     group by 1
  )
  select r.id, r.title, r.host_name, r.cover,
         coalesce(gifts.gold, 0), coalesce(wins.total, 0),
         (coalesce(gifts.gold, 0) + coalesce(wins.total, 0) * 2000)::numeric
    from public.rooms r
    left join gifts on gifts.room_id = r.id
    left join wins on wins.room_id = r.id
   where r.closed_at is null
   order by 7 desc, r.created_at desc
   limit greatest(1, least(50, coalesce(p_limit, 10)));
$$;

grant execute on function public.room_ranking(integer) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pk_battles'
  ) then
    alter publication supabase_realtime add table public.pk_battles;
  end if;
end;
$$;
