"use client";

export default function GenericOverview({ role }: { role: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted">
          Welcome back. Your tools are on the left.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-5">
          <div className="text-sm font-semibold">Role</div>
          <div className="text-2xl mt-1 capitalize">{role}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm font-semibold">Today</div>
          <div className="mt-1 text-sm opacity-80">Quick stats placeholder</div>
        </div>
        <div className="card p-5">
          <div className="text-sm font-semibold">Shortcuts</div>
          <div className="mt-1 text-sm opacity-80">
            Links based on role (coming later)
          </div>
        </div>
      </div>
    </div>
  );
}
