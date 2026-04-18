"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type FaceShape =
  | "oval"
  | "round"
  | "square"
  | "heart"
  | "diamond"
  | "triangle"
  | "";

type FrameShape =
  | "round"
  | "square"
  | "rectangle"
  | "aviator"
  | "cat-eye"
  | "browline"
  | "oval"
  | "geometric"
  | "wayfarer"
  | "";

type Material =
  | "acetate"
  | "metal"
  | "titanium"
  | "stainless steel"
  | "tr90"
  | "mixed"
  | "";

type Color =
  | "black"
  | "tortoise"
  | "gold"
  | "silver"
  | "clear"
  | "brown"
  | "blue"
  | "green"
  | "pink"
  | "red"
  | "";

type RecItem = {
  id: string;
  slug: string;
  name: string;
  price: number;
  image: string | null;
  score: number;
  matchLabel?: string;
  frameShape?: string | null;
  material?: string | null;
  colors?: string[] | null;
};

type ApiResp =
  | { ok: true; items: RecItem[] }
  | { ok: false; error: string; details?: any };

const STEPS = [
  "Face shape",
  "Frame shape",
  "Material",
  "Color",
  "Results",
] as const;

const QUIZ_STATE_KEY = "aloyon_find_frame_state";
const QUIZ_STATE_TS_KEY = "aloyon_find_frame_state_ts";
const RESTORE_TTL_MS = 30 * 60 * 1000;

type QuizState = {
  step: number;
  faceShape: FaceShape;
  frameShape: FrameShape;
  material: Material;
  color: Color;
  results: RecItem[];
};

const FRAME_SHAPE_OPTIONS: { k: FrameShape; d: string }[] = [
  { k: "round", d: "Soft & friendly, great contrast for angular faces." },
  { k: "square", d: "Crisp edges and a stronger look." },
  { k: "rectangle", d: "Classic everyday shape with subtle structure." },
  { k: "aviator", d: "Iconic teardrop style." },
  { k: "cat-eye", d: "Lifted corners, stylish and bold." },
  { k: "browline", d: "Retro, with a stronger top line." },
  { k: "oval", d: "Balanced and softly rounded." },
  { k: "geometric", d: "Modern shape with a fashion-forward feel." },
  { k: "wayfarer", d: "Timeless and versatile classic." },
];

const MATERIAL_OPTIONS: { k: Material; d: string }[] = [
  { k: "acetate", d: "Bold colors, thicker look, classic premium feel." },
  { k: "metal", d: "Lightweight, sleek, and clean." },
  { k: "titanium", d: "Premium, very light, and durable." },
  { k: "stainless steel", d: "Strong, refined, and durable." },
  { k: "tr90", d: "Flexible, lightweight, and comfortable." },
  { k: "mixed", d: "A blend of materials for a unique look." },
];

function formatLabel(value: string) {
  if (!value) return "—";
  if (value.toLowerCase() === "tr90") return "TR90";

  return value
    .split(" ")
    .map((word) =>
      word
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("-")
    )
    .join(" ");
}

function FaceShapeVisual({ shape }: { shape: string }) {
  const common = "h-24 w-full";
  const stroke = "#0f172a";
  const fill = "#f8fafc";

  if (shape === "oval") {
    return (
      <svg viewBox="0 0 120 100" className={common} aria-hidden="true">
        <ellipse cx="60" cy="50" rx="26" ry="36" fill={fill} stroke={stroke} strokeWidth="3" />
      </svg>
    );
  }

  if (shape === "round") {
    return (
      <svg viewBox="0 0 120 100" className={common} aria-hidden="true">
        <circle cx="60" cy="50" r="30" fill={fill} stroke={stroke} strokeWidth="3" />
      </svg>
    );
  }

  if (shape === "square") {
    return (
      <svg viewBox="0 0 120 100" className={common} aria-hidden="true">
        <rect
          x="30"
          y="20"
          width="60"
          height="60"
          rx="10"
          fill={fill}
          stroke={stroke}
          strokeWidth="3"
        />
      </svg>
    );
  }

  if (shape === "heart") {
    return (
      <svg viewBox="0 0 120 100" className={common} aria-hidden="true">
        <path
          d="M60 82
             C45 78, 34 66, 34 50
             C34 34, 44 22, 58 22
             C72 22, 86 34, 86 50
             C86 66, 75 78, 60 82 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="3"
        />
        <path
          d="M42 24 Q60 8 78 24"
          fill="none"
          stroke={stroke}
          strokeWidth="3"
        />
      </svg>
    );
  }

  if (shape === "diamond") {
    return (
      <svg viewBox="0 0 120 100" className={common} aria-hidden="true">
        <path
          d="M60 15 L85 50 L60 85 L35 50 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="3"
        />
      </svg>
    );
  }

  if (shape === "triangle") {
    return (
      <svg viewBox="0 0 120 100" className={common} aria-hidden="true">
        <path
          d="M45 20 L75 20 L92 78 L28 78 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="3"
        />
      </svg>
    );
  }

  return null;
}

function MaterialVisual({ material }: { material: string }) {
  const stroke = "#0f172a";

  if (material === "acetate") {
    return (
      <svg viewBox="0 0 160 80" className="h-20 w-full" aria-hidden="true">
        <rect x="18" y="22" width="42" height="26" rx="8" fill="#d6b98c" stroke={stroke} strokeWidth="3" />
        <rect x="100" y="22" width="42" height="26" rx="8" fill="#d6b98c" stroke={stroke} strokeWidth="3" />
        <rect x="60" y="28" width="40" height="8" rx="4" fill="#d6b98c" stroke={stroke} strokeWidth="2" />
        <line x1="18" y1="30" x2="6" y2="24" stroke={stroke} strokeWidth="3" />
        <line x1="142" y1="30" x2="154" y2="24" stroke={stroke} strokeWidth="3" />
      </svg>
    );
  }

  if (material === "metal") {
    return (
      <svg viewBox="0 0 160 80" className="h-20 w-full" aria-hidden="true">
        <rect x="22" y="24" width="36" height="22" rx="10" fill="none" stroke={stroke} strokeWidth="2.5" />
        <rect x="102" y="24" width="36" height="22" rx="10" fill="none" stroke={stroke} strokeWidth="2.5" />
        <line x1="58" y1="35" x2="102" y2="35" stroke={stroke} strokeWidth="2.5" />
        <line x1="22" y1="31" x2="10" y2="24" stroke={stroke} strokeWidth="2.5" />
        <line x1="138" y1="31" x2="150" y2="24" stroke={stroke} strokeWidth="2.5" />
      </svg>
    );
  }

  if (material === "titanium") {
    return (
      <svg viewBox="0 0 160 80" className="h-20 w-full" aria-hidden="true">
        <rect x="22" y="24" width="36" height="22" rx="10" fill="none" stroke="#475569" strokeWidth="2.5" />
        <rect x="102" y="24" width="36" height="22" rx="10" fill="none" stroke="#475569" strokeWidth="2.5" />
        <line x1="58" y1="35" x2="102" y2="35" stroke="#475569" strokeWidth="2.5" />
        <line x1="22" y1="31" x2="10" y2="24" stroke="#475569" strokeWidth="2.5" />
        <line x1="138" y1="31" x2="150" y2="24" stroke="#475569" strokeWidth="2.5" />
        <text x="80" y="68" textAnchor="middle" fontSize="10" fill="#475569">
          ultra-light
        </text>
      </svg>
    );
  }

  if (material === "stainless steel") {
    return (
      <svg viewBox="0 0 160 80" className="h-20 w-full" aria-hidden="true">
        <rect x="22" y="24" width="36" height="22" rx="10" fill="none" stroke="#64748b" strokeWidth="3" />
        <rect x="102" y="24" width="36" height="22" rx="10" fill="none" stroke="#64748b" strokeWidth="3" />
        <line x1="58" y1="35" x2="102" y2="35" stroke="#64748b" strokeWidth="3" />
        <line x1="22" y1="31" x2="10" y2="24" stroke="#64748b" strokeWidth="3" />
        <line x1="138" y1="31" x2="150" y2="24" stroke="#64748b" strokeWidth="3" />
      </svg>
    );
  }

  if (material === "tr90") {
    return (
      <svg viewBox="0 0 160 80" className="h-20 w-full" aria-hidden="true">
        <rect x="18" y="22" width="42" height="26" rx="10" fill="#e2e8f0" stroke={stroke} strokeWidth="2.5" />
        <rect x="100" y="22" width="42" height="26" rx="10" fill="#e2e8f0" stroke={stroke} strokeWidth="2.5" />
        <path d="M60 30 Q80 18 100 30" fill="none" stroke={stroke} strokeWidth="2.5" />
        <path d="M18 31 Q8 28 6 20" fill="none" stroke={stroke} strokeWidth="2.5" />
        <path d="M142 31 Q152 28 154 20" fill="none" stroke={stroke} strokeWidth="2.5" />
      </svg>
    );
  }

  if (material === "mixed") {
    return (
      <svg viewBox="0 0 160 80" className="h-20 w-full" aria-hidden="true">
        <rect x="18" y="22" width="42" height="26" rx="8" fill="#d6b98c" stroke={stroke} strokeWidth="3" />
        <rect x="100" y="22" width="42" height="26" rx="10" fill="none" stroke="#64748b" strokeWidth="2.5" />
        <line x1="60" y1="35" x2="100" y2="35" stroke={stroke} strokeWidth="2.5" />
        <line x1="18" y1="31" x2="6" y2="24" stroke={stroke} strokeWidth="3" />
        <line x1="142" y1="31" x2="154" y2="24" stroke="#64748b" strokeWidth="2.5" />
      </svg>
    );
  }

  return null;
}

export default function FindYourFrameClient() {
  const searchParams = useSearchParams();
  const fromScan = searchParams.get("fromScan") === "1";

  const [step, setStep] = useState(0);

  const [faceShape, setFaceShape] = useState<FaceShape>("");
  const [frameShape, setFrameShape] = useState<FrameShape>("");
  const [material, setMaterial] = useState<Material>("");
  const [color, setColor] = useState<Color>("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [results, setResults] = useState<RecItem[]>([]);

  const didRestoreRef = useRef(false);

  function saveQuizState(next?: Partial<QuizState>) {
    try {
      const payload: QuizState = {
        step,
        faceShape,
        frameShape,
        material,
        color,
        results,
        ...(next || {}),
      };
      localStorage.setItem(QUIZ_STATE_KEY, JSON.stringify(payload));
      localStorage.setItem(QUIZ_STATE_TS_KEY, String(Date.now()));
    } catch {}
  }

  function clearQuizState() {
    try {
      localStorage.removeItem(QUIZ_STATE_KEY);
      localStorage.removeItem(QUIZ_STATE_TS_KEY);
    } catch {}
  }

  useEffect(() => {
    // When arriving from scan, do not restore old quiz progress/results
    if (fromScan) return;

    try {
      const raw = localStorage.getItem(QUIZ_STATE_KEY);
      const ts = Number(localStorage.getItem(QUIZ_STATE_TS_KEY) || "0");
      const isFresh = ts && Date.now() - ts < RESTORE_TTL_MS;

      if (!raw || !isFresh) return;

      const s = JSON.parse(raw) as Partial<QuizState>;

      if (typeof s.step === "number")
        setStep(Math.max(0, Math.min(s.step, STEPS.length - 1)));
      if (typeof s.faceShape === "string") setFaceShape(s.faceShape as FaceShape);
      if (typeof s.frameShape === "string") setFrameShape(s.frameShape as FrameShape);
      if (typeof s.material === "string") setMaterial(s.material as Material);
      if (typeof s.color === "string") setColor(s.color as Color);
      if (Array.isArray(s.results)) setResults(s.results as RecItem[]);

      didRestoreRef.current = true;
    } catch {}
  }, [fromScan]);

  useEffect(() => {
    try {
      const shape = (localStorage.getItem("aloyon_quiz_face_shape") || "")
        .trim()
        .toLowerCase();
      const ts = Number(localStorage.getItem("aloyon_quiz_face_shape_ts") || "0");
      const isFresh = ts && Date.now() - ts < 10 * 60 * 1000;

      if (!isFresh || !shape) return;

      const allowed = ["round", "square", "oval", "heart", "diamond", "triangle"];
      if (!allowed.includes(shape)) return;

      // If this came from scan, start fresh but keep detected face shape
      if (fromScan) {
        setFaceShape(shape as FaceShape);
        setFrameShape("");
        setMaterial("");
        setColor("");
        setResults([]);
        setErr("");
        setLoading(false);
        setStep(1);

        saveQuizState({
          step: 1,
          faceShape: shape as FaceShape,
          frameShape: "",
          material: "",
          color: "",
          results: [],
        });
      } else {
        setFaceShape(shape as FaceShape);
        saveQuizState({ faceShape: shape as FaceShape });

        if (!didRestoreRef.current) {
          setStep((s) => (s === 0 ? 1 : s));
        }
      }

      localStorage.removeItem("aloyon_quiz_face_shape");
      localStorage.removeItem("aloyon_quiz_face_shape_ts");
    } catch {}
  }, [fromScan]);

  const progress = useMemo(() => {
    const idx = Math.min(step, STEPS.length - 1);
    return Math.round(((idx + 1) / STEPS.length) * 100);
  }, [step]);

  function next() {
    setErr("");
    setStep((s) => {
      const ns = Math.min(s + 1, STEPS.length - 1);
      saveQuizState({ step: ns });
      return ns;
    });
  }

  function back() {
    setErr("");
    setStep((s) => {
      const ns = Math.max(0, s - 1);
      saveQuizState({ step: ns });
      return ns;
    });
  }

  function resetAll() {
    setStep(0);
    setFaceShape("");
    setFrameShape("");
    setMaterial("");
    setColor("");
    setResults([]);
    setErr("");
    setLoading(false);
    didRestoreRef.current = false;
    clearQuizState();
  }

  async function getRecommendations() {
    setErr("");
    setLoading(true);
    setResults([]);

    try {
      const res = await fetch("/api/quiz/frame-recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          faceShape: faceShape || null,
          frameShape: frameShape || null,
          material: material || null,
          color: color || null,
          limit: 24,
        }),
      });

      const j = (await res.json()) as ApiResp;
      if (!res.ok || !j.ok) {
        throw new Error((j as any).error || "Failed to fetch recommendations.");
      }

      setResults(j.items);
      const resultsStep = STEPS.length - 1;
      setStep(resultsStep);
      saveQuizState({ results: j.items, step: resultsStep });
    } catch (e: any) {
      setErr(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const title = "Find your frame";

  return (
    <div className="space-y-6">
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Aloyon Optical
          </div>
          <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted">
            Answer a few quick questions and we’ll recommend frames from our catalog.
          </p>
        </div>

        <div className="flex gap-2">
          <Link href="/shop" className="btn btn-ghost">
            Browse shop
          </Link>
          <button className="btn btn-ghost" onClick={resetAll}>
            Reset
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <div>
            Step <span className="font-semibold">{Math.min(step + 1, STEPS.length)}</span> /{" "}
            {STEPS.length}
          </div>
          <div className="font-medium">{STEPS[Math.min(step, STEPS.length - 1)]}</div>
        </div>

        <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${progress}%`, background: "var(--primary)" }}
          />
        </div>

        <div className="mt-3 flex gap-2 text-xs overflow-x-auto no-scrollbar py-1">
          {STEPS.map((s, i) => (
            <button
              key={s}
              onClick={() => {
                setStep(i);
                saveQuizState({ step: i });
              }}
              className={[
                "rounded-full border px-3 py-1 transition",
                i === step
                  ? "bg-white border-slate-200 text-slate-900"
                  : "bg-slate-50 border-slate-200 text-slate-500",
                i > step && step !== STEPS.length - 1 ? "opacity-60" : "",
              ].join(" ")}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.08)] overflow-hidden">
          <div className="p-6 sm:p-8">
            {step === 0 ? (
              <StepFaceShape
                faceShape={faceShape}
                setFaceShape={(v) => {
                  setFaceShape(v);
                  saveQuizState({ faceShape: v });
                }}
              />
            ) : step === 1 ? (
              <StepFrameShape
                frameShape={frameShape}
                setFrameShape={(v) => {
                  setFrameShape(v);
                  saveQuizState({ frameShape: v });
                }}
              />
            ) : step === 2 ? (
              <StepMaterial
                material={material}
                setMaterial={(v) => {
                  setMaterial(v);
                  saveQuizState({ material: v });
                }}
              />
            ) : step === 3 ? (
              <StepColor
                color={color}
                setColor={(v) => {
                  setColor(v);
                  saveQuizState({ color: v });
                }}
              />
            ) : (
              <StepResults items={results} />
            )}

            {err ? <div className="mt-4 text-sm text-rose-600">{err}</div> : null}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button className="btn btn-ghost" onClick={back} disabled={step === 0 || loading}>
                ← Back
              </button>

              {step <= 3 ? (
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  {step < 3 ? (
                    <button className="btn btn-primary" onClick={next} disabled={loading}>
                      Next →
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary"
                      onClick={getRecommendations}
                      disabled={loading}
                    >
                      {loading ? "Finding matches…" : "See my recommendations"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setStep(0);
                      saveQuizState({ step: 0 });
                    }}
                  >
                    Start over
                  </button>
                  <Link href="/shop" className="btn btn-primary">
                    Shop all frames
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Your picks
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <Row label="Face shape" value={faceShape || "—"} />
              <Row label="Frame shape" value={frameShape || "—"} />
              <Row label="Material" value={material || "—"} />
              <Row label="Color" value={color || "—"} />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-[var(--muted)]/30 p-5">
            <div className="text-sm font-semibold">Want help choosing face shape?</div>
            <p className="mt-1 text-sm text-muted">
              You can use our Virtual Try-On to view your face and decide your face shape,
              then come back here.
            </p>

            <div className="mt-3 flex gap-2">
              <Link
                href="/virtual-try-on?returnTo=/find-your-frame%3FfromScan%3D1&autoReturn=1"
                className="btn btn-primary"
                onClick={() => saveQuizState({ step })}
              >
                Scan my face shape
              </Link>

              <button
                className="btn btn-ghost"
                onClick={() => {
                  setStep(0);
                  saveQuizState({ step: 0 });
                }}
              >
                Back to step 1
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-muted">{label}</div>
      <div className="font-medium capitalize text-right">{formatLabel(value)}</div>
    </div>
  );
}

function StepFaceShape({
  faceShape,
  setFaceShape,
}: {
  faceShape: string;
  setFaceShape: (v: any) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">What’s your face shape?</h2>
      <p className="text-sm text-muted">
        Pick the closest match. You can also use Virtual Try-On to help you decide.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { k: "oval", d: "Balanced proportions, softly rounded jaw." },
          { k: "round", d: "Soft curves, similar width & height." },
          { k: "square", d: "Strong jaw, broad forehead." },
          { k: "heart", d: "Wider forehead, narrower chin." },
          { k: "diamond", d: "Cheekbones wider, narrow forehead & jaw." },
          { k: "triangle", d: "Wider jaw, narrower forehead." },
        ].map((x) => (
          <button
            key={x.k}
            onClick={() => setFaceShape(x.k)}
            className={[
              "rounded-2xl border p-4 text-left transition",
              faceShape === x.k
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white hover:bg-slate-50",
            ].join(" ")}
          >
            <div
  className={[
    "rounded-xl p-2",
    faceShape === x.k
      ? "border border-white/20 bg-white"
      : "border border-slate-200/70 bg-slate-50",
  ].join(" ")}
>
              <FaceShapeVisual shape={x.k} />
            </div>

            <div className="mt-3 font-semibold capitalize">{x.k}</div>
            <div
              className={[
                "mt-1 text-xs",
                faceShape === x.k ? "text-white/80" : "text-muted",
              ].join(" ")}
            >
              {x.d}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepFrameShape({
  frameShape,
  setFrameShape,
}: {
  frameShape: string;
  setFrameShape: (v: any) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Which frame shape do you like?</h2>
      <p className="text-sm text-muted">
        Choose the style you want to try. These match the shapes saved in your product catalog.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {FRAME_SHAPE_OPTIONS.map((x) => (
          <button
            key={x.k}
            onClick={() => setFrameShape(x.k)}
            className={[
              "rounded-2xl border p-4 text-left transition",
              frameShape === x.k
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white hover:bg-slate-50",
            ].join(" ")}
          >
            <div className="font-semibold">{formatLabel(x.k)}</div>
            <div
              className={[
                "mt-1 text-xs",
                frameShape === x.k ? "text-white/80" : "text-muted",
              ].join(" ")}
            >
              {x.d}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepMaterial({
  material,
  setMaterial,
}: {
  material: string;
  setMaterial: (v: any) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Material preference?</h2>
      <p className="text-sm text-muted">
        Pick a material that matches the frame records in your catalog.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {MATERIAL_OPTIONS.map((x) => (
          <button
            key={x.k}
            onClick={() => setMaterial(x.k)}
            className={[
              "rounded-2xl border p-4 text-left transition",
              material === x.k
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white hover:bg-slate-50",
            ].join(" ")}
          >
            <div
  className={[
    "rounded-xl p-2",
    material === x.k
      ? "border border-white/20 bg-white"
      : "border border-slate-200/70 bg-slate-50",
  ].join(" ")}
>
              <MaterialVisual material={x.k} />
            </div>

            <div className="mt-3 font-semibold">{formatLabel(x.k)}</div>
            <div
              className={[
                "mt-1 text-xs",
                material === x.k ? "text-white/80" : "text-muted",
              ].join(" ")}
            >
              {x.d}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepColor({
  color,
  setColor,
}: {
  color: string;
  setColor: (v: any) => void;
}) {
  const options: { k: Color; sw: string }[] = [
    { k: "black", sw: "#111827" },
    { k: "tortoise", sw: "#7c4a2d" },
    { k: "gold", sw: "#d4af37" },
    { k: "silver", sw: "#9ca3af" },
    { k: "clear", sw: "#e5e7eb" },
    { k: "brown", sw: "#6b4f3a" },
    { k: "blue", sw: "#2563eb" },
    { k: "green", sw: "#16a34a" },
    { k: "pink", sw: "#ec4899" },
    { k: "red", sw: "#d60000" },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Choose a color</h2>
      <p className="text-sm text-muted">Pick a color you usually wear.</p>

      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((x) => (
          <button
            key={x.k}
            onClick={() => setColor(x.k)}
            className={[
              "rounded-2xl border p-4 text-left transition",
              color === x.k ? "border-slate-900" : "border-slate-200 hover:bg-slate-50",
            ].join(" ")}
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-block size-4 rounded-full border"
                style={{ background: x.sw }}
              />
              <span className="font-medium capitalize">{x.k}</span>
            </div>
            <div
              className={[
                "mt-1 text-xs",
                color === x.k ? "text-emerald-700" : "text-muted",
              ].join(" ")}
            >
              {color === x.k ? "Selected" : "Tap to select"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepResults({ items }: { items: RecItem[] }) {
  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Recommended frames</h2>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-muted">
          No matches yet. Try changing your answers and run the quiz again.
        </div>
      </div>
    );
  }

  const grouped = items.reduce<Record<string, RecItem[]>>((acc, item) => {
    const key = `${item.score}% Match`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const orderedGroups = Object.entries(grouped).sort((a, b) => {
    const scoreA = Number(a[0].replace("% Match", ""));
    const scoreB = Number(b[0].replace("% Match", ""));
    return scoreB - scoreA;
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Recommended frames</h2>

      {orderedGroups.map(([groupLabel, frames]) => (
        <div key={groupLabel} className="space-y-3">
          <div className="sticky top-0 z-10 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2">
            <div className="text-sm font-semibold text-slate-800">{groupLabel}</div>
            <div className="text-xs text-slate-500">
              {frames.length} frame{frames.length > 1 ? "s" : ""} found
            </div>
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {frames.map((p) => (
              <div
                key={p.id}
                className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm"
              >
                <div className="aspect-[4/3] bg-[var(--muted)]">
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                  ) : null}
                </div>

                <div className="p-4 space-y-2">
                  <div className="font-semibold line-clamp-2">{p.name}</div>

                  <div className="text-sm text-muted">
                    ₱{Number(p.price || 0).toLocaleString("en-PH")}
                  </div>

                  {(p.frameShape || p.material) && (
                    <div className="text-xs text-muted">
                      {[
                        p.material ? formatLabel(String(p.material)) : null,
                        p.frameShape ? formatLabel(String(p.frameShape)) : null,
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </div>
                  )}

                  <div className="pt-1">
                    <span className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                      {p.score}% Match{p.matchLabel ? ` • ${p.matchLabel}` : ""}
                    </span>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Link href={`/product/${p.slug}`} className="btn btn-ghost flex-1">
                      View
                    </Link>

                    <Link
                      href={`/virtual-try-on?slug=${encodeURIComponent(p.slug)}`}
                      className="btn btn-primary flex-1"
                    >
                      Try On
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
