-- Each seat shows what its person has received: how many gifts landed on them
-- in this room and how many diamonds those gifts were worth. The count is for
-- today, like the room ranking, and every phone reads the same numbers.

create or replace function public.room_seat_gifts(p_room uuid)
returns table (
  user_id uuid,
  diamonds_today bigint,
  gifts_today bigint,
  diamonds_total bigint
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select g.recipient_id,
         coalesce(sum(g.cost) filter (where g.created_at >= date_trunc('day', now())), 0)::bigint,
         count(*) filter (where g.created_at >= date_trunc('day', now()))::bigint,
         coalesce(sum(g.cost), 0)::bigint
    from public.room_gifts g
   where g.room_id = p_room
     and g.recipient_id is not null
   group by g.recipient_id;
$$;

grant execute on function public.room_seat_gifts(uuid) to authenticated;
