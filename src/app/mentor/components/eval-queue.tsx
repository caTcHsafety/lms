import { Clock, FileText, ChevronRight } from "lucide-react";
import type { Submission } from "./mentor-data";

export function EvalQueue({
  submissions,
  onOpen,
}: {
  submissions: Submission[];
  onOpen: (id: string) => void;
}) {
  const pending = submissions
    .filter((s) => s.status === "pending")
    .sort((a, b) => b.waitingDays - a.waitingDays);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[#0c3455] text-xl">Evaluation queue</h2>
          <p className="text-sm text-[#717182]">
            {pending.length} submission{pending.length === 1 ? "" : "s"} awaiting your review · ordered by submission date
          </p>
        </div>
      </div>

      {pending.length === 0 ? (
        <div className="rounded-2xl bg-white border border-[#e5e7ec] p-10 text-center">
          <div className="text-[#0c3455]">Queue is empty</div>
          <div className="text-sm text-[#717182]">No pending evaluations right now.</div>
        </div>
      ) : (
        <ul className="space-y-3">
          {pending.map((s) => {
            const urgent = s.waitingDays >= 2;
            return (
              <li key={s.id}>
                <button
                  onClick={() => onOpen(s.id)}
                  className="w-full rounded-2xl bg-white border border-[#e5e7ec] hover:border-[#0c3455]/30 hover:shadow-[0px_8px_24px_0px_rgba(13,37,67,0.06)] transition-all p-5 flex items-center gap-5 text-left"
                >
                  <div className="h-11 w-11 rounded-xl bg-[#0c3455]/5 text-[#0c3455] grid place-items-center">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-9 w-9 rounded-full bg-[#0c3455] text-white grid place-items-center text-sm shrink-0">
                      {s.studentInitials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-[#0c3455] truncate">{s.assignment}</div>
                      <div className="text-sm text-[#717182] truncate">
                        {s.studentName} · Submitted {s.submittedAt}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-[16px] ${
                      urgent ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    Waiting {s.waitingDays}d
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#717182]" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

