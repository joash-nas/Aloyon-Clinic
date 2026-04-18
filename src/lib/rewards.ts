// src/lib/rewards.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

export const POINTS_RULES = {
  appointmentDone: 5,
  pointPesoValue: 1, // 1 point = ₱1
  minRedeemPoints: 0,
  maxRedeemPercent: 0.2, // 20% of subtotal
};

export type RewardActivity = "purchase" | "appointment" | "manual" | "redeem";

export type RewardSourceType = "order" | "appointment" | "manual" | "redeem";

export type LedgerEntry = {
  _id?: ObjectId;
  patientId: ObjectId;

  // +points for earn, -points for redeem
  pointsDelta: number;

  activity: RewardActivity;

  sourceType?: RewardSourceType;
  sourceId?: string;

  note?: string | null;

  createdAt: Date;

  // expires 1 year after latest earning activity
  expiresAt?: Date | null;

  redeemedAt?: Date | null;
  redeemedBy?: ObjectId | null;
};

type BalanceDoc = {
  _id?: ObjectId;
  patientId: ObjectId;
  points: number;
  lastEarnAt: Date | null;
  expiresAt: Date | null;
  updatedAt: Date;
};

function addOneYear(d: Date) {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + 1);
  return x;
}

function isValidObjectIdString(s: string) {
  return /^[a-f\d]{24}$/i.test(String(s));
}

/**
 * Earn rule:
 * floor(total * 0.01)
 * ₱100 => 1 point
 * ₱2500 => 25 points
 */
export function pointsFromPurchaseAmount(totalPhp: number) {
  if (!Number.isFinite(totalPhp) || totalPhp <= 0) return 0;
  return Math.floor(totalPhp * 0.01);
}

export function pesoFromPoints(points: number) {
  if (!Number.isFinite(points) || points <= 0) return 0;
  return Math.floor(points * POINTS_RULES.pointPesoValue);
}

export function computeMaxRedeemablePoints(args: {
  subtotalPhp: number;
  availablePoints: number;
}) {
  const subtotalPhp = Number(args.subtotalPhp || 0);
  const availablePoints = Math.max(0, Number(args.availablePoints || 0));

  if (!Number.isFinite(subtotalPhp) || subtotalPhp <= 0) {
    return {
      maxPoints: 0,
      discountPhp: 0,
    };
  }

  // example: 20% of ₱1000 = ₱200 => max 200 points
  const capPhp = Math.floor(subtotalPhp * POINTS_RULES.maxRedeemPercent);
  const capPoints = Math.floor(capPhp / POINTS_RULES.pointPesoValue);

  const maxPoints = Math.max(0, Math.min(availablePoints, capPoints));

  return {
    maxPoints,
    discountPhp: pesoFromPoints(maxPoints),
  };
}

export function parsePatientQrPayload(qr: string) {
  const raw = String(qr || "").trim();

  if (!raw.startsWith("ALYON_PATIENT:")) {
    return { ok: false as const, error: "Invalid QR format." };
  }

  const patientId = raw.replace("ALYON_PATIENT:", "").trim();

  if (!isValidObjectIdString(patientId)) {
    return { ok: false as const, error: "Invalid patient QR." };
  }

  return {
    ok: true as const,
    patientId,
  };
}

/**
 * Earn points (writes ledger + updates balance).
 * Dedup: if same patientId + sourceType + sourceId + activity + pointsDelta exists, skip.
 */
export async function awardPoints(args: {
  patientId: string;
  staffId?: string | null;
  activity: RewardActivity; // purchase | appointment | manual
  points: number; // positive
  sourceType?: "order" | "appointment" | "manual";
  sourceId?: string;
  note?: string;
}) {
  const { patientId, staffId, activity, points, sourceType, sourceId, note } =
    args;

  if (!isValidObjectIdString(patientId)) throw new Error("Invalid patientId");
  if (!Number.isFinite(points) || points <= 0) {
    return { ok: true, skipped: true };
  }

  const db = await getDb();
  const ledger = db.collection<LedgerEntry>("rewards_ledger");
  const balances = db.collection<BalanceDoc>("rewards_balances");

  const pid = new ObjectId(patientId);
  const now = new Date();
  const expiresAt = addOneYear(now);

  // best-effort dedup
  if (sourceType && sourceId) {
    const existing = await ledger.findOne({
      patientId: pid,
      activity,
      sourceType,
      sourceId,
      pointsDelta: points,
    });

    if (existing) return { ok: true, skipped: true };
  }

  await ledger.insertOne({
    patientId: pid,
    pointsDelta: points,
    activity,
    sourceType,
    sourceId,
    note: note ?? null,
    createdAt: now,
    expiresAt,
    redeemedAt: null,
    redeemedBy:
      staffId && isValidObjectIdString(staffId) ? new ObjectId(staffId) : null,
  });

  await balances.updateOne(
    { patientId: pid },
    {
      $setOnInsert: {
        patientId: pid,
      },
      $inc: { points },
      $set: {
        lastEarnAt: now,
        expiresAt,
        updatedAt: now,
      },
    },
    { upsert: true }
  );

  return { ok: true };
}

/**
 * Get current summary for patient UI / staff UI
 */
export async function getRewardsSummary(patientId: string) {
  if (!isValidObjectIdString(patientId)) throw new Error("Invalid patientId");

  const db = await getDb();
  const balances = db.collection<BalanceDoc>("rewards_balances");
  const pid = new ObjectId(patientId);

  const doc = await balances.findOne({ patientId: pid });

  const now = Date.now();
  const expiresAt = doc?.expiresAt ? new Date(doc.expiresAt) : null;
  const expired = !!(expiresAt && expiresAt.getTime() < now);

  const points = expired ? 0 : doc?.points ?? 0;

  return {
    ok: true,
    points,
    pesoValue: pesoFromPoints(points),
    lastEarnAt: doc?.lastEarnAt ? new Date(doc.lastEarnAt).toISOString() : null,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    expired,
  };
}

/**
 * Quote redemption before actual redeem
 */
export async function getRedeemQuote(args: {
  patientId: string;
  subtotalPhp: number;
}) {
  const { patientId, subtotalPhp } = args;

  const summary = await getRewardsSummary(patientId);
  const availablePoints = Number(summary.points || 0);

  const { maxPoints, discountPhp } = computeMaxRedeemablePoints({
    subtotalPhp,
    availablePoints,
  });

  return {
    ok: true,
    availablePoints,
    availablePesoValue: pesoFromPoints(availablePoints),
    subtotalPhp,
    minRedeemPoints: POINTS_RULES.minRedeemPoints,
    maxRedeemPoints: maxPoints,
    maxDiscountPhp: discountPhp,
    pointPesoValue: POINTS_RULES.pointPesoValue,
    maxRedeemPercent: POINTS_RULES.maxRedeemPercent,
  };
}

/**
 * Redeem points
 * - validates balance
 * - validates expiry
 * - validates min redeem
 * - validates max 20% cap if subtotal is provided
 * - deducts balance first
 * - inserts negative ledger
 * - rolls back balance if ledger insert fails
 */
export async function redeemPoints(args: {
  patientId: string;
  staffId?: string | null;
  points: number; // positive number to redeem
  subtotalPhp?: number; // optional, used for cap validation
  sourceType?: "order" | "manual" | "redeem";
  sourceId?: string;
  note?: string;
}) {
  const {
    patientId,
    staffId,
    points,
    subtotalPhp,
    sourceType = "redeem",
    sourceId,
    note,
  } = args;

  if (!isValidObjectIdString(patientId)) throw new Error("Invalid patientId");

  const redeemPointsInt = Math.floor(Number(points || 0));
  if (!Number.isFinite(redeemPointsInt) || redeemPointsInt <= 0) {
    throw new Error("Invalid redeem points.");
  }



  const summary = await getRewardsSummary(patientId);
  const availablePoints = Number(summary.points || 0);

  if (availablePoints < redeemPointsInt) {
    throw new Error("Not enough points.");
  }

  if (
    Number.isFinite(subtotalPhp) &&
    Number(subtotalPhp) > 0
  ) {
    const quote = await getRedeemQuote({
      patientId,
      subtotalPhp: Number(subtotalPhp),
    });

    if (redeemPointsInt > quote.maxRedeemPoints) {
      throw new Error(
        `Points exceed the maximum allowed for this subtotal. Max allowed: ${quote.maxRedeemPoints}.`
      );
    }
  }

  const db = await getDb();
  const balances = db.collection<BalanceDoc>("rewards_balances");
  const ledger = db.collection<LedgerEntry>("rewards_ledger");

  const pid = new ObjectId(patientId);
  const now = new Date();

  const updatedBalance = await balances.findOneAndUpdate(
    {
      patientId: pid,
      points: { $gte: redeemPointsInt },
      $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }],
    },
    {
      $inc: { points: -redeemPointsInt },
      $set: { updatedAt: now },
    },
    {
      returnDocument: "after",
    }
  );

  if (!updatedBalance) {
    throw new Error("Unable to redeem points. Balance may be expired or insufficient.");
  }

  try {
    await ledger.insertOne({
      patientId: pid,
      pointsDelta: -redeemPointsInt,
      activity: "redeem",
      sourceType,
      sourceId,
      note: note ?? null,
      createdAt: now,
      expiresAt: updatedBalance.expiresAt ?? null,
      redeemedAt: now,
      redeemedBy:
        staffId && isValidObjectIdString(staffId) ? new ObjectId(staffId) : null,
    });
  } catch (e) {
    // rollback balance if ledger write fails
    await balances.updateOne(
      { patientId: pid },
      {
        $inc: { points: redeemPointsInt },
        $set: { updatedAt: new Date() },
      }
    );
    throw e;
  }

  const newPoints = Math.max(0, Number(updatedBalance.points || 0));

  return {
    ok: true,
    redeemedPoints: redeemPointsInt,
    discountPhp: pesoFromPoints(redeemPointsInt),
    newBalancePoints: newPoints,
    newBalancePesoValue: pesoFromPoints(newPoints),
  };
}

/**
 * Paginated ledger list for patient.
 * type:
 *  - all
 *  - earned
 *  - redeemed
 */
export async function listRewardsLedger(
  patientId: string,
  opts?: { type?: "all" | "earned" | "redeemed"; page?: number; limit?: number }
) {
  if (!isValidObjectIdString(patientId)) throw new Error("Invalid patientId");

  const type = opts?.type ?? "all";
  const page = Math.max(1, Number(opts?.page ?? 1) || 1);
  const limitRaw = Number(opts?.limit ?? 20) || 20;
  const limit = Math.min(Math.max(limitRaw, 1), 50);

  const db = await getDb();
  const ledger = db.collection<LedgerEntry>("rewards_ledger");
  const pid = new ObjectId(patientId);

  const match: any = { patientId: pid };
  if (type === "earned") match.pointsDelta = { $gt: 0 };
  if (type === "redeemed") match.pointsDelta = { $lt: 0 };

  const total = await ledger.countDocuments(match);

  const docs = await ledger
    .find(match, { projection: { patientId: 0 } })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit + 1)
    .toArray();

  const hasMore = docs.length > limit;
  const slice = hasMore ? docs.slice(0, limit) : docs;

  return {
    ok: true,
    page,
    pageSize: limit,
    total,
    hasMore,
    items: slice.map((x: any) => ({
      id: String(x._id),
      pointsDelta: x.pointsDelta,
      activity: x.activity,
      sourceType: x.sourceType ?? null,
      sourceId: x.sourceId ?? null,
      note: x.note ?? null,
      createdAt: new Date(x.createdAt).toISOString(),
      expiresAt: x.expiresAt ? new Date(x.expiresAt).toISOString() : null,
    })),
  };
}