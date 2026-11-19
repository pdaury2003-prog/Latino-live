-- The battle reader named its output columns like the table's own columns, so
-- the filter "room_a = p_room" was ambiguous and the room never showed its
-- battle. Every table column is named through its alias now.

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
  select b.* into battle from public.pk_battles b
   where b.room_a = p_room or b.room_b = p_room
   order by (b.status = 'live') desc, b.started_at desc
   limit 1;
  if battle.id is null then return; end if;

  -- Reading is also what closes an expired battle: no timer has to survive a
  -- phone going to sleep.
  if battle.status = 'live' and battle.ends_at <= now() then
    update public.pk_battles b
       set status = 'finished', ended_at = now(),
           winner = case when b.score_a > b.score_b then b.room_a when b.score_b > b.score_a then b.room_b else null end
     where b.id = battle.id
    returning b.* into battle;
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
