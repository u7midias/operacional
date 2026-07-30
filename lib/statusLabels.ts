import type { PostStatus } from "./types";

export const STATUS_LABEL: Record<PostStatus, string> = {
  em_producao: "Em produção",
  aguardando_aprovacao: "Aguardando sua aprovação",
  aprovado: "Aprovado, aguardando publicação",
  publicado: "Publicado",
};

export const STATUS_BADGE_CLASS: Record<PostStatus, string> = {
  em_producao: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
  aguardando_aprovacao: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  aprovado: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  publicado: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

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
