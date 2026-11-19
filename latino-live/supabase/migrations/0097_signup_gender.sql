-- El sexo se elige al crear la cuenta y viaja con el alta en los datos del
-- usuario; este disparador lo copia al perfil en el mismo instante en que la
-- cuenta nace, así que la persona nunca tiene que volver a elegirlo.
--
-- Una versión anterior de la app que no lo mande sigue creando cuentas: en ese
-- caso el perfil queda con el sexo vacío, como hasta ahora.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen text := btrim(coalesce(new.raw_user_meta_data ->> 'gender', ''));
begin
  if chosen not in ('mujer', 'hombre', 'otro') then
    chosen := '';
  end if;

  insert into public.profiles (id, display_name, user_number, gender)
  values (
    new.id,
    left(coalesce(nullif(split_part(new.email, '@', 1), ''), 'Invitado'), 15),
    public.next_user_number(),
    chosen
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
