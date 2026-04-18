export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getImageBucket } from "@/lib/gridfs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> } // Next 15 dynamic params are awaited
) {
  try {
    const { id } = await ctx.params;

    let _id: ObjectId;
    try {
      _id = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const db = await getDb();
    const files = db.collection("productImages.files");
    const file = await files.findOne<{ _id: ObjectId; filename?: string; metadata?: Record<string, unknown> }>({ _id });
    if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const contentType =
      (file.metadata?.["contentType"] as string | undefined) ||
      (file.filename?.match(/\.(png)$/i) ? "image/png" :
       file.filename?.match(/\.(jpe?g)$/i) ? "image/jpeg" :
       file.filename?.match(/\.(gif)$/i) ? "image/gif" :
       file.filename?.match(/\.(webp)$/i) ? "image/webp" : "application/octet-stream");

    const bucket = await getImageBucket();
    const nodeStream = bucket.openDownloadStream(_id);

    const readable = new ReadableStream({
      start(controller) {
        nodeStream.on("data", (chunk) => controller.enqueue(chunk));
        nodeStream.on("end", () => controller.close());
        nodeStream.on("error", (err: Error) => controller.error(err));
      },
      cancel() {
        nodeStream.destroy();
      },
    });

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("ETag", id);

    return new Response(readable, { headers });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("image-stream error:", msg);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
