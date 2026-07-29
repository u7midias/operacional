// Edge Function: approve-post
//
// Recebe a decisão do cliente (aprovar / pedir alteração) no portal público,
// valida o token de acesso, grava o registro em `approvals`, atualiza o
// status do post e reflete a decisão de volta no Trello (move o card +
// comenta).

import { corsHeaders, handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { commentOnCard, findListIdByName, moveCardToList } from "../_shared/trello.ts";

const TARGET_LIST_BY_ACTION = {
  aprovado: "Agendar",
  alteracao_solicitada: "Revisão Geral",
} as const;

const NEW_STATUS_BY_ACTION = {
  aprovado: "aprovado",
  alteracao_solicitada: "em_producao",
} as const;

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

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

  if (post.status !== "aguardando_aprovacao") {
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
