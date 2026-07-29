"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { fetchPosts } from "@/lib/api";
import { FORMAT_LABEL } from "@/lib/statusLabels";
import type { ClientPost } from "@/lib/types";
import { MonthCalendar } from "@/components/MonthCalendar";
import { PostModal } from "@/components/PostModal";
import { StatusBadge } from "@/components/StatusBadge";

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export default function ClientPortalPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [clientName, setClientName] = useState<string | null>(null);
  const [posts, setPosts] = useState<ClientPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
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

  const postsWithoutDate = useMemo(() => posts.filter((post) => !post.scheduled_date), [posts]);

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

      {postsWithoutDate.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-medium text-neutral-500">Sem data definida</h2>
          <div className="flex flex-col gap-2">
            {postsWithoutDate.map((post) => (
              <button
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-left text-sm hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
              >
                <span>{post.format ? FORMAT_LABEL[post.format] : "Post"}</span>
                <StatusBadge status={post.status} />
              </button>
            ))}
          </div>
        </section>
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
