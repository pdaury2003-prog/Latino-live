-- Every photo, voice note and song the app uploads lives in one of these
-- folders. Their policies existed, but the folders themselves had only ever
-- been made by hand in the development project, so an installed build answered
-- "Bucket not found" whenever someone tried to share a photo.
insert into storage.buckets (id, name, public)
values
  ('profile-media', 'profile-media', true),
  ('room-photos', 'room-photos', true),
  ('room-voice', 'room-voice', true),
  ('room-music', 'room-music', true),
  ('moments', 'moments', true),
  ('direct-photos', 'direct-photos', true)
on conflict (id) do nothing;
