"use client";
import { useMemo } from "react";
type MatricFormat = {label:string;pattern:string;example:string};
function fromStored(value:string):MatricFormat[] {
  if (!value.trim()) return [{label:"Regular",pattern:"",example:""}];
  if (!value.trim().startsWith("[")) return [{label:"Regular",pattern:value,example:""}];
  try {const rows=JSON.parse(value);
    return Array.isArray(rows)&&rows.length ? rows.map((r:any)=>({label:r.label||"Regular",pattern:r.pattern||"",example:r.example||""})) : [{label:"Regular",pattern:"",example:""}];
  } catch {return [{label:"Regular",pattern:value,example:""}];}
}
export default function MatricPatternEditor({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  const formats=useMemo(()=>fromStored(value),[value]);
  const update=(rows:MatricFormat[])=>onChange(JSON.stringify(rows));
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold">Accepted student categories</p>
      <button type="button" disabled={formats.length>=8} onClick={()=>update([...formats,{label:"Transfer",pattern:"",example:""}])} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-40">+ Add format</button></div>
    {formats.map((row,i)=><div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs font-semibold">Category<input value={row.label} onChange={e=>update(formats.map((r,k)=>k===i?{...r,label:e.target.value}:r))} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" placeholder="Regular / Transfer" /></label>
      <label className="text-xs font-semibold">Public example (no private regex)<input value={row.example} onChange={e=>update(formats.map((r,k)=>k===i?{...r,example:e.target.value}:r))} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" placeholder="e.g. XX.2024/1234" /></label></div>
      <label className="mt-2 block text-xs font-semibold">Private matching regex<input value={row.pattern} onChange={e=>update(formats.map((r,k)=>k===i?{...r,pattern:e.target.value}:r))} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-mono text-sm" placeholder={String.raw`DE\.\d{4}/\d{4}`} /></label>
      <div className="mt-2 flex justify-between gap-2"><p className="text-[11px] text-slate-500">Use a general pattern, not one student's full matric number.</p>
      {formats.length>1&&<button type="button" onClick={()=>update(formats.filter((_,k)=>k!==i))} className="text-xs font-bold text-red-700">Remove</button>}</div>
    </div>)}
    <p className="text-[11px] text-amber-700">This checks input format only. It does not verify university enrolment. Private expressions must never appear in public APIs.</p>
  </div>;
}
