"use client";

import {
  STATUS_BADGE_CLASS,
  STATUS_LABEL,
  canOpenPost,
  postLabel,
} from "@/lib/statusLabels";
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

function PostChip({
  post,
  onSelect,
}: {
  post: ClientPost;
  onSelect: (post: ClientPost) => void;
}) {
  const openable = canOpenPost(post.status);
  const label = postLabel(post);

  // O chip ocupa a largura da célula e corta o texto por dentro: numa grade
  // de 7 colunas no celular a célula tem ~45px, e um badge de largura
  // natural vazava por cima da borda. A cor é a da etapa — a mesma da
  // legenda — e o texto diz o formato.
  const className =
    `block w-full truncate rounded-md px-1 py-0.5 text-center text-[10px] font-semibold leading-tight sm:text-xs ` +
    STATUS_BADGE_CLASS[post.status];

  // Posts ainda em produção interna aparecem (o cliente acompanha o
  // planejamento) mas não abrem.
  if (!openable) {
    return (
      <span title={`${label} · ${STATUS_LABEL[post.status]}`} className={`${className} opacity-50`}>
        {label}
      </span>
    );
  }

  return (
    <button
      onClick={() => onSelect(post)}
      title={`${label} · ${STATUS_LABEL[post.status]}`}
      className={`${className} transition-transform hover:scale-[1.03] active:scale-95`}
    >
      {label}
    </button>
  );
}

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
    <div className="grid grid-cols-7 gap-0.5 sm:gap-1.5">
      {WEEKDAY_LABELS.map((label) => (
        <div
          key={label}
          className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-neutral-400 sm:text-xs"
        >
          {label}
        </div>
      ))}

      {cells.map((date, i) => {
        if (!date) return <div key={`empty-${i}`} />;

        const key = toDateKey(date);
        const dayPosts = postsByDate.get(key) ?? [];
        const isToday = key === today;

        return (
          <div
            key={key}
            className={`flex min-h-[4.5rem] min-w-0 flex-col rounded-lg border p-0.5 sm:min-h-24 sm:p-1.5 ${
              isToday
                ? "border-neutral-900 bg-neutral-50 dark:border-white dark:bg-neutral-900"
                : "border-neutral-200 dark:border-neutral-800"
            }`}
          >
            <div
              className={`mb-0.5 text-center text-[10px] sm:text-left sm:text-xs ${
                isToday
                  ? "font-bold text-neutral-900 dark:text-white"
                  : "text-neutral-400"
              }`}
            >
              {date.getDate()}
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              {dayPosts.map((post) => (
                <PostChip key={post.id} post={post} onSelect={onSelectPost} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { toDateKey };
