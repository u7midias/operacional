"use client";

import { FORMAT_LABEL } from "@/lib/statusLabels";
import type { ClientPost } from "@/lib/types";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCalendarCells(monthCursor: Date): (Date | null)[] {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay.getDay(); i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const STATUS_DOT_CLASS: Record<ClientPost["status"], string> = {
  em_producao: "bg-neutral-400",
  aguardando_aprovacao: "bg-amber-500",
  aprovado: "bg-blue-500",
  publicado: "bg-green-500",
};

export function MonthCalendar({
  monthCursor,
  posts,
  onSelectPost,
}: {
  monthCursor: Date;
  posts: ClientPost[];
  onSelectPost: (post: ClientPost) => void;
}) {
  const cells = buildCalendarCells(monthCursor);
  const postsByDate = new Map<string, ClientPost[]>();
  for (const post of posts) {
    if (!post.scheduled_date) continue;
    const list = postsByDate.get(post.scheduled_date) ?? [];
    list.push(post);
    postsByDate.set(post.scheduled_date, list);
  }

  const today = toDateKey(new Date());

  return (
    <div className="grid grid-cols-7 gap-1 sm:gap-2">
      {WEEKDAY_LABELS.map((label) => (
        <div key={label} className="text-center text-xs font-medium text-neutral-500">
          {label}
        </div>
      ))}

      {cells.map((date, i) => {
        if (!date) return <div key={`empty-${i}`} className="min-h-20" />;

        const key = toDateKey(date);
        const dayPosts = postsByDate.get(key) ?? [];
        const isToday = key === today;

        return (
          <div
            key={key}
            className={`min-h-20 rounded-lg border border-neutral-200 p-1 dark:border-neutral-800 ${
              isToday ? "ring-1 ring-neutral-400" : ""
            }`}
          >
            <div className="text-xs text-neutral-500">{date.getDate()}</div>
            <div className="mt-1 flex flex-col gap-1">
              {dayPosts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => onSelectPost(post)}
                  className="flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-left text-[11px] leading-tight hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[post.status]}`} />
                  <span className="truncate">
                    {post.format ? FORMAT_LABEL[post.format] : "Post"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { toDateKey };
