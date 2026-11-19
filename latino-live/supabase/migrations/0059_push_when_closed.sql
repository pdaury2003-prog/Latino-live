-- The notice also has to arrive with the app closed. Each phone hands its
-- notification address to its own account; when someone opens a room, the
-- database sends the notice straight to the addresses of their followers, so
-- no phone has to be awake for it.

create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null default 'android' check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "a phone belongs to its account" on public.push_tokens;
create policy "a phone belongs to its account" on public.push_tokens
  for select to authenticated using (user_id = auth.uid());

grant select on public.push_tokens to authenticated;

/**
 * Saves this phone's notification address to the signed-in account. A phone
 * that changes hands stops receiving the previous account's notices.
 */
create or replace function public.save_push_token(p_token text, p_platform text default 'android')
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  clean text := btrim(coalesce(p_token, ''));
  device text := case when p_platform = 'ios' then 'ios' else 'android' end;
begin
  if uid is null then raise exception 'Inicia sesión'; end if;
  if clean = '' or length(clean) > 512 then raise exception 'Ese aviso no es válido'; end if;
  if clean !~ '^[A-Za-z0-9_\[\]:.-]+$' then raise exception 'Ese aviso no es válido'; end if;

  delete from public.push_tokens where token = clean and user_id <> uid;
  insert into public.push_tokens as t (token, user_id, platform)
  values (clean, uid, device)
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now();
end;
$$;

grant execute on function public.save_push_token(text, text) to authenticated;

/** A phone that signs out stops receiving notices for that account. */
create or replace function public.drop_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then return; end if;
  delete from public.push_tokens where token = btrim(coalesce(p_token, '')) and user_id = auth.uid();
end;
$$;

grant execute on function public.drop_push_token(text) to authenticated;

/**
 * Sends the opening to every follower's phone through the push service. It
 * runs after the opening is saved and never blocks it: a phone without a
 * notification address simply gets nothing.
 */
create or replace function public.push_room_open()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  messages jsonb;
begin
  select jsonb_agg(jsonb_build_object(
           'to', t.token,
           'title', coalesce(nullif(p.display_name, ''), new.host_name) || ' abrió una sala',
           'body', new.room_title || ' · toca para entrar',
           'sound', null,
           'channelId', 'sahar-avisos',
           'data', jsonb_build_object('slug', new.room_slug, 'event', new.id)
         ))
    into messages
    from public.push_tokens t
    join public.profile_follows f on f.follower_id = t.user_id and f.following_id = new.host_id
    left join public.profiles p on p.id = new.host_id
   where t.token like 'Expo%PushToken[%]'
   limit 100;

  if messages is null then return new; end if;

  begin
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := messages,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  exception
    when others then null;
  end;
  return new;
end;
$$;

drop trigger if exists push_room_open on public.room_open_events;
create trigger push_room_open
  after insert on public.room_open_events
  for each row execute function public.push_room_open();
