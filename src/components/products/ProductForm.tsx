// src/components/products/ProductForm.tsx

"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";

// ----- types reused from your current form -----
type StepImage = { id: string; url: string };
type Status = "active" | "draft" | "archived";
type ProductType =
  | "frames"
  | "eyedrops"
  | "accessory"
  | "solution"
  | "contact-lens"
  | null;

type Visibility = {
  material: boolean;
  shape: boolean;
  color: boolean;
  category: boolean;
  size_ml: boolean;
  size_count: boolean;
  dosage: boolean;
};
type RequiredByType = Partial<Record<keyof Visibility, boolean>>;

const FRAME_MATERIAL_OPTIONS = [
  "acetate",
  "metal",
  "titanium",
  "stainless steel",
  "tr90",
  "mixed",
] as const;

const FRAME_SHAPE_OPTIONS = [
  "round",
  "rectangle",
  "square",
  "aviator",
  "cat-eye",
  "oval",
  "geometric",
  "browline",
  "wayfarer",
] as const;

const FRAME_COLOR_OPTIONS = [
  "black",
  "tortoise",
  "gold",
  "silver",
  "clear",
  "brown",
  "blue",
  "green",
  "pink",
  "red",
] as const;

function getVisibility(type: ProductType): Visibility {
  if (!type)
    return {
      material: true,
      shape: true,
      color: true,
      category: true,
      size_ml: true,
      size_count: true,
      dosage: true,
    };

  switch (type) {
    case "frames":
      return {
        material: true,
        shape: true,
        color: true,
        category: false,
        size_ml: false,
        size_count: false,
        dosage: false,
      };
    case "eyedrops":
      return {
        material: false,
        shape: false,
        color: false,
        category: true,
        size_ml: true,
        size_count: false,
        dosage: true,
      };
    case "solution":
      return {
        material: false,
        shape: false,
        color: false,
        category: true,
        size_ml: true,
        size_count: false,
        dosage: false,
      };
    case "accessory":
      return {
        material: false,
        shape: false,
        color: false,
        category: true,
        size_ml: false,
        size_count: false,
        dosage: false,
      };
    case "contact-lens":
      return {
        material: false,
        shape: false,
        color: false,
        category: true,
        size_ml: false,
        size_count: true,
        dosage: false,
      };
  }
}

function getRequired(type: ProductType): RequiredByType {
  switch (type) {
    case "frames":
      return { material: true, shape: true };
    case "eyedrops":
      return { size_ml: true };
    case "solution":
      return { size_ml: true };
    case "accessory":
      return { category: true };
    case "contact-lens":
      return { category: true, size_count: true };
    default:
      return {};
  }
}

type CatalogFields = {
  product_type: ProductType;
  material: string | null;
  shape: string | null;
  color: string | null;
  category: string | null;
  size_ml: number | null;
  size_count: number | null;
  dosage: string | null;
};

function normalizeText(v: string | null | undefined) {
  const s = String(v ?? "").trim();
  return s ? s.toLowerCase() : null;
}

function normalizeByType<T extends CatalogFields>(d: T): T {
  const v = getVisibility(d.product_type);
  return {
    ...d,
    material: v.material ? normalizeText(d.material) : null,
    shape: v.shape ? normalizeText(d.shape) : null,
    color: v.color ? normalizeText(d.color) : null,
    category: v.category ? normalizeText(d.category) : null,
    size_ml: v.size_ml ? d.size_ml : null,
    size_count: v.size_count ? d.size_count : null,
    dosage: v.dosage ? normalizeText(d.dosage) : null,
  };
}

function normalizeSupplierId(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && typeof v.$oid === "string") return v.$oid;
  if (typeof v === "object" && typeof v.toString === "function") return String(v);
  return "";
}

const zNullishString = z.string().nullish().transform((v) => v ?? null);
const zNullishNumber = z.coerce.number().nullish().transform((v) => v ?? null);
const zNullishType = z
  .enum(["frames", "eyedrops", "accessory", "solution", "contact-lens"])
  .nullish()
  .transform((v) => v ?? null);

const Schema = z
  .object({
    name: z.string().min(1, "Name is required"),
    slug: z
      .string()
      .min(1, "Slug is required")
      .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes only"),
    brand: z.string().optional(),
    price: z.coerce.number().min(0, "Price must be ≥ 0"),
    qty: z.coerce.number().int().min(0, "Quantity must be ≥ 0"),
    status: z.enum(["active", "draft", "archived"]),
    featured: z.boolean().optional(),

    product_type: zNullishType,
    material: zNullishString,
    shape: zNullishString,
    color: zNullishString,
    category: zNullishString,
    size_ml: zNullishNumber,
    size_count: zNullishNumber,
    dosage: zNullishString,

    imageIds: z.array(z.string()).min(1, "Upload at least one image"),
    primaryImageId: z.string().min(1, "Choose a primary image"),

    tryonImageId: z.string().nullish().transform((v) => v ?? null),
    supplierId: z.string().min(1, "Supplier is required"),
  })
  .superRefine((d, ctx) => {
    const req = getRequired(d.product_type);

    if (req.material && (!d.material || d.material.trim() === "")) {
      ctx.addIssue({
        code: "custom",
        path: ["material"],
        message: "Material is required",
      });
    }

    if (req.shape && (!d.shape || d.shape.trim() === "")) {
      ctx.addIssue({
        code: "custom",
        path: ["shape"],
        message: "Shape is required",
      });
    }

    if (req.size_ml && (d.size_ml === null || Number.isNaN(d.size_ml))) {
      ctx.addIssue({
        code: "custom",
        path: ["size_ml"],
        message: "Size (ml) is required",
      });
    }

    if (req.size_count && (d.size_count === null || Number.isNaN(d.size_count))) {
      ctx.addIssue({
        code: "custom",
        path: ["size_count"],
        message: "Count is required",
      });
    }

    if (req.category && (!d.category || d.category.trim() === "")) {
      ctx.addIssue({
        code: "custom",
        path: ["category"],
        message: "Category is required",
      });
    }
  });

export type ProductFormState = z.infer<typeof Schema>;
type Initial = Partial<ProductFormState>;

type Props = {
  mode: "create" | "edit";
  submitUrl: string;
  initial?: Initial;
};

type SupplierOpt = { id: string; name: string };

export default function ProductForm({ mode, submitUrl, initial }: Props) {
  const r = useRouter();

  const [suppliers, setSuppliers] = useState<SupplierOpt[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [images, setImages] = useState<StepImage[]>([]);
  const [primaryId, setPrimaryId] = useState<string>("");

  const [tryonImage, setTryonImage] = useState<StepImage | null>(null);
  const [tryonUploading, setTryonUploading] = useState(false);

  const [form, setForm] = useState<ProductFormState>({
    name: "",
    slug: "",
    brand: "",
    price: 0,
    qty: 0,
    status: "draft",
    featured: false,

    product_type: null,
    material: null,
    shape: null,
    color: null,
    category: null,
    size_ml: null,
    size_count: null,
    dosage: null,

    imageIds: [],
    primaryImageId: "",
    tryonImageId: null,
    supplierId: "",
  });

  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ProductFormState, string>>>({});
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      setSuppliersLoading(true);
      try {
        const res = await fetch("/api/staff/suppliers", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load suppliers");
        setSuppliers((data.suppliers ?? []) as SupplierOpt[]);
      } catch (e) {
        showToast("error", (e as Error).message);
      } finally {
        setSuppliersLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!initial) return;

    setForm((f) => ({
      ...f,
      ...initial,
      product_type: (initial.product_type ?? null) as ProductType,
      material: normalizeText(initial.material ?? null),
      shape: normalizeText(initial.shape ?? null),
      color: normalizeText((initial as any).color ?? null),
      category: normalizeText(initial.category ?? null),
      size_ml: (initial.size_ml ?? null) as number | null,
      size_count: (initial.size_count ?? null) as number | null,
      dosage: normalizeText(initial.dosage ?? null),
      tryonImageId: initial.tryonImageId ?? null,
      supplierId: normalizeSupplierId((initial as any).supplierId),
    }));

    const ids = (initial.imageIds ?? []) as string[];
    const prim = initial.primaryImageId ?? (ids[0] ?? "");
    setImages(ids.map((id) => ({ id, url: `/api/images/${id}` })));
    setPrimaryId(prim);

    if (initial.tryonImageId) {
      setTryonImage({ id: initial.tryonImageId, url: `/api/images/${initial.tryonImageId}` });
    }
  }, [initial]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const openFileDialog = () => fileInputRef.current?.click();

  const onPickFiles = (files: FileList | null) =>
    files && setSelectedFiles((prev) => [...prev, ...Array.from(files)]);

  const clearSelection = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  const onDropFiles = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) setSelectedFiles((prev) => [...prev, ...files]);
  };

  useEffect(() => {
    const ids = images.map((i) => i.id);
    setForm((f) => ({
      ...f,
      imageIds: ids,
      primaryImageId: primaryId || ids[0] || "",
    }));
  }, [images, primaryId]);

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  }

  function set<K extends keyof ProductFormState>(k: K, v: ProductFormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function uploadSelected() {
    if (!selectedFiles.length) return;
    setBusy(true);
    try {
      const uploaded: StepImage[] = [];
      for (const file of selectedFiles) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/staff/images/upload", { method: "POST", body: fd });
        const data: { ok?: true; ids?: string[]; id?: string; error?: string } = await res.json();
        const ids = data.ids ?? (data.id ? [data.id] : []);
        if (!res.ok || ids.length === 0) throw new Error(data?.error || "Upload failed");
        ids.forEach((id) => uploaded.push({ id, url: `/api/images/${id}` }));
      }
      setImages((prev) => [...prev, ...uploaded]);
      clearSelection();
      showToast("success", `Uploaded ${uploaded.length} image${uploaded.length > 1 ? "s" : ""}.`);
    } catch (e) {
      showToast("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadTryon(file: File) {
    if (!file) return;
    setTryonUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/staff/images/upload", { method: "POST", body: fd });
      const data: { ok?: true; ids?: string[]; id?: string; error?: string } = await res.json();
      const ids = data.ids ?? (data.id ? [data.id] : []);
      if (!res.ok || ids.length === 0) throw new Error(data?.error || "Upload failed");
      const id = ids[0];
      setTryonImage({ id, url: `/api/images/${id}` });
      set("tryonImageId", id);
      showToast("success", "Virtual try-on PNG uploaded.");
    } catch (e) {
      showToast("error", (e as Error).message);
    } finally {
      setTryonUploading(false);
    }
  }

  function clearTryon() {
    setTryonImage(null);
    set("tryonImageId", null);
  }

  async function onSave() {
    const candidate: ProductFormState = {
      ...form,
      primaryImageId: primaryId || form.primaryImageId,
      imageIds: images.map((i) => i.id),
    };

    const parsed = Schema.safeParse(candidate);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const mapped: Partial<Record<keyof ProductFormState, string>> = {};
      (Object.keys(flat.fieldErrors) as (keyof ProductFormState)[]).forEach((k) => {
        const msg = flat.fieldErrors[k]?.[0];
        if (msg) mapped[k] = msg;
      });
      setErrors(mapped);
      showToast("error", flat.formErrors?.[0] ?? "Please fix the highlighted fields.");
      return;
    }

    const clean = normalizeByType(parsed.data as CatalogFields & typeof parsed.data);

    setErrors({});
    setBusy(true);
    try {
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch(submitUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clean),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Save failed");
      showToast("success", "Saved!");
      r.push("/dashboard/products");
    } catch (e) {
      showToast("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function fieldClass(hasError?: boolean, extra = "") {
    const base =
      "rounded-xl px-3 py-2 ring-1 outline-none transition bg-white/70 dark:bg-white/5";
    const ring = hasError
      ? " ring-red-500"
      : " ring-[var(--border)] focus:ring-[var(--primary)]";
    return base + ring + (extra ? ` ${extra}` : "");
  }

  const V = getVisibility(form.product_type ?? null);
  const R = getRequired(form.product_type ?? null);

  const btnBase =
    "rounded-lg px-3 py-1.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--primary)]";
  const btnGhost =
    `${btnBase} ring-1 ring-[var(--border)] bg-white/70 dark:bg-white/5 hover:shadow-sm`;
  const btnPrimary =
    `${btnBase} text-[var(--primary-ink)] bg-[var(--primary)] hover:brightness-95`;

  return (
    <div className="space-y-6">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-1/2 -translate-x-1/2 top-4 z-50 px-4 py-2 rounded-xl text-sm shadow ${
            toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Step 1 – images */}
      <section className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-[var(--muted)]">
              Step 1
            </span>
            <h2 className="text-lg font-semibold">Upload images</h2>
          </div>
          <div className="text-xs text-muted">
            Unlimited images. Click a thumbnail below to set <strong>Primary</strong>.
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onPickFiles(e.target.files)}
        />

        <div
          role="button"
          tabIndex={0}
          onClick={openFileDialog}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") openFileDialog();
          }}
          onDragOver={onDragOver}
          onDrop={onDropFiles}
          className="rounded-xl border-2 border-dashed border-[var(--border)] bg-white/40 dark:bg-white/5 cursor-pointer text-center p-6 hover:bg-white/60 transition"
          aria-label="Drop images here or click to select files"
        >
          <div className="text-sm text-muted">
            <span className="font-medium">Drag & drop</span> images here or{" "}
            <span className="underline">click to select</span>.
          </div>
          {selectedFiles.length > 0 && (
            <div className="mt-2 text-xs text-muted">
              {selectedFiles.length} file(s) ready to upload
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="flex gap-2">
            <button type="button" className={btnGhost} onClick={openFileDialog}>
              📁 Select
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={clearSelection}
              disabled={selectedFiles.length === 0}
            >
              ✖️ Clear
            </button>
          </div>
          <button
            type="button"
            className={btnPrimary}
            onClick={uploadSelected}
            disabled={busy || selectedFiles.length === 0}
          >
            ⬆️ {busy ? "Uploading…" : `Upload ${selectedFiles.length ? `(${selectedFiles.length})` : ""}`}
          </button>
        </div>

        {images.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {images.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setPrimaryId(img.id)}
                  className={`relative rounded-xl overflow-hidden ring-2 transition ${
                    primaryId === img.id
                      ? "ring-[var(--primary)]"
                      : "ring-[var(--border)] hover:ring-[var(--primary)]/50"
                  }`}
                >
                  <img src={img.url} alt="" className="w-full h-36 object-cover" />
                  <div className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-2 py-0.5 rounded">
                    {primaryId === img.id ? "Primary ✓" : "Set primary"}
                  </div>
                </button>
              ))}
            </div>
            <div className="text-xs text-muted">Primary image: {primaryId || "—"}</div>
          </>
        )}

        {form.product_type === "frames" && (
          <div className="mt-4 pt-4 border-t border-dashed border-[var(--border)] space-y-2">
            <h3 className="text-sm font-semibold">Virtual Try-On PNG (frames only)</h3>
            <p className="text-xs text-muted max-w-md">
              Upload a transparent PNG of the frame (front view). This image is used by the AI virtual
              try-on overlay and won’t appear in the regular product gallery.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/png"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadTryon(f);
                }}
              />
              {tryonImage && (
                <button type="button" className={btnGhost} onClick={clearTryon}>
                  Remove PNG
                </button>
              )}
              {tryonUploading && <span className="text-xs text-muted">Uploading…</span>}
            </div>
            {tryonImage && (
              <div className="mt-2 inline-block rounded-xl ring-1 ring-[var(--border)] bg-white/70 dark:bg-white/5 p-2">
                <div className="text-[11px] text-muted mb-1">Current virtual try-on image</div>
                <img src={tryonImage.url} alt="Virtual try-on frame" className="h-24 object-contain" />
              </div>
            )}
          </div>
        )}
      </section>

      {/* Step 2 – details */}
      <section className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-[var(--muted)]">
            Step 2
          </span>
          <h2 className="text-lg font-semibold">Details</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted select-none">Name *</label>
              <input
                className={fieldClass(!!errors.name, "w-full")}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted select-none">Slug *</label>
              <input
                className={fieldClass(!!errors.slug, "w-full")}
                value={form.slug}
                onChange={(e) => set("slug", e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted select-none">Brand</label>
              <input
                className={fieldClass(false, "w-full")}
                value={form.brand ?? ""}
                onChange={(e) => set("brand", e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted select-none">Price (₱) *</label>
              <input
                type="number"
                className={fieldClass(!!errors.price, "w-full")}
                value={form.price}
                onChange={(e) => set("price", Number(e.target.value))}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted select-none">Quantity in stock *</label>
              <input
                type="number"
                className={fieldClass(!!errors.qty, "w-full")}
                value={form.qty}
                onChange={(e) => set("qty", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted select-none">Status *</label>
              <select
                className={fieldClass(!!errors.status, "w-full")}
                value={form.status}
                onChange={(e) => set("status", e.target.value as Status)}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="featured"
                type="checkbox"
                checked={!!form.featured}
                onChange={(e) => set("featured", e.target.checked)}
              />
              <label htmlFor="featured" className="text-xs font-medium text-muted select-none">
                Show on home page
              </label>
            </div>

            <div>
              <label className="text-xs font-medium text-muted select-none">Type</label>
              <select
                className={fieldClass(false, "w-full")}
                value={form.product_type ?? ""}
                onChange={(e) => set("product_type", (e.target.value || null) as ProductType)}
              >
                <option value="">(none)</option>
                <option value="frames">Frames</option>
                <option value="eyedrops">Eye drops</option>
                <option value="solution">Solution</option>
                <option value="contact-lens">Contact lens</option>
                <option value="accessory">Accessory</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted select-none">Supplier *</label>
              <select
                className={fieldClass(!!errors.supplierId, "w-full")}
                value={form.supplierId}
                onChange={(e) => set("supplierId", e.target.value)}
                disabled={suppliersLoading}
              >
                <option value="">{suppliersLoading ? "Loading suppliers…" : "(Select supplier)"}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {errors.supplierId && (
                <div className="mt-1 text-xs text-red-600">{errors.supplierId}</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {V.material && (
                <div>
                  <label className="text-xs font-medium text-muted select-none">
                    Material{R.material ? " *" : ""}
                  </label>
                  <select
                    className={fieldClass(!!errors.material, "w-full")}
                    value={form.material ?? ""}
                    onChange={(e) => set("material", e.target.value || null)}
                  >
                    <option value="">(Select material)</option>
                    {FRAME_MATERIAL_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt === "tr90"
                          ? "TR90"
                          : opt
                              .split(" ")
                              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                              .join(" ")}
                      </option>
                    ))}
                  </select>
                  {errors.material && (
                    <div className="mt-1 text-xs text-red-600">{errors.material}</div>
                  )}
                </div>
              )}

              {V.shape && (
                <div>
                  <label className="text-xs font-medium text-muted select-none">
                    Shape{R.shape ? " *" : ""}
                  </label>
                  <select
                    className={fieldClass(!!errors.shape, "w-full")}
                    value={form.shape ?? ""}
                    onChange={(e) => set("shape", e.target.value || null)}
                  >
                    <option value="">(Select shape)</option>
                    {FRAME_SHAPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt
                          .split("-")
                          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                          .join("-")}
                      </option>
                    ))}
                  </select>
                  {errors.shape && (
                    <div className="mt-1 text-xs text-red-600">{errors.shape}</div>
                  )}
                </div>
              )}

                            {V.color && (
                <div>
                  <label className="text-xs font-medium text-muted select-none">
                    Color
                  </label>
                  <select
                    className={fieldClass(!!errors.color, "w-full")}
                    value={(form as any).color ?? ""}
                    onChange={(e) => set("color" as keyof ProductFormState, (e.target.value || null) as any)}
                  >
                    <option value="">(Select color)</option>
                    {FRAME_COLOR_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </option>
                    ))}
                  </select>
                  {(errors as any).color && (
                    <div className="mt-1 text-xs text-red-600">{(errors as any).color}</div>
                  )}
                </div>
              )}

              {V.category && (
                <div>
                  <label className="text-xs font-medium text-muted select-none">
                    Category{R.category ? " *" : ""}
                  </label>
                  <input
                    className={fieldClass(!!errors.category, "w-full")}
                    value={form.category ?? ""}
                    onChange={(e) => set("category", e.target.value || null)}
                  />
                </div>
              )}

              {V.size_ml && (
                <div>
                  <label className="text-xs font-medium text-muted select-none">
                    Size (ml){R.size_ml ? " *" : ""}
                  </label>
                  <input
                    type="number"
                    className={fieldClass(!!errors.size_ml, "w-full")}
                    value={form.size_ml ?? ""}
                    onChange={(e) =>
                      set("size_ml", e.target.value === "" ? null : Number(e.target.value))
                    }
                  />
                </div>
              )}

              {V.size_count && (
                <div>
                  <label className="text-xs font-medium text-muted select-none">
                    Count{R.size_count ? " *" : ""}
                  </label>
                  <input
                    type="number"
                    className={fieldClass(!!errors.size_count, "w-full")}
                    value={form.size_count ?? ""}
                    onChange={(e) =>
                      set("size_count", e.target.value === "" ? null : Number(e.target.value))
                    }
                  />
                </div>
              )}

              {V.dosage && (
                <div>
                  <label className="text-xs font-medium text-muted select-none">
                    Dosage{R.dosage ? " *" : ""}
                  </label>
                  <input
                    className={fieldClass(!!errors.dosage, "w-full")}
                    value={form.dosage ?? ""}
                    onChange={(e) => set("dosage", e.target.value || null)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => r.push("/dashboard/products")}
          >
            Back to list
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSave}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save product"}
          </button>
        </div>

        {(errors.imageIds || errors.primaryImageId) && (
          <div className="text-sm" style={{ color: "#b10d0d" }}>
            {errors.imageIds || errors.primaryImageId}
          </div>
        )}
      </section>
    </div>
  );
}