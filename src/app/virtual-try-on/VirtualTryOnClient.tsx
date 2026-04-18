/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/virtual-try-on/VirtualTryOnClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

/** Only 5 stable shapes */
type FaceShape = "round" | "square" | "oval" | "heart" | "diamond";

type EyeData = {
  leftX: number;
  leftY: number;
  rightX: number;
  rightY: number;
};

type FrameOption = {
  id: string;
  name: string;
  png: string;
  slug: string;
  recommendedFor?: FaceShape[];
};

type ProductTryOn = {
  slug: string;
  name: string;
  png: string;
};

type Metrics = {
  L: number;
  F: number;
  C: number;
  J: number;
  rLC: number;
  rFC: number;
  rJC: number;
  yForehead: number;
  yCheek: number;
  yJaw: number;
  bandPx: number;
};

function dist2D(a: number[], b: number[]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function avgPoint(mesh: number[][], idxs: number[]) {
  const pts = idxs.map((i) => mesh[i]).filter(Boolean) as number[][];
  const n = pts.length || 1;
  const sx = pts.reduce((s, p) => s + p[0], 0);
  const sy = pts.reduce((s, p) => s + p[1], 0);
  const sz = pts.reduce((s, p) => s + (p[2] ?? 0), 0);
  return [sx / n, sy / n, sz / n] as number[];
}

function widthAtY(mesh: number[][], targetY: number, bandPx: number) {
  let minX = Infinity;
  let maxX = -Infinity;

  for (const p of mesh) {
    const x = p[0];
    const y = p[1];
    if (Math.abs(y - targetY) <= bandPx) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }

  if (!isFinite(minX) || !isFinite(maxX)) return NaN;
  const w = maxX - minX;
  return w > 0 ? w : NaN;
}

const IDX = {
  top: [10, 8, 9],
  chin: [152, 200, 199],
};

function classifyFaceShape5(mesh: number[][]): {
  shape: FaceShape;
  metrics: Metrics | null;
} {
  if (!mesh || mesh.length < 468) return { shape: "oval", metrics: null };

  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of mesh) {
    const y = p[1];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const height = maxY - minY;
  if (!isFinite(height) || height <= 0) return { shape: "oval", metrics: null };

  const bandPx = Math.max(4, height * 0.02);

  const yForehead = minY + height * 0.22;
  const yCheek = minY + height * 0.55;
  const yJaw = minY + height * 0.78;

  const F = widthAtY(mesh, yForehead, bandPx);
  const C = widthAtY(mesh, yCheek, bandPx);
  const J = widthAtY(mesh, yJaw, bandPx);

  const top = avgPoint(mesh, IDX.top);
  const chin = avgPoint(mesh, IDX.chin);
  const L = dist2D(top, chin);

  if (![L, F, C, J].every((v) => isFinite(v) && v > 0)) {
    return { shape: "oval", metrics: null };
  }

  const rLC = L / C;
  const rFC = F / C;
  const rJC = J / C;

  const score: Record<FaceShape, number> = {
    round: 0,
    square: 0,
    oval: 0,
    heart: 0,
    diamond: 0,
  };

  const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

  const isShort = rLC <= 1.28;
  const isMedium = rLC > 1.28 && rLC < 1.55;
  const isLongish = rLC >= 1.55;

  // Round
  if (isShort) score.round += 2;
  if (rJC <= 0.97) score.round += 1;

  // Square
  if (!isLongish) score.square += 1;
  if (near(rFC, 1.0, 0.1)) score.square += 1.5;
  if (near(rJC, 1.0, 0.1)) score.square += 1.5;

  // Heart
  if (rFC >= 1.05) score.heart += 2;
  if (rJC <= 0.92) score.heart += 2;
  if (isMedium || isLongish) score.heart += 0.5;

  // Diamond (strict)
  if (rFC <= 0.92) score.diamond += 2;
  if (rJC <= 0.92) score.diamond += 2;
  if (rJC > 0.96) score.diamond -= 2;

  // Oval
  if (isMedium) score.oval += 2;
  if (rJC <= 0.98) score.oval += 1;
  if (rFC <= 1.02) score.oval += 0.5;
  if (isLongish) score.oval += 1;

  let best: FaceShape = "oval";
  let bestScore = -Infinity;
  (Object.keys(score) as FaceShape[]).forEach((k) => {
    if (score[k] > bestScore) {
      bestScore = score[k];
      best = k;
    }
  });

  return {
    shape: best,
    metrics: { L, F, C, J, rLC, rFC, rJC, yForehead, yCheek, yJaw, bandPx },
  };
}

const SHAPE_RECOMMENDATIONS: Record<FaceShape, { label: string; href: string }[]> = {
  oval: [
    { label: "Rectangle", href: "/shop?type=frames&shape=rectangle" },
    { label: "Cat-eye", href: "/shop?type=frames&shape=cat-eye" },
  ],
  round: [
    { label: "Angular", href: "/shop?type=frames&shape=rectangle" },
    { label: "Wayfarer", href: "/shop?type=frames&shape=rectangle" },
  ],
  square: [
    { label: "Round", href: "/shop?type=frames&shape=round" },
    { label: "Oval", href: "/shop?type=frames&shape=oval" },
  ],
  heart: [
    { label: "Bottom-heavy", href: "/shop?type=frames&shape=rectangle" },
    { label: "Metal", href: "/shop?type=frames&material=metal" },
  ],
  diamond: [
    { label: "Oval", href: "/shop?type=frames&shape=oval" },
    { label: "All frames", href: "/shop?type=frames" },
  ],
};

function Pill({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-[11px] leading-none text-slate-700">
      {children}
    </span>
  );
}

function AloyonRecheckButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium transition
      border shadow-sm
      ${
        disabled
          ? "cursor-not-allowed opacity-60 border-slate-200 bg-slate-100 text-slate-500"
          : "border-lime-200 bg-lime-50 text-lime-800 hover:bg-lime-100 hover:border-lime-300"
      }`}
      aria-label="Re-check face shape"
      title="Re-check face shape"
    >
      <span className="inline-block h-2 w-2 rounded-full bg-lime-500" />
      Re-check
    </button>
  );
}

export default function VirtualTryOnClient() {
  const DEBUG = false;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);

  const [stageSize, setStageSize] = useState<{ w: number; h: number } | null>(null);
  const [videoDims, setVideoDims] = useState<{ w: number; h: number } | null>(null);

  const searchParams = useSearchParams();
  const slug = (searchParams.get("slug") ?? "").trim();
  const returnTo = (searchParams.get("returnTo") ?? "").trim(); // e.g. /find-your-frame
  const productNameFromUrl = (searchParams.get("name") ?? "").trim();
  const pngFromUrl = (searchParams.get("png") ?? "").trim();

  const [productTryOn, setProductTryOn] = useState<ProductTryOn | null>(null);
  const [productLoading, setProductLoading] = useState(false);

  const [frameOptions, setFrameOptions] = useState<FrameOption[]>([]);
  const [framesLoading, setFramesLoading] = useState(false);

  const [activeMode, setActiveMode] = useState<"product" | "carousel">("product");
  const [overlaySrc, setOverlaySrc] = useState<string>("");
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isModelReady, setIsModelReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const [eyeData, setEyeData] = useState<EyeData | null>(null);
  const [glassesAspect, setGlassesAspect] = useState(1);

  const [liveFaceShape, setLiveFaceShape] = useState<FaceShape>("oval");
  const [lockedFaceShape, setLockedFaceShape] = useState<FaceShape>("oval");
  const [isShapeLocked, setIsShapeLocked] = useState(false);

  const [shapeScanEnabled, setShapeScanEnabled] = useState(true);

  const votesRef = useRef<Array<{ t: number; s: FaceShape }>>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  const [debugPoints, setDebugPoints] = useState<Array<{ x: number; y: number }>>([]);

  const LOCK_MS = 6000;
  const MIN_SAMPLES = 16;
  const MIN_WIN_RATE = 0.60;

  const productLabel = useMemo(() => {
    if (productTryOn?.name) return productTryOn.name;
    if (productNameFromUrl) return productNameFromUrl;
    if (!slug) return "";
    return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }, [productTryOn?.name, productNameFromUrl, slug]);

  const recs = SHAPE_RECOMMENDATIONS[lockedFaceShape];

  const selectedLabel = useMemo(() => {
    if (activeMode === "product") return "Current";
    const match = frameOptions.find((f) => f.id === selectedFrameId);
    return match ? match.name : "Other";
  }, [activeMode, frameOptions, selectedFrameId]);

  const [containerWidth, setContainerWidth] = useState(520);
  useEffect(() => {
    function updateWidth() {
      const w = window.innerWidth;
      const next = Math.min(860, Math.max(320, w - 24));
      setContainerWidth(next);
    }
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const update = () => {
      const r = el.getBoundingClientRect();
      setStageSize({ w: r.width, h: r.height });
      if (DEBUG) console.log("[VTO] stage size:", r.width, r.height);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [DEBUG]);

  useEffect(() => {
    const ctrl = new AbortController();

    async function loadProductTryOn() {
      try {
        setError(null);
        setProductLoading(true);
        setActiveMode("product");
        setSelectedFrameId(null);

        if (slug && pngFromUrl) {
          const next: ProductTryOn = {
            slug,
            name: productNameFromUrl || slug.replace(/-/g, " "),
            png: pngFromUrl,
          };
          setProductTryOn(next);
          setOverlaySrc(pngFromUrl);
          return;
        }

        if (!slug) {
          setProductTryOn(null);
          setOverlaySrc("/frames/demo-glasses.png");
          return;
        }

        const res = await fetch(`/api/virtual-try-on-product?slug=${encodeURIComponent(slug)}`, {
          signal: ctrl.signal,
        });

        if (!res.ok) throw new Error("Failed to fetch product try-on data");

        const data = (await res.json()) as ProductTryOn;
        setProductTryOn(data);
        setOverlaySrc(data.png || "/frames/demo-glasses.png");
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        console.error("Product try-on load error:", e);
        setProductTryOn(null);
        setOverlaySrc("/frames/demo-glasses.png");
        setError("Try-on PNG not found for this product. Configure it in DB.");
      } finally {
        setProductLoading(false);
      }
    }

    loadProductTryOn();
    return () => ctrl.abort();
  }, [slug, pngFromUrl, productNameFromUrl]);

  useEffect(() => {
    const ctrl = new AbortController();

    async function loadFrames() {
      try {
        setFramesLoading(true);
        const res = await fetch(`/api/virtual-try-on-frames`, { signal: ctrl.signal });
        if (!res.ok) throw new Error("Failed to fetch frames");
        const data = await res.json();
        setFrameOptions((data.frames || []) as FrameOption[]);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        console.error("Error loading frames:", e);
        setFrameOptions([]);
      } finally {
        setFramesLoading(false);
      }
    }

    loadFrames();
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    let mounted = true;

    async function setupCamera() {
      try {
        setError(null);
        setCameraReady(false);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });

        if (!mounted) return;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          const checkDims = () => {
            if (!mounted) return;
            const v = videoRef.current;
            if (v && v.videoWidth > 0 && v.videoHeight > 0) {
              setVideoDims({ w: v.videoWidth, h: v.videoHeight });
              setCameraReady(true);
            } else {
              requestAnimationFrame(checkDims);
            }
          };
          checkDims();
        }
      } catch (err: any) {
        console.error("Camera error:", err);
        setError("Camera blocked. Allow permission to use try-on.");
      }
    }

    setupCamera();

    return () => {
      mounted = false;
      if (videoRef.current?.srcObject instanceof MediaStream) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // hide noisy TF Lite info
  useEffect(() => {
    const origInfo = console.info;
    console.info = (...args: any[]) => {
      const msg = String(args?.[0] ?? "");
      if (msg.includes("XNNPACK delegate")) return;
      origInfo(...args);
    };
    return () => {
      console.info = origInfo;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFaceLandmarker() {
      try {
        setError(null);
        setIsModelReady(false);

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
          },
          runningMode: "VIDEO",
          numFaces: 1,
        });

        if (cancelled) return;

        landmarkerRef.current = landmarker;
        setIsModelReady(true);
        if (DEBUG) console.log("[VTO] FaceLandmarker loaded");
      } catch (e: any) {
        console.error("[VTO] FaceLandmarker load error:", e);
        setError("Face model failed to load (network/CSP). Check console.");
      }
    }

    loadFaceLandmarker();

    return () => {
      cancelled = true;
      try {
        landmarkerRef.current?.close?.();
        landmarkerRef.current = null;
      } catch {}
    };
  }, [DEBUG]);

  useEffect(() => {
    if (!overlaySrc) return;
    const img = new Image();
    img.src = overlaySrc;
    img.onload = () => setGlassesAspect(img.height / img.width);
    img.onerror = (e) => console.error("Error loading overlay image", e);
  }, [overlaySrc]);

  // lock decision
  useEffect(() => {
    if (!shapeScanEnabled) return;

    const id = window.setInterval(() => {
      const now = performance.now();
      const windowVotes = votesRef.current.filter((v) => now - v.t <= LOCK_MS);

      if (windowVotes.length < MIN_SAMPLES) {
        setIsShapeLocked(false);
        return;
      }

      const counts: Record<FaceShape, number> = {
        round: 0,
        square: 0,
        oval: 0,
        heart: 0,
        diamond: 0,
      };
      for (const v of windowVotes) counts[v.s]++;

      let best: FaceShape = "oval";
      let bestCount = -1;
      (Object.keys(counts) as FaceShape[]).forEach((k) => {
        if (counts[k] > bestCount) {
          bestCount = counts[k];
          best = k;
        }
      });

      const winRate = bestCount / windowVotes.length;

      if (winRate >= MIN_WIN_RATE) {
        setLockedFaceShape(best);
        setIsShapeLocked(true);
        setShapeScanEnabled(false);
        votesRef.current = [];
      } else {
        setIsShapeLocked(false);
      }
    }, 800);

    return () => window.clearInterval(id);
  }, [shapeScanEnabled, LOCK_MS, MIN_SAMPLES, MIN_WIN_RATE]);

  // detection loop
  useEffect(() => {
    let cancelled = false;
    let lastInference = 0;
    const MIN_INTERVAL_MS = 90;

    const loop = () => {
      if (cancelled) return;

      const video = videoRef.current;
      const landmarker = landmarkerRef.current;

      if (!video || !landmarker || !cameraReady || !isModelReady) {
        requestAnimationFrame(loop);
        return;
      }
      if (video.readyState < 2 || video.videoWidth === 0) {
        requestAnimationFrame(loop);
        return;
      }

      const now = performance.now();
      if (now - lastInference < MIN_INTERVAL_MS) {
        requestAnimationFrame(loop);
        return;
      }
      lastInference = now;

      try {
        const res = landmarker.detectForVideo(video, now);
        const landmarks = res.faceLandmarks?.[0];

        if (!landmarks || landmarks.length < 468) {
          setEyeData(null);
          setDebugPoints([]);
          requestAnimationFrame(loop);
          return;
        }

        const mesh: number[][] = landmarks.map((p) => [
          p.x * video.videoWidth,
          p.y * video.videoHeight,
          (p.z ?? 0) * video.videoWidth,
        ]);

        const [lx, ly] = mesh[33];
        const [rx, ry] = mesh[263];
        setEyeData({ leftX: lx, leftY: ly, rightX: rx, rightY: ry });

        if (shapeScanEnabled) {
          const out = classifyFaceShape5(mesh);
          setLiveFaceShape(out.shape);
          setMetrics(out.metrics);

          votesRef.current.push({ t: now, s: out.shape });
          votesRef.current = votesRef.current.filter((v) => now - v.t <= LOCK_MS);
        }

        const dp = [33, 263, 1, 152].map((i) => ({ x: mesh[i][0], y: mesh[i][1] }));
        setDebugPoints(dp);
      } catch (e) {
        console.error("[VTO] detectForVideo error:", e);
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
    return () => {
      cancelled = true;
    };
  }, [cameraReady, isModelReady, shapeScanEnabled, LOCK_MS]);

    // If opened from the quiz (returnTo), send face shape back automatically once locked
  useEffect(() => {
    if (!returnTo) return;
    if (!isShapeLocked) return;

    try {
      localStorage.setItem("aloyon_quiz_face_shape", lockedFaceShape);
      localStorage.setItem("aloyon_quiz_face_shape_ts", String(Date.now()));
    } catch {}

    // short delay so user sees lock state briefly
    const t = window.setTimeout(() => {
      window.location.href = returnTo.startsWith("/") ? returnTo : `/${returnTo}`;
    }, 600);

    return () => window.clearTimeout(t);
  }, [returnTo, isShapeLocked, lockedFaceShape]);

  // Overlay positioning
  let overlay: React.ReactNode = null;
  let debugDots: React.ReactNode = null;

  if (overlaySrc && eyeData && videoDims && stageSize) {
    const stageW = stageSize.w;
    const stageH = stageSize.h;
    const videoW = videoDims.w;
    const videoH = videoDims.h;

    const scale = Math.max(stageW / videoW, stageH / videoH);
    const displayW = videoW * scale;
    const displayH = videoH * scale;

    const offsetX = (stageW - displayW) / 2;
    const offsetY = (stageH - displayH) / 2;

    const scaledLeftX = eyeData.leftX * scale + offsetX;
    const scaledLeftY = eyeData.leftY * scale + offsetY;
    const scaledRightX = eyeData.rightX * scale + offsetX;
    const scaledRightY = eyeData.rightY * scale + offsetY;

    const WIDTH_FACTOR = 2.1;
    const VERTICAL_FACTOR = 0.1;

    const centerX = (scaledLeftX + scaledRightX) / 2;
    const centerY = (scaledLeftY + scaledRightY) / 2;

    const eyeDistance = Math.hypot(scaledRightX - scaledLeftX, scaledRightY - scaledLeftY);

    const glassesWidth = eyeDistance * WIDTH_FACTOR;
    const glassesHeight = glassesWidth * glassesAspect;

    const angleRad = Math.atan2(scaledRightY - scaledLeftY, scaledRightX - scaledLeftX);

    overlay = (
      <img
        src={overlaySrc}
        alt="Glasses overlay"
        style={{
          position: "absolute",
          left: centerX,
          top: centerY + eyeDistance * VERTICAL_FACTOR,
          width: glassesWidth,
          height: glassesHeight,
          transform: `translate(-50%, -50%) rotate(${angleRad}rad)`,
          transformOrigin: "center center",
          pointerEvents: "none",
        }}
      />
    );

    if (debugPoints.length > 0) {
      debugDots = (
        <>
          {debugPoints.map((p, idx) => (
            <div
              key={idx}
              style={{
                position: "absolute",
                left: p.x * scale + offsetX - 4,
                top: p.y * scale + offsetY - 4,
                width: 8,
                height: 8,
                borderRadius: 9999,
                background: "rgba(0, 0, 255, 0.85)",
                pointerEvents: "none",
              }}
            />
          ))}
        </>
      );
    }
  }

  // Suggest logic
  const fallbackSuggestMap: Record<FaceShape, string[]> = {
    round: ["rectangle", "angular", "wayfarer", "square"],
    square: ["round", "oval"],
    oval: ["all"],
    heart: ["bottom", "aviator", "round", "oval"],
    diamond: ["oval", "round", "browline"],
  };

  const isSuggested = (frame: FrameOption) => {
    if (!isShapeLocked) return false;

    if (frame.recommendedFor && frame.recommendedFor.length > 0) {
      return frame.recommendedFor.includes(lockedFaceShape);
    }

    const hay = `${frame.name ?? ""} ${frame.slug ?? ""}`.toLowerCase();
    const tokens = fallbackSuggestMap[lockedFaceShape];
    if (tokens.includes("all")) return true;
    return tokens.some((t) => hay.includes(t));
  };

  const orderedFrames = useMemo(() => {
    const suggested = frameOptions.filter(isSuggested);
    const others = frameOptions.filter((f) => !isSuggested(f));
    return [...suggested, ...others];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameOptions, lockedFaceShape, isShapeLocked]);

  const onRecheck = () => {
    if (!cameraReady || !isModelReady) return;

    setIsShapeLocked(false);
    setShapeScanEnabled(true);
    votesRef.current = [];
    setMetrics(null);

    // keep last locked value visible until the new lock happens
    setLiveFaceShape(lockedFaceShape);
  };

  return (
    <div className="min-h-screen px-4 py-5 md:py-10 bg-gradient-to-b from-slate-50 to-white">
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <div className="mx-auto max-w-5xl">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
                Virtual Try-On
              </h1>
              {productLabel ? (
                <span className="text-xs sm:text-sm md:text-base font-normal text-slate-500">
                  · {productLabel}
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Pill>Face: {lockedFaceShape}</Pill>
              <Pill>Selected: {selectedLabel}</Pill>

              <AloyonRecheckButton
                onClick={onRecheck}
                disabled={!cameraReady || !isModelReady || !!error}
              />

              {productLoading ? <Pill>Loading…</Pill> : null}
            </div>

            {error ? (
              <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 inline-block">
                {error}
              </div>
            ) : null}

            {/* Steady prompt only while scanning */}
            {!error && cameraReady && isModelReady && shapeScanEnabled && !isShapeLocked ? (
              <div className="text-sm text-slate-700 bg-lime-50 border border-lime-200 rounded-xl px-3 py-2 inline-block">
                Hold steady for a moment…
              </div>
            ) : null}

            {isShapeLocked && returnTo ? (
              <div className="text-sm text-slate-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 inline-block">
                Face shape detected: <span className="font-semibold capitalize">{lockedFaceShape}</span> — returning to quiz…
              </div>
            ) : null}

            {/* quick recommendations only after lock */}
            {isShapeLocked && recs?.length ? (
              <div className="pt-1 flex flex-wrap gap-2">
                {recs.slice(0, 2).map((r) => (
                  <Link
                    key={r.label}
                    href={r.href}
                    className="text-[12px] px-3 py-1.5 rounded-full border border-slate-200 bg-white/70 hover:bg-white hover:border-slate-300 transition text-slate-700"
                  >
                    {r.label}
                  </Link>
                ))}
              </div>
            ) : null}

            {/* optional tiny metrics line */}
            {metrics ? (
              <div className="text-[11px] text-slate-500">
                rLC:{metrics.rLC.toFixed(2)} · rFC:{metrics.rFC.toFixed(2)} · rJC:{metrics.rJC.toFixed(2)}
              </div>
            ) : null}
          </div>

          <div className="w-full md:w-auto">
            <div className="grid grid-cols-2 gap-2 md:flex md:flex-col md:items-end">
              {slug ? (
                <Link
                  href={`/product/${slug}`}
                  className="inline-flex w-full items-center justify-center rounded-xl px-3 py-2 text-[13px] font-medium bg-slate-900 text-white"
                >
                  ← Back to product
                </Link>
              ) : (
                <div />
              )}

              <Link
                href="/shop?type=frames"
                className="inline-flex w-full items-center justify-center rounded-xl px-3 py-2 text-[13px] font-medium border border-slate-200 bg-white/70"
              >
                Browse frames →
              </Link>
            </div>
          </div>
        </div>

        {/* VIDEO STAGE */}
        <div className="mt-5 sm:mt-6 flex justify-center">
          <div
            className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35)]"
            style={{ width: containerWidth }}
          >
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/35 to-transparent" />

            <div ref={stageRef} className="relative w-full aspect-[3/4] sm:aspect-[4/5] md:aspect-[16/9]">
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                muted
                playsInline
              />
              {debugDots}
              {overlay}
            </div>

            {!cameraReady && !error ? (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur px-4 py-3 text-sm text-slate-600 shadow-sm">
                  Allow camera access to start try-on.
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* CAROUSEL */}
        <div className="mt-7 sm:mt-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Try other frames</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {framesLoading
                  ? "Loading frames…"
                  : frameOptions.length > 0
                  ? isShapeLocked
                    ? `${frameOptions.length} available · Suggested first`
                    : `${frameOptions.length} available`
                  : "No try-on frames found"}
              </p>
            </div>

            {productTryOn?.png ? (
              <button
                type="button"
                className="text-[12px] px-3 py-2 rounded-xl border border-slate-200 bg-white/70 hover:bg-white transition"
                onClick={() => {
                  setActiveMode("product");
                  setSelectedFrameId(null);
                  setOverlaySrc(productTryOn.png);
                }}
              >
                Use current frame
              </button>
            ) : null}
          </div>

          {framesLoading ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white/70 px-4 py-4 text-sm text-slate-600">
              Loading frames…
            </div>
          ) : orderedFrames.length > 0 ? (
            <div className="relative mt-3">
              <div className="pointer-events-none absolute left-0 top-0 h-full w-10 bg-gradient-to-r from-white to-transparent z-10" />
              <div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-white to-transparent z-10" />

              <div className="no-scrollbar flex gap-3 overflow-x-auto pb-3 pt-1 scroll-smooth snap-x snap-mandatory touch-pan-x overscroll-x-contain">
                {orderedFrames.map((frame) => {
                  const isActive = activeMode === "carousel" && frame.id === selectedFrameId;
                  const suggested = isSuggested(frame);

                  return (
                    <button
                      key={frame.id}
                      type="button"
                      onClick={() => {
                        setActiveMode("carousel");
                        setOverlaySrc(frame.png);
                        setSelectedFrameId(frame.id);
                      }}
                      className={`snap-start flex-shrink-0 w-[170px] sm:w-[180px] rounded-2xl border text-left transition
                        ${
                          isActive
                            ? "border-slate-900 bg-white shadow-[0_10px_25px_-18px_rgba(15,23,42,0.45)]"
                            : suggested
                            ? "border-lime-400 bg-white shadow-[0_10px_25px_-18px_rgba(132,204,22,0.25)]"
                            : "border-slate-200 bg-white/70 hover:bg-white hover:border-slate-300"
                        }`}
                    >
                      <div className="p-3">
                        <div className="h-24 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center">
                          <img src={frame.png} alt={frame.name} className="w-full h-full object-contain" />
                        </div>

                        <div className="mt-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[13px] font-semibold text-slate-900 truncate">{frame.name}</div>
                            {suggested ? (
                              <span className="shrink-0 inline-flex items-center rounded-full bg-lime-50 border border-lime-200 px-2 py-0.5 text-[10px] font-medium text-lime-800">
                                Suggested
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-[11px] text-slate-500">{isActive ? "Selected" : "Tap to try"}</span>

                            <Link
                              href={`/product/${frame.slug}`}
                              className="text-[12px] font-medium text-slate-900 hover:underline underline-offset-4"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View →
                            </Link>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white/70 px-4 py-4 text-sm text-slate-600">
              No frames returned by <span className="font-mono">/api/virtual-try-on-frames</span>. Add try-on PNGs in DB.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}