-- The shop's frames are the new ones. The frames people already bought stay
-- in their profile: they are simply no longer for sale.

delete from public.shop_items where kind = 'frame';

insert into public.shop_items (key, kind, name, price_diamonds, sort_order) values
  ('frame:corona', 'frame', 'Corona real', 500, 1),
  ('frame:rubi', 'frame', 'Corona de rubí', 900, 2),
  ('frame:celest', 'frame', 'Alas celestiales', 1400, 3),
  ('frame:fenix-oro', 'frame', 'Fénix de oro', 2000, 4),
  ('frame:jade', 'frame', 'Alas de jade', 2700, 5),
  ('frame:leon-real', 'frame', 'León real', 3600, 6),
  ('frame:neon', 'frame', 'Neón musical', 4800, 7),
  ('frame:roses', 'frame', 'Jardín de roses', 6500, 8);
