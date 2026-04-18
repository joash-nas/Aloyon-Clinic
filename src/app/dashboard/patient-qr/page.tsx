// src/app/dashboard/patient-qr/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type RewardsSummary = {
  ok: boolean;
  points?: number;
  lastEarnAt?: string | null;
  expiresAt?: string | null;
  expired?: boolean;
  error?: string;
};

type LedgerItem = {
  id: string;
  pointsDelta: number;
  activity: "purchase" | "appointment" | "manual" | "redeem" | string;
  sourceType?: string | null;
  sourceId?: string | null;
  note?: string | null;
  createdAt: string;
  expiresAt?: string | null;
  orderNumber?: string | null;
  orderTotal?: number | null;
  orderCreatedAt?: string | null;
};

type LedgerResp = {
  ok: boolean;
  items?: LedgerItem[];
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
  total?: number;
  error?: string;
};


type MePayload = {
  ok: boolean;
  user?: {
    id?: string | null;
    role?: string | null;
    email?: string | null;
    name?: string | null;
    profile?: { fullName?: string | null } | null;
  };
  error?: string;
};

type PatientQrResp = {
  ok: boolean;
  qrText?: string;
  error?: string;
};

type Filter = "all" | "earned" | "redeemed";

function fmtPrettyDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PH", {
    month: "long",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtPrettyDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function monthKey(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = d.getMonth();
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

function monthLabelFromIso(iso: string) {
  const d = new Date(iso);
  const label = d.toLocaleString("en-US", { month: "long" }).toUpperCase();
  return `${label} ${d.getFullYear()}`;
}

function labelForEntry(it: LedgerItem) {
  const isRedeem = it.pointsDelta < 0 || it.activity === "redeem";
  if (isRedeem) return "Redeemed points";
  if (it.activity === "appointment") return "Appointment";
  if (it.activity === "purchase") return "Shop purchase";
  if (it.activity === "manual") return "Manual adjustment";
  return "Points";
}

function pointsBadgeClass(delta: number) {
  if (delta > 0) return "text-emerald-700";
  if (delta < 0) return "text-rose-700";
  return "text-neutral-600";
}

function pointsBadgeText(delta: number) {
  if (delta > 0) return `+${delta} pts`;
  if (delta < 0) return `${delta} pts`;
  return "0 pts";
}

const PAGE_SIZE = 5;

export default function PatientQrPage() {
  const [meLoading, setMeLoading] = useState(true);
  const [meErr, setMeErr] = useState<string | null>(null);
  const [role, setRole] = useState<string>("patient");
  const [email, setEmail] = useState<string>("");

  const [qrText, setQrText] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const [summary, setSummary] = useState<RewardsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [filter, setFilter] = useState<Filter>("all");

  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerErr, setLedgerErr] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setMeLoading(true);
        setMeErr(null);

        const r = await fetch("/api/users/me", { cache: "no-store" });
        const data: MePayload = await r.json();

        if (!r.ok || !data.ok || !data.user) {
          if (!cancelled) setMeErr(data.error ?? "Could not load user.");
          return;
        }

        if (cancelled) return;

        setRole(String(data.user.role || "patient"));
        setEmail(String(data.user.email || ""));
      } catch {
        if (!cancelled) setMeErr("Could not load user.");
      } finally {
        if (!cancelled) setMeLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // fetch token-based QR text
  useEffect(() => {
    if (role !== "patient") return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/users/me/qr", { cache: "no-store" });
        const j = (await res.json()) as PatientQrResp;

        if (cancelled) return;

        if (!res.ok || !j.ok || !j.qrText) {
          setQrText("");
          return;
        }

        setQrText(j.qrText);
      } catch {
        if (!cancelled) setQrText("");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [role]);

  // generate QR image
  useEffect(() => {
    if (!qrText) {
      setQrDataUrl("");
      return;
    }

    (async () => {
      try {
        const url = await QRCode.toDataURL(qrText, {
          margin: 1,
          width: 240,
        });
        setQrDataUrl(url);
      } catch (e) {
        console.error("QR generate failed:", e);
        setQrDataUrl("");
      }
    })();
  }, [qrText]);

  useEffect(() => {
    if (role !== "patient") return;

    let cancelled = false;

    (async () => {
      try {
        setSummaryLoading(true);
        const res = await fetch("/api/rewards/summary", { cache: "no-store" });
        const j = (await res.json()) as RewardsSummary;
        if (cancelled) return;

        if (!res.ok || !j.ok) {
          setSummary({ ok: false, error: j.error || "Failed to load rewards." });
        } else {
          setSummary(j);
        }
      } catch {
        if (!cancelled) setSummary({ ok: false, error: "Failed to load rewards." });
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [role]);

  async function loadLedger(nextPage: number, nextFilter: Filter) {
    setLedgerLoading(true);
    setLedgerErr(null);

    try {
      const qs = new URLSearchParams();
      qs.set("page", String(nextPage));
      qs.set("limit", String(PAGE_SIZE));
      qs.set("type", nextFilter);

      const res = await fetch(`/api/rewards/ledger?${qs.toString()}`, {
        cache: "no-store",
      });
      const j = (await res.json()) as LedgerResp;

      if (!res.ok || !j.ok) {
        throw new Error(j.error || "Failed to load points history.");
      }

      setLedger((j.items ?? []) as LedgerItem[]);
      setHasMore(!!j.hasMore);
      setOpenMonths({});
    } catch (e: any) {
      setLedger([]);
      setHasMore(false);
      setLedgerErr(e?.message || "Failed to load points history.");
    } finally {
      setLedgerLoading(false);
    }
  }

  useEffect(() => {
    if (role !== "patient") return;
    void loadLedger(page, filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, page, filter]);

  const monthGroups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; sortKey: string; items: LedgerItem[] }>();

    for (const it of ledger) {
      const key = monthKey(it.createdAt);
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: monthLabelFromIso(it.createdAt),
          sortKey: key,
          items: [],
        });
      }
      map.get(key)!.items.push(it);
    }

    const groups = Array.from(map.values()).sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1));

    for (const g of groups) {
      g.items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return groups;
  }, [ledger]);

  const asOfText = useMemo(() => {
    const now = new Date();
    return now.toLocaleString("en-PH", {
      month: "long",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }, [summaryLoading, ledgerLoading]);

  const toggleMonth = (key: string) => {
    setOpenMonths((m) => ({ ...m, [key]: !m[key] }));
  };

  // used for hiding expiry
  const pointsNow = summary?.ok ? Number(summary.points ?? 0) : 0;

  if (meLoading) {
    return <div className="card p-4 text-sm text-muted">Loading…</div>;
  }
  if (meErr) {
    return <div className="card p-4 text-sm text-rose-600">{meErr}</div>;
  }
  if (role !== "patient") {
    return (
      <div className="card p-4 text-sm text-muted">
        Patient QR is available for patient accounts only.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Patient QR</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Show this QR when redeeming points. 
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white/80 ring-1 ring-[var(--border)] p-5">
          <div className="flex flex-col items-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Patient QR"
                className="w-[260px] h-[260px] rounded-xl bg-white"
              />
            ) : (
              <div className="w-[260px] h-[260px] rounded-xl bg-neutral-100 grid place-items-center text-sm text-neutral-500">
                QR unavailable
              </div>
            )}

            <div className="mt-3 text-[11px] text-neutral-500 text-center break-all">
              {qrText || "—"}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl bg-white/80 ring-1 ring-[var(--border)] p-5">
          <div className="text-[11px] text-neutral-500">As of {asOfText}</div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl ring-1 ring-[var(--border)] bg-white/70 p-4">
              <div className="text-xs text-neutral-500">Current points</div>
              <div className="text-2xl font-semibold mt-1">
                {summaryLoading ? "…" : summary?.ok ? summary.points ?? 0 : 0}
              </div>
            </div>

            {/* UPDATED: hide expiry when points = 0 */}
            <div className="rounded-2xl ring-1 ring-[var(--border)] bg-white/70 p-4">
              <div className="text-xs text-neutral-500">Expires on</div>

              <div className="text-sm font-semibold mt-1">
                {summaryLoading
                  ? "Loading…"
                  : summary?.ok
                  ? pointsNow > 0
                    ? fmtPrettyDate(summary.expiresAt ?? null)
                    : "—"
                  : "—"}
              </div>

              <div className="text-[11px] text-neutral-500 mt-2">
                {summaryLoading
                  ? " "
                  : summary?.ok
                  ? pointsNow > 0
                    ? "Points expire 1 year after your latest earning activity."
                    : "No points yet — earn points to activate expiry."
                  : " "}
              </div>
            </div>

            <div className="rounded-2xl ring-1 ring-[var(--border)] bg-white/70 p-4">
              <div className="text-xs text-neutral-500">How you earn</div>
              <ul className="mt-2 text-sm text-neutral-700 list-disc pl-5 space-y-1">
                <li>
                  Purchases: <b>1 point</b> for every <b>₱100</b> spent
                </li>
                <li>
                  Appointment marked <b>Done</b>: <b>+5 points</b>
                </li>
                <li>
                  Redemption: <b>1 point = ₱1</b> discount
                </li>
              </ul>
            </div>
          </div>

          {!summaryLoading && summary && !summary.ok && (
            <div className="mt-3 text-sm text-rose-600">
              {summary.error || "Failed to load rewards."}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white/80 ring-1 ring-[var(--border)] p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold">Points history</div>
          </div>

          <div className="flex gap-2">
            {(["all", "earned", "redeemed"] as Filter[]).map((k) => {
              const active = filter === k;
              const label = k.toUpperCase();
              return (
                <button
                  key={k}
                  type="button"
                  className={[
                    "px-3 py-1.5 rounded-full text-xs ring-1 transition",
                    active
                      ? "bg-black text-white ring-black"
                      : "bg-white/70 ring-[var(--border)] hover:bg-black/5",
                  ].join(" ")}
                  onClick={() => {
                    setPage(1);
                    setFilter(k);
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          {ledgerErr && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
              {ledgerErr}
            </div>
          )}

          {ledgerLoading ? (
            <div className="text-sm text-neutral-500">Loading points history…</div>
          ) : ledger.length === 0 ? (
            <div className="text-sm text-neutral-500">No points history yet.</div>
          ) : (
            <div className="space-y-3">
              {monthGroups.map((g) => {
                const isOpen = !!openMonths[g.key];

                return (
                  <section
                    key={g.key}
                    className="rounded-2xl ring-1 ring-[var(--border)] bg-white/70 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleMonth(g.key)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-black text-white"
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <span>{isOpen ? "▼" : "▶"}</span>
                        <span>{g.label}</span>
                      </div>
                      <span className="text-xs opacity-80">{isOpen ? "Hide" : "Show"}</span>
                    </button>

                    {isOpen && (
                      <div className="divide-y divide-[var(--border)]">
                        {g.items.map((it) => {
                          const title = labelForEntry(it);
                          const created = fmtPrettyDateTime(it.orderCreatedAt || it.createdAt);

                          const subtitleParts: string[] = [];
                          if (typeof it.orderTotal === "number") {
                            subtitleParts.push(`₱${it.orderTotal.toLocaleString("en-PH")}`);
                          }

                          return (
                            <div key={it.id} className="px-4 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium">
                                    {title}
                                    {it.orderNumber ? (
                                      <span className="text-neutral-500 font-normal"> • {it.orderNumber}</span>
                                    ) : it.sourceId ? (
                                      <span className="text-neutral-500 font-normal">
                                        {" "}
                                        • {String(it.sourceId).slice(0, 10)}
                                      </span>
                                    ) : null}
                                  </div>

                                  <div className="text-xs text-neutral-500 mt-1">
                                    {created}
                                    {subtitleParts.length ? (
                                      <span className="text-neutral-400"> • {subtitleParts.join(" • ")}</span>
                                    ) : null}
                                  </div>

                                  {it.note ? (
                                    <div className="text-xs text-neutral-600 mt-1">{it.note}</div>
                                  ) : null}
                                </div>

                                <div
                                  className={[
                                    "text-sm font-semibold whitespace-nowrap",
                                    pointsBadgeClass(it.pointsDelta),
                                  ].join(" ")}
                                >
                                  {pointsBadgeText(it.pointsDelta)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg ring-1 ring-[var(--border)] text-sm disabled:opacity-50 hover:bg-black/5"
            disabled={page <= 1 || ledgerLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>

          <button
            type="button"
            className="px-3 py-1.5 rounded-lg ring-1 ring-[var(--border)] text-sm disabled:opacity-50 hover:bg-black/5"
            disabled={!hasMore || ledgerLoading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>

      <div className="text-[11px] text-neutral-500">Logged in as: {email || "—"}</div>
    </div>
  );
}