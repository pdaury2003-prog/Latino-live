-- Who gave the gifts: the seat counter says how many diamonds a person has
-- received today, and this names the people behind them, biggest first.

create or replace function public.room_seat_gift_senders(p_room uuid, p_user uuid)
returns table (
  sender_id uuid,
  sender_name text,
  diamonds_today bigint,
  gifts_today bigint,
  last_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select g.sender_id,
         coalesce(nullif(max(p.display_name), ''), max(g.sender_name), 'Alguien'),
         coalesce(sum(g.cost), 0)::bigint,
         count(*)::bigint,
         max(g.created_at)
    from public.room_gifts g
    left join public.profiles p on p.id = g.sender_id
   where g.room_id = p_room
     and g.recipient_id = p_user
     and g.created_at >= date_trunc('day', now())
   group by g.sender_id, g.sender_name
   order by 3 desc, 5 desc
   limit 12;
$$;

grant execute on function public.room_seat_gift_senders(uuid, uuid) to authenticated;
