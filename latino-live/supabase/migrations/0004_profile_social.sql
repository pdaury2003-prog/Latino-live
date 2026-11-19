-- Follows and profile visits behind the member card: following, friends
-- (mutual follows) and unique visitors, all counted from real rows.

create table if not exists public.profile_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists profile_follows_following_idx on public.profile_follows (following_id);

create table if not exists public.profile_visits (
  profile_id uuid not null references auth.users (id) on delete cascade,
  visitor_id uuid not null references auth.users (id) on delete cascade,
  visits integer not null default 1 check (visits > 0),
  last_visit timestamptz not null default now(),
  primary key (profile_id, visitor_id),
  check (profile_id <> visitor_id)
);

alter table public.profile_follows enable row level security;
alter table public.profile_visits enable row level security;

drop policy if exists follows_read on public.profile_follows;
create policy follows_read on public.profile_follows for select to authenticated using (true);

drop policy if exists visits_read on public.profile_visits;
create policy visits_read on public.profile_visits for select to authenticated using (true);

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
  if uid is null then raise exception 'Inicia sesión'; end if;
  if p_user = uid then raise exception 'No puedes seguirte a ti mismo'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'Ese perfil no existe'; end if;
  if exists (select 1 from public.profile_follows where follower_id = uid and following_id = p_user) then
    delete from public.profile_follows where follower_id = uid and following_id = p_user;
    now_following := false;
  else
    insert into public.profile_follows (follower_id, following_id) values (uid, p_user);
    now_following := true;
  end if;
  return now_following;
end;
$$;

create or replace function public.record_profile_visit(p_profile uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or p_profile = uid then return; end if;
  insert into public.profile_visits (profile_id, visitor_id, visits, last_visit)
  values (p_profile, uid, 1, now())
  on conflict (profile_id, visitor_id)
  do update set visits = public.profile_visits.visits + 1, last_visit = now();
end;
$$;

create or replace function public.profile_stats(p_profile uuid)
returns table (following integer, friends integer, visitors integer, is_following boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from public.profile_follows f where f.follower_id = p_profile),
    (select count(*)::int
       from public.profile_follows a
       join public.profile_follows b on b.follower_id = a.following_id and b.following_id = a.follower_id
      where a.follower_id = p_profile),
    (select count(*)::int from public.profile_visits v where v.profile_id = p_profile),
    exists (select 1 from public.profile_follows f where f.follower_id = auth.uid() and f.following_id = p_profile);
$$;

grant execute on function public.follow_user(uuid) to authenticated;
grant execute on function public.record_profile_visit(uuid) to authenticated;
grant execute on function public.profile_stats(uuid) to authenticated;
