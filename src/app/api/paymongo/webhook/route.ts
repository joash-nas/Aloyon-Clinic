/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/paymongo/webhook/route.ts

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { redeemPoints } from "@/lib/rewards";

export const dynamic = "force-dynamic";

function verifyPaymongoSignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret) throw new Error("Missing PAYMONGO_WEBHOOK_SECRET");
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const [k, ...rest] = kv.trim().split("=");
      return [k, rest.join("=")];
    })
  );

  const t = parts["t"];
  const te = parts["te"];
  const li = parts["li"];
  if (!t) return false;

  const signedPayload = `${t}.${rawBody}`;
  const computed = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");

  const expected = li && li.length > 0 ? li : te;
  if (!expected) return false;

  const a = Buffer.from(computed);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function autoCreateSaleFromOrder(db: any, orderId: any, order: any) {
  const salesCol = db.collection("sales") as any;

  const existing = await salesCol.findOne({ orderId });
  if (existing) return;

  const now = new Date();

  await salesCol.insertOne({
    date: now,
    category: "Shop Sale",
    description: `Shop order ${order.orderNumber}`,
    amount: order.total,
    paymentMethod: order.paymentMethod || "PayMongo",
    items: (order.items ?? []).map((it: any) => ({
      name: it.name,
      qty: it.qty,
      price: it.unitPrice,
    })),
    createdBy: order.userId || null,
    orderId,
    source: "shop-order",
    updatedAt: now,
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const sig = req.headers.get("paymongo-signature");

    if (!verifyPaymongoSignature(rawBody, sig)) {
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    const eventType = event?.data?.attributes?.type || event?.type || "";
    const resource = event?.data?.attributes?.data || event?.data;

    // metadata is the safest because we set metadata.orderId in create route
    const metadata =
      resource?.attributes?.metadata ||
      resource?.attributes?.data?.attributes?.metadata ||
      resource?.attributes?.payment_intent?.data?.attributes?.metadata ||
      null;

    const orderId = metadata?.orderId;
    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ ok: true, received: true });
    }

    // Determine paid status (tolerant)
    const status =
      resource?.attributes?.status ||
      resource?.attributes?.payment_intent?.data?.attributes?.status ||
      "";

    const isPaid =
      status === "paid" ||
      status === "succeeded" ||
      String(eventType).includes("paid");

    if (!isPaid) return NextResponse.json({ ok: true });

    const db = await getDb();
    const ordersCol = db.collection("orders") as any;

    const _id = new ObjectId(orderId);
    const order = await ordersCol.findOne({ _id });
    if (!order) return NextResponse.json({ ok: true });

    // If already marked paid, stop (idempotent)
    if (order?.payment?.state === "paid") {
      return NextResponse.json({ ok: true });
    }

    const now = new Date();

    // 1) Mark paid
    await ordersCol.updateOne(
      { _id },
      {
        $set: {
          paymentMethod: "PayMongo",
          "payment.provider": "paymongo",
          "payment.state": "paid",
          "payment.paidAt": now,
          updatedAt: now,
        },
      }
    );

    // 2) Apply points if pending (deduct ledger now that payment is confirmed)
    if (order.pointsPendingApply && Number(order.pointsRedeemed || 0) > 0) {
      await redeemPoints({
        patientId: String(order.userId),
        points: Number(order.pointsRedeemed || 0),
        subtotalPhp: Number(order.subtotal || 0),
        sourceType: "order",
        sourceId: String(orderId),
        note: `Applied after PayMongo payment for ${order.orderNumber}`,
      });

      await ordersCol.updateOne(
        { _id },
        { $set: { pointsPendingApply: false, updatedAt: new Date() } }
      );
    }

    // 3) Create sales record (paid online)
    const fresh = await ordersCol.findOne({ _id });
    await autoCreateSaleFromOrder(db, _id, fresh || order);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[paymongo webhook] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Webhook error" }, { status: 500 });
  }
}