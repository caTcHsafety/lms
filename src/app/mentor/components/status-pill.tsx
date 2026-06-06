import type { EvalStatus, StudentStatus } from "./mentor-data";

const studentStyles: Record<StudentStatus, { label: string; bg: string; fg: string; dot: string }> = {
  "on-track": { label: "On track", bg: "bg-emerald-50", fg: "text-emerald-700", dot: "bg-emerald-500" },
  stalling: { label: "Stalling", bg: "bg-amber-50", fg: "text-amber-700", dot: "bg-amber-500" },
  "awaiting-eval": { label: "Awaiting evaluation", bg: "bg-[#0c3455]/10", fg: "text-[#0c3455]", dot: "bg-[#0c3455]" },
};

const evalStyles: Record<EvalStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: "Pending", bg: "bg-[#0c3455]/10", fg: "text-[#0c3455]" },
  approved: { label: "Approved", bg: "bg-emerald-50", fg: "text-emerald-700" },
  "needs-revision": { label: "Needs revision", bg: "bg-rose-50", fg: "text-rose-700" },
};

export function StudentStatusPill({ status }: { status: StudentStatus }) {
  const s = studentStyles[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full text-[16px] ${s.bg} ${s.fg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function EvalStatusPill({ status }: { status: EvalStatus }) {
  const s = evalStyles[status];
  return (
    <span className={`inline-flex items-center px-2.5 h-6 rounded-full text-[16px] ${s.bg} ${s.fg}`}>
      {s.label}
    </span>
  );
}

