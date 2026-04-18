import { MongoClient, ServerApiVersion, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Missing MONGODB_URI");

const dbNameFromEnv = process.env.MONGODB_DB?.trim();
const dbNameFromUri = (() => {
  try {
    const p = new URL(uri).pathname.replace(/^\//, "");
    return p || undefined; 
  } catch {
    return undefined;
  }
})();
const dbName = dbNameFromEnv || dbNameFromUri || "Aloyon"; // <— final source of truth

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const options = {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  serverSelectionTimeoutMS: 8000,
};

const client = new MongoClient(uri, options);
const clientPromise = global._mongoClientPromise ?? client.connect();
if (process.env.NODE_ENV !== "production") global._mongoClientPromise = clientPromise;

export default clientPromise;

export async function getDb(): Promise<Db> {
  const c = await clientPromise;
  return c.db(dbName);
}
