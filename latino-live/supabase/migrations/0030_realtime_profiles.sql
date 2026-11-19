-- A profile changes while the person is already in a room: a new SVIP pack,
-- a new photo or a new account level. Everyone there must see it at once.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;
