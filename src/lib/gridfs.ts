// src/lib/gridfs.ts
import { GridFSBucket } from "mongodb";
import { getDb } from "@/lib/mongodb";

/**
 * Returns a GridFS bucket named "productImages".
 * MongoDB will create:
 *   - productImages.files
 *   - productImages.chunks
 * in your active database (MONGODB_DB = "aloyon").
 */
export async function getImageBucket(): Promise<GridFSBucket> {
  const db = await getDb(); // uses your MONGODB_DB (aloyon)
  return new GridFSBucket(db, { bucketName: "productImages" });
}
