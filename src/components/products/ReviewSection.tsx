"use client";

import { useEffect, useMemo, useState } from "react";

type Review = {
  id: string;
  userId: string;
  name: string;
  rating: number;
  comment: string;
  anonymous?: boolean;
  createdAt: string;
};

type Props = {
  slug: string;
  initialAverage?: number | null;
  initialCount?: number | null;
  canReview?: boolean;
};

type SortOption = "newest" | "oldest" | "highest" | "lowest";

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Stars({
  value,
  onChange,
  readonly = false,
}: {
  value: number;
  onChange?: (n: number) => void;
  readonly?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => !readonly && onChange?.(n)}
          className={readonly ? "cursor-default" : "cursor-pointer"}
          disabled={readonly}
          aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
        >
          <span className={n <= value ? "text-yellow-500" : "text-slate-300"}>
            ★
          </span>
        </button>
      ))}
    </div>
  );
}

export default function ReviewSection({
  slug,
  initialAverage,
  initialCount,
  canReview = false,
}: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState<number>(initialAverage ?? 0);
  const [count, setCount] = useState<number>(initialCount ?? 0);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [anonymous, setAnonymous] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [openReviews, setOpenReviews] = useState(false);
  const [openWriteReview, setOpenWriteReview] = useState(false);

  const [page, setPage] = useState(1);
  const [limit] = useState(5);
  const [sort, setSort] = useState<SortOption>("newest");
  const [totalPages, setTotalPages] = useState(1);

  async function loadReviews(nextPage = page, nextSort = sort) {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(
        `/api/products/${encodeURIComponent(
          slug
        )}/reviews?page=${nextPage}&limit=${limit}&sort=${nextSort}`,
        { cache: "no-store" }
      );

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load reviews.");
      }

      setReviews(data.reviews ?? []);
      setAverage(data.summary?.averageRating ?? 0);
      setCount(data.summary?.reviewsCount ?? 0);
      setPage(data.pagination?.page ?? 1);
      setTotalPages(data.pagination?.totalPages ?? 1);
    } catch (err: any) {
      setMessage(err?.message || "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReviews(1, sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, sort]);

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/products/${encodeURIComponent(slug)}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating,
          comment,
          anonymous,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to submit review.");
      }

      setComment("");
      setAnonymous(false);
      setRating(5);
      setMessage(data.message || "Review submitted.");
      setOpenReviews(true);
      setOpenWriteReview(false);
      await loadReviews(1, sort);
    } catch (err: any) {
      setMessage(err?.message || "Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  }

  const averageLabel = useMemo(() => {
    if (!count) return "No reviews yet";
    return `${average.toFixed(1)} out of 5`;
  }, [average, count]);

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages) return;
    loadReviews(nextPage, sort);
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-xl font-semibold">Reviews</h3>
          <p className="text-sm text-muted">
            {averageLabel} • {count} review{count === 1 ? "" : "s"}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm">
          <div className="font-semibold">{count ? average.toFixed(1) : "—"} ★</div>
          <div className="text-xs text-muted">Buyer ratings</div>
        </div>
      </div>

      <div className="space-y-3">
        {canReview && (
          <>
            <button
              type="button"
              onClick={() => setOpenWriteReview((v) => !v)}
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-left flex items-center justify-between"
            >
              <span className="font-medium">Leave a review</span>
              <span className="text-sm text-muted">
                {openWriteReview ? "Hide" : "Open"}
              </span>
            </button>

            {openWriteReview && (
              <form onSubmit={submitReview} className="card p-4 space-y-4">
                <div>
                  <div className="text-sm font-medium mb-2">Your rating</div>
                  <Stars value={rating} onChange={setRating} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Comment</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    maxLength={500}
                    placeholder="Share your experience with this product..."
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 outline-none"
                    required
                  />
                  <div className="text-xs text-muted text-right">
                    {comment.length}/500
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={anonymous}
                    onChange={(e) => setAnonymous(e.target.checked)}
                  />
                  Post this review anonymously
                </label>

                <div className="flex items-center gap-3 flex-wrap">
                  <button type="submit" className="btn" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit review"}
                  </button>
                  {message ? <span className="text-sm text-muted">{message}</span> : null}
                </div>

                <p className="text-xs text-muted">
                  Only signed-in buyers can leave a review.
                </p>
              </form>
            )}
          </>
        )}

        <button
          type="button"
          onClick={() => setOpenReviews((v) => !v)}
          className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-left flex items-center justify-between"
        >
          <span className="font-medium">All reviews</span>
          <span className="text-sm text-muted">
            {openReviews ? "Hide" : `View ${count}`}
          </span>
        </button>

        {openReviews && (
          <div className="card p-4 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm text-muted">
                Page {page} of {totalPages}
              </div>

              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as SortOption);
                  setPage(1);
                }}
                className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="highest">Highest rated</option>
                <option value="lowest">Lowest rated</option>
              </select>
            </div>

            {loading ? (
              <div className="text-sm text-muted">Loading reviews...</div>
            ) : reviews.length === 0 ? (
              <div className="text-sm text-muted">No reviews yet for this product.</div>
            ) : (
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-[var(--border)] p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted">{formatDate(r.createdAt)}</div>
                      </div>
                      <Stars value={r.rating} readonly />
                    </div>

                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {r.comment}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || loading}
                className="btn btn-ghost disabled:opacity-50"
              >
                Previous
              </button>

              <div className="text-sm text-muted">
                {count} total review{count === 1 ? "" : "s"}
              </div>

              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages || loading}
                className="btn btn-ghost disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}