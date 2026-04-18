// src/app/reset-password/page.tsx
import ResetPasswordClient from "./ResetPasswordClient";

type Props = {
  searchParams: Promise<{
    token?: string | string[];
  }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const sp = await searchParams;

  const token = typeof sp.token === "string" ? sp.token : "";

  return <ResetPasswordClient initialToken={token} />;
}