import { FORMAT_BADGE_CLASS, FORMAT_LABEL } from "@/lib/statusLabels";
import type { PostFormat } from "@/lib/types";

export function FormatBadge({ format }: { format: PostFormat | null }) {
  const label = format ? FORMAT_LABEL[format] : "Post";

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${FORMAT_BADGE_CLASS}`}
    >
      {label}
    </span>
  );
}
