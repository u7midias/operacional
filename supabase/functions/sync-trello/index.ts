// Edge Function: sync-trello
//
// Recebe o webhook do Trello (configurado por board), busca o estado atual
// completo do card na API do Trello e faz upsert em `posts`. Toda ação no
// card (mover de lista, editar legenda, anexar mídia, mudar due date)
// dispara o mesmo resync, então não há necessidade de interpretar o tipo
// específico de cada evento do webhook.

import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { extractFormat, extractMedia, getCard, mapListNameToStatus } from "../_shared/trello.ts";

Deno.serve(async (req) => {
  // Trello valida a URL do webhook com HEAD/GET antes de aceitar o cadastro.
  if (req.method === "HEAD" || req.method === "GET") {
    return new Response("ok", { status: 200 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = supabaseAdmin();

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return new Response("ok", { status: 200 });
  }

  const action = (payload as Record<string, unknown>)?.action as
    | { type?: string; data?: { card?: { id?: string }; board?: { id?: string } } }
    | undefined;

  const cardId = action?.data?.card?.id;
  const boardId = action?.data?.board?.id;

  await supabase.from("trello_sync_log").insert({
    trello_card_id: cardId ?? null,
    event_type: action?.type ?? null,
    payload,
  });

  if (!cardId || !boardId) {
    // Evento não relacionado a um card específico (ex: alteração no board).
    return new Response("ok", { status: 200 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, trello_board_id, is_active")
    .eq("trello_board_id", boardId)
    .maybeSingle();

  if (!client || !client.is_active) {
    return new Response("ok", { status: 200 });
  }

  const card = await getCard(cardId);
  const media = extractMedia(card);

  const { error } = await supabase.from("posts").upsert(
    {
      client_id: client.id,
      trello_card_id: card.id,
      trello_list_id: card.idList,
      trello_list_name: card.list?.name ?? null,
      format: extractFormat(card.labels ?? []),
      caption: card.desc ?? null,
      media_type: media?.mediaType ?? null,
      media_url: media?.mediaUrl ?? null,
      scheduled_date: card.due ? card.due.slice(0, 10) : null,
      status: mapListNameToStatus(card.list?.name),
    },
    { onConflict: "trello_card_id" },
  );

  if (error) {
    console.error("Falha ao gravar post:", error);
    return new Response("ok", { status: 200 });
  }

  return new Response("ok", { status: 200 });
});
