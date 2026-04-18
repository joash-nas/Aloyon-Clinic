/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/users/[id]/route.ts
// Admin-only delete endpoint for user accounts.
// - If the user is a patient, cancels pending/preparing shop orders and restocks items.
// - Saves a snapshot to deleted_accounts.
// - Writes an audit log entry.

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDb } from "@/lib/mongodb";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    // Make sure the caller is a logged-in admin.
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Does not allow an admin to delete their own account.
    if (session.user.id === id) {
      return NextResponse.json(
        { error: "You cannot delete your own admin account." },
        { status: 400 }
      );
    }

    const db = await getDb();
    const usersCol = db.collection("users");
    const ordersCol = db.collection("orders");
    const productsCol = db.collection("products");
    const deletedCol = db.collection("deleted_accounts");
    const auditCol = db.collection("audit_logs");

    const _id = new ObjectId(id);
    const existingUser = await usersCol.findOne({ _id });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const now = new Date();
    const userIdStr = id;
    const userRole = existingUser.role as string;

    // -------------------------------------------------------------------
    // 1) If the user is a patient, clean up their active shop orders.
    //    - Cancel orders in "pending" or "preparing".
    //    - Return item quantities back to product stock.
    // -------------------------------------------------------------------
    if (userRole === "patient") {
      const pendingOrders = await ordersCol
        .find({
          userId: userIdStr,
          status: { $in: ["pending", "preparing"] },
        })
        .toArray();

      if (pendingOrders.length > 0) {
        // Restock inventory using the product slug as key.
        for (const order of pendingOrders) {
          for (const item of order.items ?? []) {
            const slug = item.productId as string | undefined;
            const qty = Number(item.qty ?? 0);
            if (!slug || !qty || Number.isNaN(qty)) continue;

            await productsCol.updateOne(
              { slug },
              {
                $inc: { qty },
                $currentDate: { updatedAt: true },
              }
            );
          }
        }

        // Mark those orders as cancelled and push a status history entry.
        const update: any = {
          $set: { status: "cancelled", updatedAt: now },
          $push: {
            statusHistory: {
              status: "cancelled",
              at: now,
              byRole: "admin-delete",
            },
          },
        };

        await ordersCol.updateMany(
          {
            userId: userIdStr,
            status: { $in: ["pending", "preparing"] },
          },
          update
        );
      }

      // Remove upcoming appointments for this patient.
      await db.collection("appointments").deleteMany({ userId: _id });
    }

    // -------------------------------------------------------------------
    // 2) Save a snapshot of the account into deleted_accounts.
    // -------------------------------------------------------------------
    await deletedCol.insertOne({
      originalUserId: _id,
      email: existingUser.email ?? null,
      role: existingUser.role ?? null,
      profile: existingUser.profile ?? null,
      name: existingUser.name ?? null,
      deletedAt: now,
      deletedBy: "admin",
      deletedById: new ObjectId(session.user.id as string),
      reason: "admin-delete-user",
    });

    // -------------------------------------------------------------------
    // 3) Delete the user document from the main users collection.
    // -------------------------------------------------------------------
    await usersCol.deleteOne({ _id });

    // -------------------------------------------------------------------
    // 4) Write an audit log entry for traceability.
    // -------------------------------------------------------------------
    await auditCol.insertOne({
      type: "admin_delete_user",
      user: session.user.email,
      actorId: new ObjectId(session.user.id as string),
      targetUserId: _id,
      targetEmail: existingUser.email,
      role: existingUser.role,
      action: `Deleted user account: ${existingUser.email} (role: ${existingUser.role})`,
      timestamp: now,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/admin/users/[id]] error", e);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
