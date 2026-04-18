export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getImageBucket } from "@/lib/gridfs";
import { STAFF_ROLES } from "@/lib/roles";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (!session || !role || !STAFF_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();

  const files: File[] = [];
  for (const [, value] of form.entries()) {
    if (value instanceof Blob) files.push(value as File);
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  const bucket = await getImageBucket();
  const ids: string[] = [];

  for (const f of files) {
    const filename = f.name || "upload";
    const contentType = f.type || "application/octet-stream";
    const buffer = Buffer.from(await f.arrayBuffer());

    const uploadStream = bucket.openUploadStream(filename, {
      metadata: {
        contentType,
        uploadedBy: session.user.id,
        uploadedAt: new Date(),
      },
    });

    await new Promise<void>((resolve, reject) => {
      uploadStream.on("finish", () => resolve());
      uploadStream.on("error", (err: Error) => reject(err));
      uploadStream.end(buffer);
    });

    ids.push(String(uploadStream.id));
  }

  return NextResponse.json({ ok: true, ids });
}
