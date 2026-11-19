-- The card's first figure is the profile's followers, so following someone
-- changes it; "Siguiendo" (who they follow) stays its own honest number.

drop function if exists public.profile_stats(uuid);

create or replace function public.profile_stats(p_profile uuid)
returns table (followers integer, following integer, friends integer, visitors integer, is_following boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from public.profile_follows f where f.following_id = p_profile),
    (select count(*)::int from public.profile_follows f where f.follower_id = p_profile),
    (select count(*)::int
       from public.profile_follows a
       join public.profile_follows b on b.follower_id = a.following_id and b.following_id = a.follower_id
      where a.follower_id = p_profile),
    (select count(*)::int from public.profile_visits v where v.profile_id = p_profile),
    exists (select 1 from public.profile_follows f where f.follower_id = auth.uid() and f.following_id = p_profile);
$$;

grant execute on function public.profile_stats(uuid) to authenticated;
