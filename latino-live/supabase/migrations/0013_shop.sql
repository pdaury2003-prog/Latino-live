-- The shop: frames and SVIP bought with diamonds, and diamond top-ups paid
-- with Stripe. Prices live here so the server, not the phone, decides them.

create table if not exists public.shop_items (
  key text primary key,
  kind text not null check (kind in ('frame', 'svip')),
  name text not null,
  price_diamonds integer not null check (price_diamonds > 0),
  sort_order integer not null default 0
);

alter table public.shop_items enable row level security;

drop policy if exists shop_items_read on public.shop_items;
create policy shop_items_read on public.shop_items for select to anon, authenticated using (true);

insert into public.shop_items (key, kind, name, price_diamonds, sort_order) values
  ('frame:jazmin', 'frame', 'Jardin de jazmin', 400, 1),
  ('frame:corazon', 'frame', 'Corazon fucsia', 900, 2),
  ('frame:dragon-blanco', 'frame', 'Dragon de fuego', 1500, 3),
  ('frame:dragon-dorado', 'frame', 'Dragon dorado', 2400, 4),
  ('frame:leones', 'frame', 'Leones del trueno', 3600, 5),
  ('frame:arana', 'frame', 'Telarana de oro', 5000, 6),
  ('svip:1', 'svip', 'SVIP 1 · Rosa', 800, 11),
  ('svip:2', 'svip', 'SVIP 2 · Amatista', 2000, 12),
  ('svip:3', 'svip', 'SVIP 3 · Esmeralda', 4500, 13),
  ('svip:4', 'svip', 'SVIP 4 · Oro real', 9000, 14)
on conflict (key) do update set
  name = excluded.name,
  price_diamonds = excluded.price_diamonds,
  sort_order = excluded.sort_order;

create table if not exists public.profile_frames (
  user_id uuid not null references auth.users (id) on delete cascade,
  frame_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, frame_key)
);

alter table public.profile_frames enable row level security;

drop policy if exists profile_frames_read on public.profile_frames;
create policy profile_frames_read on public.profile_frames for select to authenticated using (true);

alter table public.profiles add column if not exists equipped_frame text;

create table if not exists public.diamond_claims (
  entitlement_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount > 0),
  credited_at timestamptz not null default now()
);

alter table public.diamond_claims enable row level security;

drop policy if exists diamond_claims_read on public.diamond_claims;
create policy diamond_claims_read on public.diamond_claims for select to authenticated using (user_id = auth.uid());

create or replace function public.buy_frame(p_key text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  item public.shop_items;
  budget integer;
begin
  if uid is null then raise exception 'Inicia sesion'; end if;
  select * into item from public.shop_items where key = p_key and kind = 'frame';
  if item.key is null then raise exception 'Ese marco no existe'; end if;
  if exists (select 1 from public.profile_frames where user_id = uid and frame_key = p_key) then
    raise exception 'Ya tienes ese marco';
  end if;
  select diamonds into budget from public.profiles where id = uid for update;
  if coalesce(budget, 0) < item.price_diamonds then
    raise exception 'Te faltan diamantes: cuesta % y tienes %', item.price_diamonds, coalesce(budget, 0);
  end if;
  update public.profiles set diamonds = diamonds - item.price_diamonds, equipped_frame = p_key where id = uid;
  insert into public.profile_frames (user_id, frame_key) values (uid, p_key);
  return item.price_diamonds;
end;
$$;
grant execute on function public.buy_frame(text) to authenticated;

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
begin
  if uid is null then raise exception 'Inicia sesion'; end if;
  if p_level < 1 or p_level > 4 then raise exception 'Ese nivel SVIP no existe'; end if;
  select * into item from public.shop_items where key = 'svip:' || p_level and kind = 'svip';
  if item.key is null then raise exception 'Ese nivel SVIP no existe'; end if;
  select diamonds, coalesce(svip_level, 0) into budget, current_level
    from public.profiles where id = uid for update;
  if current_level >= p_level then raise exception 'Ya tienes ese nivel SVIP'; end if;
  if coalesce(budget, 0) < item.price_diamonds then
    raise exception 'Te faltan diamantes: cuesta % y tienes %', item.price_diamonds, coalesce(budget, 0);
  end if;
  update public.profiles
    set diamonds = diamonds - item.price_diamonds,
        svip_level = greatest(coalesce(svip_level, 0), p_level)
    where id = uid;
  return item.price_diamonds;
end;
$$;
grant execute on function public.buy_svip(integer) to authenticated;

create or replace function public.claim_diamond_packs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  entry record;
  amount integer;
  total integer := 0;
begin
  if uid is null then raise exception 'Inicia sesion'; end if;
  for entry in
    select e.id, e.entitlement_key
      from public.spk_payment_entitlements e
     where e.user_id = uid
       and e.active
       and e.entitlement_key like 'diamonds_%'
       and not exists (select 1 from public.diamond_claims c where c.entitlement_id = e.id)
  loop
    amount := nullif(regexp_replace(entry.entitlement_key, '\D', '', 'g'), '')::integer;
    continue when amount is null or amount <= 0;
    insert into public.diamond_claims (entitlement_id, user_id, amount)
      values (entry.id, uid, amount)
      on conflict (entitlement_id) do nothing;
    if found then
      update public.profiles set diamonds = coalesce(diamonds, 0) + amount where id = uid;
      total := total + amount;
    end if;
  end loop;
  return total;
end;
$$;
grant execute on function public.claim_diamond_packs() to authenticated;
