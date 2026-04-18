// src/lib/patientHistory.ts
import { ObjectId, Db } from "mongodb";

export type PatientHistoryEvent = {
  _id?: ObjectId;
  patientId: ObjectId;
  doctorId?: ObjectId | null;
  doctorName?: string | null;
  type: "info_update" | "note" | "prescription" | "appointment" | "other";
  title: string;
  description?: string | null;
  snapshot?: Record<string, unknown>;
  createdAt: Date;
};

type LogArgs = {
  db: Db;
  patientId: string | ObjectId;
  doctorId?: string | ObjectId | null;
  doctorName?: string | null;
  type?: PatientHistoryEvent["type"];
  title: string;
  description?: string | null;
  snapshot?: Record<string, unknown>;
};

export async function logPatientHistory({
  db,
  patientId,
  doctorId,
  doctorName,
  type = "other",
  title,
  description,
  snapshot,
}: LogArgs) {
  const patientOid =
    patientId instanceof ObjectId ? patientId : new ObjectId(patientId);

  const doctorOid =
    doctorId == null
      ? null
      : doctorId instanceof ObjectId
      ? doctorId
      : new ObjectId(doctorId);

  const event: PatientHistoryEvent = {
    patientId: patientOid,
    doctorId: doctorOid ?? undefined,
    doctorName: doctorName ?? null,
    type,
    title,
    description: description ?? null,
    snapshot,
    createdAt: new Date(),
  };

  await db.collection<PatientHistoryEvent>("patient_history").insertOne(event);
}
