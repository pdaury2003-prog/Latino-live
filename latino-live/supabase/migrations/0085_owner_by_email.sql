-- La cuenta del dueno del producto tambien es duena en el entorno publicado.
-- Se busca por correo porque el identificador de cada entorno es distinto.

update public.app_roles r
   set role = 'owner', updated_at = now()
  from auth.users u
 where u.id = r.user_id
   and lower(u.email) = 'geormaryvaldez291914@gmail.com'
   and r.role <> 'owner';
