-- El alta de una cuenta toma el nombre del correo. Con el límite nuevo de
-- quince letras, ese nombre se recorta también aquí o el alta fallaría con un
-- correo largo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, user_number)
  values (
    new.id,
    left(coalesce(nullif(split_part(new.email, '@', 1), ''), 'Invitado'), 15),
    public.next_user_number()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
