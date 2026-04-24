/* =============================================================================
   File: src/components/dashboard/Sidebar.tsx
   Purpose:
     • Left navigation inside the Dashboard. Items adapt by role.
     • Distinguishes between:
         - "Clinic orders"  (/dashboard/orders)      → internal / walk-in orders
         - "Shop orders"    (/dashboard/shop-orders) → online/patient cart orders
   Roles:
     • admin      → system/admin tools
     • doctor     → schedule, patients
     • assistant  → appointments, products, clinic orders, shop orders, suppliers
     • sales      → analytics-focused sales view
     • patient    → their own appointments + shop orders + prescriptions
     • supplier   → purchase orders, profile
   ============================================================================ */

/* =============================================================================
   File: src/components/dashboard/Sidebar.tsx
   ============================================================================ */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import type { Role } from "@/lib/roles";

type Item = { href: string; label: string; icon?: string };

const STAFF_PRODUCTS: Item[] = [
  { href: "/dashboard/products", label: "Products", icon: "🛍️" },
  { href: "/dashboard/products/new", label: "Add product", icon: "➕" },
];

const MENUS: Record<Role | "default", Item[]> = {
  admin: [
    { href: "/dashboard", label: "Overview", icon: "🏠" },
    { href: "/dashboard/users", label: "Users & Roles", icon: "👥" },
    { href: "/dashboard/security", label: "Security & Audit", icon: "🔐" },
    { href: "/dashboard/profile", label: "Profile", icon: "⚙️" },
  ],

  doctor: [
    { href: "/dashboard", label: "Overview", icon: "🏠" },
    { href: "/dashboard/appointments/doctor", label: "Appointments", icon: "📆" },
    { href: "/dashboard/patients", label: "Patients", icon: "🧑‍⚕️" },
    { href: "/dashboard/reports", label: "Reports", icon: "📊" },
    { href: "/dashboard/suppliers", label: "Suppliers", icon: "🚚" },
    { href: "/dashboard/orders", label: "Clinic orders", icon: "📒" },
    { href: "/dashboard/profile", label: "Profile", icon: "⚙️" },
  ],

  assistant: [
    { href: "/dashboard", label: "Overview", icon: "🏠" },
    { href: "/dashboard/appointments/assistant", label: "Appointments", icon: "📆" },
    { href: "/dashboard/patients", label: "Patients", icon: "🧑‍⚕️" },
    { href: "/dashboard/rewards-redeem", label: "Redeem points", icon: "🎟️" },
    { href: "/dashboard/products", label: "Products", icon: "🛍️" },
    { href: "/dashboard/orders", label: "Clinic orders", icon: "📒" },
    { href: "/dashboard/shop-orders", label: "Shop orders", icon: "🛒" },
    { href: "/dashboard/suppliers", label: "Suppliers", icon: "🚚" },
    { href: "/dashboard/profile", label: "Profile", icon: "⚙️" },
  ],

  sales: [
    { href: "/dashboard", label: "Overview", icon: "🏠" },
    { href: "/dashboard/sales", label: "Sales", icon: "🧾" },
    { href: "/dashboard/reports", label: "Reports", icon: "📊" },
    { href: "/dashboard/expenses", label: "Expenses", icon: "💼" },
    { href: "/dashboard/profile", label: "Profile", icon: "⚙️" },
  ],

  patient: [
    { href: "/dashboard", label: "Overview", icon: "🏠" },
    { href: "/dashboard/appointments", label: "Appointments", icon: "📆" },
    { href: "/dashboard/shop-orders", label: "Shop orders", icon: "🛒" },
    { href: "/dashboard/prescriptions", label: "Prescriptions", icon: "💊" },
    { href: "/dashboard/profile", label: "Profile", icon: "⚙️" },
  ],

  supplier: [
    { href: "/dashboard", label: "Overview", icon: "🏠" },
    { href: "/dashboard/purchase-orders", label: "Purchase Orders", icon: "📑" },
    { href: "/dashboard/profile", label: "Profile", icon: "⚙️" },
  ],

  default: [
    { href: "/dashboard", label: "Overview", icon: "🏠" },
    { href: "/dashboard/profile", label: "Profile", icon: "⚙️" },
  ],
};

function isActive(path: string, href: string) {
  return path === href || path.startsWith(href + "/");
}

export default function Sidebar() {
  const { role } = useAuth();
  const pathname = usePathname();
  const items = (role ? MENUS[role] : MENUS.default) as Item[];

  return (
    <aside className="p-3">
      <div className="sticky top-[4.5rem]">
        <div className="text-xs opacity-70 px-3 mb-2">Navigation</div>
        <nav className="grid gap-1">
          {items.map((it) => {
            const active = isActive(pathname, it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={[
                  "flex items-center gap-2 px-3 py-2 rounded-xl transition",
                  active
                    ? "bg-[var(--muted)] ring-1 ring-[var(--border)]"
                    : "hover:bg-black/5",
                ].join(" ")}
              >
                <span className="text-base leading-none">{it.icon}</span>
                <span className="text-sm">{it.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
