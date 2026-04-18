/* eslint-disable @typescript-eslint/no-explicit-any */
/* =============================================================================
   File: src/app/api/me/orders/route.ts
   Updated:
     - Remove GCASH/BANK mock payments
     - Keep only PAY_ON_PICKUP here
     - PAYMONGO is handled by /api/checkout/paymongo/create
     - paid flag now respects payment.state === "paid"
   ============================================================================ */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { z } from "zod";
import type { WithId } from "mongodb";
import { getRedeemQuote, redeemPoints, pesoFromPoints } from "@/lib/rewards";

const ItemSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  qty: z.number().int().min(1),
  unitPrice: z.number().min(0),
});

// only two methods now
const PaymentMethodEnum = z.enum(["PAY_ON_PICKUP", "PAYMONGO"]);

const PostBodySchema = z.object({
  items: z.array(ItemSchema).min(1),
  paymentMethod: PaymentMethodEnum.optional(),
  pointsToUse: z.number().int().min(0).optional(),
});

type PaymentMethodCode = z.infer<typeof PaymentMethodEnum>;

function mapPaymentMethod(
  code: PaymentMethodCode | undefined
): { label: string; isOnline: boolean } {
  switch (code) {
    case "PAYMONGO":
      return { label: "PayMongo", isOnline: true };
    default:
      return { label: "Pay on pickup", isOnline: false };
  }
}

type OrderStatus = "pending" | "preparing" | "ready" | "completed" | "cancelled";

type OrderItem = {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

type OrderPayment = {
  provider?: "paymongo" | "pickup";
  state?: "unpaid" | "paid";
  paidAt?: Date | null;
  checkoutUrl?: string | null;
  checkoutSessionId?: string | null;
  linkId?: string | null;
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
  payment?: OrderPayment; 
  notes: string | null;
  shippingAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type SalesDoc = {
  date: Date;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  items: { name: string; qty: number; price: number }[];
  createdBy: string | null;
  orderId: any;
  source: "shop-order";
  updatedAt: Date;
};

function makeOrderNumber(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `ALY-${y}${m}${d}-${rand}`;
}

async function autoCreateSaleFromOrder(
  db: any,
  orderId: any,
  order: OrderDoc,
  createdBy: string | null
) {
  const salesCol = db.collection("sales") as any;

  const existing = await salesCol.findOne({ orderId });
  if (existing) return;

  const now = new Date();

  const sale: SalesDoc = {
    date: now,
    category: "Shop Sale",
    description: `Shop order ${order.orderNumber}`,
    amount: order.total,
    paymentMethod: order.paymentMethod,
    items: (order.items ?? []).map((it) => ({
      name: it.name,
      qty: it.qty,
      price: it.unitPrice,
    })),
    createdBy,
    orderId,
    source: "shop-order",
    updatedAt: now,
  };

  await salesCol.insertOne(sale);
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = PostBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const payInfo = mapPaymentMethod(parsed.data.paymentMethod);

    // Guard: PayMongo orders are created via /api/checkout/paymongo/create
    if (payInfo.isOnline) {
      return NextResponse.json(
        { error: "Use /api/checkout/paymongo/create for PayMongo checkout." },
        { status: 400 }
      );
    }

    const db = await getDb();
    const productsCol = db.collection("products") as any;
    const ordersCol = db.collection("orders") as any;

    const cartItems = parsed.data.items;

    // 1) Load products and validate stock
    const slugs = cartItems.map((it) => it.productId);
    const products = await productsCol.find({ slug: { $in: slugs } }).toArray();

    const bySlug = new Map<string, any>();
    products.forEach((p: any) => bySlug.set(String(p.slug), p));

    for (const it of cartItems) {
      const p = bySlug.get(it.productId);

      if (!p) {
        return NextResponse.json(
          { error: `Product not found: ${it.name}` },
          { status: 400 }
        );
      }

      const currentQty = Number(p.qty ?? 0);
      if (currentQty < it.qty) {
        return NextResponse.json(
          {
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

    // Pickup orders: points are NOT redeemed here
    const pointsRedeemed = 0;
    const rewardsDiscount = 0;

    const total = Math.max(0, subtotal - rewardsDiscount + shippingFee);

    // 3) Decrement stock
    const bulkOps: any[] = cartItems.map((it) => ({
      updateOne: {
        filter: { slug: it.productId, qty: { $gte: it.qty } },
        update: {
          $inc: { qty: -it.qty },
          $currentDate: { updatedAt: true },
        },
      },
    }));

    const bulkRes: any = await productsCol.bulkWrite(bulkOps, {
      ordered: true,
    });

    const modified = bulkRes.modifiedCount ?? 0;
    if (modified !== cartItems.length) {
      return NextResponse.json(
        {
          error:
            "Inventory update failed for one or more items. No order was created.",
        },
        { status: 500 }
      );
    }

    // 4) Create order
    const now = new Date();
    const orderNumber = makeOrderNumber(now);

    const doc: OrderDoc = {
      orderNumber,
      userId: session.user.id as string,
      userEmail: (session.user.email as string | null) ?? null,
      status: "pending",
      items: itemsWithTotals,
      subtotal,
      rewardsDiscount,
      pointsRedeemed,
      shippingFee,
      total,
      paymentMethod: payInfo.label,
      payment: { provider: "pickup", state: "unpaid", paidAt: null },
      notes: null,
      shippingAddress: null,
      createdAt: now,
      updatedAt: now,
    };

    const result = await ordersCol.insertOne(doc);

    return NextResponse.json(
      {
        id: result.insertedId.toString(),
        orderNumber: doc.orderNumber,
        createdAt: doc.createdAt.toISOString(),
        subtotal: doc.subtotal,
        rewardsDiscount: doc.rewardsDiscount,
        pointsRedeemed: doc.pointsRedeemed,
        shippingFee: doc.shippingFee,
        total: doc.total,
        items: doc.items,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[POST /api/me/orders] error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to create order" },
      { status: 500 }
    );
  }
}

type OrderListOrder = {
  id: string;
  orderNumber: string;
  status: OrderDoc["status"];
  subtotal: number;
  rewardsDiscount?: number;
  pointsRedeemed?: number;
  total: number;
  createdAt: string;
  paymentMethod: string;
  paid: boolean;
  items: { name: string; qty: number }[];
};

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = await getDb();
    const col = db.collection("orders") as any;

    const docs = (await col
      .find({ userId: session.user.id as string })
      .sort({ createdAt: -1 })
      .toArray()) as WithId<OrderDoc>[];

    const items: OrderListOrder[] = docs.map((d) => {
      const method = d.paymentMethod || "Pay on pickup";

      // paid logic:
      // - PayMongo is paid when payment.state === "paid"
      // - Pickup is paid when status is completed (or you can change to when staff confirms)
      const paymentState = (d as any)?.payment?.state;
      const paid =
        paymentState === "paid" ||
        (String(method).toLowerCase().includes("pickup") && d.status === "completed");

      return {
        id: d._id.toString(),
        orderNumber: d.orderNumber,
        status: d.status,
        subtotal: d.subtotal,
        rewardsDiscount: Number((d as any).rewardsDiscount ?? 0),
        pointsRedeemed: Number((d as any).pointsRedeemed ?? 0),
        total: d.total,
        createdAt: d.createdAt.toISOString(),
        paymentMethod: method,
        paid,
        items: (d.items ?? []).map((it) => ({
          name: it.name,
          qty: it.qty,
        })),
      };
    });

    return NextResponse.json({ items });
  } catch (err) {
    console.error("[GET /api/me/orders] error:", err);
    return NextResponse.json(
      { error: "Failed to load orders" },
      { status: 500 }
    );
  }
}