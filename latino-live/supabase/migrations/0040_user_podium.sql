-- Where the room a person hosts stands on today's podium, so a profile can
-- wear the same TOP frame its room wears in the ranking.

create or replace function public.user_podium(p_user uuid default null)
returns table (
  place integer, room_id uuid, room_title text, photo_path text,
  gold bigint, pk_wins bigint, total_rooms integer
)
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
    select r.id, r.title, r.host_id, r.background_path,
           coalesce(gifts.gold, 0) as gold,
           coalesce(wins.total, 0) as pk_wins,
           (coalesce(gifts.gold, 0) + coalesce(wins.total, 0) * 2000)::numeric as score
      from public.rooms r
      left join gifts on gifts.room_id = r.id
      left join wins on wins.room_id = r.id
     where r.closed_at is null
  ),
  ranked as (
    select s.*, (row_number() over (order by s.score desc, s.id))::integer as place
      from scored s
     where s.score > 0
  )
  select r.place, r.id, r.title, r.background_path, r.gold, r.pk_wins,
         (select count(*)::integer from ranked)
    from ranked r
   where r.host_id = coalesce(p_user, auth.uid())
   limit 1;
$$;

grant execute on function public.user_podium(uuid) to authenticated;
