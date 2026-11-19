-- The photo the host puts on the room is the room's own picture: the daily
-- podium shows that same photo, so the ranking looks like the rooms it ranks.

drop function if exists public.room_ranking(integer);

create or replace function public.room_ranking(p_limit integer default 10)
returns table (
  room_id uuid, title text, host_name text, cover text,
  photo_path text, gold bigint, pk_wins bigint, score numeric
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
  )
  select r.id, r.title, r.host_name, r.cover, r.background_path,
         coalesce(gifts.gold, 0), coalesce(wins.total, 0),
         (coalesce(gifts.gold, 0) + coalesce(wins.total, 0) * 2000)::numeric
    from public.rooms r
    left join gifts on gifts.room_id = r.id
    left join wins on wins.room_id = r.id
   where r.closed_at is null
   order by 8 desc, r.created_at desc
   limit greatest(1, least(50, coalesce(p_limit, 10)));
$$;

grant execute on function public.room_ranking(integer) to authenticated;
