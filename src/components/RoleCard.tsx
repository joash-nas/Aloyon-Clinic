import Link from "next/link";
import { ReactNode } from "react";

type RoleCardProps = {
  title: string;
  desc: string;
  href?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

export default function RoleCard({ title, desc, href = "#", icon, disabled }: RoleCardProps) {
  const content = (
    <div
      className={`card card-floating p-5 transition ${
        disabled ? "opacity-60 pointer-events-none" : "hover:-translate-y-1"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="size-9 rounded-xl"
            style={{ background: "linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--primary) 70%, #b0cb35))" }}
          />
          <h3 className="text-base font-semibold">{title}</h3>
        </div>
        <span className="text-muted">→</span>
      </div>
      <p className="mt-2 text-sm text-muted">{desc}</p>
    </div>
  );

  return href && !disabled ? (
    <Link href={href} className="group no-underline text-inherit">
      {content}
    </Link>
  ) : (
    content
  );
}
