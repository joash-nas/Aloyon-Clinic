"use client";

import { useState } from "react";

type UploadResp = { ok: true; id: string; filename: string; contentType: string } | { error: string };

export default function DevUploadImagePage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);

 async function onUpload() {
  if (!file) { setErr("Please choose a file first."); return; }
  setBusy(true); setErr(null); setImageId(null);

  try {
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/images/upload", { method: "POST", body: fd });
    const data = (await res.json()) as UploadResp;

    // Narrow by checking for "id" existence
    if (!res.ok || !("id" in data)) {
      setErr("error" in data ? data.error : "Upload failed");
      setBusy(false);
      return;
    }

    setImageId(data.id); // TypeScript now knows data has an "id"
  } catch (e) {
    setErr((e as Error).message);
  } finally {
    setBusy(false);
  }
}


  return (
    <div className="container py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Dev: Upload Image (GridFS)</h1>

      <div className="card p-4 space-y-3">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button className="btn btn-primary" onClick={onUpload} disabled={busy || !file}>
          {busy ? "Uploading…" : "Upload"}
        </button>

        {err && <div className="text-sm" style={{ color: "#b10d0d" }}>{err}</div>}

        {imageId && (
          <div className="space-y-2">
            <div className="text-sm">Image ID: <code>{imageId}</code></div>
            <div className="text-sm">
              URL:&nbsp;
              <a className="link-muted" href={`/api/images/${imageId}`} target="_blank" rel="noreferrer">
                /api/images/{imageId}
              </a>
            </div>
            <div className="mt-2 card p-2 w-full max-w-md">
              <img
                src={`/api/images/${imageId}`}
                alt="Uploaded"
                className="w-full h-auto object-contain"
              />
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted">
        This page is temporary for testing. You can delete it later.
      </p>
    </div>
  );
}
