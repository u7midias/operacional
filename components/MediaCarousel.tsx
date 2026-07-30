"use client";

import { useEffect, useRef, useState } from "react";

export function MediaCarousel({ urls }: { urls: string[] }) {
  const [index, setIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (urls.length === 0) return null;

  const hasMultiple = urls.length > 1;

  function goTo(newIndex: number) {
    setIndex(Math.max(0, Math.min(urls.length - 1, newIndex)));
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!hasMultiple) return;
    setDragging(true);
    startXRef.current = e.clientX;
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignora navegadores que não suportam pointer capture nesse elemento.
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setDragOffset(e.clientX - startXRef.current);
  }

  function handlePointerUp() {
    if (!dragging) return;
    const threshold = containerWidth * 0.2;
    if (dragOffset < -threshold) goTo(index + 1);
    else if (dragOffset > threshold) goTo(index - 1);
    setDragging(false);
    setDragOffset(0);
  }

  const dragPercent = containerWidth ? (dragOffset / containerWidth) * 100 : 0;
  const translate = -index * 100 + dragPercent;

  return (
    <div className="relative overflow-hidden rounded-lg" ref={containerRef}>
      <div
        className={`flex touch-pan-y ${dragging ? "" : "transition-transform duration-300 ease-out"}`}
        style={{ transform: `translateX(${translate}%)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {urls.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt={`Mídia ${i + 1} de ${urls.length}`}
            className="w-full shrink-0 select-none"
            draggable={false}
          />
        ))}
      </div>

      {hasMultiple && (
        <>
          {index > 0 && (
            <button
              onClick={() => goTo(index - 1)}
              aria-label="Imagem anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-2.5 py-1.5 text-white hover:bg-black/70"
            >
              ‹
            </button>
          )}
          {index < urls.length - 1 && (
            <button
              onClick={() => goTo(index + 1)}
              aria-label="Próxima imagem"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-2.5 py-1.5 text-white hover:bg-black/70"
            >
              ›
            </button>
          )}
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
          <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-xs font-medium text-white">
            {index + 1}/{urls.length}
          </span>
        </>
      )}
    </div>
  );
}
