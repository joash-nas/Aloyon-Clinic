"use client";

import { useEffect, useState } from "react";
import Guard from "@/components/auth/Guard";

type AuditLog = {
  user: string;
  action: string;
  timestamp: string;
};

const PAGE_SIZE = 6;

export default function SecurityAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  async function loadLogs() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/audit", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`);
      setLogs(data.logs || []);
      setPage(1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  const totalItems = logs.length;
  const totalPages = Math.max(1, Math.ceil((totalItems || 1) / PAGE_SIZE));

  const startIndex = (page - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
  const pageLogs = logs.slice(startIndex, endIndex);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil((totalItems || 1) / PAGE_SIZE));
    if (page > maxPage) setPage(maxPage);
  }, [totalItems, page]);

  return (
    <Guard requireAuth roles={["admin"]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Security & Audit</h1>
            <p className="text-sm opacity-70">
              Monitor admin actions and deletion of patient accounts.
            </p>
          </div>
          <button
            className="btn btn-ghost text-sm"
            onClick={loadLogs}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="card p-0 overflow-hidden ring-1 ring-[var(--border)] rounded-xl bg-white/70">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--muted)]">
                <tr>
                  <th className="text-left px-4 py-3">User</th>
                  <th className="text-left px-4 py-3">Action</th>
                  <th className="text-left px-4 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="text-center py-4">
                      Loading…
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={3} className="text-center py-4 text-red-600">
                      {error}
                    </td>
                  </tr>
                ) : pageLogs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-4 opacity-60">
                      No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  pageLogs.map((log, i) => (
                    <tr key={i} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3">{log.user}</td>
                      <td className="px-4 py-3">{log.action}</td>
                      <td className="px-4 py-3">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalItems > 0 && !loading && !error && (
            <div className="flex items-center justify-between px-4 py-3 text-xs text-muted">
              <div>
                Showing{" "}
                <span className="font-medium">{startIndex + 1}–{endIndex}</span>{" "}
                of <span className="font-medium">{totalItems}</span> events
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-ghost px-3 py-1"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </button>
                <span>
                  Page <span className="font-medium">{page}</span> of{" "}
                  <span className="font-medium">{totalPages}</span>
                </span>
                <button
                  className="btn btn-ghost px-3 py-1"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Guard>
  );
}
