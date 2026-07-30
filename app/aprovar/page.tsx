"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchPosts } from "@/lib/api";
import type { ClientPost } from "@/lib/types";
import { MonthCalendar } from "@/components/MonthCalendar";
import { PostModal } from "@/components/PostModal";
import { WeekCalendar, startOfWeek } from "@/components/WeekCalendar";

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

const WEEK_DAY_MONTH_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
});

type ViewMode = "month" | "week";

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function weekRangeLabel(weekCursor: Date): string {
  const start = startOfWeek(weekCursor);
  const end = addDays(start, 6);
  return `${WEEK_DAY_MONTH_FORMATTER.format(start)} – ${WEEK_DAY_MONTH_FORMATTER.format(end)}`;
}

function ClientPortal({ token }: { token: string }) {
  const [clientName, setClientName] = useState<string | null>(null);
  const [posts, setPosts] = useState<ClientPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [weekCursor, setWeekCursor] = useState(() => startOfWeek(new Date()));
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedPost, setSelectedPost] = useState<ClientPost | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetchPosts(token);
        if (cancelled) return;
        setClientName(res.client.name);
        setPosts(res.posts);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Falha ao carregar posts.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const postsInMonth = useMemo(
    () =>
      posts.filter((post) => {
        if (!post.scheduled_date) return false;
        const [year, month] = post.scheduled_date.split("-").map(Number);
        return year === monthCursor.getFullYear() && month === monthCursor.getMonth() + 1;
      }),
    [posts, monthCursor],
  );

  const postsInWeek = useMemo(() => {
    const start = startOfWeek(weekCursor);
    const end = addDays(start, 6);
    return posts.filter((post) => {
      if (!post.scheduled_date) return false;
      const date = new Date(`${post.scheduled_date}T00:00:00`);
      return date >= start && date <= end;
    });
  }, [posts, weekCursor]);

  function handleDecided(postId: string, status: ClientPost["status"]) {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, status } : p)));
    setSelectedPost(null);
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center p-8 text-sm text-neutral-500">
        Carregando...
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{clientName}</h1>
          <p className="text-sm text-neutral-500">Calendário de posts</p>
        </div>
      </header>

      <div className="mb-4 flex justify-center gap-1 rounded-lg border border-neutral-200 p-1 dark:border-neutral-800">
        <button
          onClick={() => setViewMode("month")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
            viewMode === "month"
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
        >
          Mês
        </button>
        <button
          onClick={() => setViewMode("week")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
            viewMode === "week"
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
        >
          Semana
        </button>
      </div>

      {viewMode === "month" ? (
        <>
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="rounded-lg border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              ← Anterior
            </button>
            <span className="text-sm font-medium capitalize">
              {MONTH_LABEL_FORMATTER.format(monthCursor)}
            </span>
            <button
              onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="rounded-lg border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Próximo →
            </button>
          </div>

          <MonthCalendar monthCursor={monthCursor} posts={postsInMonth} onSelectPost={setSelectedPost} />
        </>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setWeekCursor((d) => addDays(d, -7))}
              className="rounded-lg border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              ← Anterior
            </button>
            <span className="text-sm font-medium">{weekRangeLabel(weekCursor)}</span>
            <button
              onClick={() => setWeekCursor((d) => addDays(d, 7))}
              className="rounded-lg border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Próximo →
            </button>
          </div>

          <WeekCalendar weekCursor={weekCursor} posts={postsInWeek} onSelectPost={setSelectedPost} />
        </>
      )}

      {selectedPost && (
        <PostModal
          post={selectedPost}
          token={token}
          onClose={() => setSelectedPost(null)}
          onDecided={handleDecided}
        />
      )}
    </main>
  );
}

function ClientPortalGate() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  if (!token) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <p className="max-w-sm text-center text-sm text-neutral-500">
          Link inválido. Acesse pelo link enviado pela equipe (formato
          <code className="mx-1 rounded bg-neutral-100 px-1 dark:bg-neutral-800">
            /aprovar/?token=...
          </code>
          ).
        </p>
      </main>
    );
  }

  return <ClientPortal token={token} />;
}

export default function ClientPortalPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center p-8 text-sm text-neutral-500">
          Carregando...
        </main>
      }
    >
      <ClientPortalGate />
    </Suspense>
  );
}
