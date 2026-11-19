// Entrada al panel con usuario y contraseña, o con un código al correo.
//
// La app inicia sesión con correo; el panel acepta el nombre de la cuenta
// ("nanao") porque es lo que el equipo recuerda. Aquí se traduce ese nombre a
// su correo, se comprueba la contraseña real de la cuenta y se exige un rol de
// equipo. Nunca se guarda ni se devuelve una contraseña, y sin rol no hay sesión.

import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!url || !serviceKey || !anonKey) return json({ error: "El panel no está configurado." }, 500);

  const body = await request.json().catch(() => ({})) as {
    identifier?: string;
    password?: string;
    action?: string;
  };
  const identifier = (body.identifier ?? "").trim();
  const password = body.password ?? "";
  const byCode = body.action === "code";
  if (!identifier) return json({ error: "Escribe tu usuario." }, 400);
  if (!byCode && !password) return json({ error: "Escribe tu usuario y tu contraseña." }, 400);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // The database turns "nanao" into that account's sign-in email; only the
  // service role may call it, so this never reveals anyone else's address.
  // A name that appears twice is refused instead of guessing which account
  // the person means.
  const { data: resolved, error: resolveError } = await admin.rpc("staff_identity", {
    p_identifier: identifier,
  });
  if (resolveError) {
    const missing = /no hay ninguna cuenta/i.test(resolveError.message);
    const ambiguous = /mas de una cuenta/i.test(resolveError.message);
    return json({ error: resolveError.message }, missing ? 404 : ambiguous ? 409 : 400);
  }
  const identity = (Array.isArray(resolved) ? resolved[0] : resolved) as
    | { user_id?: string; email?: string }
    | null;
  const email = String(identity?.email ?? "");
  const userId = String(identity?.user_id ?? "");
  if (!email || !userId) return json({ error: "Esa cuenta no tiene correo de acceso." }, 400);

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // The code only reaches accounts that already belong to the team, so nobody
  // can use the panel to mail a stranger.
  if (byCode) {
    const { data: staff } = await admin
      .from("app_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    if (!staff) return json({ error: "Esa cuenta no tiene acceso al panel." }, 403);

    const { error: otpError } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (otpError) return json({ error: otpError.message }, 400);
    return json({ sent: true, email });
  }

  const { data: signed, error: signError } = await client.auth.signInWithPassword({ email, password });
  if (signError || !signed.session) {
    return json({ error: "El usuario o la contraseña no coinciden." }, 401);
  }

  const { data: role } = await admin
    .from("app_roles")
    .select("role")
    .eq("user_id", signed.user.id)
    .maybeSingle();
  if (!role) {
    return json({ error: "Esa cuenta no tiene acceso al panel." }, 403);
  }

  return json({
    access_token: signed.session.access_token,
    refresh_token: signed.session.refresh_token,
    role: role.role,
    user_id: signed.user.id,
    email: signed.user.email ?? null,
  });
});
