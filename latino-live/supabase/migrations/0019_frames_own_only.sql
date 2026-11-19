-- A person's bought frames are private to them: the shop reads only their own
-- list. Showing everyone's made the shop believe every frame was owned.

drop policy if exists profile_frames_read on public.profile_frames;
create policy profile_frames_read on public.profile_frames
  for select to authenticated using (user_id = auth.uid());
