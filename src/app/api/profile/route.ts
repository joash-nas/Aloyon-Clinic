/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const SexEnum = z.enum([
  "male",
  "female",
  "non_binary",
  "other",
  "prefer_not_to_say",
]);

const UpdateSchema = z.object({
  fullName: z.string().min(1).optional(),
  dob: z.string().nullable().optional(), // YYYY-MM-DD or null
  phone: z.string().optional(),
  address: z.string().optional(),
  sex: SexEnum.optional(),
});

// ------------------ GET: current user's profile ------------------
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const users = db.collection("users");
  const u = await users.findOne(
    { _id: new ObjectId(session.user.id) },
    { projection: { email: 1, role: 1, profile: 1, name: 1 } }
  );

  if (!u) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, user: u });
}

// ------------------ PUT: update current user's profile ------------------
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid input" },
      { status: 400 }
    );
  }

  const db = await getDb();
  const users = db.collection("users");

  const $set: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(parsed.data)) {
    $set[`profile.${k}`] = v ?? null;
  }

  await users.updateOne({ _id: new ObjectId(session.user.id) }, { $set });
  return NextResponse.json({ ok: true });
}

// ------------------ DELETE: delete current patient's account ------------------
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any | undefined;

    if (!user?.id) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only *patients* can self-delete
    if (user.role !== "patient") {
      return NextResponse.json(
        { ok: false, error: "Only patients can delete their account." },
        { status: 403 }
      );
    }

    const db = await getDb();
    const userIdStr = user.id as string;
    const userIdObj = new ObjectId(userIdStr);
    const now = new Date();

    const ordersCol = db.collection("orders");

    // 1) Block if this patient has any order with status "preparing" or "ready"
    const blockingOrder = await ordersCol.findOne({
      userId: userIdStr,
      status: { $in: ["preparing", "ready"] },
    });

    if (blockingOrder) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You still have an order in PREPARING or READY status. Please claim or cancel it before deleting your account.",
        },
        { status: 400 }
      );
    }

    // 2) Find all PENDING orders for this user (these will be auto-cancelled + restocked)
    const pendingOrders = await ordersCol
      .find({
        userId: userIdStr,
        status: "pending",
      })
      .toArray();

    // 2a) Accumulate quantities per productId (this is the *slug* in /api/me/orders)
    const qtyByProductSlug = new Map<string, number>();

    for (const order of pendingOrders) {
      for (const item of order.items || []) {
        if (!item || !item.productId) continue;
        const slug = String(item.productId).trim(); // stored as slug
        if (!slug) continue;
        const qty = Number(item.qty) || 0;
        if (!qty) continue;
        qtyByProductSlug.set(slug, (qtyByProductSlug.get(slug) || 0) + qty);
      }
    }

    // 2b) Apply inventory returns in products collection (by slug – matches /api/me/orders POST)
    if (qtyByProductSlug.size > 0) {
      const bulkOps: any[] = [];

      for (const [slug, qty] of qtyByProductSlug.entries()) {
        bulkOps.push({
          updateOne: {
            filter: { slug }, // restock by slug, not _id
            update: {
              $inc: { qty }, // return qty to stock
              $currentDate: { updatedAt: true },
            },
          },
        });
      }

      if (bulkOps.length > 0) {
        try {
          await db.collection("products").bulkWrite(bulkOps);
        } catch (e) {
          console.error(
            "Failed to return inventory for deleted account orders:",
            e
          );
          
        }
      }
    }

    // 2c) Auto-cancel any PENDING orders for this user
    await ordersCol.updateMany(
      {
        userId: userIdStr,
        status: "pending",
      },
      {
        $set: {
          status: "cancelled",
          updatedAt: now,
        },
      }
    );

    const usersColl = db.collection("users");
    const deletedColl = db.collection("deleted_accounts");

    // 3) Snapshot the user BEFORE delete
    const existingUser = await usersColl.findOne({ _id: userIdObj });

    // 4) Store snapshot in deleted_accounts for audit trail
    await deletedColl.insertOne({
      originalUserId: userIdObj,
      email: existingUser?.email ?? null,
      role: existingUser?.role ?? null,
      profile: existingUser?.profile ?? null,
      name: existingUser?.name ?? null,
      deletedAt: now,
      deletedBy: "self",
      reason: "patient-self-delete",
    });

    // 4b) Also write to audit_logs so it appears in the Security & Audit tab
    await db.collection("audit_logs").insertOne({
      type: "patient_self_delete",
      user: existingUser?.email ?? "Unknown",
      action: `Patient ${existingUser?.email ?? ""} deleted their own account.`,
      timestamp: now,
    });

    // 5) Actually delete the user
    await usersColl.deleteOne({ _id: userIdObj });

    // Optional: simple cleanup – remove their appointments
    await db.collection("appointments").deleteMany({ userId: userIdObj });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/profile error", e);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}