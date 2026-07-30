import { STATUS_DOT_CLASS, STATUS_LABEL } from "@/lib/statusLabels";
import type { PostStatus } from "@/lib/types";

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

export function StatusLegend() {
  return (
    <div className="mt-6 flex flex-wrap gap-x-4 gap-y-1.5">
      {STATUS_ORDER.map((status) => (
        <span key={status} className="flex items-center gap-1.5 text-xs text-neutral-500">
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASS[status]}`} />
          {STATUS_LABEL[status]}
        </span>
      ))}
    </div>
  );
}
