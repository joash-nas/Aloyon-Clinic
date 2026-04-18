// src/app/admin/users/page.tsx
// Legacy admin route that now just redirects to the dashboard users list.

import { redirect } from "next/navigation";

export default function Page() {
  // Always send admins to the main users management page.
  redirect("/dashboard/users");
}
