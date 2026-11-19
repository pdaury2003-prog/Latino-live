-- The seat's counter belongs to the visit, not to the day: it counts the gifts
-- a person has been given since they sat down, and it is zero again the moment
-- they stand up or leave the room. Sitting again starts a new count.

drop function if exists public.room_seat_gifts(uuid);

create or replace function public.room_seat_gifts(p_room uuid)
returns table (
  user_id uuid,
  diamonds bigint,
  gifts bigint
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select s.user_id,
         coalesce(sum(g.cost), 0)::bigint,
         count(g.id)::bigint
    from public.room_seats s
    left join public.room_gifts g
      on g.room_id = s.room_id
     and g.recipient_id = s.user_id
     and g.created_at >= s.joined_at
   where s.room_id = p_room
   group by s.user_id;
$$;

grant execute on function public.room_seat_gifts(uuid) to authenticated;

drop function if exists public.room_seat_gift_senders(uuid, uuid);

/**
 * Who filled a seat's counter during this visit, biggest first. Only gifts
 * that landed after the person sat down are counted.
 */
create or replace function public.room_seat_gift_senders(p_room uuid, p_user uuid)
returns table (
  sender_id uuid,
  sender_name text,
  diamonds bigint,
  gifts bigint,
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
    join public.room_seats s
      on s.room_id = g.room_id
     and s.user_id = g.recipient_id
    left join public.profiles p on p.id = g.sender_id
   where g.room_id = p_room
     and g.recipient_id = p_user
     and g.created_at >= s.joined_at
   group by g.sender_id, g.sender_name
   order by 3 desc, 5 desc
   limit 12;
$$;

grant execute on function public.room_seat_gift_senders(uuid, uuid) to authenticated;
