/* =============================================================================
   File: src/components/products/ProductTable.tsx
   Purpose: Assistant inventory table with pagination, filters, toggle, delete
   ============================================================================ */
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { isAssistant } from "@/lib/roles";

type Row = {
  name: string;
  slug: string;
  price: number;
  qty: number;
  status: "active" | "draft" | "archived";
  featured: boolean;
  product_type?: string;
};

const LIMIT = 6; 

type StockFilter = "any" | "critical" | "low" | "out";

export default function ProductTable() {
  const { role } = useAuth();
  const canEdit = isAssistant(role);

  const [q, setQ] = useState("");
  const [status, setStatus] =
    useState<"any" | "active" | "draft" | "archived">("any");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [sort, setSort] =
    useState<"name" | "newest" | "qty" | "price">("name");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // NEW: stock-level filter (client-side)
  const [stockFilter, setStockFilter] = useState<StockFilter>("any");

  // counts for alert bar (based on current page, not filtered)
  const criticalCount = rows.filter((r) => r.qty <= 2).length;
  const lowCount = rows.filter((r) => r.qty > 2 && r.qty <= 10).length;

  // rows actually visible in the table (respect stock filter)
  const filteredRows = rows.filter((r) => {
    if (stockFilter === "critical") return r.qty <= 2;
    if (stockFilter === "low") return r.qty > 2 && r.qty <= 10;
    if (stockFilter === "out") return r.qty === 0;
    return true; // "any"
  });

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  async function fetchRows(p = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(LIMIT),
        sort,
      });
      if (q.trim()) params.set("q", q.trim());
      if (status !== "any") params.set("status", status);
      if (featuredOnly) params.set("featured", "1");

      const url = `/api/staff/products?${params.toString()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRows(data.items ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? p);
    } catch (e) {
      console.error("Error fetching products:", e);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, featuredOnly, sort]);

  async function toggleFeatured(slug: string, current: boolean) {
    try {
      setRows((rs) =>
        rs.map((r) => (r.slug === slug ? { ...r, featured: !current } : r)),
      );
      const res = await fetch(`/api/staff/products/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: !current }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      setRows((rs) =>
        rs.map((r) => (r.slug === slug ? { ...r, featured: current } : r)),
      );
      alert("Failed to update. Please try again.");
    }
  }

  async function deleteProduct(slug: string) {
    const first = window.confirm(
      "Delete this product? This cannot be undone.",
    );
    if (!first) return;
    const second = window.prompt("Type DELETE to confirm:");
    if (second !== "DELETE") return;

    try {
      const res = await fetch(`/api/staff/products/${slug}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      setRows((rs) => rs.filter((r) => r.slug !== slug));
      setTotal((t) => Math.max(0, t - 1));
    } catch (e) {
      alert("Failed to delete. Please try again.");
    }
  }

  const QtyCell = ({ qty }: { qty: number }) => (
    <span
      className={[
        "inline-flex items-center justify-center min-w-[2.5rem] rounded-full px-2 py-0.5 text-sm",
        qty <= 2
          ? "bg-red-50 text-red-700"
          : qty <= 10
          ? "bg-yellow-50 text-yellow-700"
          : "bg-[var(--muted)]",
      ].join(" ")}
      title={qty <= 2 ? "Low stock" : qty <= 10 ? "Running low" : "OK"}
    >
      {qty}
    </span>
  );

  const StatusPill = ({ s }: { s: Row["status"] }) => (
    <span
      className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full"
      style={{
        background:
          s === "active"
            ? "#e9f7e9"
            : s === "draft"
            ? "#fff6e6"
            : "#eee",
        color:
          s === "active"
            ? "#166534"
            : s === "draft"
            ? "#92400e"
            : "#374151",
      }}
    >
      {s}
    </span>
  );

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, slug, brand…"
          className="rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/70 dark:bg-white/5 outline-none w-72"
        />

        <select
          value={status}
          onChange={(e) =>
            setStatus(e.target.value as typeof status)
          }
          className="rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/70 dark:bg-white/5 outline-none"
          title="Status"
        >
          <option value="any">Status: All</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>

        <label className="flex items-center gap-2 px-3 py-2 rounded-xl ring-1 ring-[var(--border)] bg-white/70 dark:bg-white/5 select-none text-sm">
          <input
            type="checkbox"
            checked={featuredOnly}
            onChange={(e) => setFeaturedOnly(e.target.checked)}
          />
          Featured only
        </label>

        {/* NEW: stock filter */}
        <select
          value={stockFilter}
          onChange={(e) =>
            setStockFilter(e.target.value as StockFilter)
          }
          className="rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/70 dark:bg-white/5 outline-none"
          title="Stock level"
        >
          <option value="any">Stock: All</option>
          <option value="critical">Critical (≤ 2)</option>
          <option value="low">Low (3–10)</option>
          <option value="out">Out of stock</option>
        </select>

        <select
          value={sort}
          onChange={(e) =>
            setSort(e.target.value as typeof sort)
          }
          className="rounded-xl px-3 py-2 ring-1 ring-[var(--border)] bg-white/70 dark:bg-white/5 outline-none"
          title="Sort"
        >
          <option value="name">Sort: Name</option>
          <option value="newest">Newest</option>
          <option value="qty">Qty</option>
          <option value="price">Price</option>
        </select>

        <button
          className="btn btn-ghost"
          onClick={() => fetchRows(1)}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>

        <div className="ml-auto text-sm text-muted">
          {filteredRows.length} of {total} item
          {total === 1 ? "" : "s"}
        </div>
      </div>

      {/* Inventory alert bar */}
      {(criticalCount > 0 || lowCount > 0) && (
        <div className="rounded-2xl px-4 py-2 bg-red-50 text-xs text-red-800 flex items-center gap-3">
          <span>⚠️ Inventory alert</span>
          {criticalCount > 0 && (
            <span className="font-semibold">
              {criticalCount} product
              {criticalCount === 1 ? "" : "s"} critically low
              (≤ 2 pcs)
            </span>
          )}
          {lowCount > 0 && (
            <span className="text-[11px] text-red-700/80">
              + {lowCount} running low (3–10 pcs)
            </span>
          )}
          <span className="ml-auto text-[11px] text-red-700/70">
            Check and reorder soon.
          </span>
        </div>
      )}

      {/* table */}
      {loading ? (
        <p>Loading inventory…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl ring-1 ring-[var(--border)] bg-white/70 dark:bg-white/5">
          <table className="min-w-full table-auto text-sm">
            <thead className="bg-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Slug</th>
                <th className="px-4 py-3 text-left">Price</th>
                <th className="px-4 py-3 text-left">Qty</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Featured</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((p) => (
                <tr
                  key={p.slug}
                  className="border-t border-[var(--border)]"
                >
                  <td className="px-4 py-3 font-medium">
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {p.slug}
                  </td>
                  <td className="px-4 py-3">
                    ₱{Number(p.price).toLocaleString("en-PH")}
                  </td>
                  <td className="px-4 py-3">
                    <QtyCell qty={p.qty} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill s={p.status} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className={`btn btn-ghost ${
                        p.featured
                          ? "text-yellow-600"
                          : "text-muted"
                      }`}
                      title={
                        p.featured
                          ? "Unfeature"
                          : "Mark as featured"
                      }
                      onClick={() =>
                        toggleFeatured(p.slug, p.featured)
                      }
                      disabled={!canEdit}
                    >
                      {p.featured ? "⭐" : "☆"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {canEdit ? (
                        <Link
                          href={`/dashboard/products/${p.slug}/edit`}
                          className="btn btn-ghost"
                          title="Edit product (Assistant only)"
                        >
                          Edit
                        </Link>
                      ) : (
                        <button
                          className="btn btn-ghost opacity-50 cursor-not-allowed"
                          aria-disabled
                        >
                          Edit
                        </button>
                      )}
                      <Link
                        href={`/product/${p.slug}`}
                        className="btn btn-primary"
                      >
                        View
                      </Link>
                      <button
                        className="btn btn-ghost"
                        onClick={() => deleteProduct(p.slug)}
                        disabled={!canEdit}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-muted"
                  >
                    No products match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* pagination */}
      <div className="flex items-center justify-center gap-3 pt-2">
        <button
          className={`btn btn-ghost ${
            !canPrev ? "pointer-events-none opacity-50" : ""
          }`}
          onClick={() => canPrev && fetchRows(page - 1)}
        >
          ← Prev
        </button>
        <div className="text-xs text-muted">
          Page {page} of {totalPages}
        </div>
        <button
          className={`btn btn-ghost ${
            !canNext ? "pointer-events-none opacity-50" : ""
          }`}
          onClick={() => canNext && fetchRows(page + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
