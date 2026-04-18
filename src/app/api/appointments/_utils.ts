// src/app/api/appointments/_utils.ts

import type { Db } from "mongodb";
import { ObjectId } from "mongodb";

/* pick default doctor id (env or first doctor user) */
export async function resolveDefaultDoctorId(db: Db): Promise<ObjectId> {
  const envId = process.env.NEXT_PUBLIC_DEFAULT_DOCTOR_ID;
  if (envId && envId.length === 24) {
    return new ObjectId(envId);
  }

  const doc = await db.collection("users").findOne(
    { role: "doctor" },
    { projection: { _id: 1 } }
  );

  if (!doc?._id) {
    throw new Error("No doctor user found to assign appointments.");
  }

  return doc._id as ObjectId;
}

/* current time as ISO string */
export function nowIsoDate(): string {
  return new Date().toISOString();
}