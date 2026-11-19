-- The gift trigger read the sender's seat into a variable named like the
-- column, which PostgreSQL refuses as ambiguous. Same rule, one clear name.

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
  sender_seat integer;
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

  select s.seat_no into sender_seat
    from public.room_seats s
   where s.room_id = new.room_id and s.user_id = new.sender_id;
  if sender_seat is null and new.recipient_id is not null then
    select s.seat_no into sender_seat
      from public.room_seats s
     where s.room_id = new.room_id and s.user_id = new.recipient_id;
  end if;
  if sender_seat is null then return new; end if;

  if sender_seat <= split then
    update public.team_pk_battles set score_red = score_red + new.cost where id = battle.id;
  else
    update public.team_pk_battles set score_blue = score_blue + new.cost where id = battle.id;
  end if;
  return new;
end;
$$;
