-- SVIP is a 30-day membership: when it lapses the whole pack stops showing,
-- and each person can hide or show any single piece of the pack.

alter table public.profiles
  add column if not exists svip_expires_at timestamptz;

alter table public.profiles
  add column if not exists svip_show jsonb not null default '{}'::jsonb;

comment on column public.profiles.svip_expires_at is 'When the SVIP pack stops applying.';
comment on column public.profiles.svip_show is 'Pieces of the SVIP pack the person hides: {key: false}.';

-- Nobody loses a pack the day this ships: current members start their 30 days now.
update public.profiles
  set svip_expires_at = now() + interval '30 days'
  where coalesce(svip_level, 0) > 0 and svip_expires_at is null;

create or replace function public.buy_svip(p_level integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  item public.shop_items;
  budget integer;
  current_level integer;
  expires timestamptz;
begin
  if uid is null then raise exception 'Inicia sesion'; end if;
  if p_level < 1 or p_level > 10 then raise exception 'Ese nivel SVIP no existe'; end if;
  select * into item from public.shop_items where key = 'svip:' || p_level and kind = 'svip';
  if item.key is null then raise exception 'Ese nivel SVIP no existe'; end if;

  select diamonds, coalesce(svip_level, 0), svip_expires_at
    into budget, current_level, expires
    from public.profiles where id = uid for update;

  -- An expired pack no longer counts as a level.
  if expires is not null and expires <= now() then
    current_level := 0;
    expires := null;
  end if;

  if current_level > p_level then
    raise exception 'Ya tienes un nivel SVIP superior activo';
  end if;
  if coalesce(budget, 0) < item.price_diamonds then
    raise exception 'Te faltan diamantes: cuesta % y tienes %', item.price_diamonds, coalesce(budget, 0);
  end if;

  update public.profiles
    set diamonds = diamonds - item.price_diamonds,
        svip_level = greatest(current_level, p_level),
        svip_expires_at = greatest(coalesce(expires, now()), now()) + interval '30 days'
    where id = uid;
  return item.price_diamonds;
end;
$$;
grant execute on function public.buy_svip(integer) to authenticated;

-- Only the server may touch the wallet and the membership; people can still
-- edit their own card and the pieces they want to wear.
revoke update on public.profiles from authenticated;
grant update (display_name, bio, country, avatar_url, cover_url, equipped_frame, theme, notices_seen_at, svip_show)
  on public.profiles to authenticated;
