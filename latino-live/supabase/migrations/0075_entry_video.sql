-- Entry video: a short clip of your own that plays when you walk into a room.
--
-- It belongs to the profile, like the avatar, and lasts fifteen days: the
-- folder keeps one clip per person and the profile carries the address and the
-- day it stops playing. The room reads it with the profile it already loads,
-- so an arrival costs no extra request.

alter table public.profiles add column if not exists entry_video_path text;
alter table public.profiles add column if not exists entry_video_until timestamptz;

-- Videos up to 25 MB, read by everyone (the room shows them to strangers),
-- written only under the owner's own folder.
insert into storage.buckets (id, name, public, file_size_limit)
values ('entry-videos', 'entry-videos', true, 26214400)
on conflict (id) do update set public = true, file_size_limit = 26214400;

drop policy if exists entry_videos_read on storage.objects;
create policy entry_videos_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'entry-videos');

drop policy if exists entry_videos_insert on storage.objects;
create policy entry_videos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'entry-videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists entry_videos_update on storage.objects;
create policy entry_videos_update on storage.objects for update to authenticated
  using (bucket_id = 'entry-videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists entry_videos_delete on storage.objects;
create policy entry_videos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'entry-videos' and (storage.foldername(name))[1] = auth.uid()::text);

/**
 * Turns a clip on for fifteen days. The address has to be the caller's own,
 * so nobody can point their profile at someone else's file.
 */
create or replace function public.set_entry_video(p_path text, p_days integer default 15)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean text := btrim(coalesce(p_path, ''));
  days integer := greatest(1, least(coalesce(p_days, 15), 30));
  until timestamptz;
begin
  if uid is null then raise exception 'Inicia sesion'; end if;
  if clean = '' then raise exception 'Elige un video'; end if;
  if split_part(clean, '/', 1) <> uid::text then
    raise exception 'Ese video no es tuyo';
  end if;
  until := now() + make_interval(days => days);
  update public.profiles
     set entry_video_path = clean,
         entry_video_until = until
   where id = uid;
  return until;
end;
$$;

/** Stops playing it now, without waiting for the fifteen days. */
create or replace function public.clear_entry_video()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Inicia sesion'; end if;
  update public.profiles
     set entry_video_path = null,
         entry_video_until = null
   where id = uid;
end;
$$;

grant execute on function public.set_entry_video(text, integer) to authenticated;
grant execute on function public.clear_entry_video() to authenticated;
