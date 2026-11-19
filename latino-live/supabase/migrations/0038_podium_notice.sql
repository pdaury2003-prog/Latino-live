-- The room hears when it climbs onto the day's podium. The notice is written
-- by the database, so it lands in the chat even if nobody has the app open,
-- and only once per better place each day.

create table if not exists public.rank_notices (
  room_id uuid not null references public.rooms (id) on delete cascade,
  day date not null,
  best_place integer not null,
  primary key (room_id, day)
);

alter table public.rank_notices enable row level security;

/** The room's place today, using the same score the podium shows. */
create or replace function public.room_day_place(p_room uuid)
returns integer
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
  ),
  scored as (
    select r.id,
           coalesce(gifts.gold, 0) + coalesce(wins.total, 0) * 2000 as score,
           r.created_at
      from public.rooms r
      left join gifts on gifts.room_id = r.id
      left join wins on wins.room_id = r.id
     where r.closed_at is null
  ),
  ranked as (
    select id, row_number() over (order by score desc, created_at desc) as place
      from scored
     where score > 0
  )
  select coalesce((select place from ranked where id = p_room), 0)::integer;
$$;

grant execute on function public.room_day_place(uuid) to authenticated;

/**
 * Writes the notice once the room reaches a better place on the podium. A room
 * that was third and is now first hears both, because each is real news; it
 * never hears the same place twice.
 */
create or replace function public.announce_podium(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  place integer;
  best integer;
  today date := current_date;
  title text;
  body text;
begin
  place := public.room_day_place(p_room);
  if place < 1 or place > 3 then return; end if;

  select r.best_place into best from public.rank_notices r
   where r.room_id = p_room and r.day = today;
  if best is not null and place >= best then return; end if;

  insert into public.rank_notices (room_id, day, best_place)
  values (p_room, today, place)
  on conflict (room_id, day) do update set best_place = least(public.rank_notices.best_place, excluded.best_place);

  select coalesce(nullif(btrim(r.title), ''), 'Tu sala') into title from public.rooms r where r.id = p_room;
  body := case place
    when 1 then '¡' || title || ' es la número 1 del podio de hoy! La sala que más brilla ahora mismo.'
    when 2 then '¡' || title || ' subió al puesto 2 del podio de hoy! Sigue recibiendo diamantes.'
    else '¡' || title || ' entró al podio de hoy en el puesto 3! Un regalo más y sube.'
  end;

  insert into public.room_messages (room_id, user_id, author, kind, body)
  values (p_room, null, 'Podio', 'system', body);
end;
$$;

grant execute on function public.announce_podium(uuid) to authenticated;

/** Every gift can lift its room onto the podium. */
create or replace function public.podium_after_gift()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.announce_podium(new.room_id);
  return new;
end;
$$;

drop trigger if exists podium_after_gift on public.room_gifts;
create trigger podium_after_gift
  after insert on public.room_gifts
  for each row execute function public.podium_after_gift();

/** A battle win also lifts the room, so the same notice follows. */
create or replace function public.podium_after_battle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'finished' and new.winner is not null then
    perform public.announce_podium(new.room_a);
    perform public.announce_podium(new.room_b);
  end if;
  return new;
end;
$$;

drop trigger if exists podium_after_battle on public.pk_battles;
create trigger podium_after_battle
  after update of status on public.pk_battles
  for each row execute function public.podium_after_battle();
