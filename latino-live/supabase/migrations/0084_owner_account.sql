-- La cuenta del dueno del producto en el entorno publicado tambien es duena:
-- si se pierde una clave, el panel no queda sin nadie que pueda dar roles.

update public.app_roles
   set role = 'owner', updated_at = now()
 where user_id = '99d9a767-eff0-478a-8dcf-5c9846b0a6c0'
   and role <> 'owner';
