"use client";

import { canOpenPost } from "@/lib/statusLabels";
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
            className={`rounded-lg border border-neutral-200 p-3 dark:border-neutral-800 ${
              isToday ? "ring-1 ring-neutral-400" : ""
            }`}
          >
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm font-medium">{WEEKDAY_LABELS[i]}</span>
              <span className="text-xs text-neutral-500">{date.getDate()}</span>
            </div>

            {dayPosts.length === 0 ? (
              <p className="text-xs text-neutral-400">Sem posts</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {dayPosts.map((post) => {
                  const openable = canOpenPost(post.status);
                  const content = (
                    <>
                      <FormatBadge format={post.format} />
                      <StatusBadge status={post.status} />
                    </>
                  );

                  // Posts ainda em produção interna aparecem (o cliente
                  // acompanha o planejamento) mas não abrem.
                  return openable ? (
                    <button
                      key={post.id}
                      onClick={() => onSelectPost(post)}
                      className="flex items-center justify-between gap-2 rounded-lg bg-neutral-50 px-2.5 py-2 text-left hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                    >
                      {content}
                    </button>
                  ) : (
                    <div
                      key={post.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-neutral-50 px-2.5 py-2 opacity-60 dark:bg-neutral-800"
                    >
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
