import type { WithId } from "mongodb";

export type AppointmentStatus = "booked" | "cancelled";

export type Appointment = {
  userId: string;         // ObjectId as string when serialized
  date: Date;             // UTC
  createdAt: Date;
  status: AppointmentStatus;
  notes?: string | null;
};

export type AppointmentDoc = WithId<Appointment>;
