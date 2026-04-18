// src/lib/http.ts
export async function readJsonSafe(res: Response): Promise<Record<string, any> | null> {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      return (await res.json()) as Record<string, any>;
    } catch {
      return null;
    }
  }
  try {
    const t = await res.text();
    try {
      return JSON.parse(t) as Record<string, any>;
    } catch {
      return { message: t };
    }
  } catch {
    return null;
  }
}
