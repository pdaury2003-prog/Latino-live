-- Two animated gift videos play full screen in the room for everyone.

insert into public.gift_catalog (key, name, cost, sort) values
  ('tigre', 'Tigre de fuego', 300, 6),
  ('demonio', 'Demonio de fuego', 800, 7)
on conflict (key) do update set name = excluded.name, cost = excluded.cost, sort = excluded.sort;
