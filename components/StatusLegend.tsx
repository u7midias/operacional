import { STATUS_BADGE_CLASS, STATUS_LABEL } from "@/lib/statusLabels";
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
    // Recolhida por padrão: no celular ela ocuparia meia tela sem precisar.
    <details className="mt-6 rounded-xl border border-neutral-200 dark:border-neutral-800">
      <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-semibold text-neutral-500 marker:content-none">
        O que significa cada cor?
      </summary>

      <div className="px-3 pb-3">
        {/* Os mesmos chips do calendário, na mesma cor: a cor é sempre a
            etapa, e o texto dentro do chip é o formato (Feed/Story/Reels). */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_ORDER.map((status) => (
            <span
              key={status}
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE_CLASS[status]}`}
            >
              {STATUS_LABEL[status]}
            </span>
          ))}
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-neutral-400">
          A cor mostra em que etapa o post está. O texto dentro do quadradinho
          diz o formato: Feed, Story ou Reels. Só dá pra abrir o post a partir
          de &ldquo;Em aprovação&rdquo;.
        </p>
      </div>
    </details>
  );
}
