// Edge Function: sync-trello
//
// Recebe o webhook do Trello (configurado por board), busca o estado atual
// completo do card na API do Trello e faz upsert em `posts`. Toda ação no
// card (mover de lista, editar legenda, anexar mídia, mudar due date)
// dispara o mesmo resync, então não há necessidade de interpretar o tipo
// específico de cada evento do webhook.
//
// Arquivo autocontido (sem imports de outras pastas) para poder ser colado
// direto no editor de Edge Functions do painel do Supabase.

import { createClient } from "npm:@supabase/supabase-js@2";

type PostStatus =
  | "criacao_legenda"
  | "em_producao"
  | "em_revisao"
  | "em_aprovacao"
  | "em_alteracao"
  | "em_agendamento"
  | "publicado";
type PostFormat = "feed" | "story" | "reels";
type MediaType = "imagem" | "video";

interface TrelloLabel {
  id: string;
  name: string;
  color: string | null;
}

interface TrelloAttachment {
  id: string;
  url: string;
  name: string;
  mimeType?: string;
}

interface TrelloCard {
  id: string;
  desc: string;
  due: string | null;
  idList: string;
  idBoard: string;
  idLabels: string[];
  closed: boolean;
  list?: { id: string; name: string; closed?: boolean };
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

// Devolve null quando o card não existe mais (foi excluído no Trello). O
// evento "deleteCard" chega aqui como qualquer outro, e nesse caso a API
// responde 404 — não é erro, é a informação de que o post precisa sair.
async function getCardOrNull(cardId: string): Promise<TrelloCard | null> {
  try {
    const res = await trelloFetch(
      `/cards/${cardId}?fields=name,desc,due,idList,idBoard,idLabels,closed&list=true`,
    );
    return await res.json();
  } catch (err) {
    if (err instanceof Error && err.message.includes("(404)")) return null;
    throw err;
  }
}

// As etiquetas vêm do board e são cruzadas com o `idLabels` do card. Pedir
// o campo `labels` embutido na resposta do card não funciona de forma
// confiável (o Trello simplesmente não devolve o campo).
async function getBoardLabels(boardId: string): Promise<TrelloLabel[]> {
  const res = await trelloFetch(`/boards/${boardId}/labels?fields=name&limit=1000`);
  return await res.json();
}

// O campo "attachments" embutido no card às vezes vem incompleto (ex: só o
// primeiro anexo de um carrossel). O endpoint dedicado devolve a lista real.
async function getCardAttachments(cardId: string): Promise<TrelloAttachment[]> {
  const res = await trelloFetch(`/cards/${cardId}/attachments`);
  return await res.json();
}

// clients.trello_board_id guarda o código curto que aparece na URL do board
// (ex: trello.com/b/AbCd1234/nome-do-board) — é o jeito mais fácil de copiar
// sem precisar mexer em API. O webhook do Trello manda o ID completo, então
// resolvemos aqui pra esse código curto antes de comparar.
async function getBoardShortLink(boardId: string): Promise<string | null> {
  const res = await trelloFetch(`/boards/${boardId}?fields=shortLink`);
  const data = await res.json();
  return data?.shortLink ?? null;
}

const COMBINING_DIACRITICS_RE = /[̀-ͯ]/g;

function normalize(value: string): string {
  return value.normalize("NFD").replace(COMBINING_DIACRITICS_RE, "").trim().toLowerCase();
}

// Listas internas do Trello -> status mostrado ao cliente.
//
// A comparação é por palavra-chave, não por nome exato: na prática os
// boards têm variações ("Concluído ✅", "CONCLUÍDOS", "Aprovação do
// cliente"), e exigir o nome exato fazia a lista cair no padrão
// "em produção" sem ninguém perceber. A ordem importa — vale a primeira
// palavra-chave encontrada.
const LIST_KEYWORD_TO_STATUS: [string, PostStatus][] = [
  ["legenda", "criacao_legenda"],
  ["aprova", "em_aprovacao"],
  ["alterac", "em_alteracao"],
  ["revis", "em_revisao"],
  ["agend", "em_agendamento"],
  ["conclu", "publicado"],
  ["public", "publicado"],
  ["design", "em_producao"],
  ["produc", "em_producao"],
  ["informac", "em_producao"],
];

function mapListNameToStatus(listName: string | null | undefined): PostStatus | null {
  if (!listName) return null;
  const normalized = normalize(listName);
  for (const [keyword, status] of LIST_KEYWORD_TO_STATUS) {
    if (normalized.includes(keyword)) return status;
  }
  return null;
}

const FORMAT_LABELS: Record<string, PostFormat> = {
  feed: "feed",
  story: "story",
  reels: "reels",
};

function extractFormat(labelNames: string[]): PostFormat | null {
  for (const labelName of labelNames) {
    const match = FORMAT_LABELS[normalize(labelName)];
    if (match) return match;
  }
  return null;
}

const DRIVE_LINK_RE = /https:\/\/(?:drive|docs)\.google\.com\S+/i;

function isImageAttachment(att: TrelloAttachment): boolean {
  return !!att.mimeType?.startsWith("image/") || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(att.url);
}

// Um post pode ter várias imagens anexadas (carrossel) — nesse caso
// devolvemos todas, na ordem em que foram anexadas no card.
function extractMedia(
  card: { desc: string | null; attachments: TrelloAttachment[] },
): { mediaType: MediaType; mediaUrls: string[] } | null {
  const imageAttachments = (card.attachments ?? []).filter(isImageAttachment);
  if (imageAttachments.length > 0) {
    return { mediaType: "imagem", mediaUrls: imageAttachments.map((att) => att.url) };
  }

  const driveLinkInDesc = card.desc?.match(DRIVE_LINK_RE)?.[0];
  if (driveLinkInDesc) {
    return { mediaType: "video", mediaUrls: [driveLinkInDesc] };
  }

  const nonImageAttachment = (card.attachments ?? [])[0];
  if (nonImageAttachment) {
    const driveLinkInAttachment = nonImageAttachment.url.match(DRIVE_LINK_RE)?.[0];
    if (driveLinkInAttachment) {
      return { mediaType: "video", mediaUrls: [driveLinkInAttachment] };
    }
  }

  return null;
}

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

  const shortLink = await getBoardShortLink(boardId);

  const { data: client } = await supabase
    .from("clients")
    .select("id, trello_board_id, is_active")
    .eq("trello_board_id", shortLink ?? boardId)
    .maybeSingle();

  if (!client || !client.is_active) {
    return new Response("ok", { status: 200 });
  }

  // O card é buscado sozinho primeiro: se ele sumiu, buscar anexos dele daria
  // 404 e derrubaria o resto do processamento.
  const card = await getCardOrNull(cardId);

  // Card excluído, arquivado ou movido pra outro board deixa de fazer parte do
  // planejamento do cliente — sem isso o post ficava no banco pra sempre e
  // continuava aparecendo no calendário sem ter card nenhum por trás.
  //
  // Arquivar a lista inteira conta igual: o card em si continua com
  // closed=false, mas sumiu do board do mesmo jeito.
  if (
    !card ||
    card.closed ||
    card.list?.closed ||
    (card.idBoard && card.idBoard !== boardId)
  ) {
    await supabase
      .from("posts")
      .delete()
      .eq("client_id", client.id)
      .eq("trello_card_id", cardId);
    return new Response("ok", { status: 200 });
  }

  const [attachments, boardLabels] = await Promise.all([
    getCardAttachments(cardId),
    getBoardLabels(boardId),
  ]);
  const media = extractMedia({ desc: card.desc, attachments });
  const labelNameById = new Map(boardLabels.map((label) => [label.id, label.name ?? ""]));
  const labelNames = (card.idLabels ?? []).map((id) => labelNameById.get(id) ?? "");

  const listName = card.list?.name ?? null;
  const mappedStatus = mapListNameToStatus(listName);

  // Uma lista que não bate com nenhuma etapa vira "em produção" por falta de
  // opção melhor, mas isso fica registrado: senão um nome de lista fora do
  // padrão faz o post aparecer na etapa errada sem deixar rastro.
  if (!mappedStatus) {
    await supabase.from("trello_sync_log").insert({
      trello_card_id: card.id,
      event_type: "sync-trello:lista-nao-reconhecida",
      payload: { listName },
    });
  }

  const { error } = await supabase.from("posts").upsert(
    {
      client_id: client.id,
      trello_card_id: card.id,
      trello_list_id: card.idList,
      trello_list_name: listName,
      format: extractFormat(labelNames),
      caption: card.desc ?? null,
      media_type: media?.mediaType ?? null,
      media_urls: media?.mediaUrls ?? [],
      scheduled_date: card.due ? card.due.slice(0, 10) : null,
      status: mappedStatus ?? "em_producao",
    },
    { onConflict: "trello_card_id" },
  );

  if (error) {
    console.error("Falha ao gravar post:", error);
    return new Response("ok", { status: 200 });
  }

  return new Response("ok", { status: 200 });
});
