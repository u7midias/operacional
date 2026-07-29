import type { GetPostsResponse } from "./types";

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
