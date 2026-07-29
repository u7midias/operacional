// Edge Function: get-posts
//
// Único ponto de leitura do portal do cliente. RLS bloqueia totalmente a
// chave anon nas tabelas, então o frontend nunca lê `posts`/`clients`
// diretamente — ele chama esta função, que valida o token de acesso e
// devolve somente os campos relevantes para o calendário/detalhe do post.

import { corsHeaders, handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON inválido." }, 400);
  }

  const { token } = body;
  if (!token) {
    return jsonResponse({ error: "Token é obrigatório." }, 400);
  }

  const supabase = supabaseAdmin();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, is_active")
    .eq("access_token", token)
    .maybeSingle();

  if (!client || !client.is_active) {
    return jsonResponse({ error: "Acesso inválido." }, 401);
  }

  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, format, caption, media_type, media_url, scheduled_date, status")
    .eq("client_id", client.id)
    .order("scheduled_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("Falha ao buscar posts:", error);
    return jsonResponse({ error: "Falha ao buscar posts." }, 500);
  }

  return jsonResponse({
    client: { name: client.name },
    posts: posts ?? [],
  });
});
