import { FORMAT_BADGE_CLASS, FORMAT_LABEL, STATUS_DOT_CLASS, STATUS_LABEL } from "@/lib/statusLabels";
import type { PostFormat, PostStatus } from "@/lib/types";

// Ordem do pipeline, pra legenda ler como a linha do tempo do post.
const STATUS_ORDER: PostStatus[] = [
  "criacao_legenda",
  "em_producao",
  "em_revisao",
  "em_aprovacao",
  "em_alteracao",
  "em_agendamento",
  "publicado",
];

const FORMAT_ORDER: PostFormat[] = ["feed", "story", "reels"];

export function StatusLegend() {
  return (
    // Recolhida por padrão: no celular ela ocuparia meia tela sem precisar.
    <details className="mt-6 rounded-xl border border-neutral-200 dark:border-neutral-800">
      <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-semibold text-neutral-500 marker:content-none">
        O que significa cada cor?
      </summary>

      <div className="px-3 pb-3">
        <p className="mb-1.5 text-[11px] font-semibold text-neutral-400">Formato do post</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {FORMAT_ORDER.map((format) => (
            <span
              key={format}
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${FORMAT_BADGE_CLASS[format]}`}
            >
              {FORMAT_LABEL[format]}
            </span>
          ))}
        </div>

        <p className="mb-1.5 text-[11px] font-semibold text-neutral-400">Etapa</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {STATUS_ORDER.map((status) => (
            <span key={status} className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASS[status]}`} />
              {STATUS_LABEL[status]}
            </span>
          ))}
        </div>
      </div>
    </details>
  );
}
