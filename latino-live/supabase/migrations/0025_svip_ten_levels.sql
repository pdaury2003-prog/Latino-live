-- SVIP now goes up to level 10: five more steps for the most loyal hosts,
-- each sold with diamonds like the earlier ones.

alter table public.profiles drop constraint if exists profiles_svip_level_check;
alter table public.profiles
  add constraint profiles_svip_level_check check (svip_level between 0 and 10);

insert into public.shop_items (key, kind, name, price_diamonds, sort_order) values
  ('svip:6', 'svip', 'SVIP 6 · Guardián de oro', 14000, 16),
  ('svip:7', 'svip', 'SVIP 7 · Tormenta zafiro', 20000, 17),
  ('svip:8', 'svip', 'SVIP 8 · Dragón esmeralda', 28000, 18),
  ('svip:9', 'svip', 'SVIP 9 · Fénix carmesí', 38000, 19),
  ('svip:10', 'svip', 'SVIP 10 · Imperial corona', 50000, 20)
on conflict (key) do update
  set name = excluded.name,
      price_diamonds = excluded.price_diamonds,
      sort_order = excluded.sort_order;

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
  if p_level < 1 or p_level > 10 then raise exception 'Ese nivel SVIP no existe'; end if;
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
