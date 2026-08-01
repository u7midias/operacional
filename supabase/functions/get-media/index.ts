// Edge Function: get-media
//
// Serve as imagens dos posts para o portal do cliente.
//
// As URLs de anexo do Trello não são públicas: elas exigem autenticação, e
// quem não tem acesso ao board (ou seja, o cliente) recebe 401 ao tentar
// abrir a imagem direto. Funcionava no navegador da equipe só porque ela
// já estava logada no Trello. Esta função busca o anexo usando as
// credenciais da agência e devolve os bytes da imagem, então o cliente
// carrega tudo sem nunca ter acesso ao Trello.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function supabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados.");
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

// Mesma lista de get-posts: etapas em que o cliente pode abrir o post.
const OPENABLE_STATUSES = new Set(["em_aprovacao", "em_agendamento", "publicado"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const params = new URL(req.url).searchParams;
  const token = params.get("token");
  const postId = params.get("post_id");
  const index = Number(params.get("index") ?? "0");

  if (!token || !postId || !Number.isInteger(index) || index < 0) {
    return new Response("Parâmetros inválidos.", { status: 400, headers: corsHeaders });
  }

  const supabase = supabaseAdmin();

  const { data: client } = await supabase
    .from("clients")
    .select("id, is_active")
    .eq("access_token", token)
    .maybeSingle();

  if (!client || !client.is_active) {
    return new Response("Acesso inválido.", { status: 401, headers: corsHeaders });
  }

  const { data: post } = await supabase
    .from("posts")
    .select("client_id, media_urls, status")
    .eq("id", postId)
    .maybeSingle();

  // Só serve mídia de um post que pertence ao cliente daquele token — o
  // token sozinho não dá acesso a qualquer imagem do banco. E só a partir das
  // etapas que o cliente pode abrir: peça em produção interna não sai daqui
  // nem por URL montada na mão.
  if (!post || post.client_id !== client.id || !OPENABLE_STATUSES.has(post.status)) {
    return new Response("Post não encontrado.", { status: 404, headers: corsHeaders });
  }

  const mediaUrl = (post.media_urls ?? [])[index];
  if (!mediaUrl) {
    return new Response("Mídia não encontrada.", { status: 404, headers: corsHeaders });
  }

  const key = Deno.env.get("TRELLO_API_KEY");
  const trelloToken = Deno.env.get("TRELLO_API_TOKEN");
  if (!key || !trelloToken) {
    return new Response("Trello não configurado.", { status: 500, headers: corsHeaders });
  }

  const upstream = await fetch(mediaUrl, {
    headers: {
      Authorization: `OAuth oauth_consumer_key="${key}", oauth_token="${trelloToken}"`,
    },
  });

  if (!upstream.ok) {
    console.error("Falha ao buscar mídia no Trello:", upstream.status, mediaUrl);
    return new Response("Falha ao carregar a mídia.", { status: 502, headers: corsHeaders });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
      // A imagem de um post praticamente não muda depois de anexada, então
      // vale cachear no navegador do cliente.
      "Cache-Control": "public, max-age=86400",
    },
  });
});
