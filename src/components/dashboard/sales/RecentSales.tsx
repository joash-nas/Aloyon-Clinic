"use client";
type Row={id:string;date:string;category:string;description:string;amount:number;paymentMethod:string;items?:{name:string;qty:number;price:number}[]};
export default function RecentSales({ rows, limit=6, title="Recent Sales", wrap="card", className }:{
  rows:Row[]; limit?:number; title?:string; wrap?:"card"|"bare"; className?:string;
}) {
  const peso=(n:number)=>`₱${Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const list=[...rows].sort((a,b)=>+new Date(b.date)-+new Date(a.date)).slice(0,limit);
  const Content=(
    <div className={className}>
      <div className="text-sm font-medium mb-3">{title}</div>
      {list.length===0? <div className="text-sm text-muted">No recent sales.</div> :
        <ul className="space-y-4">
          {list.map((r,idx)=>(
            <li key={r.id} className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1"/>
                  {idx!==list.length-1 && <span className="w-px flex-1 bg-[var(--border)] mt-1"/>}
                </div>
                <div>
                  <div className="font-medium">{r.description || r.category}</div>
                  <div className="text-xs text-muted">
                    {new Date(r.date).toLocaleDateString()} • {r.category} • {r.paymentMethod}
                  </div>
                </div>
              </div>
              <div className="font-medium">{peso(r.amount)}</div>
            </li>
          ))}
        </ul>}
    </div>
  );
  return wrap==="bare"?Content:<div className="card p-4">{Content}</div>;
}
