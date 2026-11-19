-- A function that returns a table names its output columns, and those names
-- shadow the table's own columns inside the body. Every column is qualified
-- here so the room's team battle can be read without ambiguity.

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
  select * into battle
    from public.team_pk_battles b
   where b.room_id = p_room
   order by (b.status = 'live') desc, b.started_at desc
   limit 1;
  if battle.id is null then return; end if;

  if battle.status = 'live' and battle.ends_at <= now() then
    update public.team_pk_battles b
       set status = 'finished', ended_at = now(),
           winner = case when b.score_red > b.score_blue then 'red'
                         when b.score_blue > b.score_red then 'blue' else null end
     where b.id = battle.id and b.status = 'live';
    get diagnostics changed = row_count;
    settled := changed > 0;
    select * into battle from public.team_pk_battles b where b.id = battle.id;
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

  select r.max_seats into capacity from public.rooms r where r.id = p_room;
  capacity := coalesce(capacity, 10);
  split := (capacity + 1) / 2;

  return query
    select b.id, b.room_id, b.score_red, b.score_blue, b.status, b.winner,
           b.ends_at, b.started_at, b.duration_seconds, split, capacity
      from public.team_pk_battles b
     where b.id = battle.id;
end;
$$;
