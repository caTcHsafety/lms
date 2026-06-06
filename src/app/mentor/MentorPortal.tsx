import { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import { TopNav, type MentorView } from "./components/top-nav";
import { Dashboard } from "./components/dashboard";
import { Roster } from "./components/roster";
import { StudentProfile } from "./components/student-profile";
import { EvalQueue } from "./components/eval-queue";
import { EvalWorkspace } from "./components/eval-workspace";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/auth/AuthContext";
import type { Student, Submission, Broadcast, EvalStatus, ActivityEvent } from "./components/mentor-data";

type Screen =
  | { name: "dashboard" }
  | { name: "roster" }
  | { name: "queue" }
  | { name: "student"; id: string; from: MentorView }
  | { name: "workspace"; submissionId: string };

export default function App() {
  const { user } = useAuth();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [activities, setActivities] = useState<Record<string, ActivityEvent[]>>({});
  const [screen, setScreen] = useState<Screen>({ name: "dashboard" });

  const fetchData = async () => {
    if (!user) return;

    // 1. Fetch mentor's assigned students via mentorships
    const { data: mentorshipData } = await supabase
      .from('mentorships')
      .select('student_id')
      .eq('mentor_id', user.id)
      .eq('active', true);

    const assignedStudentIds = mentorshipData?.map(m => m.student_id) || [];

    // If no assigned students, still fetch all (fallback for dev/testing)
    const studentFilter = assignedStudentIds.length > 0 ? assignedStudentIds : null;

    // 2. Fetch profiles for students
    let profileQuery = supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'student');
    if (studentFilter) {
      profileQuery = profileQuery.in('id', studentFilter);
    }
    const { data: profilesData } = await profileQuery;

    // 3. Fetch student progress
    let progressQuery = supabase
      .from('student_progress')
      .select('student_id, completed, stalled_flag');
    if (studentFilter) {
      progressQuery = progressQuery.in('student_id', studentFilter);
    }
    const { data: progressData } = await progressQuery;

    // 4. Fetch last activity event per student from activity_events
    let actQuery = supabase
      .from('activity_events')
      .select('user_id, created_at')
      .order('created_at', { ascending: false });
    if (studentFilter) {
      actQuery = actQuery.in('user_id', studentFilter);
    }
    const { data: allActivityData } = await actQuery;

    // Build last-activity map
    const lastActivityMap = new Map<string, number>();
    allActivityData?.forEach(evt => {
      if (!lastActivityMap.has(evt.user_id)) {
        lastActivityMap.set(evt.user_id, new Date(evt.created_at).getTime());
      }
    });

    // Helper: format ms-since to human string
    const formatLastActive = (ms: number): string => {
      if (!ms) return 'Never';
      const diff = Date.now() - ms;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      return `${days}d ago`;
    };

    // 5. Build progress map
    const progressMap = new Map<string, { completed: number; total: number; stalledFlag: boolean }>();
    progressData?.forEach(row => {
      const existing = progressMap.get(row.student_id) || { completed: 0, total: 0, stalledFlag: false };
      existing.total++;
      if (row.completed) existing.completed++;
      if (row.stalled_flag) existing.stalledFlag = true;
      progressMap.set(row.student_id, existing);
    });

    // 6. Build students array
    let liveStudents: Student[] = (profilesData || []).map(profile => {
      const prog = progressMap.get(profile.id) || { completed: 0, total: 0, stalledFlag: false };
      const progress = prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0;
      const lastActiveMs = lastActivityMap.get(profile.id) || 0;
      const daysSinceActive = lastActiveMs
        ? Math.floor((Date.now() - lastActiveMs) / 86400000)
        : 999;
      const initials = profile.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '??';

      // Stalling = DB flag OR inactive for more than 7 days
      let status: Student['status'] = 'on-track';
      if (prog.stalledFlag || daysSinceActive >= 7) {
        status = 'stalling';
      }

      return {
        id: profile.id,
        name: profile.full_name || 'Unknown',
        initials,
        progress,
        lastActive: formatLastActive(lastActiveMs),
        lastActiveMs,
        daysSinceActive,
        status,
      };
    });

    setStudents(liveStudents);

    // 7. Fetch Submissions (scoped to assigned students)
    let subsQuery = supabase
      .from('submissions')
      .select(`
        id,
        student_id,
        submitted_at,
        status,
        file_url,
        profiles!submissions_student_id_fkey (id, full_name),
        assignments (title)
      `);
    if (studentFilter) {
      subsQuery = subsQuery.in('student_id', studentFilter);
    }
    const { data: subsData } = await subsQuery;

    if (subsData) {
      const liveSubs: Submission[] = subsData.map(s => {
        const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
        const assignment = Array.isArray(s.assignments) ? s.assignments[0] : s.assignments;
        const initials = profile?.full_name?.split(' ').map((n: string) => n[0]).join('') || '??';
        
        let waitingDays = 0;
        if (s.submitted_at) {
           const ms = Date.now() - new Date(s.submitted_at).getTime();
           waitingDays = Math.floor(ms / (1000 * 60 * 60 * 24));
        }

        const dbStatus = s.status || 'pending';
        const mappedStatus: EvalStatus = dbStatus === 'needs_revision' ? 'needs-revision' : (dbStatus as EvalStatus);

        return {
          id: s.id,
          studentId: s.student_id,
          studentName: profile?.full_name || 'Unknown',
          studentInitials: initials.toUpperCase(),
          assignment: assignment?.title || 'Unknown Assignment',
          submittedAt: s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : 'N/A',
          waitingDays,
          status: mappedStatus,
          fileType: "pdf",
          fileName: s.file_url?.split('/').pop() || "submission.pdf",
          content: s.file_url || "No content available."
        };
      });
      setSubmissions(liveSubs);

      // Upgrade status to awaiting-eval if student has pending submissions
      // but don't downgrade a stalling student
      liveStudents = liveStudents.map(student => {
        if (student.status === 'stalling') return student;
        const hasPending = liveSubs.some(sub => sub.studentId === student.id && sub.status === 'pending');
        if (hasPending) return { ...student, status: 'awaiting-eval' as const };
        return student;
      });
      setStudents(liveStudents);
    }

    // 3. Fetch Broadcasts — only those targeted at mentor role or this specific user
    const { data: broadcastsData } = await supabase
      .from('broadcasts')
      .select(`
        *,
        profiles!broadcasts_published_by_fkey (full_name),
        broadcast_audiences (role_target, cohort_target),
        broadcast_acks (broadcast_id, user_id, acked_at, dismissed_at)
      `);
    
    const { data: acksData } = await supabase
      .from('broadcast_acks')
      .select('broadcast_id, acked_at, dismissed_at')
      .eq('user_id', user.id);
      
    if (broadcastsData) {
      // Build a map: broadcast_id → { acked, dismissed }
      const ackMap = new Map(
        (acksData || []).map(a => [a.broadcast_id, { acked: !!a.acked_at, dismissed: !!a.dismissed_at }])
      );

      // Filter to only broadcasts relevant to this mentor:
      // - has a broadcast_audience row with role_target = 'mentor'
      // - OR has a broadcast_acks row with user_id = this mentor (individual targeting)
      const relevantBroadcasts = broadcastsData.filter(b => {
        const audiences = b.broadcast_audiences || [];
        const acks = b.broadcast_acks || [];
        const targetedByRole = audiences.some((a: any) => a.role_target === 'mentor');
        const targetedIndividually = acks.some((a: any) => a.user_id === user.id);
        return targetedByRole || targetedIndividually;
      });

      const liveBroadcasts: Broadcast[] = relevantBroadcasts
        // Hide broadcasts dismissed by this user
        .filter(b => !ackMap.get(b.id)?.dismissed)
        .map(b => {
          const profile = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
          const ackInfo = ackMap.get(b.id);
          return {
            id: b.id,
            title: b.title,
            body: b.content,
            from: profile?.full_name || 'Admin',
            postedAt: b.published_at ? new Date(b.published_at).toLocaleDateString() : 'N/A',
            acknowledged: !!ackInfo?.acked,
            priority: b.priority === 'urgent' ? 'mandatory' : 'info'
          };
        });
      setBroadcasts(liveBroadcasts);
    }

    // 4. Fetch Activity Events
    if (liveStudents.length > 0) {
      const studentIds = liveStudents.map(s => s.id);
      const { data: activityData } = await supabase
        .from('activity_events')
        .select('*')
        .in('user_id', studentIds)
        .order('created_at', { ascending: false });

      if (activityData) {
        const activityMap: Record<string, ActivityEvent[]> = {};
        studentIds.forEach(id => activityMap[id] = []);
        activityData.forEach(evt => {
          let kind: ActivityEvent['kind'] = 'login';
          if (evt.event_type.includes('module')) kind = 'module';
          else if (evt.event_type.includes('submission')) kind = 'submission';
          else if (evt.event_type.includes('stalled')) kind = 'inactivity';
          
          activityMap[evt.user_id].push({
            id: evt.id,
            studentId: evt.user_id,
            timestamp: evt.created_at || 'N/A',
            kind,
            label: evt.event_type,
            detail: (evt.metadata as any)?.detail || undefined
          });
        });
        setActivities(activityMap);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const pendingCount = submissions.filter((s) => s.status === "pending").length;
  const unreadBroadcasts = broadcasts.filter((b) => !b.acknowledged).length;

  const view: MentorView =
    screen.name === "dashboard" || screen.name === "roster" || screen.name === "queue"
      ? screen.name
      : screen.name === "student"
      ? screen.from
      : "queue";

  const acknowledge = async (id: string) => {
    if (!user) return;
    setBroadcasts((prev) => prev.map((b) => (b.id === id ? { ...b, acknowledged: true } : b)));
    
    // Use upsert — for individually-targeted broadcasts the ack row already exists with acked_at=null
    const { error } = await supabase.from('broadcast_acks').upsert({
      user_id: user.id,
      broadcast_id: id,
      acked_at: new Date().toISOString()
    }, { onConflict: 'broadcast_id,user_id' });

    if (error) {
      toast.error("Failed to acknowledge broadcast");
      setBroadcasts((prev) => prev.map((b) => (b.id === id ? { ...b, acknowledged: false } : b)));
      return;
    }
    toast.success("Broadcast acknowledged");
  };

  const clearAcknowledged = async () => {
    const acknowledged = broadcasts.filter((b) => b.acknowledged);
    const count = acknowledged.length;
    if (count === 0) return;

    // Optimistically remove from UI
    setBroadcasts((prev) => prev.filter((b) => !b.acknowledged));

    // Mark as dismissed in DB — keeps the ack record intact but hides it from the feed
    const broadcastIds = acknowledged.map((b) => b.id);
    const { error } = await supabase
      .from('broadcast_acks')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('user_id', user!.id)
      .in('broadcast_id', broadcastIds);

    if (error) {
      toast.error("Failed to clear acknowledged broadcasts");
      // Restore on failure
      setBroadcasts((prev) => [...prev, ...acknowledged]);
      return;
    }
    toast.success(`Cleared ${count} acknowledged broadcast${count === 1 ? "" : "s"}`);
  };

  const completeEval = async (
    id: string,
    outcome: "approved" | "needs-revision",
    grade: number,
    feedback: string
  ) => {
    const dbOutcome = outcome === "needs-revision" ? "needs_revision" : "approved";
    const { error } = await supabase
      .from('submissions')
      .update({
        status: dbOutcome,
        grade,
        feedback,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id
      })
      .eq('id', id);

    if (error) {
      toast.error("Failed to submit evaluation");
      return;
    }

    toast.success(
      outcome === "approved" ? `Approved · ${grade}/100` : `Returned for revision · ${grade}/100`,
      { description: feedback.length > 80 ? feedback.slice(0, 80) + "…" : feedback }
    );
    setScreen({ name: "queue" });
    fetchData();
  };

  const activeStudent =
    screen.name === "student" ? students.find((s) => s.id === screen.id) ?? null : null;

  const activeSubmission = useMemo(
    () => (screen.name === "workspace" ? submissions.find((s) => s.id === screen.submissionId) ?? null : null),
    [screen, submissions]
  );

  return (
    <div className="min-h-screen w-full bg-[#f3f3f5] font-['Inter'] antialiased">
      <Toaster position="top-right" richColors />
      <TopNav
        view={view}
        onChange={(v) => setScreen({ name: v } as Screen)}
        pendingCount={pendingCount}
        unreadBroadcasts={unreadBroadcasts}
      />
      <main className="max-w-[1400px] mx-auto px-10 py-8">
        {screen.name === "dashboard" && (
          <Dashboard
            broadcasts={broadcasts}
            students={students}
            pendingCount={pendingCount}
            onAcknowledge={acknowledge}
            onClearAcknowledged={clearAcknowledged}
            onOpenQueue={() => setScreen({ name: "queue" })}
            onOpenRoster={() => setScreen({ name: "roster" })}
            onOpenStudent={(id) => setScreen({ name: "student", id, from: "roster" })}
          />
        )}

        {screen.name === "roster" && (
          <Roster
            students={students}
            onOpen={(id) => setScreen({ name: "student", id, from: "roster" })}
          />
        )}

        {screen.name === "queue" && (
          <EvalQueue
            submissions={submissions}
            onOpen={(id) => setScreen({ name: "workspace", submissionId: id })}
          />
        )}

        {screen.name === "student" && activeStudent && (
          <StudentProfile
            student={activeStudent}
            activity={activities[activeStudent.id] ?? []}
            history={submissions.filter(s => s.studentId === activeStudent.id)}
            onBack={() => setScreen({ name: screen.from })}
            onOpenSubmission={(id) => setScreen({ name: "workspace", submissionId: id })}
          />
        )}

        {screen.name === "workspace" && activeSubmission && (
          <EvalWorkspace
            submission={activeSubmission}
            onBack={() => setScreen({ name: "queue" })}
            onSubmit={completeEval}
          />
        )}
      </main>
    </div>
  );
}
