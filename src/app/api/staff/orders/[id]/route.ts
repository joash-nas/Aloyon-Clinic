/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/staff/orders/[id]/route.ts

import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { sendOrderReadyForPickupEmail } from "@/lib/email";
import { awardPoints, pointsFromPurchaseAmount } from "@/lib/rewards";

export const dynamic = "force-dynamic";

type Status = "pending" | "preparing" | "ready" | "completed" | "cancelled";

function isStaffRole(role?: string | null) {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "assistant" || r === "sales";
}

function isValidObjectId(id: string) {
  return /^[a-f\d]{24}$/i.test(id);
}

const PatchSchema = z.object({
  status: z.enum(["pending", "preparing", "ready", "completed", "cancelled"]),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const role =
      (session?.user as any)?.role || (session?.user as any)?.userRole || null;

    if (!session?.user?.id || !isStaffRole(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params; // Next.js 15
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const db = await getDb();
    const col = db.collection("orders") as any;

    const _id = new ObjectId(id);
    const order = await col.findOne({ _id });
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const locked = order.status === "completed" || order.status === "cancelled";
    if (locked) {
      return NextResponse.json(
        { error: "Order status is locked." },
        { status: 409 }
      );
    }

    const nextStatus = parsed.data.status as Status;
    const prevStatus = order.status as Status;

    await col.updateOne(
      { _id },
      { $set: { status: nextStatus, updatedAt: new Date() } }
    );

    // Award loyalty points when order becomes COMPLETED (send once)
    try {
      const alreadyEarned = Boolean(order?.rewards?.purchaseEarnedAt);

      if (nextStatus === "completed" && prevStatus !== "completed" && !alreadyEarned) {
        const patientId = String(order.userId || "");
        const amountBasis = Number(order.total || 0); // or order.subtotal if you prefer

        const pts = pointsFromPurchaseAmount(amountBasis);

        if (patientId && pts > 0) {
          await awardPoints({
            patientId,
            staffId: String(session.user.id), // staff who completed it
            activity: "purchase",
            points: pts,
            sourceType: "order",
            sourceId: String(order._id), // for dedup
            note: `Earned from completed order ${String(order.orderNumber || "")}`,
          });

          // mark in order doc so UI/debugging shows it happened
          await col.updateOne(
            { _id },
            { $set: { "rewards.purchaseEarnedAt": new Date(), updatedAt: new Date() } }
          );
        }
      }
    } catch (pointsErr) {
      console.error("[Points award] failed:", pointsErr);
      // do NOT fail status update
    }

    // Send "Ready for pickup" email when moved to READY (send once)
    try {
      const email: string | null =
        (order.userEmail as string | null) ||
        (order.user?.email as string | null) ||
        null;

      const alreadySent = Boolean(order?.notifications?.readyEmailSentAt);

      if (nextStatus === "ready" && prevStatus !== "ready" && email && !alreadySent) {
        // Use the request's origin as fallback base URL (works for localhost and Vercel)
        const origin = new URL(req.url).origin;

        await sendOrderReadyForPickupEmail({
          to: email,
          orderNumber: String(order.orderNumber || "Your order"),
          totalPhp: Number(order.total || 0),
          baseUrl: origin,
        });

        await col.updateOne(
          { _id },
          { $set: { "notifications.readyEmailSentAt": new Date() } }
        );
      }
    } catch (mailErr) {
      // Don't fail the status update if email fails
      console.error("[Ready email] failed:", mailErr);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[PATCH /api/staff/orders/[id]] error:", e);
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}