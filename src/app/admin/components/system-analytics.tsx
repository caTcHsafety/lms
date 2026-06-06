import { useMemo, useState, useEffect } from "react";
import {
  Users,
  ShieldCheck,
  ClipboardList,
  FileClock,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  ArrowUpDown,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { supabase } from "@/lib/supabase";

type Range = "7d" | "30d" | "90d";
type StaffStatus = "active" | "watch" | "risk";

const RANGE_LABEL: Record<Range, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

const statusStyles: Record<StaffStatus, { pill: string; dot: string; label: string }> = {
  active: { pill: "bg-[#E6F1E9] text-[#1E5631]", dot: "bg-[#1E5631]", label: "Active" },
  watch: { pill: "bg-[#FFF3D6] text-[#A56A00]", dot: "bg-[#A56A00]", label: "Watch" },
  risk: { pill: "bg-[#FDECEA] text-[#9F2A1C]", dot: "bg-[#9F2A1C]", label: "At Risk" },
};

type StaffEngagement = {
  id: string;
  name: string;
  role: "Trainer" | "Mentor";
  logins: number;
  sessions: number;
  lastSeen: string;
  lastSeenDate: Date | null;
  status: StaffStatus;
};

type MentorQueueItem = {
  name: string;
  pending: number;
  oldestDays: number;
};

type ThroughputData = {
  label: string;
  submitted: number;
  graded: number;
};

export function SystemAnalyticsView() {
  const [range, setRange] = useState<Range>("30d");
  const [sortBy, setSortBy] = useState<"logins" | "sessions" | "status">("status");
  const [roleFilter, setRoleFilter] = useState<"all" | "Trainer" | "Mentor">("all");

  const [loading, setLoading] = useState(true);

  // Raw database data states
  const [profiles, setProfiles] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [broadcastAudiences, setBroadcastAudiences] = useState<any[]>([]);
  const [broadcastAcks, setBroadcastAcks] = useState<any[]>([]);
  const [mentorships, setMentorships] = useState<any[]>([]);
  const [cohortStudents, setCohortStudents] = useState<any[]>([]);
  const [activityEvents, setActivityEvents] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);

  // Fetch all analytics-related tables on mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [
          { data: profs },
          { data: subs },
          { data: broads },
          { data: auds },
          { data: acks },
          { data: mships },
          { data: cs },
          { data: events },
          { data: assigs }
        ] = await Promise.all([
          supabase.from("profiles").select("*"),
          supabase.from("submissions").select("*"),
          supabase.from("broadcasts").select("*"),
          supabase.from("broadcast_audiences").select("*"),
          supabase.from("broadcast_acks").select("*"),
          supabase.from("mentorships").select("*"),
          supabase.from("cohort_students").select("*"),
          supabase.from("activity_events").select("*"),
          supabase.from("assignments").select("*, assignment_cohorts(cohort_id)")
        ]);

        setProfiles(profs || []);
        setSubmissions(subs || []);
        setBroadcasts(broads || []);
        setBroadcastAudiences(auds || []);
        setBroadcastAcks(acks || []);
        setMentorships(mships || []);
        setCohortStudents(cs || []);
        setActivityEvents(events || []);
        setAssignments(assigs || []);
      } catch (error) {
        console.error("Error loading analytics database views:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Filter duration cutoff
  const cutoffDate = useMemo(() => {
    const d = new Date();
    if (range === "7d") d.setDate(d.getDate() - 7);
    else if (range === "30d") d.setDate(d.getDate() - 30);
    else d.setDate(d.getDate() - 90);
    return d;
  }, [range]);

  // Derived cohort student counts
  const cohortStudentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    cohortStudents.forEach((cs) => {
      counts[cs.cohort_id] = (counts[cs.cohort_id] || 0) + 1;
    });
    return counts;
  }, [cohortStudents]);

  // 1. Outstanding Submissions KPI
  // Defined as expected submissions for published assignments minus actual submissions uploaded
  const outstandingSubmissions = useMemo(() => {
    const publishedAssignments = assignments.filter((a) => a.status === "Published");
    let expected = 0;
    publishedAssignments.forEach((a) => {
      // Find cohorts linked to this assignment
      const linkedCohortIds = assignmentCohortsFor(a.id);
      linkedCohortIds.forEach((cid) => {
        expected += cohortStudentCounts[cid] || 0;
      });
    });
    // Subtract actual submission count
    return Math.max(0, expected - submissions.length);
  }, [assignments, cohortStudentCounts, submissions, cohortStudents]);

  function assignmentCohortsFor(assignmentId: string) {
    const assignment = assignments.find((a) => a.id === assignmentId);
    if (!assignment || !assignment.assignment_cohorts) return [];
    return assignment.assignment_cohorts.map((ac: any) => ac.cohort_id);
  }

  // 2. Active Teaching Staff KPI (Trainers + Mentors logged in this period)
  const staffStats = useMemo(() => {
    const teachingStaff = profiles.filter((p) => p.role === "trainer" || p.role === "mentor");
    const totalStaff = teachingStaff.length;

    // Logins in selected range (case-insensitive comparison for event_type)
    const activeStaffIds = new Set(
      activityEvents
        .filter(
          (ae) =>
            ae.event_type.toUpperCase() === "LOGIN" &&
            new Date(ae.created_at) >= cutoffDate
        )
        .map((ae) => ae.user_id)
    );

    const activeStaffCount = teachingStaff.filter((s) => activeStaffIds.has(s.id)).length;

    return {
      active: activeStaffCount,
      total: totalStaff || 1, // Avoid divide by zero
    };
  }, [profiles, activityEvents, cutoffDate]);

  // 3. Broadcast Compliance KPI
  // Compares acknowledged broadcast_acks against total expected recipients
  const compliancePct = useMemo(() => {
    let expectedCount = 0;
    const ackedCount = broadcastAcks.filter((a) => a.acked_at !== null).length;

    broadcasts.forEach((b) => {
      const audsForB = broadcastAudiences.filter((ba) => ba.broadcast_id === b.id);
      audsForB.forEach((aud) => {
        if (aud.role_target) {
          expectedCount += profiles.filter((p) => p.role === aud.role_target).length;
        }
        if (aud.cohort_target) {
          expectedCount += cohortStudentCounts[aud.cohort_target] || 0;
        }
      });
      // Also count individually targeted users (broadcast_acks with no corresponding audience row)
      if (audsForB.length === 0) {
        const individualAcks = broadcastAcks.filter((a) => a.broadcast_id === b.id);
        expectedCount += individualAcks.length;
      }
    });

    if (expectedCount === 0) return 100;
    return Math.round((ackedCount / expectedCount) * 100);
  }, [broadcasts, broadcastAudiences, broadcastAcks, profiles, cohortStudentCounts]);

  // Compute period-over-period deltas for KPIs
  const prevCutoffDate = useMemo(() => {
    const d = new Date();
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    d.setDate(d.getDate() - days * 2); // previous period start
    return d;
  }, [range]);

  const kpiDeltas = useMemo(() => {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const prevEnd = cutoffDate; // prev period ends where current starts
    const prevStart = prevCutoffDate;

    // Pending reviews: current vs previous
    const currentPending = submissions.filter(s => s.status === "pending").length;
    const prevPending = submissions.filter(s => {
      const d = new Date(s.submitted_at);
      return s.status === "pending" && d >= prevStart && d < prevEnd;
    }).length;
    const pendingDelta = prevPending > 0 ? Math.round(((currentPending - prevPending) / prevPending) * 100) : 0;

    // Active staff: logins this period vs previous
    const teachingStaff = profiles.filter(p => p.role === "trainer" || p.role === "mentor");
    const currentActiveIds = new Set(
      activityEvents.filter(ae => ae.event_type.toUpperCase() === "LOGIN" && new Date(ae.created_at) >= cutoffDate)
        .map(ae => ae.user_id)
    );
    const prevActiveIds = new Set(
      activityEvents.filter(ae => ae.event_type.toUpperCase() === "LOGIN" && new Date(ae.created_at) >= prevStart && new Date(ae.created_at) < prevEnd)
        .map(ae => ae.user_id)
    );
    const currentStaffActive = teachingStaff.filter(s => currentActiveIds.has(s.id)).length;
    const prevStaffActive = teachingStaff.filter(s => prevActiveIds.has(s.id)).length;
    const staffDelta = currentStaffActive - prevStaffActive;

    // Submissions in period
    const currentSubs = submissions.filter(s => new Date(s.submitted_at) >= cutoffDate).length;
    const prevSubs = submissions.filter(s => { const d = new Date(s.submitted_at); return d >= prevStart && d < prevEnd; }).length;
    const subsDelta = prevSubs > 0 ? Math.round(((currentSubs - prevSubs) / prevSubs) * 100) : 0;

    return { pendingDelta, staffDelta, subsDelta };
  }, [submissions, profiles, activityEvents, cutoffDate, prevCutoffDate, range]);

  // 4. Pending Reviews KPI
  const pendingReviewsCount = useMemo(() => {
    return submissions.filter((s) => s.status === "pending").length;
  }, [submissions]);

  // 5. Assignment Throughput Chart Series (Submitted vs Graded grouped over range)
  const series = useMemo(() => {
    const buckets = range === "7d" ? 7 : range === "30d" ? 6 : 12;
    const out: ThroughputData[] = [];

    const now = new Date();
    for (let i = buckets - 1; i >= 0; i--) {
      const start = new Date(now);
      const end = new Date(now);
      let label = "";

      if (range === "7d") {
        start.setDate(now.getDate() - i);
        end.setDate(now.getDate() - i + 1);
        label = start.toLocaleDateString("en-US", { weekday: "short" });
      } else if (range === "30d") {
        start.setDate(now.getDate() - (i + 1) * 5);
        end.setDate(now.getDate() - i * 5);
        label = `Wk -${i}`;
      } else {
        start.setDate(now.getDate() - (i + 1) * 7);
        end.setDate(now.getDate() - i * 7);
        label = `Wk -${i}`;
      }

      const subsInBucket = submissions.filter(
        (s) => new Date(s.submitted_at) >= start && new Date(s.submitted_at) < end
      );
      const submitted = subsInBucket.length;
      const graded = subsInBucket.filter((s) => s.status !== "pending").length;

      out.push({ label, submitted, graded });
    }

    return out;
  }, [submissions, range]);

  const submittedTotal = series.reduce((a, b) => a + b.submitted, 0);
  const gradedTotal = series.reduce((a, b) => a + b.graded, 0);
  const backlog = submissions.filter((s) => s.status === "pending").length;

  // 6. Pending Grading Queue per Mentor
  const mentorQueue = useMemo((): MentorQueueItem[] => {
    const mentors = profiles.filter((p) => p.role === "mentor");
    return mentors.map((m) => {
      // Find students assigned to this mentor
      const studentIds = mentorships.filter((ms) => ms.mentor_id === m.id).map((ms) => ms.student_id);
      const mentorSubmissions = submissions.filter(
        (s) => studentIds.includes(s.student_id) && s.status === "pending"
      );

      const pending = mentorSubmissions.length;
      let oldestDays = 0;
      if (pending > 0) {
        const oldestDate = new Date(
          Math.min(...mentorSubmissions.map((s) => new Date(s.submitted_at).getTime()))
        );
        oldestDays = Math.ceil((new Date().getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        name: m.full_name || "Unknown Mentor",
        pending,
        oldestDays,
      };
    }).filter(m => m.pending > 0).sort((a, b) => b.pending - a.pending);
  }, [profiles, mentorships, submissions]);

  const maxQueue = Math.max(1, ...mentorQueue.map((m) => m.pending));

  // 7. Staff Engagement Grid
  const staffEngagement = useMemo((): StaffEngagement[] => {
    const teachingStaff = profiles.filter((p) => p.role === "trainer" || p.role === "mentor");

    return teachingStaff.map((p) => {
      const staffLogins = activityEvents.filter(
        (ae) => ae.user_id === p.id && ae.event_type.toUpperCase() === "LOGIN" && new Date(ae.created_at) >= cutoffDate
      );

      const loginDates = staffLogins.map((ae) => new Date(ae.created_at).toDateString());
      const sessions = new Set(loginDates).size;

      let lastSeen = "never";
      let lastSeenDate: Date | null = null;
      if (staffLogins.length > 0) {
        const sortedLogins = [...staffLogins].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        lastSeenDate = new Date(sortedLogins[0].created_at);
        const diffMs = new Date().getTime() - lastSeenDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) lastSeen = "today";
        else if (diffDays === 1) lastSeen = "yesterday";
        else lastSeen = `${diffDays}d ago`;
      }

      // Auto-derived status
      let status: StaffStatus = "risk";
      if (lastSeenDate) {
        const diffDays = (new Date().getTime() - lastSeenDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays <= 3) status = "active";
        else if (diffDays <= 7) status = "watch";
      }

      return {
        id: p.id,
        name: p.full_name || "Unknown Staff",
        role: (p.role === "trainer" ? "Trainer" : "Mentor") as "Trainer" | "Mentor",
        logins: staffLogins.length,
        sessions,
        lastSeen,
        lastSeenDate,
        status,
      };
    });
  }, [profiles, activityEvents, cutoffDate]);

  const sortedStaff = useMemo(() => {
    const statusRank: Record<StaffStatus, number> = { risk: 0, watch: 1, active: 2 };
    return [...staffEngagement]
      .filter((s) => roleFilter === "all" || s.role === roleFilter)
      .sort((a, b) => {
        if (sortBy === "status") {
          return statusRank[a.status] - statusRank[b.status] || a.logins - b.logins;
        }
        return b[sortBy] - a[sortBy];
      });
  }, [staffEngagement, roleFilter, sortBy]);

  if (loading) {
    return (
      <div className="-mx-10 -my-10 min-h-[calc(100vh-64px)] flex flex-col items-center justify-center bg-[#f5f5f7] text-[#0d2543]">
        <Loader2 className="size-10 animate-spin text-[#4493bf] mb-4" />
        <span className="font-['Inter'] font-semibold text-sm tracking-wide">Querying live metrics from SafetyCatch...</span>
      </div>
    );
  }

  return (
    <div className="-mx-10 -my-10 h-[calc(100vh-64px)] bg-[#f5f5f7] p-10 overflow-y-auto overflow-x-hidden">
    <div className="space-y-6">
      {/* Page Header */}
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 id="page-title" className="font-['Inter'] font-semibold text-[#0B1B33] tracking-[-0.3px]" style={{ fontSize: 24 }}>
            System Analytics
          </h1>
          <p className="font-['Inter'] text-sm text-[#6F7480] mt-1 max-w-[680px]">
            Operational command center — pipeline capacity, throughput, and staff accountability across SafetyCatch.
          </p>
        </div>
        <RangeToggle range={range} setRange={setRange} />
      </header>

      {/* ROW 1 — Pipeline KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          id="kpi-outstanding-submissions"
          icon={<FileClock className="size-4" />}
          label="Outstanding Submissions"
          value={outstandingSubmissions.toString()}
          sub="Assigned but not uploaded"
          delta={Math.abs(kpiDeltas.subsDelta)}
          deltaSuffix="%"
          positive={kpiDeltas.subsDelta <= 0}
          context="Ball in students' court"
          tone={outstandingSubmissions >= 120 ? "warning" : "neutral"}
        />
        <KpiCard
          id="kpi-active-staff"
          icon={<Users className="size-4" />}
          label="Active Teaching Staff"
          value={`${staffStats.active}/${staffStats.total}`}
          sub={`Logged in (${RANGE_LABEL[range]})`}
          delta={Math.abs(kpiDeltas.staffDelta)}
          deltaSuffix=""
          positive={kpiDeltas.staffDelta >= 0}
          context={`${Math.round((staffStats.active / staffStats.total) * 100)}% attendance`}
        />
        <KpiCard
          id="kpi-broadcast-compliance"
          icon={<ShieldCheck className="size-4" />}
          label="Broadcast Compliance"
          value={`${compliancePct}%`}
          sub="Acknowledged mandatory memos"
          delta={0}
          deltaSuffix=" pts"
          positive={true}
          context="From News Publisher"
          tone={compliancePct >= 90 ? "ok" : compliancePct >= 75 ? "warning" : "danger"}
        />
        <KpiCard
          id="kpi-pending-reviews"
          icon={<ClipboardList className="size-4" />}
          label="Total Pending Reviews"
          value={pendingReviewsCount.toString()}
          sub="Awaiting Mentor evaluation"
          delta={Math.abs(kpiDeltas.pendingDelta)}
          deltaSuffix="%"
          positive={kpiDeltas.pendingDelta <= 0}
          context="Ball in Mentors' court"
          tone={pendingReviewsCount >= 5 ? "danger" : pendingReviewsCount >= 2 ? "warning" : "ok"}
        />
      </section>

      {/* ROW 2 — Operations & Workload */}
      <section className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3">
          <Card>
            <CardHeader
              title="Assignment Throughput"
              subtitle="Submitted vs Graded — are Mentors clearing the queue as fast as students fill it?"
              right={
                <span id="backlog-badge" className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-['Inter'] font-semibold text-[16px] tracking-[0.4px] uppercase ${
                  backlog > 5 ? "bg-[#FDECEA] text-[#9F2A1C]" : backlog > 2 ? "bg-[#FFF3D6] text-[#A56A00]" : "bg-[#E6F1E9] text-[#1E5631]"
                }`}>
                  <AlertTriangle className="size-3" />
                  {backlog} backlog
                </span>
              }
            />
            <div className="mt-4 grid grid-cols-2 gap-3 mb-3">
              <MiniStat label="Submitted" value={submittedTotal} color="#00658d" />
              <MiniStat label="Graded" value={gradedTotal} color="#0d2543" />
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
                  <CartesianGrid stroke="rgba(15,32,60,0.07)" vertical={false} />
                  <XAxis dataKey="label" stroke="#9097A2" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#9097A2" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "white", border: "1px solid rgba(15,32,60,0.10)", borderRadius: 10, boxShadow: "0 10px 24px -6px rgba(13,37,67,0.12)", fontSize: 12 }}
                    cursor={{ fill: "rgba(13,37,67,0.04)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
                  <Bar id="bar-submitted" dataKey="submitted" name="Submitted" fill="#00658d" radius={[4, 4, 0, 0]} />
                  <Bar id="bar-graded" dataKey="graded" name="Graded" fill="#0d2543" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="xl:col-span-2">
          <Card>
            <CardHeader
              title="Pending Grading Queue"
              subtitle="Per-Mentor workload — spot the overloaded, reassign instantly."
              right={
                <span id="mentor-queue-count" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F1F4F8] text-[#0d2543] font-['Inter'] font-semibold text-xs tracking-[0.4px] uppercase">
                  {mentorQueue.length} active mentors
                </span>
              }
            />
            {mentorQueue.length === 0 ? (
              <div className="mt-8 py-16 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-[rgba(15,32,60,0.1)]">
                <ShieldCheck className="size-8 text-[#1E5631] mb-2" />
                <span className="font-['Inter'] font-semibold text-sm text-[#0B1B33]">Queue completely clear!</span>
                <span className="font-['Inter'] text-sm text-[#6F7480] mt-1">All pending student submissions have been evaluated.</span>
              </div>
            ) : (
              <ul className="mt-4 space-y-2 max-h-[340px] overflow-auto pr-1 [scrollbar-width:thin] [scrollbar-color:#c4c6ce_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-[#c4c6ce] [&::-webkit-scrollbar-thumb]:rounded-full">
                {mentorQueue.map((m) => {
                  const pct = (m.pending / maxQueue) * 100;
                  const tone = m.pending >= 5 ? "danger" : m.pending >= 2 ? "warning" : "ok";
                  const barColor = tone === "danger" ? "#9F2A1C" : tone === "warning" ? "#A56A00" : "#00658d";
                  return (
                    <li key={m.name} className="px-3 py-2.5 rounded-lg border border border-[rgba(15,32,60,0.07)] hover:shadow-[0_4px_6px_-1px_rgba(13,37,67,0.07)] transition-shadow duration-150">
                      <div className="flex items-center gap-3">
                        <span className="size-8 rounded-full bg-[#8B5CF6] flex items-center justify-center font-['Inter'] font-semibold text-sm text-white shrink-0">
                          {m.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-['Inter'] font-semibold text-sm text-[#0B1B33] truncate">{m.name}</span>
                            <span className="font-['Inter'] font-semibold text-sm tabular-nums text-[#0B1B33] shrink-0">{m.pending}</span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-[#F1F4F8] overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: barColor }} />
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="font-['Inter'] text-sm text-[#6F7480]">Oldest: {m.oldestDays}d</span>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </section>

      {/* ROW 3 — Staff Engagement */}
      <Card>
        <CardHeader
          title="Engagement Matrix"
          subtitle="Status auto-derived from logins & live sessions over the period."
          right={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 p-1 rounded-full bg-[#F1F4F8] border border-[rgba(15,32,60,0.07)]">
                {(["all", "Trainer", "Mentor"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-3 py-1 rounded-full font-['Inter'] font-semibold text-[16px] tracking-[0.4px] uppercase transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf] ${
                      roleFilter === r ? "bg-white text-[#0d2543] shadow-[0_1px_2px_rgba(13,37,67,0.08)]" : "text-[#6F7480] hover:text-[#0d2543]"
                    }`}
                  >
                    {r === "all" ? "All" : r + "s"}
                  </button>
                ))}
              </div>
            </div>
          }
        />

        <div className="mt-4 grid grid-cols-3 gap-2">
          <SummaryPill label="Active" count={sortedStaff.filter((s) => s.status === "active").length} color="#1E5631" bg="#E6F1E9" />
          <SummaryPill label="Watch" count={sortedStaff.filter((s) => s.status === "watch").length} color="#A56A00" bg="#FFF3D6" />
          <SummaryPill label="At Risk" count={sortedStaff.filter((s) => s.status === "risk").length} color="#9F2A1C" bg="#FDECEA" />
        </div>

        <div className="mt-4 overflow-auto [scrollbar-width:thin] [scrollbar-color:#c4c6ce_transparent] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:bg-[#c4c6ce] [&::-webkit-scrollbar-thumb]:rounded-full">
          <table className="w-full" style={{ minWidth: 720 }}>
            <thead>
              <tr className="border-b border-[rgba(15,32,60,0.07)] text-left">
                <th className="font-['Inter'] font-semibold text-xs uppercase tracking-[0.5px] text-[#9097A2] px-3 py-2">Staff</th>
                <th className="font-['Inter'] font-semibold text-xs uppercase tracking-[0.5px] text-[#9097A2] px-3 py-2">Role</th>
                <th className="font-['Inter'] font-semibold text-xs uppercase tracking-[0.5px] text-[#9097A2] px-3 py-2">
                  <SortBtn active={sortBy === "logins"} onClick={() => setSortBy("logins")}>Logins</SortBtn>
                </th>
                <th className="font-['Inter'] font-semibold text-xs uppercase tracking-[0.5px] text-[#9097A2] px-3 py-2">
                  <SortBtn active={sortBy === "sessions"} onClick={() => setSortBy("sessions")}>Sessions</SortBtn>
                </th>
                <th className="font-['Inter'] font-semibold text-xs uppercase tracking-[0.5px] text-[#9097A2] px-3 py-2">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {sortedStaff.map((s) => {
                const style = statusStyles[s.status];
                return (
                  <tr key={s.id} className="border-b border-[rgba(15,32,60,0.05)] hover:bg-[#F7F9FC] transition-colors duration-100">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`size-8 rounded-full flex items-center justify-center font-['Inter'] font-semibold text-[16px] text-white ${s.role === "Trainer" ? "bg-[#00658d]" : "bg-[#8B5CF6]"}`}>
                          {s.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-['Inter'] font-semibold text-sm text-[#0B1B33]">{s.name}</span>
                          <span className={`mt-0.5 inline-flex items-center gap-1 w-max px-1.5 py-0.5 rounded-full text-[16px] font-semibold ${style.pill}`}>
                            <span className={`size-1.5 rounded-full ${style.dot}`} />
                            {style.label}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-['Inter'] text-sm text-[#44474e]">{s.role}</td>
                    <td className="px-3 py-3">
                      <span className="font-['Inter'] font-semibold text-sm text-[#0B1B33] tabular-nums">{s.logins}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-['Inter'] font-semibold text-sm text-[#0B1B33] tabular-nums">{s.sessions}</span>
                    </td>
                    <td className="px-3 py-3 font-['Inter'] text-sm text-[#6F7480] whitespace-nowrap">{s.lastSeen}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
    </div>
  );
}

function RangeToggle({ range, setRange }: { range: Range; setRange: (r: Range) => void }) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white border border-[rgba(15,32,60,0.07)] shadow-[0_1px_2px_rgba(13,37,67,0.04)]">
      {(["7d", "30d", "90d"] as Range[]).map((r) => (
        <button
          key={r}
          onClick={() => setRange(r)}
          className={`px-4 py-1.5 rounded-full font-['Inter'] font-semibold text-[16px] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf] ${
            range === r
              ? "bg-[#0d2543] text-white shadow-[0_1px_2px_rgba(13,37,25,0.25)]"
              : "text-[#44474e] hover:text-[#0d2543]"
          }`}
        >
          {RANGE_LABEL[r]}
        </button>
      ))}
    </div>
  );
}

function KpiCard({
  id, icon, label, value, sub, delta, deltaSuffix, positive, context, tone = "neutral",
}: {
  id?: string; icon: React.ReactNode; label: string; value: string; sub: string;
  delta: number; deltaSuffix: string; positive: boolean; context: string;
  tone?: "neutral" | "ok" | "warning" | "danger";
}) {
  const toneBar = tone === "danger" ? "bg-[#9F2A1C]" : tone === "warning" ? "bg-[#A56A00]" : tone === "ok" ? "bg-[#1E5631]" : "bg-[#00658d]";
  const valueColor = tone === "danger" ? "text-[#9F2A1C]" : tone === "warning" ? "text-[#A56A00]" : "text-[#0B1B33]";
  return (
    <div id={id} className="relative bg-white rounded-xl border border-[rgba(15,32,60,0.07)] shadow-[0_1px_2px_rgba(13,37,67,0.04),0_1px_6px_rgba(13,37,67,0.04)] p-5 overflow-hidden">
      <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${toneBar}`} />
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="size-7 rounded-md bg-[#F1F4F8] text-[#0d2543] flex items-center justify-center">{icon}</span>
          <span className="font-['Inter'] font-semibold text-xs uppercase tracking-[0.5px] text-[#6F7480]">{label}</span>
        </div>
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-['Inter'] font-semibold text-[16px] tabular-nums ${
          positive ? "bg-[#E6F1E9] text-[#1E5631]" : "bg-[#FDECEA] text-[#9F2A1C]"
        }`}>
          {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
          {Math.abs(delta)}{deltaSuffix}
        </span>
      </div>
      <div className={`font-['Inter'] font-semibold tabular-nums tracking-[-0.5px] ${valueColor}`} style={{ fontSize: 32 }}>{value}</div>
      <div className="font-['Inter'] text-sm text-[#6F7480] mt-1">{sub}</div>
      <div className="font-['Inter'] text-sm text-[#9097A2] mt-2 italic">{context}</div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[rgba(15,32,60,0.07)] shadow-[0_1px_2px_rgba(13,37,67,0.04),0_1px_6px_rgba(13,37,67,0.04)] p-5 h-full">
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h3 className="font-['Inter'] font-semibold text-[#0B1B33] tracking-[-0.2px]" style={{ fontSize: 15 }}>{title}</h3>
        {subtitle && <p className="font-['Inter'] text-sm text-[#6F7480] mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-[#F7F9FC] border border-[rgba(15,32,60,0.05)]">
      <div className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full" style={{ background: color }} />
        <span className="font-['Inter'] font-semibold text-xs uppercase tracking-[0.5px] text-[#6F7480]">{label}</span>
      </div>
      <div className="font-['Inter'] font-semibold text-[18px] tabular-nums text-[#0B1B33] mt-0.5">{value.toLocaleString()}</div>
    </div>
  );
}

function SummaryPill({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 rounded-lg font-['Inter']" style={{ background: bg, color }}>
      <span className="text-xs font-semibold uppercase tracking-[0.5px]">{label}</span>
      <span className="text-sm font-bold tabular-nums">{count}</span>
    </div>
  );
}

function SortBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 font-['Inter'] font-semibold text-[16px] uppercase tracking-[0.5px] hover:text-[#0d2543] transition-colors duration-100 ${active ? "text-[#0d2543]" : "text-[#9097A2]"}`}
    >
      {children}
      <ArrowUpDown className="size-3" />
    </button>
  );
}

