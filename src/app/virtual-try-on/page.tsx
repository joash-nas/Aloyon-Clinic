// src/app/virtual-try-on/page.tsx
import { Suspense } from "react";
import VirtualTryOnClient from "./VirtualTryOnClient";

export default function VirtualTryOnPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-sm text-muted-foreground">Loading try-on…</div>
        </div>
      }
    >
      <VirtualTryOnClient />
    </Suspense>
  );
}