import type { PostStatus } from "./types";

export const STATUS_LABEL: Record<PostStatus, string> = {
  criacao_legenda: "Criação de legenda",
  em_producao: "Em produção",
  em_revisao: "Em revisão",
  em_aprovacao: "Em aprovação",
  em_alteracao: "Em Alteração",
  em_agendamento: "Em agendamento",
  publicado: "Publicado",
};

export const STATUS_BADGE_CLASS: Record<PostStatus, string> = {
  criacao_legenda: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  em_producao: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  em_revisao: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  em_aprovacao: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  em_alteracao: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  em_agendamento: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  publicado: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

// Usado como faixa lateral no chip do calendário mensal: ali a cor de fundo
// já indica o formato, então o status entra como uma borda fina — cabe em
// célula estreita sem roubar espaço do texto.
export const STATUS_BORDER_CLASS: Record<PostStatus, string> = {
  criacao_legenda: "border-slate-400",
  em_producao: "border-blue-500",
  em_revisao: "border-violet-500",
  em_aprovacao: "border-amber-500",
  em_alteracao: "border-orange-500",
  em_agendamento: "border-teal-500",
  publicado: "border-green-500",
};

export const STATUS_DOT_CLASS: Record<PostStatus, string> = {
  criacao_legenda: "bg-slate-400",
  em_producao: "bg-blue-500",
  em_revisao: "bg-violet-500",
  em_aprovacao: "bg-amber-500",
  em_alteracao: "bg-orange-500",
  em_agendamento: "bg-teal-500",
  publicado: "bg-green-500",
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

export const FORMAT_BADGE_CLASS: Record<string, string> = {
  feed: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  story: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200",
  reels: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
};

export const FORMAT_BADGE_FALLBACK_CLASS =
  "bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300";
