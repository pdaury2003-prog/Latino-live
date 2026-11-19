-- Profile images live under the person's own folder in the public profile-media bucket.

drop policy if exists profile_media_read on storage.objects;
create policy profile_media_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'profile-media');

drop policy if exists profile_media_insert_own on storage.objects;
create policy profile_media_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists profile_media_update_own on storage.objects;
create policy profile_media_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists profile_media_delete_own on storage.objects;
create policy profile_media_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
