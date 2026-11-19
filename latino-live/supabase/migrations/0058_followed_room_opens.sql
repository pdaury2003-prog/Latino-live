-- When someone opens a room, the people who follow them hear about it. The
-- opening is recorded once, so the notice still means something if the room
-- closes a minute later, and only followers can read that person's openings.

create table if not exists public.room_open_events (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  host_id uuid not null references auth.users (id) on delete cascade,
  host_name text not null default '',
  room_title text not null,
  room_slug text not null,
  created_at timestamptz not null default now()
);

create index if not exists room_open_events_host on public.room_open_events (host_id, created_at desc);

alter table public.room_open_events enable row level security;

-- A follower reads their own hosts' openings through the function below; the
-- table itself is not browsable, so nobody can map who opened what.
drop policy if exists "room openings are private" on public.room_open_events;

create or replace function public.record_room_open()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.room_open_events (room_id, host_id, host_name, room_title, room_slug)
  select new.id, new.host_id, new.host_name, new.title, new.slug
   where new.host_id is not null;
  return new;
end;
$$;

drop trigger if exists record_room_open on public.rooms;
create trigger record_room_open
  after insert on public.rooms
  for each row execute function public.record_room_open();

/**
 * The rooms the people this account follows opened lately and are still open.
 * A private room is left out: a follower without the code could not enter.
 */
create or replace function public.followed_room_opens(p_limit integer default 20)
returns table (
  id bigint, room_id uuid, room_slug text, room_title text,
  host_id uuid, host_name text, opened_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select e.id, e.room_id, r.slug, r.title, e.host_id,
         coalesce(nullif(p.display_name, ''), e.host_name), e.created_at
    from public.room_open_events e
    join public.rooms r on r.id = e.room_id
    join public.profile_follows f on f.following_id = e.host_id and f.follower_id = auth.uid()
    left join public.profiles p on p.id = e.host_id
   where r.closed_at is null
     and coalesce(r.is_private, false) = false
     and e.created_at > now() - interval '7 days'
   order by e.created_at desc
   limit greatest(1, least(50, coalesce(p_limit, 20)));
$$;

grant execute on function public.followed_room_opens(integer) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.room_open_events;
exception
  when duplicate_object then null;
end $$;
