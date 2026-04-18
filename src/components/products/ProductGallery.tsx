/**
 * File: src/components/products/ProductGallery.tsx
 * Purpose:
 *   Displays product images with clickable thumbnails and a fullscreen viewer.
 *   The viewer (lightbox) closes when:
 *     • Clicking outside the image
 *     • Pressing ESC
 *     • Clicking the ✕ (close) button at top-right
 */

"use client";

import { useState, useEffect } from "react";

type Props = {
  urls: string[];
  alt: string;
};

export default function ProductGallery({ urls, alt }: Props) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  // ESC key handler
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  if (!urls.length) {
    return (
      <div className="card overflow-hidden">
        <img src="/placeholder.png" alt={alt} className="w-full object-cover" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main display */}
      <div
        className="card overflow-hidden cursor-zoom-in relative"
        onClick={() => setLightbox(true)}
      >
        <img
          src={urls[active]}
          alt={alt}
          className="w-full object-cover"
          style={{ aspectRatio: "4/3" }}
        />
        <span className="absolute bottom-2 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded">
          Click to view
        </span>
      </div>

      {/* Thumbnails */}
      {urls.length > 1 && (
        <div className="grid grid-cols-3 gap-3">
          {urls.map((u, i) => (
            <button
              key={u + i}
              onClick={() => setActive(i)}
              className={[
                "card overflow-hidden ring-2 transition",
                i === active
                  ? "ring-[var(--primary)]"
                  : "ring-[var(--border)] hover:ring-[var(--primary)]/50",
              ].join(" ")}
            >
              <img
                src={u}
                alt={`${alt} ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightbox(false)}
        >
          {/* Close Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(false);
            }}
            className="absolute top-4 right-4 text-white text-3xl font-bold hover:text-[var(--primary)] transition"
            aria-label="Close viewer"
          >
            ×
          </button>

          {/* Image */}
          <img
            src={urls[active]}
            alt={`${alt} large`}
            className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-lg"
          />

          {/* Navigation */}
          {urls.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActive((active - 1 + urls.length) % urls.length);
                }}
                className="absolute left-4 text-white text-3xl font-bold hover:text-[var(--primary)] transition"
                aria-label="Previous image"
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActive((active + 1) % urls.length);
                }}
                className="absolute right-4 text-white text-3xl font-bold hover:text-[var(--primary)] transition"
                aria-label="Next image"
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
