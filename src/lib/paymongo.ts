// src/lib/paymongo.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
const PAYMONGO_BASE = "https://api.paymongo.com/v1";

function authHeader() {
  const sk = process.env.PAYMONGO_SECRET_KEY;
  if (!sk) throw new Error("Missing PAYMONGO_SECRET_KEY");
  return "Basic " + Buffer.from(`${sk}:`).toString("base64");
}

export async function paymongoFetch(path: string, body?: any, init?: RequestInit) {
  const res = await fetch(`${PAYMONGO_BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: authHeader(),
      ...(init?.headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    ...init,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data?.errors?.[0]?.detail ||
      data?.errors?.[0]?.code ||
      data?.message ||
      `PayMongo error (${res.status})`;
    throw new Error(msg);
  }
  return data;
}