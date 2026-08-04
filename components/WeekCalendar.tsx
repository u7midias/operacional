"use client";

import { STATUS_DOT_CLASS, canOpenPost } from "@/lib/statusLabels";
import type { ClientPost } from "@/lib/types";
import { FormatBadge } from "./FormatBadge";
import { StatusBadge } from "./StatusBadge";
import { toDateKey } from "./MonthCalendar";

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function buildWeekDays(weekCursor: Date): Date[] {
  const start = startOfWeek(weekCursor);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function WeekCalendar({
  weekCursor,
  posts,
  onSelectPost,
}: {
  weekCursor: Date;
  posts: ClientPost[];
  onSelectPost: (post: ClientPost) => void;
}) {
  const days = buildWeekDays(weekCursor);
  const postsByDate = new Map<string, ClientPost[]>();
  for (const post of posts) {
    if (!post.scheduled_date) continue;
    const list = postsByDate.get(post.scheduled_date) ?? [];
    list.push(post);
    postsByDate.set(post.scheduled_date, list);
  }

  const today = toDateKey(new Date());

  return (
    <div className="flex flex-col gap-2">
      {days.map((date, i) => {
        const key = toDateKey(date);
        const dayPosts = postsByDate.get(key) ?? [];
        const isToday = key === today;

        return (
          <div
            key={key}
            className={`overflow-hidden rounded-xl border ${
              isToday
                ? "border-neutral-900 dark:border-white"
                : "border-neutral-200 dark:border-neutral-800"
            }`}
          >
            <div
              className={`flex items-baseline gap-2 px-3 py-2 ${
                isToday
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "bg-neutral-50 dark:bg-neutral-900"
              }`}
            >
              <span className="text-lg font-bold leading-none">{date.getDate()}</span>
              <span className="text-sm font-medium">{WEEKDAY_LABELS[i]}</span>
              {isToday && <span className="ml-auto text-[10px] font-semibold uppercase">hoje</span>}
            </div>

            {dayPosts.length === 0 ? (
              <p className="px-3 py-3 text-xs text-neutral-400">Nenhum post neste dia</p>
            ) : (
              <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
                {dayPosts.map((post) => {
                  const openable = canOpenPost(post.status);
                  const content = (
                    <>
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASS[post.status]}`}
                      />
                      <FormatBadge post={post} />
                      <span className="ml-auto flex items-center gap-1.5">
                        <StatusBadge status={post.status} />
                        {openable && <span className="text-neutral-300">›</span>}
                      </span>
                    </>
                  );

                  // Posts ainda em produção interna aparecem (o cliente
                  // acompanha o planejamento) mas não abrem.
                  return openable ? (
                    <button
                      key={post.id}
                      onClick={() => onSelectPost(post)}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-neutral-50 active:bg-neutral-100 dark:hover:bg-neutral-900"
                    >
                      {content}
                    </button>
                  ) : (
                    <div key={post.id} className="flex items-center gap-2 px-3 py-2.5 opacity-50">
                      {content}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
