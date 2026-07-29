// Edge Function: admin-clients
//
// Painel interno (não é o portal do cliente): lista os clientes já
// cadastrados e cria novos. Ao criar, além de gravar em `clients`, já
// registra o webhook no Trello automaticamente — assim cadastrar um cliente
// novo não exige nenhum passo manual no Trello ou SQL.
//
// Protegido por uma senha simples (ADMIN_SECRET, configurada como secret da
// função) enviada em toda chamada. Não é uma autenticação robusta, mas é
// suficiente para uma tela de uso interno da equipe.
//
// Arquivo autocontido (sem imports de outras pastas) para poder ser colado
// direto no editor de Edge Functions do painel do Supabase.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

const TRELLO_API_BASE = "https://api.trello.com/1";

function trelloAuthParams(): string {
  const key = Deno.env.get("TRELLO_API_KEY");
  const token = Deno.env.get("TRELLO_API_TOKEN");
  if (!key || !token) {
    throw new Error("TRELLO_API_KEY / TRELLO_API_TOKEN não configurados.");
  }
  return `key=${key}&token=${token}`;
}

async function trelloFetch(path: string, init?: RequestInit): Promise<Response> {
  const separator = path.includes("?") ? "&" : "?";
  const res = await fetch(`${TRELLO_API_BASE}${path}${separator}${trelloAuthParams()}`, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Trello API error (${res.status}) em ${path}: ${body}`);
  }
  return res;
}

async function getBoardFullId(shortLinkOrId: string): Promise<string> {
  const res = await trelloFetch(`/boards/${shortLinkOrId}?fields=id`);
  const data = await res.json();
  return data.id;
}

async function createTrelloWebhook(boardFullId: string, callbackUrl: string): Promise<void> {
  await trelloFetch("/webhooks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description: "U7 Mídias - sync automático de posts",
      callbackURL: callbackUrl,
      idModel: boardFullId,
    }),
  });
}

function checkAdminSecret(secret: string | null): boolean {
  const expected = Deno.env.get("ADMIN_SECRET");
  return !!expected && secret === expected;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = supabaseAdmin();
  const adminSecret = req.headers.get("x-admin-secret");

  if (!checkAdminSecret(adminSecret)) {
    return jsonResponse({ error: "Não autorizado." }, 401);
  }

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, trello_board_id, access_token, is_active, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Falha ao listar clientes:", error);
      return jsonResponse({ error: "Falha ao listar clientes." }, 500);
    }

    return jsonResponse({ clients: data ?? [] });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  let body: { name?: string; trello_board_short_link?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON inválido." }, 400);
  }

  const name = body.name?.trim();
  const shortLink = body.trello_board_short_link?.trim();

  if (!name || !shortLink) {
    return jsonResponse({ error: "Nome do cliente e código do board são obrigatórios." }, 400);
  }

  const { data: client, error: insertError } = await supabase
    .from("clients")
    .insert({ name, trello_board_id: shortLink })
    .select("id, name, trello_board_id, access_token, is_active, created_at")
    .single();

  if (insertError) {
    console.error("Falha ao criar cliente:", insertError);
    const message = insertError.code === "23505"
      ? "Já existe um cliente cadastrado com esse board do Trello."
      : "Falha ao criar cliente.";
    return jsonResponse({ error: message }, 400);
  }

  let webhookWarning: string | null = null;
  try {
    const boardFullId = await getBoardFullId(shortLink);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    await createTrelloWebhook(boardFullId, `${supabaseUrl}/functions/v1/sync-trello`);
  } catch (webhookError) {
    console.error("Falha ao criar webhook do Trello:", webhookError);
    webhookWarning =
      "Cliente criado, mas não consegui registrar o webhook no Trello automaticamente. " +
      "Confira se o código do board está certo (o de 8 caracteres da URL do board).";
  }

  return jsonResponse({ client, webhookWarning });
});
