import { Search } from "lucide-react";
import { useState } from "react";
import type { Student } from "./mentor-data";
import { StudentStatusPill } from "./status-pill";

export function Roster({
  students,
  onOpen,
}: {
  students: Student[];
  onOpen: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = students.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[#0c3455] text-xl">Cohort roster</h2>
          <p className="text-sm text-[#717182]">{students.length} students assigned to you</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#717182]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search students…"
            className="h-10 pl-9 pr-4 w-72 rounded-full bg-white border border-[#e5e7ec] text-sm outline-none focus:border-[#0c3455]/40"
          />
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-[#e5e7ec] overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 text-xs uppercase tracking-wider text-[#717182] bg-[#fafbfc] border-b border-[#eef0f3]">
          <div className="col-span-5">Student</div>
          <div className="col-span-3">Progress</div>
          <div className="col-span-2">Last active</div>
          <div className="col-span-2 text-right">Status</div>
        </div>
        <ul>
          {filtered.map((s) => (
            <li key={s.id} className="border-b border-[#eef0f3] last:border-b-0">
              <button
                onClick={() => onOpen(s.id)}
                className="w-full grid grid-cols-12 items-center px-5 py-4 text-left hover:bg-[#f7f8fa] transition-colors"
              >
                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-[#0c3455] text-white grid place-items-center text-sm shrink-0">
                    {s.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-[#0c3455] truncate">{s.name}</div>
                  </div>
                </div>
                <div className="col-span-3 pr-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full bg-[#0c3455]/10 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${s.progress}%`,
                          background: "linear-gradient(90deg, #0c3455 0%, #4493BF 100%)",
                        }}
                      />
                    </div>
                    <div className="text-sm text-[#0c3455] w-9 text-right">{s.progress}%</div>
                  </div>
                </div>
                <div className="col-span-2 text-sm text-[#717182]">{s.lastActive}</div>
                <div className="col-span-2 flex justify-end">
                  <StudentStatusPill status={s.status} />
                </div>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-5 py-6 text-center text-sm text-[#717182]">No students match your search.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

