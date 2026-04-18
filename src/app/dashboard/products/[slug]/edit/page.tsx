//src/app/dashboard/products/[slug]/edit/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { isAssistant } from "@/lib/roles";
import ProductForm, { ProductFormState } from "@/components/products/ProductForm";

type Loaded = Partial<ProductFormState>;

export default function EditProductPage() {
  const { role } = useAuth();
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [initial, setInitial] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (role && !isAssistant(role)) router.replace("/dashboard/products");
  }, [role, router]);

  useEffect(() => {
    async function load() {
      try {
        const safeSlug = encodeURIComponent(slug || "");
        const res = await fetch(`/api/staff/products/${safeSlug}`, { cache: "no-store" });

        const text = await res.text(); // read once
        let data: any = null;
        try { data = JSON.parse(text); } catch {}

        if (!res.ok) {
          const msg =
            data?.error ||
            data?.message ||
            `Request failed (${res.status})`;
          throw new Error(msg);
        }

        setInitial(data.product);
      } catch (e) {
        setError((e as Error).message);
      }
    }

    if (slug) load();
  }, [slug]);

  if (!isAssistant(role)) return null;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!initial) return <div className="p-6">Loading…</div>;

  return (
    <ProductForm
      mode="edit"
      submitUrl={`/api/staff/products/${encodeURIComponent(slug)}`}
      initial={initial}
    />
  );
}