"use client";

import { useState } from "react";
import { decidePost } from "@/lib/api";
import { FORMAT_LABEL } from "@/lib/statusLabels";
import type { ClientPost } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

function driveEmbedUrl(url: string): string | null {
  const match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  return `https://drive.google.com/file/d/${match[1]}/preview`;
}

export function PostModal({
  post,
  token,
  onClose,
  onDecided,
}: {
  post: ClientPost;
  token: string;
  onClose: () => void;
  onDecided: (postId: string, status: ClientPost["status"]) => void;
}) {
  const [mode, setMode] = useState<"idle" | "requesting">("idle");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAct = post.status === "aguardando_aprovacao";
  const embedUrl = post.media_type === "video" && post.media_url ? driveEmbedUrl(post.media_url) : null;

  async function handleApprove() {
    setSubmitting(true);
    setError(null);
    try {
      await decidePost({ token, postId: post.id, action: "aprovado" });
      onDecided(post.id, "aprovado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao aprovar.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestChange() {
    if (!comment.trim()) {
      setError("Escreva o que precisa ser ajustado.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await decidePost({ token, postId: post.id, action: "alteracao_solicitada", comment });
      onDecided(post.id, "em_producao");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar solicitação.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {post.format && (
              <span className="text-sm font-medium text-neutral-500">
                {FORMAT_LABEL[post.format]}
              </span>
            )}
            <StatusBadge status={post.status} />
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="mt-4">
          {post.media_type === "imagem" && post.media_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.media_url} alt="Mídia do post" className="w-full rounded-lg" />
          )}
          {post.media_type === "video" && embedUrl && (
            <iframe src={embedUrl} className="aspect-video w-full rounded-lg" allow="autoplay" />
          )}
          {post.media_type === "video" && !embedUrl && post.media_url && (
            <a
              href={post.media_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-600 underline dark:text-blue-400"
            >
              Abrir vídeo
            </a>
          )}
          {!post.media_url && (
            <p className="text-sm text-neutral-400">Sem mídia anexada ainda.</p>
          )}
        </div>

        {post.caption && (
          <p className="mt-4 whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">
            {post.caption}
          </p>
        )}

        {canAct && (
          <div className="mt-5 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            {mode === "idle" ? (
              <div className="flex gap-2">
                <button
                  onClick={handleApprove}
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Aprovar
                </button>
                <button
                  onClick={() => setMode("requesting")}
                  disabled={submitting}
                  className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  Pedir alteração
                </button>
              </div>
            ) : (
              <div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="O que precisa ser ajustado?"
                  rows={3}
                  className="w-full rounded-lg border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={handleRequestChange}
                    disabled={submitting}
                    className="flex-1 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
                  >
                    Enviar solicitação
                  </button>
                  <button
                    onClick={() => setMode("idle")}
                    disabled={submitting}
                    className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
