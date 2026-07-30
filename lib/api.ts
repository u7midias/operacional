import type { AdminClient, GetPostsResponse } from "./types";

function functionsUrl(name: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL;
  if (!base) {
    throw new Error("NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL não configurado.");
  }
  return `${base.replace(/\/$/, "")}/${name}`;
}

async function postJson<T>(name: string, body: unknown): Promise<T> {
  const res = await fetch(functionsUrl(name), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error ?? `Erro inesperado (${res.status}).`);
  }

  return data as T;
}

export function fetchPosts(token: string): Promise<GetPostsResponse> {
  return postJson<GetPostsResponse>("get-posts", { token });
}

// As imagens vêm sempre por aqui, nunca direto do Trello: as URLs de anexo
// do Trello exigem login no board, então quebrariam pro cliente.
export function mediaUrl(token: string, postId: string, index: number): string {
  const url = new URL(functionsUrl("get-media"));
  url.searchParams.set("token", token);
  url.searchParams.set("post_id", postId);
  url.searchParams.set("index", String(index));
  return url.toString();
}

export function decidePost(params: {
  token: string;
  postId: string;
  action: "aprovado" | "alteracao_solicitada";
  comment?: string;
}): Promise<{ ok: true; status: string }> {
  return postJson("approve-post", {
    token: params.token,
    post_id: params.postId,
    action: params.action,
    comment: params.comment,
  });
}

export async function adminListClients(adminSecret: string): Promise<AdminClient[]> {
  const res = await fetch(functionsUrl("admin-clients"), {
    method: "GET",
    headers: { "x-admin-secret": adminSecret },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error ?? `Erro inesperado (${res.status}).`);
  }

  return (data?.clients as AdminClient[]) ?? [];
}

export async function adminCreateClient(
  adminSecret: string,
  params: { name: string; trelloBoardShortLink: string },
): Promise<{
  client: AdminClient;
  importedCount: number;
  webhookWarning: string | null;
  unmappedLists: string[];
}> {
  const res = await fetch(functionsUrl("admin-clients"), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-secret": adminSecret },
    body: JSON.stringify({
      name: params.name,
      trello_board_short_link: params.trelloBoardShortLink,
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error ?? `Erro inesperado (${res.status}).`);
  }

  return data as {
    client: AdminClient;
    importedCount: number;
    webhookWarning: string | null;
    unmappedLists: string[];
  };
}

export async function adminDeleteClient(adminSecret: string, clientId: string): Promise<void> {
  const url = new URL(functionsUrl("admin-clients"));
  url.searchParams.set("client_id", clientId);

  const res = await fetch(url, {
    method: "DELETE",
    headers: { "x-admin-secret": adminSecret },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error ?? `Erro inesperado (${res.status}).`);
  }
}
