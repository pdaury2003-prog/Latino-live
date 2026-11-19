-- The gold set: five profile frames, five SVIP levels and five gift pieces,
-- all drawn from the same board. Prices stay in the catalogue.

alter table public.profiles drop constraint if exists profiles_svip_level_check;
alter table public.profiles
  add constraint profiles_svip_level_check check (svip_level between 0 and 5);

delete from public.shop_items where key like 'frame:%';

insert into public.shop_items (key, kind, name, price_diamonds, sort_order) values
  ('frame:aureo', 'frame', 'Corona áurea', 500, 1),
  ('frame:violeta', 'frame', 'Dragón amatista', 900, 2),
  ('frame:leon', 'frame', 'León azul', 1500, 3),
  ('frame:esmeralda', 'frame', 'Dragón esmeralda', 2200, 4),
  ('frame:fenix', 'frame', 'Fénix de fuego', 3200, 5),
  ('svip:1', 'svip', 'SVIP 1 · Corona de fuego', 800, 11),
  ('svip:2', 'svip', 'SVIP 2 · León azul', 2000, 12),
  ('svip:3', 'svip', 'SVIP 3 · Dragón amatista', 3500, 13),
  ('svip:4', 'svip', 'SVIP 4 · Fénix dorado', 5500, 14),
  ('svip:5', 'svip', 'SVIP 5 · Dragón esmeralda', 9000, 15)
on conflict (key) do update set
  name = excluded.name,
  kind = excluded.kind,
  price_diamonds = excluded.price_diamonds,
  sort_order = excluded.sort_order;

-- Frames that no longer exist are dropped from the people who had them.
delete from public.profile_frames where frame_key not in (select key from public.shop_items where kind = 'frame');
update public.profiles set equipped_frame = null
 where equipped_frame is not null
   and equipped_frame not in (select key from public.shop_items where kind = 'frame');

insert into public.gift_catalog (key, name, cost, sort) values
  ('corona', 'Corona', 10, 1),
  ('dragon', 'Dragón', 50, 2),
  ('leon', 'León', 100, 3),
  ('fenix', 'Fénix', 200, 4),
  ('trono', 'Trono SVIP', 500, 5)
on conflict (key) do update set name = excluded.name, cost = excluded.cost, sort = excluded.sort;
