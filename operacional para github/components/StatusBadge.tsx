import { STATUS_BADGE_CLASS, STATUS_LABEL } from "@/lib/statusLabels";
import type { PostStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
