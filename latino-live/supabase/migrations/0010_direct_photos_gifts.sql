-- Private conversations can carry a photo and a gift, still only between the
-- two friends, and still invisible to anyone else.
alter table public.direct_messages add column if not exists image_path text;

alter table public.direct_messages drop constraint if exists direct_messages_body_check;
alter table public.direct_messages
  add constraint direct_messages_body_check check (
    char_length(btrim(body)) <= 1000
    and (btrim(body) <> '' or image_path is not null)
  );

insert into storage.buckets (id, name, public)
values ('direct-photos', 'direct-photos', true)
on conflict (id) do nothing;

drop policy if exists direct_photos_read on storage.objects;
create policy direct_photos_read on storage.objects for select
  using (bucket_id = 'direct-photos');

drop policy if exists direct_photos_write on storage.objects;
create policy direct_photos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'direct-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.direct_gifts (
  id bigint generated always as identity primary key,
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  gift_key text not null,
  cost integer not null check (cost > 0),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index if not exists direct_gifts_pair on public.direct_gifts (recipient_id, created_at desc);
alter table public.direct_gifts enable row level security;

drop policy if exists direct_gifts_read on public.direct_gifts;
create policy direct_gifts_read on public.direct_gifts for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- Sends a gift to a friend and takes its diamonds from the sender's wallet.
create or replace function public.send_direct_gift(p_to uuid, p_gift text, p_cost integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  wallet integer;
begin
  if uid is null then raise exception 'Inicia sesión para regalar'; end if;
  if not public.are_friends(uid, p_to) then
    raise exception 'Solo puedes regalar a tus amigos';
  end if;
  if p_cost is null or p_cost <= 0 then raise exception 'Regalo no válido'; end if;
  select diamonds into wallet from public.profiles where id = uid for update;
  if coalesce(wallet, 0) < p_cost then raise exception 'No te alcanzan los diamantes'; end if;
  update public.profiles set diamonds = diamonds - p_cost where id = uid;
  update public.profiles set gold = coalesce(gold, 0) + (p_cost * 100) where id = p_to;
  insert into public.direct_gifts (sender_id, recipient_id, gift_key, cost)
  values (uid, p_to, p_gift, p_cost);
end;
$$;

grant execute on function public.send_direct_gift(uuid, text, integer) to authenticated;

alter publication supabase_realtime add table public.direct_gifts;
