import { FORMAT_BADGE_CLASS, postLabel } from "@/lib/statusLabels";
import type { ClientPost } from "@/lib/types";

export function FormatBadge({ post }: { post: ClientPost }) {
  return (
    <span
      className={`inline-block max-w-[12rem] truncate rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${FORMAT_BADGE_CLASS}`}
      title={postLabel(post)}
    >
      {postLabel(post)}
    </span>
  );
}
