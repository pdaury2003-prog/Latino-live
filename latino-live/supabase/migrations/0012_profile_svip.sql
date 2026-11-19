-- SVIP look of a profile: an animated frame, a medal, the profile background
-- and the entrance banner in the rooms. 0 means no SVIP.

alter table public.profiles
  add column if not exists svip_level smallint not null default 0;

alter table public.profiles
  drop constraint if exists profiles_svip_level_check;

alter table public.profiles
  add constraint profiles_svip_level_check check (svip_level between 0 and 4);
