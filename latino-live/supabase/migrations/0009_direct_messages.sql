-- Private messages: only friends (mutual follows) can talk, and only the two
-- people in a conversation can read it.
create table if not exists public.direct_messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index if not exists direct_messages_pair on public.direct_messages (sender_id, recipient_id, created_at desc);
create index if not exists direct_messages_unread on public.direct_messages (recipient_id, read_at);

alter table public.direct_messages enable row level security;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select a is not null and b is not null and a <> b and exists (
    select 1 from public.profile_follows f
    join public.profile_follows r on r.follower_id = f.following_id and r.following_id = f.follower_id
    where f.follower_id = a and f.following_id = b
  );
$$;

grant execute on function public.are_friends(uuid, uuid) to authenticated;

drop policy if exists direct_read on public.direct_messages;
create policy direct_read on public.direct_messages for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists direct_send on public.direct_messages;
create policy direct_send on public.direct_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.are_friends(sender_id, recipient_id));

drop policy if exists direct_mark on public.direct_messages;
create policy direct_mark on public.direct_messages for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- One row per conversation partner, newest first, with its unread count.
create or replace function public.direct_conversations()
returns table (
  partner_id uuid,
  display_name text,
  avatar_url text,
  last_body text,
  last_at timestamptz,
  last_mine boolean,
  unread bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select
      case when m.sender_id = auth.uid() then m.recipient_id else m.sender_id end as partner_id,
      m.body,
      m.created_at,
      (m.sender_id = auth.uid()) as mine_flag,
      (m.recipient_id = auth.uid() and m.read_at is null) as unread_flag,
      row_number() over (
        partition by case when m.sender_id = auth.uid() then m.recipient_id else m.sender_id end
        order by m.created_at desc, m.id desc
      ) as position
    from public.direct_messages m
    where m.sender_id = auth.uid() or m.recipient_id = auth.uid()
  ), latest as (
    select * from mine where position = 1
  )
  select l.partner_id, p.display_name, p.avatar_url, l.body, l.created_at, l.mine_flag,
    (select count(*) from mine u where u.partner_id = l.partner_id and u.unread_flag)
  from latest l
  join public.profiles p on p.id = l.partner_id
  order by l.created_at desc;
$$;

grant execute on function public.direct_conversations() to authenticated;

-- Marks everything the partner sent as read.
create or replace function public.mark_direct_read(p_from uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.direct_messages
  set read_at = now()
  where recipient_id = auth.uid() and sender_id = p_from and read_at is null;
$$;

grant execute on function public.mark_direct_read(uuid) to authenticated;

alter publication supabase_realtime add table public.direct_messages;
