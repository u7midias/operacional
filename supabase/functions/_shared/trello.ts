export type PostStatus =
  | "em_producao"
  | "aguardando_aprovacao"
  | "aprovado"
  | "publicado";

export type PostFormat = "feed" | "story" | "reels";
export type MediaType = "imagem" | "video";

export interface TrelloLabel {
  id: string;
  name: string;
  color: string | null;
}

export interface TrelloAttachment {
  id: string;
  url: string;
  name: string;
  mimeType?: string;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  idList: string;
  idBoard: string;
  labels: TrelloLabel[];
  attachments: TrelloAttachment[];
  list?: { id: string; name: string };
}

export interface TrelloList {
  id: string;
  name: string;
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

export async function getCard(cardId: string): Promise<TrelloCard> {
  const res = await trelloFetch(
    `/cards/${cardId}?fields=name,desc,due,idList,idBoard&labels=true&attachments=true&list=true`,
  );
  return await res.json();
}

export async function getBoardLists(boardId: string): Promise<TrelloList[]> {
  const res = await trelloFetch(`/boards/${boardId}/lists?fields=name`);
  return await res.json();
}

export async function findListIdByName(
  boardId: string,
  listName: string,
): Promise<string | null> {
  const lists = await getBoardLists(boardId);
  const normalizedTarget = normalize(listName);
  const match = lists.find((list) => normalize(list.name) === normalizedTarget);
  return match?.id ?? null;
}

export async function moveCardToList(cardId: string, listId: string): Promise<void> {
  await trelloFetch(`/cards/${cardId}?idList=${listId}`, { method: "PUT" });
}

export async function commentOnCard(cardId: string, text: string): Promise<void> {
  await trelloFetch(`/cards/${cardId}/actions/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

const COMBINING_DIACRITICS_RE = /[̀-ͯ]/g;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS_RE, "")
    .trim()
    .toLowerCase();
}

// Listas internas do Trello -> status mostrado ao cliente
const LIST_NAME_TO_STATUS: Record<string, PostStatus> = {
  "informacoes": "em_producao",
  "criacao de legenda": "em_producao",
  "producao de design/video": "em_producao",
  "revisao geral": "em_producao",
  "aprovacao": "aguardando_aprovacao",
  "agendar": "aprovado",
  "concluido": "publicado",
};

export function mapListNameToStatus(listName: string | null | undefined): PostStatus {
  if (!listName) return "em_producao";
  return LIST_NAME_TO_STATUS[normalize(listName)] ?? "em_producao";
}

const FORMAT_LABELS: Record<string, PostFormat> = {
  feed: "feed",
  story: "story",
  reels: "reels",
};

export function extractFormat(labels: TrelloLabel[]): PostFormat | null {
  for (const label of labels ?? []) {
    const match = FORMAT_LABELS[normalize(label.name ?? "")];
    if (match) return match;
  }
  return null;
}

const DRIVE_LINK_RE = /https:\/\/(?:drive|docs)\.google\.com\S+/i;

export function extractMedia(
  card: Pick<TrelloCard, "desc" | "attachments">,
): { mediaType: MediaType; mediaUrl: string } | null {
  const imageAttachment = (card.attachments ?? []).find((att) =>
    att.mimeType?.startsWith("image/") || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(att.url),
  );
  if (imageAttachment) {
    return { mediaType: "imagem", mediaUrl: imageAttachment.url };
  }

  const driveLinkInDesc = card.desc?.match(DRIVE_LINK_RE)?.[0];
  if (driveLinkInDesc) {
    return { mediaType: "video", mediaUrl: driveLinkInDesc };
  }

  const nonImageAttachment = (card.attachments ?? [])[0];
  if (nonImageAttachment) {
    const driveLinkInAttachment = nonImageAttachment.url.match(DRIVE_LINK_RE)?.[0];
    if (driveLinkInAttachment) {
      return { mediaType: "video", mediaUrl: driveLinkInAttachment };
    }
  }

  return null;
}
