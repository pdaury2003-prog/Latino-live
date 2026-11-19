-- El perfil dice también quién es la persona, y el nombre cabe en una línea
-- de la sala: nunca pasa de quince letras.
--
-- Las versiones ya instaladas siguen funcionando: la columna nueva llega con
-- un valor vacío y la app antigua la ignora. Los nombres que ya existían se
-- recortan una sola vez para que la regla nueva se cumpla desde el principio.

alter table public.profiles
  add column if not exists gender text not null default '';

alter table public.profiles drop constraint if exists profiles_gender_check;
alter table public.profiles
  add constraint profiles_gender_check
  check (gender in ('', 'mujer', 'hombre', 'otro'));

comment on column public.profiles.gender is
  'Mujer, hombre u otro; vacío mientras la persona no lo elige.';

update public.profiles
set display_name = left(btrim(display_name), 15)
where char_length(display_name) > 15;

alter table public.profiles drop constraint if exists profiles_display_name_check;
alter table public.profiles
  add constraint profiles_display_name_check
  check (char_length(display_name) between 1 and 15);

comment on column public.profiles.display_name is
  'Nombre visible en la sala y en el perfil: de 1 a 15 letras.';
