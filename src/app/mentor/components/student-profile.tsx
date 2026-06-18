import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, LogIn, FileUp, FileText, CheckCircle2, Activity } from "lucide-react";
import type { ActivityEvent, Student, Submission } from "./mentor-data";
import { EvalStatusPill, StudentStatusPill } from "./status-pill";
import { ActivityHeatmap } from "./activity-heatmap";

function formatTimestamp(timestampStr: string): string {
  const d = new Date(timestampStr);
  if (isNaN(d.getTime())) return timestampStr;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${month} ${day}, ${hours}:${minutes}`;
}

function humanLabel(eventType: string, metadata: any, moduleMap: Record<string, string>): string {
  const t = eventType.toUpperCase();
  if (t === "LOGIN") return "Logged in";
  if (t === "MODULE_COMPLETED") {
    const modId = metadata?.module_id;
    const modTitle = modId ? moduleMap[modId] : null;
    return modTitle ? `Completed ${modTitle}` : "Completed a module";
  }
  if (t === "ASSIGNMENT_SUBMITTED") {
    const title = metadata?.assignment_title || metadata?.title;
    return title ? `Submitted ${title}` : "Submitted an assignment";
  }
  if (t === "GRADE_RECEIVED") return "Received a grade";
  if (t === "BROADCAST_ACK") return "Acknowledged a broadcast";
  if (t === "INACTIVITY_FLAG") return "Flagged as inactive";
  // Fallback: convert snake_case to Title Case
  return eventType
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StudentProfile({
  student,
  activity,
  history,
  onBack,
  onOpenSubmission,
}: {
  student: Student;
  activity: ActivityEvent[];
  history: Submission[];
  onBack: () => void;
  onOpenSubmission: (id: string) => void;
}) {
  const [liveActivity, setLiveActivity] = useState<ActivityEvent[]>(activity);
  const [liveHistory, setLiveHistory] = useState<Submission[]>(history);

  useEffect(() => {
    let isMounted = true;
    const fetchLiveData = async () => {
      // 1. Fetch all activity events for this student
      const { data: actData, error: actError } = await supabase
        .from('activity_events')
        .select('id, user_id, event_type, metadata, created_at')
        .eq('user_id', student.id)
        .order('created_at', { ascending: false });

      if (actError) {
        console.error("activity_events fetch error:", actError.message);
      }

      if (actData && actData.length > 0 && isMounted) {
        // 2. Collect all module IDs referenced in events so we can resolve titles
        const moduleIds = Array.from(new Set(
          actData
            .map(e => (e.metadata as any)?.module_id)
            .filter(Boolean)
        ));

        let moduleMap: Record<string, string> = {};
        if (moduleIds.length > 0) {
          const { data: mods } = await supabase
            .from('modules')
            .select('id, title')
            .in('id', moduleIds);
          mods?.forEach(m => { moduleMap[m.id] = m.title; });
        }

        const mappedAct: ActivityEvent[] = actData.map(evt => {
          const meta = evt.metadata as any;
          const evtType = evt.event_type.toUpperCase();
          let kind: ActivityEvent['kind'] = 'login';
          if (evtType.includes('MODULE')) kind = 'module';
          else if (evtType.includes('SUBMI') || evtType.includes('ASSIGNMENT')) kind = 'submission';
          else if (evtType.includes('STALL') || evtType.includes('INACTIV')) kind = 'inactivity';

          return {
            id: evt.id,
            studentId: evt.user_id,
            timestamp: evt.created_at || 'N/A',
            kind,
            label: humanLabel(evt.event_type, meta, moduleMap),
            detail: meta?.detail || undefined,
          };
        });
        setLiveActivity(mappedAct);
      } else if (actData && isMounted) {
        setLiveActivity([]);
      }

      // 3. Fetch submission history
      const { data: subData } = await supabase
        .from('submissions')
        .select(`id, student_id, submitted_at, status, file_url, assignments (title)`)
        .eq('student_id', student.id)
        .order('submitted_at', { ascending: false })
        .limit(10);

      if (subData && isMounted) {
        const mappedSub: Submission[] = subData.map(s => {
          const assignment = Array.isArray(s.assignments) ? s.assignments[0] : s.assignments;
          return {
            id: s.id,
            studentId: s.student_id,
            studentName: student.name,
            studentInitials: student.initials,
            assignment: assignment?.title || 'Unknown Assignment',
            submittedAt: s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : 'N/A',
            waitingDays: 0,
            status: (s.status === 'needs_revision' ? 'needs-revision' : s.status) as any,
            fileType: "pdf",
            fileName: "submission.pdf",
            content: s.file_url || ""
          };
        });
        setLiveHistory(mappedSub);
      }
    };
    fetchLiveData();
    return () => { isMounted = false; };
  }, [student.id]);

  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-[#717182] hover:text-[#0c3455] mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to batch
      </button>

      <div className="rounded-2xl bg-white border border-[#e5e7ec] p-6 mb-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-[#0c3455] text-white grid place-items-center text-lg">
              {student.initials}
            </div>
            <div>
              <h2 className="text-[#0c3455] text-xl">{student.name}</h2>
              <div className="text-sm text-[#717182]">
                ID · {student.id.toUpperCase()} · Last active {student.lastActive}
              </div>
              <div className="mt-2">
                <StudentStatusPill status={student.status} />
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-[#717182]">Course progress</div>
            <div className="text-[#0c3455] text-2xl">{student.progress}%</div>
            <div className="w-44 h-1.5 rounded-full bg-[#0c3455]/10 overflow-hidden mt-2">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${student.progress}%`,
                  background: "linear-gradient(90deg, #0c3455 0%, #4493BF 100%)",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <ActivityHeatmap events={liveActivity} student={student} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[#0c3455]">Activity timeline</h3>
            <span className="text-sm text-[#717182]">{liveActivity.length} events</span>
          </div>
          <div className="rounded-2xl bg-white border border-[#e5e7ec] p-5">
            {liveActivity.length === 0 ? (
              <div className="text-sm text-[#717182] text-center py-6">No activity recorded yet.</div>
            ) : (
              <ul className="space-y-5">
                {liveActivity.map((e) => {
                  let Icon = Activity;
                  if (e.kind === 'login') Icon = LogIn;
                  else if (e.kind === 'submission') Icon = FileUp;
                  else if (e.kind === 'module') Icon = CheckCircle2;

                  return (
                    <li key={e.id} className="flex gap-4 items-start">
                      <div className="size-10 shrink-0 rounded-full bg-[#f3f3f5] flex items-center justify-center text-[#4a4f5a]">
                        <Icon size={18} />
                      </div>
                      <div>
                        <div className="text-[16px] text-[#0c3455] leading-snug">{e.label}</div>
                        {e.detail && <div className="text-sm text-[#717182] mt-0.5">{e.detail}</div>}
                        <div className="text-sm text-[#717182] mt-1">{formatTimestamp(e.timestamp)}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[#0c3455]">Submission history</h3>
            <span className="text-sm text-[#717182]">{liveHistory.length} submissions</span>
          </div>
          <div className="rounded-2xl bg-white border border-[#e5e7ec] overflow-hidden">
            {liveHistory.length === 0 ? (
              <div className="p-6 text-sm text-[#717182] text-center">No submissions yet.</div>
            ) : (
              <ul>
                {liveHistory.map((sub) => (
                  <li key={sub.id} className="border-b border-[#eef0f3] last:border-b-0">
                    <button
                      onClick={() => sub.status === "Pending" && onOpenSubmission(sub.id)}
                      disabled={sub.status !== "Pending"}
                      className={`w-full px-5 py-4 text-left flex items-start gap-3 ${
                        sub.status === "Pending" ? "hover:bg-[#f7f8fa] cursor-pointer" : "cursor-default"
                      }`}
                    >
                      <div className="h-9 w-9 rounded-lg bg-[#0c3455]/5 text-[#0c3455] grid place-items-center shrink-0">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-[#0c3455] truncate">{sub.assignment}</div>
                        <div className="text-sm text-[#717182] mt-0.5">Submitted {sub.submittedAt}</div>
                      </div>
                      <EvalStatusPill status={sub.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

