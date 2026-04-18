"use client";

import { useEffect, useState } from "react";

/**
 * Minimal theme toggle: emoji-only, tiny UI.
 * Assumes your CSS respects [data-theme="dark"] on <html> or <body>,
 * OR toggles a class .dark on <html>. Adjust to your current approach.
 */
export default function ThemeEmojiToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Detect initial
    const html = document.documentElement;
    const dark = html.classList.contains("dark") || html.getAttribute("data-theme") === "dark";
    setIsDark(dark);
  }, []);

  const toggle = () => {
    const html = document.documentElement;
    const next = !isDark;
    setIsDark(next);

    // Two common strategies—uncomment the one your app uses:
    // 1) Tailwind dark class:
    // next ? html.classList.add("dark") : html.classList.remove("dark");

    // 2) data-theme attr:
    if (next) html.setAttribute("data-theme", "dark");
    else html.setAttribute("data-theme", "light");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="text-lg leading-none px-2 py-1 rounded-full hover:bg-black/5"
      title="Toggle theme"
      aria-label="Toggle theme"
    >
      {isDark ? "🌙" : "☀️"}
    </button>
  );
}
