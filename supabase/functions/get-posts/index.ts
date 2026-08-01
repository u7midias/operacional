// Edge Function: get-posts
//
// Único ponto de leitura do portal do cliente. RLS bloqueia totalmente a
// chave anon nas tabelas, então o frontend nunca lê `posts`/`clients`
// diretamente — ele chama esta função, que valida o token de acesso e
// devolve somente os campos relevantes para o calendário/detalhe do post.
//
// Arquivo autocontido (sem imports de outras pastas) para poder ser colado
// direto no editor de Edge Functions do painel do Supabase.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function supabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados.");
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

// Etapas em que já existe uma peça pronta pro cliente ver. Nas outras ele
// enxerga só que o post existe e em que etapa está.
const OPENABLE_STATUSES = new Set(["em_aprovacao", "em_agendamento", "publicado"]);

interface PostRow {
  id: string;
  format: string | null;
  caption: string | null;
  media_type: string | null;
  media_urls: string[];
  scheduled_date: string | null;
  status: string;
}

// Esconder o conteúdo só no frontend não basta: o JSON inteiro fica visível
// pra quem abrir o inspetor do navegador. Cards de listas internas costumam
// ter anotação da equipe na descrição (num board real havia até um card de
// acessos com senha), então a legenda e a mídia só saem daqui quando o post
// já está numa etapa que o cliente pode abrir.
function stripInternalContent(post: PostRow): PostRow {
  if (OPENABLE_STATUSES.has(post.status)) return post;
  return { ...post, caption: null, media_type: null, media_urls: [] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

  // O cliente vê o pipeline inteiro (pra acompanhar o planejamento e em que
  // etapa cada post está); o que muda por etapa é só poder abrir o post ou
  // não, o que o frontend controla.
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, format, caption, media_type, media_urls, scheduled_date, status")
    .eq("client_id", client.id)
    .not("scheduled_date", "is", null)
    .order("scheduled_date", { ascending: true });

  if (error) {
    console.error("Falha ao buscar posts:", error);
    return jsonResponse({ error: "Falha ao buscar posts." }, 500);
  }

  return jsonResponse({
    client: { name: client.name },
    posts: ((posts ?? []) as PostRow[]).map(stripInternalContent),
  });
});
