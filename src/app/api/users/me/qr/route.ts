/* eslint-disable @typescript-eslint/no-explicit-any */

//src/app/api/users/me/qr/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import crypto from "crypto";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role as string | undefined;
    if (role !== "patient") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const db = await getDb();
    const userId = new ObjectId(String(session.user.id));

    const users = db.collection("users");
    const user = await users.findOne({ _id: userId }, { projection: { qrToken: 1 } });

    if (!user) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    let qrToken = (user as any).qrToken as string | undefined;

    if (!qrToken) {
      qrToken = crypto.randomBytes(16).toString("hex");
      await users.updateOne(
        { _id: userId },
        { $set: { qrToken, qrCreatedAt: new Date() } }
      );
    }

    const qrText = `ALOYON:PT:${qrToken}`;
    return NextResponse.json({ ok: true, qrText });
  } catch (e) {
    console.error("GET /api/users/me/qr error:", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
