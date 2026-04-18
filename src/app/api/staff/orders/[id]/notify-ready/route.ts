/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/staff/orders/[id]/notify-ready/route.ts

import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { sendOrderReadyForPickupEmail } from "@/lib/email";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Status = "pending" | "preparing" | "ready" | "completed" | "cancelled";

function isStaffRole(role?: string | null) {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "assistant" || r === "sales";
}
function isValidObjectId(id: string) {
  return /^[a-f\d]{24}$/i.test(id);
}

const BodySchema = z.object({
  force: z.boolean().optional(), // allow resend even if already sent
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const role =
      (session?.user as any)?.role || (session?.user as any)?.userRole || null;

    if (!session?.user?.id || !isStaffRole(role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    const force = Boolean(parsed.data.force);

    const db = await getDb();
    const col = db.collection("orders") as any;

    const _id = new ObjectId(id);
    const order = await col.findOne({ _id });
    if (!order) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const status = String(order.status || "") as Status;
    if (status !== "ready") {
      return NextResponse.json(
        { ok: false, error: "Order is not READY yet." },
        { status: 409 }
      );
    }

    const email: string | null =
      (order.userEmail as string | null) ||
      (order.user?.email as string | null) ||
      null;

    if (!email) {
      return NextResponse.json({ ok: false, error: "Customer email not found." }, { status: 400 });
    }

    const alreadySent = Boolean(order?.notifications?.readyEmailSentAt);
    if (alreadySent && !force) {
      return NextResponse.json({ ok: true, skipped: true, message: "Ready email already sent." });
    }

    const origin = new URL(req.url).origin;

    await sendOrderReadyForPickupEmail({
      to: email,
      orderNumber: String(order.orderNumber || "Your order"),
      totalPhp: Number(order.total || 0),
      baseUrl: origin,
    });

    await col.updateOne(
      { _id },
      { $set: { "notifications.readyEmailSentAt": new Date(), updatedAt: new Date() } }
    );

    return NextResponse.json({ ok: true, sent: true });
  } catch (e: any) {
    console.error("[POST /api/staff/orders/[id]/notify-ready] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}