"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchPosts } from "@/lib/api";
import type { ClientPost } from "@/lib/types";
import { MonthCalendar } from "@/components/MonthCalendar";
import { PostModal } from "@/components/PostModal";
import { StatusLegend } from "@/components/StatusLegend";
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

  const navButtonClass =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800";

  function tabClass(active: boolean) {
    return `flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
      active
        ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
        : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
    }`;
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-3 pb-10 pt-5 sm:px-8 sm:pt-8">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">{clientName}</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Toque nos posts <span className="font-medium text-amber-600">em aprovação</span> para
          avaliar.
        </p>
      </header>

      {/* Alternador Mês/Semana, estilo "segmented control" */}
      <div className="mb-4 flex gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800/60">
        <button onClick={() => setViewMode("month")} className={tabClass(viewMode === "month")}>
          Mês
        </button>
        <button onClick={() => setViewMode("week")} className={tabClass(viewMode === "week")}>
          Semana
        </button>
      </div>

      {viewMode === "month" ? (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className={navButtonClass}
              aria-label="Mês anterior"
            >
              ‹
            </button>
            <span className="text-base font-semibold capitalize">
              {MONTH_LABEL_FORMATTER.format(monthCursor)}
            </span>
            <button
              onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className={navButtonClass}
              aria-label="Próximo mês"
            >
              ›
            </button>
          </div>

          <MonthCalendar monthCursor={monthCursor} posts={postsInMonth} onSelectPost={setSelectedPost} />
        </>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              onClick={() => setWeekCursor((d) => addDays(d, -7))}
              className={navButtonClass}
              aria-label="Semana anterior"
            >
              ‹
            </button>
            <span className="text-base font-semibold">{weekRangeLabel(weekCursor)}</span>
            <button
              onClick={() => setWeekCursor((d) => addDays(d, 7))}
              className={navButtonClass}
              aria-label="Próxima semana"
            >
              ›
            </button>
          </div>

          <WeekCalendar weekCursor={weekCursor} posts={postsInWeek} onSelectPost={setSelectedPost} />
        </>
      )}

      <StatusLegend />

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
