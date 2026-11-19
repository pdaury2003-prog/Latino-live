-- Account levels grow by themselves: people earn experience by talking,
-- hosting and sending gifts, and the level follows the experience.

alter table public.profiles
  add column if not exists xp integer not null default 0;

comment on column public.profiles.xp is 'Experience earned in the rooms; the level follows it.';

create or replace function public.level_for_xp(p_xp integer)
returns integer
language sql
immutable
as $$
  -- Level 2 at 100 XP, then each level costs a bit more; 99 is the ceiling.
  select least(99, greatest(1, 1 + floor(sqrt(greatest(0, p_xp)::numeric / 50))::integer));
$$;

-- Experience already earned before this change: keep everybody at their level.
update public.profiles
  set xp = greatest(xp, (power(greatest(coalesce(level, 1) - 1, 0), 2) * 50)::integer)
  where xp = 0 and coalesce(level, 1) > 1;

create or replace function public.add_xp(p_user uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_xp integer;
begin
  if p_user is null or coalesce(p_amount, 0) <= 0 then return; end if;
  update public.profiles
    set xp = xp + p_amount
    where id = p_user
    returning xp into next_xp;
  if next_xp is null then return; end if;
  update public.profiles
    set level = greatest(coalesce(level, 1), public.level_for_xp(next_xp))
    where id = p_user;
end;
$$;
revoke all on function public.add_xp(uuid, integer) from public;
grant execute on function public.add_xp(uuid, integer) to service_role;

-- Talking in a room earns a little experience.
create or replace function public.xp_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null and new.kind = 'user' then
    perform public.add_xp(new.user_id, 5);
  end if;
  return new;
end;
$$;

drop trigger if exists award_xp_on_message on public.room_messages;
create trigger award_xp_on_message
  after insert on public.room_messages
  for each row execute function public.xp_from_message();

-- Sending a gift earns the sender, and more so the person who receives it.
create or replace function public.xp_from_gift()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  host uuid;
  payee uuid;
begin
  if new.sender_id is not null then
    perform public.add_xp(new.sender_id, greatest(1, floor(new.cost / 10.0)::integer));
  end if;
  if new.recipient_id is not null then
    payee := new.recipient_id;
  else
    select host_id into payee from public.rooms where id = new.room_id;
  end if;
  if payee is not null and payee <> new.sender_id then
    perform public.add_xp(payee, greatest(1, floor(new.cost / 5.0)::integer));
  end if;
  return new;
end;
$$;

drop trigger if exists award_xp_on_gift on public.room_gifts;
create trigger award_xp_on_gift
  after insert on public.room_gifts
  for each row execute function public.xp_from_gift();
