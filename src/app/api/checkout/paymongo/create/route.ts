/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/checkout/paymongo/create/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getToken } from "next-auth/jwt";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getRedeemQuote, pesoFromPoints } from "@/lib/rewards";
import { paymongoFetch } from "@/lib/paymongo";

const SECRET = process.env.NEXTAUTH_SECRET!;
export const dynamic = "force-dynamic";

const ItemSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  qty: z.number().int().min(1),
  unitPrice: z.number().min(0),
});

const BodySchema = z.object({
  items: z.array(ItemSchema).min(1),
  pointsToUse: z.number().int().min(0).optional(),
  customer: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
});

type OrderStatus = "pending" | "preparing" | "ready" | "completed" | "cancelled";

type OrderItem = {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

type OrderDoc = {
  orderNumber: string;
  userId: string;
  userEmail: string | null;
  status: OrderStatus;

  items: OrderItem[];
  subtotal: number;

  rewardsDiscount: number;
  pointsRedeemed: number;

  shippingFee: number;
  total: number;

  paymentMethod: string;
  payment: {
    provider: "paymongo";
    state: "unpaid" | "paid";
    paidAt: Date | null;
    checkoutUrl: string | null;
    checkoutSessionId: string | null;
  };

  pointsPendingApply: boolean;

  notes: string | null;
  shippingAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function makeOrderNumber(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `ALY-${y}${m}${d}-${rand}`;
}

const phpToCentavos = (php: number) => Math.round(Number(php) * 100);

/**
 * Make PayMongo line_items sum EXACTLY match totalCharged (all positive)
 * We expand items into quantity=1 units, then distribute discount in centavos.
 */
function buildDiscountedLineItems(args: {
  items: Array<{ name: string; qty: number; unitPricePhp: number }>;
  totalChargedCentavos: number;
}) {
  // Expand into units (qty = 1 per unit) so we can adjust by 1 centavo safely
  const units: Array<{ name: string; quantity: number; amount: number; currency: "PHP" }> = [];

  for (const it of args.items) {
    const unit = phpToCentavos(it.unitPricePhp);
    const qty = Math.max(1, Math.floor(it.qty || 1));

    for (let i = 0; i < qty; i++) {
      units.push({
        name: it.name,
        quantity: 1, // required by PayMongo
        amount: unit,
        currency: "PHP",
      });
    }
  }

  const originalSum = units.reduce((s, u) => s + u.amount, 0);
  const target = Math.max(0, Math.floor(args.totalChargedCentavos || 0));

  // If for some reason target is >= original, just return originals
  if (target >= originalSum) return units;

  let discount = originalSum - target;

  // Distribute discount 1 centavo at a time across units
  // Keep minimum 1 centavo to avoid zero/negative
  let idx = 0;
  const maxLoops = units.length * 200000; // safety
  let loops = 0;

  while (discount > 0 && loops < maxLoops) {
    loops++;
    const u = units[idx];

    if (u.amount > 1) {
      u.amount -= 1;
      discount -= 1;
    }

    idx++;
    if (idx >= units.length) idx = 0;

    if (loops % units.length === 0) {
      const canStillReduce = units.some((x) => x.amount > 1);
      if (!canStillReduce) break;
    }
  }

  return units;
}

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: SECRET });
    if (!token?.sub) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const db = await getDb();
    const productsCol = db.collection("products") as any;
    const ordersCol = db.collection("orders") as any;

    const cartItems = parsed.data.items;
    const requestedPoints = Math.floor(Number(parsed.data.pointsToUse || 0));

    // 1) Load products and validate stock
    const slugs = cartItems.map((it) => it.productId);
    const products = await productsCol.find({ slug: { $in: slugs } }).toArray();

    const bySlug = new Map<string, any>();
    products.forEach((p: any) => bySlug.set(String(p.slug), p));

    for (const it of cartItems) {
      const p = bySlug.get(it.productId);

      if (!p) {
        return NextResponse.json(
          { ok: false, error: `Product not found: ${it.name}` },
          { status: 400 }
        );
      }

      const currentQty = Number(p.qty ?? 0);
      if (currentQty < it.qty) {
        return NextResponse.json(
          {
            ok: false,
            error: `Not enough stock for ${it.name}. Available: ${currentQty}, requested: ${it.qty}.`,
          },
          { status: 400 }
        );
      }
    }

    // 2) Build safe order items from DB values
    const itemsWithTotals: OrderItem[] = cartItems.map((it) => {
      const p = bySlug.get(it.productId);

      const unitPrice = Number(p?.price ?? it.unitPrice ?? 0);
      const name = String(p?.name ?? it.name ?? "Product");

      return {
        productId: it.productId,
        name,
        qty: it.qty,
        unitPrice,
        lineTotal: unitPrice * it.qty,
      };
    });

    const subtotal = itemsWithTotals.reduce((s, it) => s + it.lineTotal, 0);
    const shippingFee = 0;

    // 3) Compute rewards discount (but DO NOT deduct points yet)
    let pointsRedeemed = 0;
    let rewardsDiscount = 0;
    let pointsPendingApply = false;

    if (requestedPoints > 0 && subtotal > 0) {
      const quote = await getRedeemQuote({
        patientId: String(token.sub),
        subtotalPhp: subtotal,
      });

      if (requestedPoints > quote.maxRedeemPoints) {
        return NextResponse.json(
          { ok: false, error: `You can only redeem up to ${quote.maxRedeemPoints} points for this order.` },
          { status: 400 }
        );
      }

      pointsRedeemed = requestedPoints;
      rewardsDiscount = pesoFromPoints(pointsRedeemed);
      pointsPendingApply = pointsRedeemed > 0;
    }

    // charge DISCOUNTED total
    const totalBeforeDiscount = subtotal + shippingFee;
    const total = Math.max(0, totalBeforeDiscount - rewardsDiscount);

    // 4) Decrement stock (reserve inventory)
    const bulkOps: any[] = cartItems.map((it) => ({
      updateOne: {
        filter: { slug: it.productId, qty: { $gte: it.qty } },
        update: {
          $inc: { qty: -it.qty },
          $currentDate: { updatedAt: true },
        },
      },
    }));

    const bulkRes: any = await productsCol.bulkWrite(bulkOps, { ordered: true });
    const modified = bulkRes.modifiedCount ?? 0;

    if (modified !== cartItems.length) {
      return NextResponse.json(
        { ok: false, error: "Inventory update failed for one or more items. No order was created." },
        { status: 500 }
      );
    }

    // 5) Create order first (unpaid)
    const now = new Date();
    const orderNumber = makeOrderNumber(now);

    const doc: OrderDoc = {
      orderNumber,
      userId: String(token.sub),
      userEmail: (token.email as string | null) ?? null,
      status: "pending",
      items: itemsWithTotals,
      subtotal,
      rewardsDiscount,
      pointsRedeemed,
      shippingFee,
      total,
      paymentMethod: "PayMongo",
      payment: {
        provider: "paymongo",
        state: "unpaid",
        paidAt: null,
        checkoutUrl: null,
        checkoutSessionId: null,
      },
      pointsPendingApply,
      notes: null,
      shippingAddress: null,
      createdAt: now,
      updatedAt: now,
    };

    const ins = await ordersCol.insertOne(doc);
    const orderId = ins.insertedId.toString();

    // 6) Create PayMongo Checkout Session (hosted)
    const appUrl = process.env.APP_URL || req.nextUrl.origin;

    const discountLabel =
      rewardsDiscount > 0
        ? ` (Discount ₱${Number(rewardsDiscount).toLocaleString("en-PH")} via ${pointsRedeemed} pts)`
        : "";

    const totalChargedCentavos = phpToCentavos(total);

    // THIS is the critical fix:
    // line_items sum will match totalChargedCentavos, so PayMongo page shows discounted total
    const line_items = buildDiscountedLineItems({
      items: itemsWithTotals.map((it) => ({
        name: it.name,
        qty: it.qty,
        unitPricePhp: it.unitPrice,
      })),
      totalChargedCentavos,
    });

    const pmBody = {
      data: {
        attributes: {
          amount: totalChargedCentavos,
          currency: "PHP",
          description: `Aloyon Order ${orderNumber}${discountLabel}`,

          // LIVE QRPh-only
          payment_method_types: ["qrph"],

          success_url: `${appUrl}/shop/checkout/success?orderId=${orderId}`,
          cancel_url: `${appUrl}/shop/checkout/cancel?orderId=${orderId}`,

          metadata: {
            orderId,
            orderNumber,
            userId: String(token.sub),
            subtotal,
            rewardsDiscount,
            pointsRedeemed,
            totalCharged: total,
          },

          customer: parsed.data.customer?.email
            ? {
                name: parsed.data.customer?.name || undefined,
                email: parsed.data.customer?.email || undefined,
                phone: parsed.data.customer?.phone || undefined,
              }
            : undefined,

          line_items,
        },
      },
    };

    const pm = await paymongoFetch("/checkout_sessions", pmBody);

    const checkoutSessionId = pm?.data?.id;
    const checkoutUrl = pm?.data?.attributes?.checkout_url;

    if (!checkoutSessionId || !checkoutUrl) {
      // rollback: delete order + restock
      await ordersCol.deleteOne({ _id: new ObjectId(orderId) });

      const rollbackOps: any[] = cartItems.map((it) => ({
        updateOne: {
          filter: { slug: it.productId },
          update: { $inc: { qty: it.qty }, $currentDate: { updatedAt: true } },
        },
      }));
      await productsCol.bulkWrite(rollbackOps, { ordered: true });

      return NextResponse.json(
        { ok: false, error: "PayMongo did not return checkout_url." },
        { status: 502 }
      );
    }

    // 7) Save session info into order
    await ordersCol.updateOne(
      { _id: new ObjectId(orderId) },
      {
        $set: {
          "payment.checkoutSessionId": checkoutSessionId,
          "payment.checkoutUrl": checkoutUrl,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      ok: true,
      orderId,
      checkoutUrl,
      pricing: {
        subtotal,
        rewardsDiscount,
        pointsRedeemed,
        totalCharged: total,
      },
    });
  } catch (err: any) {
    console.error("[POST /api/checkout/paymongo/create] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to start PayMongo checkout" },
      { status: 500 }
    );
  }
}