-- Preferences that used to live only on the phone now follow the person's
-- account: the chosen look and the last time they read their notices.

alter table public.profiles
  add column if not exists theme text;

alter table public.profiles
  add column if not exists notices_seen_at timestamptz;

alter table public.profiles drop constraint if exists profiles_theme_check;
alter table public.profiles
  add constraint profiles_theme_check check (theme is null or theme in ('light', 'dark'));

comment on column public.profiles.theme is 'Look the person picked: light or dark.';
comment on column public.profiles.notices_seen_at is 'Newest notice the person has already read.';
