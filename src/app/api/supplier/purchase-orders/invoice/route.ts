// src/app/api/supplier/purchase-orders/invoice/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import path from "path";
import { promises as fs } from "fs";

const SECRET = process.env.NEXTAUTH_SECRET!;
const SUPPLIER_ROLES = new Set(["supplier", "admin"]);

function toOid(v?: string | null) {
  try {
    return v ? new ObjectId(v) : null;
  } catch {
    return null;
  }
}

// POST /api/supplier/purchase-orders/invoice
export async function POST(req: NextRequest) {
  // --- Auth check ---
  const token = await getToken({ req, secret: SECRET });
  const role = String(token?.role || "");
  if (!SUPPLIER_ROLES.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // --- Read multipart form ---
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const idRaw = form.get("id");
  const file = form.get("invoice");

  if (!idRaw || typeof idRaw !== "string") {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing invoice file" }, { status: 400 });
  }

  // Restrict to PDF only
  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Only PDF invoices are allowed" },
      { status: 400 }
    );
  }

  const _id = toOid(idRaw);
  if (!_id) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const db = await getDb();

  // Supplier can only touch their own POs (admin can touch all)
  const supplierFilter =
    role === "supplier"
      ? {
          supplierId: (() => {
            try {
              return new ObjectId(String(token?.sub));
            } catch {
              return String(token?.sub);
            }
          })(),
        }
      : {};

  const po = await db.collection("purchase_orders").findOne(
    { _id, ...supplierFilter },
    {
      projection: {
        poNumber: 1,
        invoiceUrl: 1,
        status: 1,
      },
    }
  );

  if (!po) {
    return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
  }

  // Build safe filename based on poNumber
  const rawNumber: string = String(po.poNumber || `PO-${_id.toString()}`);
  const base = rawNumber.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  const filename = `${base}.pdf`;

  const invoicesDir = path.join(process.cwd(), "public", "invoices");
  const filePath = path.join(invoicesDir, filename);

  // Ensure folder exists
  await fs.mkdir(invoicesDir, { recursive: true });

  // Optional: delete old invoice if it exists and is under /invoices
  if (po.invoiceUrl && typeof po.invoiceUrl === "string") {
    if (po.invoiceUrl.startsWith("/invoices/")) {
      const oldPath = path.join(
        process.cwd(),
        "public",
        po.invoiceUrl.replace(/^\/+/, "")
      );
      try {
        await fs.unlink(oldPath);
      } catch {
        // ignore if missing
      }
    }
  }

  // Write file to disk
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.writeFile(filePath, buffer);

  const invoiceUrl = `/invoices/${filename}`;

  // Save invoice URL to PO
  await db.collection("purchase_orders").updateOne(
    { _id },
    {
      $set: {
        invoiceUrl,
        updatedAt: new Date(),
      },
    }
  );

  // You can choose to auto-change status here (e.g., to "Shipped" or "Delivered")
  // For now, keep existing status:
  const status = po.status || "Pending";

  return NextResponse.json({ invoiceUrl, status });
}
