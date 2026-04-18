// src/app/login/page.tsx
import { Suspense } from "react";
import LoginClient from "./LoginClient";

type PageProps = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const redirectTo = params?.redirect ?? null;

  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center">
          <div className="text-sm text-muted">Loading…</div>
        </div>
      }
    >
      <LoginClient redirectTo={redirectTo} />
    </Suspense>
  );
}
