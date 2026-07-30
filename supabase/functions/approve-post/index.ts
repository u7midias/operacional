// Edge Function: approve-post
//
// Recebe a decisão do cliente (aprovar / pedir alteração) no portal público,
// valida o token de acesso, grava o registro em `approvals`, atualiza o
// status do post e reflete a decisão de volta no Trello (move o card +
// comenta).
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

const TRELLO_API_BASE = "https://api.trello.com/1";

function trelloAuthParams(): string {
  const key = Deno.env.get("TRELLO_API_KEY");
  const token = Deno.env.get("TRELLO_API_TOKEN");
  if (!key || !token) {
    throw new Error("TRELLO_API_KEY / TRELLO_API_TOKEN não configurados.");
  }
  return `key=${key}&token=${token}`;
}

async function trelloFetch(path: string, init?: RequestInit, attempt = 1): Promise<Response> {
  const separator = path.includes("?") ? "&" : "?";
  const res = await fetch(`${TRELLO_API_BASE}${path}${separator}${trelloAuthParams()}`, init);

  if (res.status === 429 && attempt <= 5) {
    const retryAfterSeconds = Number(res.headers.get("Retry-After"));
    const waitMs = (retryAfterSeconds > 0 ? retryAfterSeconds : attempt) * 1000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return trelloFetch(path, init, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Trello API error (${res.status}) em ${path}: ${body}`);
  }
  return res;
}

async function getBoardLists(boardId: string): Promise<{ id: string; name: string }[]> {
  const res = await trelloFetch(`/boards/${boardId}/lists?fields=name`);
  return await res.json();
}

function normalize(value: string): string {
  const COMBINING_DIACRITICS_RE = /[̀-ͯ]/g;
  return value.normalize("NFD").replace(COMBINING_DIACRITICS_RE, "").trim().toLowerCase();
}

async function findListIdByName(boardId: string, listName: string): Promise<string | null> {
  const lists = await getBoardLists(boardId);
  const normalizedTarget = normalize(listName);
  const match = lists.find((list) => normalize(list.name) === normalizedTarget);
  return match?.id ?? null;
}

async function moveCardToList(cardId: string, listId: string): Promise<void> {
  await trelloFetch(`/cards/${cardId}?idList=${listId}`, { method: "PUT" });
}

async function commentOnCard(cardId: string, text: string): Promise<void> {
  await trelloFetch(`/cards/${cardId}/actions/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

const TARGET_LIST_BY_ACTION = {
  aprovado: "Agendamento",
  alteracao_solicitada: "Alteração",
} as const;

const NEW_STATUS_BY_ACTION = {
  aprovado: "em_agendamento",
  alteracao_solicitada: "em_alteracao",
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  let body: { token?: string; post_id?: string; action?: string; comment?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON inválido." }, 400);
  }

  const { token, post_id, action, comment } = body;

  if (!token || !post_id || (action !== "aprovado" && action !== "alteracao_solicitada")) {
    return jsonResponse({ error: "Parâmetros inválidos." }, 400);
  }

  if (action === "alteracao_solicitada" && !comment?.trim()) {
    return jsonResponse({ error: "Comentário é obrigatório ao pedir alteração." }, 400);
  }

  const supabase = supabaseAdmin();

  const { data: client } = await supabase
    .from("clients")
    .select("id, trello_board_id, is_active")
    .eq("access_token", token)
    .maybeSingle();

  if (!client || !client.is_active) {
    return jsonResponse({ error: "Acesso inválido." }, 401);
  }

  const { data: post } = await supabase
    .from("posts")
    .select("id, client_id, trello_card_id, status")
    .eq("id", post_id)
    .maybeSingle();

  if (!post || post.client_id !== client.id) {
    return jsonResponse({ error: "Post não encontrado." }, 404);
  }

  if (post.status !== "em_aprovacao") {
    return jsonResponse({ error: "Este post não está aguardando aprovação." }, 409);
  }

  const { error: approvalError } = await supabase.from("approvals").insert({
    post_id: post.id,
    action,
    comment: comment?.trim() || null,
  });

  if (approvalError) {
    console.error("Falha ao gravar approval:", approvalError);
    return jsonResponse({ error: "Falha ao registrar a decisão." }, 500);
  }

  const newStatus = NEW_STATUS_BY_ACTION[action];

  const { error: updateError } = await supabase
    .from("posts")
    .update({ status: newStatus })
    .eq("id", post.id);

  if (updateError) {
    console.error("Falha ao atualizar status do post:", updateError);
    return jsonResponse({ error: "Falha ao atualizar o post." }, 500);
  }

  try {
    const targetListName = TARGET_LIST_BY_ACTION[action];
    const listId = await findListIdByName(client.trello_board_id, targetListName);

    if (listId) {
      await moveCardToList(post.trello_card_id, listId);
      await supabase
        .from("posts")
        .update({ trello_list_id: listId, trello_list_name: targetListName })
        .eq("id", post.id);
    } else {
      await supabase.from("trello_sync_log").insert({
        trello_card_id: post.trello_card_id,
        event_type: "approve-post:list-not-found",
        payload: { targetListName, board_id: client.trello_board_id },
      });
    }

    const timestamp = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date());

    const commentText =
      action === "aprovado"
        ? `✅ Aprovado pelo cliente em ${timestamp}`
        : `🔁 Cliente solicitou alteração: ${comment?.trim()}`;

    await commentOnCard(post.trello_card_id, commentText);
  } catch (trelloError) {
    console.error("Falha ao sincronizar com o Trello:", trelloError);
    await supabase.from("trello_sync_log").insert({
      trello_card_id: post.trello_card_id,
      event_type: "approve-post:trello-error",
      payload: { message: String(trelloError) },
    });
    // A decisão do cliente já está registrada no banco; a sincronização com
    // o Trello pode ser corrigida manualmente a partir do log acima.
  }

  return jsonResponse({ ok: true, status: newStatus });
});
