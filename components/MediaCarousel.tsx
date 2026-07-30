"use client";

import { useState } from "react";

export function MediaCarousel({ urls }: { urls: string[] }) {
  const [index, setIndex] = useState(0);

  if (urls.length === 0) return null;

  const hasMultiple = urls.length > 1;

  function goTo(newIndex: number) {
    setIndex((newIndex + urls.length) % urls.length);
  }

  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={urls[index]} alt={`Mídia ${index + 1} de ${urls.length}`} className="w-full rounded-lg" />

      {hasMultiple && (
        <>
          <button
            onClick={() => goTo(index - 1)}
            aria-label="Imagem anterior"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-2.5 py-1.5 text-white hover:bg-black/70"
          >
            ‹
          </button>
          <button
            onClick={() => goTo(index + 1)}
            aria-label="Próxima imagem"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-2.5 py-1.5 text-white hover:bg-black/70"
          >
            ›
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {urls.map((url, i) => (
              <button
                key={url}
                onClick={() => goTo(i)}
                aria-label={`Ir para imagem ${i + 1}`}
                className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`}
              />
            ))}
          </div>
          <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-xs font-medium text-white">
            {index + 1}/{urls.length}
          </span>
        </>
      )}
    </div>
  );
}
