/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/rewards/ledger/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { listRewardsLedger } from "@/lib/rewards";

function isValidObjectIdString(s: string) {
  return /^[a-f\d]{24}$/i.test(s);
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role as string | undefined;
    if (role !== "patient") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);

    // accept BOTH ?type= and ?filter= (to be safe)
    const type = (url.searchParams.get("type") ||
      url.searchParams.get("filter") ||
      "all") as "all" | "earned" | "redeemed";

    const page = Math.max(1, Number(url.searchParams.get("page") || "1") || 1);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || "5") || 5));

    const base = await listRewardsLedger(String(session.user.id), {
      type,
      page,
      limit,
    });

    // Enrich purchases using orders collection
    const db = await getDb();
    const orders = db.collection("orders");

    const orderIds = (base.items || [])
      .filter((it: any) => it.sourceType === "order" && isValidObjectIdString(String(it.sourceId)))
      .map((it: any) => new ObjectId(String(it.sourceId)));

    const orderMap = new Map<string, any>();
    if (orderIds.length) {
      const docs = await orders
        .find(
          { _id: { $in: orderIds } },
          { projection: { orderNumber: 1, total: 1, createdAt: 1 } }
        )
        .toArray();

      for (const d of docs) orderMap.set(String(d._id), d);
    }

    const items = (base.items || []).map((it: any) => {
      if (it.sourceType === "order" && it.sourceId && orderMap.has(String(it.sourceId))) {
        const o = orderMap.get(String(it.sourceId));
        return {
          ...it,
          orderNumber: o?.orderNumber ?? null,
          orderTotal: typeof o?.total === "number" ? o.total : null,
          orderCreatedAt: o?.createdAt ? new Date(o.createdAt).toISOString() : null,
        };
      }
      return it;
    });

    return NextResponse.json({
      ok: true,
      items,
      page: base.page,
      pageSize: base.pageSize,
      hasMore: base.hasMore,
      total: base.total,
    });
  } catch (e) {
    console.error("GET /api/rewards/ledger error:", e);
    return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
  }
}