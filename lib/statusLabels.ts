import type { PostStatus } from "./types";

export const STATUS_LABEL: Record<PostStatus, string> = {
  criacao_legenda: "Criação de legenda",
  em_producao: "Em produção",
  em_revisao: "Em revisão",
  em_aprovacao: "Em aprovação",
  em_alteracao: "Em alteração",
  em_agendamento: "Em agendamento",
  publicado: "Publicado",
};

// Etapas vizinhas no fluxo precisam de tons bem distantes: em chip pequeno
// âmbar e laranja (aprovação/alteração) e teal e verde (agendamento/
// publicado) ficavam quase iguais. "Publicado" é sólido porque é o fim da
// linha — não pede mais nada de ninguém.
export const STATUS_BADGE_CLASS: Record<PostStatus, string> = {
  criacao_legenda: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  em_producao: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  em_revisao: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  em_aprovacao: "bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100",
  em_alteracao: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  em_agendamento: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  publicado: "bg-emerald-600 text-white dark:bg-emerald-600 dark:text-white",
};

export const STATUS_DOT_CLASS: Record<PostStatus, string> = {
  criacao_legenda: "bg-slate-400",
  em_producao: "bg-blue-500",
  em_revisao: "bg-violet-500",
  em_aprovacao: "bg-amber-500",
  em_alteracao: "bg-red-500",
  em_agendamento: "bg-cyan-500",
  publicado: "bg-emerald-600",
};

// Enquanto o post está em produção interna o cliente vê que ele existe e em
// que etapa está, mas não abre o conteúdo — só a partir de "Em aprovação",
// quando já há uma peça pronta pra ele avaliar.
const OPENABLE_STATUSES: PostStatus[] = ["em_aprovacao", "em_agendamento", "publicado"];

export function canOpenPost(status: PostStatus): boolean {
  return OPENABLE_STATUSES.includes(status);
}

export const FORMAT_LABEL: Record<string, string> = {
  feed: "Feed",
  story: "Story",
  reels: "Reels",
};

// Texto que aparece no chip do post. Feed/Story/Reels ganham o rótulo
// caprichado; qualquer outra etiqueta do Trello aparece como a equipe
// escreveu. "Post" é só o caso de card sem etiqueta nenhuma.
export function postLabel(post: { format: string | null; label_name: string | null }): string {
  if (post.format) return FORMAT_LABEL[post.format];
  return post.label_name?.trim() || "Post";
}

// A cor no sistema significa uma coisa só: a etapa do post (STATUS_*). O
// formato é informação secundária e aparece sempre em cinza, para não criar
// uma segunda escala de cor competindo com a legenda.
export const FORMAT_BADGE_CLASS =
  "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200";
