// Edge Function: admin-clients
//
// Painel interno (não é o portal do cliente): lista os clientes já
// cadastrados e cria novos. Ao criar (ou recadastrar um board já existente):
// 1. Importa todos os cards que já existem no board (backfill) — o webhook
//    só avisa sobre mudanças futuras, então sem isso os posts já criados
//    antes do cadastro nunca apareceriam no portal.
// 2. Registra o webhook no Trello, pra manter tudo sincronizado dali em
//    diante.
//
// Protegido por uma senha simples (ADMIN_SECRET, configurada como secret da
// função) enviada em toda chamada. Não é uma autenticação robusta, mas é
// suficiente para uma tela de uso interno da equipe.
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
  labels: TrelloLabel[];
  attachments: TrelloAttachment[];
}

interface TrelloList {
  id: string;
  name: string;
}

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

async function getBoardLists(boardFullId: string): Promise<TrelloList[]> {
  const res = await trelloFetch(`/boards/${boardFullId}/lists?fields=name`);
  return await res.json();
}

async function getBoardCards(boardFullId: string): Promise<TrelloCard[]> {
  const res = await trelloFetch(
    `/boards/${boardFullId}/cards?filter=open&fields=desc,due,idList&labels=true&attachments=true`,
  );
  return await res.json();
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
  const expected = Deno.env.get("ADMIN_SECRET")?.trim();
  return !!expected && secret?.trim() === expected;
}

const COMBINING_DIACRITICS_RE = /[̀-ͯ]/g;

function normalize(value: string): string {
  return value.normalize("NFD").replace(COMBINING_DIACRITICS_RE, "").trim().toLowerCase();
}

const LIST_NAME_TO_STATUS: Record<string, PostStatus> = {
  "informacoes": "em_producao",
  "criacao de legenda": "criacao_legenda",
  "producao de design/video": "em_producao",
  "revisao geral": "em_revisao",
  "aprovacao": "em_aprovacao",
  "alteracao": "em_alteracao",
  "agendamento": "em_agendamento",
  "concluido": "publicado",
};

function mapListNameToStatus(listName: string | null | undefined): PostStatus {
  if (!listName) return "em_producao";
  return LIST_NAME_TO_STATUS[normalize(listName)] ?? "em_producao";
}

const FORMAT_LABELS: Record<string, PostFormat> = {
  feed: "feed",
  story: "story",
  reels: "reels",
};

function extractFormat(labels: TrelloLabel[]): PostFormat | null {
  for (const label of labels ?? []) {
    const match = FORMAT_LABELS[normalize(label.name ?? "")];
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
  card: Pick<TrelloCard, "desc" | "attachments">,
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

// deno-lint-ignore no-explicit-any
async function backfillPosts(supabase: any, clientId: string, boardFullId: string): Promise<number> {
  const [lists, cards] = await Promise.all([getBoardLists(boardFullId), getBoardCards(boardFullId)]);
  const listNameById = new Map(lists.map((list) => [list.id, list.name]));

  if (cards.length === 0) return 0;

  const rows = cards.map((card) => {
    const listName = listNameById.get(card.idList) ?? null;
    const media = extractMedia(card);
    return {
      client_id: clientId,
      trello_card_id: card.id,
      trello_list_id: card.idList,
      trello_list_name: listName,
      format: extractFormat(card.labels ?? []),
      caption: card.desc ?? null,
      media_type: media?.mediaType ?? null,
      media_urls: media?.mediaUrls ?? [],
      scheduled_date: card.due ? card.due.slice(0, 10) : null,
      status: mapListNameToStatus(listName),
    };
  });

  const { error } = await supabase.from("posts").upsert(rows, { onConflict: "trello_card_id" });
  if (error) throw new Error(`Falha ao importar posts: ${error.message}`);

  return rows.length;
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

  let client: {
    id: string;
    name: string;
    trello_board_id: string;
    access_token: string;
    is_active: boolean;
    created_at: string;
  };

  const { data: inserted, error: insertError } = await supabase
    .from("clients")
    .insert({ name, trello_board_id: shortLink })
    .select("id, name, trello_board_id, access_token, is_active, created_at")
    .single();

  if (insertError) {
    // Board já cadastrado antes (ex: primeira tentativa criou o cliente mas
    // falhou no webhook/import) — reaproveita o cliente existente em vez de
    // travar, e tenta de novo o resto do processo.
    if (insertError.code === "23505") {
      const { data: existing, error: fetchError } = await supabase
        .from("clients")
        .select("id, name, trello_board_id, access_token, is_active, created_at")
        .eq("trello_board_id", shortLink)
        .single();

      if (fetchError || !existing) {
        return jsonResponse({ error: "Já existe um cliente com esse board, mas não consegui recarregá-lo." }, 500);
      }
      client = existing;
    } else {
      console.error("Falha ao criar cliente:", insertError);
      return jsonResponse({ error: "Falha ao criar cliente." }, 400);
    }
  } else {
    client = inserted;
  }

  let importedCount = 0;
  let webhookWarning: string | null = null;
  let boardFullId: string | null = null;

  try {
    boardFullId = await getBoardFullId(shortLink);
    importedCount = await backfillPosts(supabase, client.id, boardFullId);
  } catch (backfillError) {
    console.error("Falha ao importar posts existentes:", backfillError);
    webhookWarning =
      "Cliente criado, mas não consegui importar os posts que já existem no board. " +
      "Confira se o código do board está certo (o de 8 caracteres da URL do board).";
  }

  if (boardFullId && !webhookWarning) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      await createTrelloWebhook(boardFullId, `${supabaseUrl}/functions/v1/sync-trello`);
    } catch (webhookError) {
      console.error("Falha ao criar webhook do Trello:", webhookError);
      webhookWarning =
        "Posts importados, mas não consegui registrar o webhook no Trello — mudanças futuras " +
        "não vão sincronizar sozinhas até isso ser resolvido.";
    }
  }

  return jsonResponse({ client, importedCount, webhookWarning });
});
