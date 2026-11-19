-- Blocking: a person you block cannot write you in private, follow you, or see
-- you in their connections, and you can unblock them from Ajustes.

create table if not exists public.profile_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists profile_blocks_blocked_idx on public.profile_blocks (blocked_id);

alter table public.profile_blocks enable row level security;

drop policy if exists blocks_read on public.profile_blocks;
create policy blocks_read on public.profile_blocks for select to authenticated
  using (blocker_id = auth.uid() or blocked_id = auth.uid());

drop policy if exists blocks_write on public.profile_blocks;
create policy blocks_write on public.profile_blocks for insert to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists blocks_delete on public.profile_blocks;
create policy blocks_delete on public.profile_blocks for delete to authenticated
  using (blocker_id = auth.uid());

-- True when either person has blocked the other.
create or replace function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profile_blocks bl
    where (bl.blocker_id = a and bl.blocked_id = b)
       or (bl.blocker_id = b and bl.blocked_id = a)
  );
$$;

grant execute on function public.is_blocked(uuid, uuid) to authenticated;

create or replace function public.block_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Necesitas una cuenta'; end if;
  if p_user = uid then raise exception 'No puedes bloquearte a ti mismo'; end if;
  insert into public.profile_blocks (blocker_id, blocked_id) values (uid, p_user)
  on conflict do nothing;
  -- A block also ends the friendship in both directions.
  delete from public.profile_follows
  where (follower_id = uid and following_id = p_user)
     or (follower_id = p_user and following_id = uid);
end;
$$;

grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.profile_blocks
  where blocker_id = auth.uid() and blocked_id = p_user;
end;
$$;

grant execute on function public.unblock_user(uuid) to authenticated;

-- The people this account blocked, newest first, with their name and photo.
create or replace function public.blocked_profiles()
returns table (user_id uuid, display_name text, avatar_url text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select b.blocked_id, coalesce(p.display_name, 'Cuenta'), p.avatar_url, b.created_at
  from public.profile_blocks b
  left join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

grant execute on function public.blocked_profiles() to authenticated;

-- Private messages stop in both directions once either person blocks the other.
drop policy if exists direct_send on public.direct_messages;
create policy direct_send on public.direct_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.are_friends(sender_id, recipient_id)
    and not public.is_blocked(sender_id, recipient_id)
  );

-- Following is refused while a block stands.
create or replace function public.follow_user(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  now_following boolean;
begin
  if uid is null then raise exception 'Necesitas una cuenta'; end if;
  if p_user = uid then raise exception 'No puedes seguirte a ti mismo'; end if;
  if public.is_blocked(uid, p_user) then raise exception 'No puedes seguir a esta persona'; end if;

  if exists (select 1 from public.profile_follows where follower_id = uid and following_id = p_user) then
    delete from public.profile_follows where follower_id = uid and following_id = p_user;
    now_following := false;
  else
    insert into public.profile_follows (follower_id, following_id) values (uid, p_user)
    on conflict do nothing;
    now_following := true;
  end if;

  return now_following;
end;
$$;

grant execute on function public.follow_user(uuid) to authenticated;
