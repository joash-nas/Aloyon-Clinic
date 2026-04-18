/* =============================================================================
   File: src/app/api/orders/route.ts
   Purpose:
     • Create a new order from the cart (checkout).
     • This is called by the “Place order” button on /cart.
   Data shape in MongoDB (collection: orders):
     {
       _id: ObjectId,
       orderNumber: "ALY-20251114-5929",
       userId: "mongodbUserId",
       userEmail: "patient@test.com",
       status: "pending" | "preparing" | "ready" | "completed" | "cancelled",
       items: [
         {
           productId: "string",
           name: "Classic Aviator",
           price: 2490,
           qty: 1
         },
         ...
       ],
       subtotal: 2490,
       shippingFee: 0,
       total: 2490,
       paymentMethod: "NA",
       notes: null,
       pickupType: "in-clinic",
       pickupLocation: {
         name: "Aloyon Optical",
         address: "386 J luna extension Mandaluyong City, Philippines",
         googleMapsUrl: "https://maps.google.com/…"
       },
       statusHistory: [
         { status: "pending", at: ISODate, byRole: "system" }
       ],
       createdAt: ISODate,
       updatedAt: ISODate
     }
   ============================================================================ */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";

type IncomingItem = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  image?: string;
};

type OrderDoc = {
  orderNumber: string;
  userId: string;
  userEmail: string;
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled";
  items: IncomingItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
  paymentMethod: string;
  notes: string | null;
  pickupType: "in-clinic";
  pickupLocation: {
    name: string;
    address: string;
    googleMapsUrl: string;
  };
  statusHistory: { status: string; at: Date; byRole: string }[];
  createdAt: Date;
  updatedAt: Date;
};

function genOrderNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `ALY-${y}${m}${d}-${rand}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as
      | { items?: IncomingItem[]; notes?: string | null }
      | null;

    if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const items = body.items.map((it) => ({
      productId: String(it.productId),
      name: String(it.name),
      price: Number(it.price),
      qty: Number(it.qty) || 1,
      image: it.image,
    }));

    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
    const shippingFee = 0; // pickup only
    const total = subtotal + shippingFee;

    const orderNumber = genOrderNumber();
    const now = new Date();

    const order: OrderDoc = {
      orderNumber,
      userId: String(session.user.id),
      userEmail: session.user.email,
      status: "pending",
      items,
      subtotal,
      shippingFee,
      total,
      paymentMethod: "NA", 
      notes: body.notes ?? null,
      pickupType: "in-clinic",
      pickupLocation: {
        name: "Aloyon Optical",
        address: "386 J luna extension Mandaluyong City, Philippines",
        googleMapsUrl:
          "https://maps.app.goo.gl/oaGGQVauSBLboomJA",
      },
      statusHistory: [{ status: "pending", at: now, byRole: "system" }],
      createdAt: now,
      updatedAt: now,
    };

    const db = await getDb();
    const col = db.collection<OrderDoc>("orders");
    const result = await col.insertOne(order);

    return NextResponse.json(
      {
        _id: result.insertedId.toString(),
        ...order,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[POST /api/orders] error:", e);
    return NextResponse.json(
      { error: "Failed to place order" },
      { status: 500 }
    );
  }
}
