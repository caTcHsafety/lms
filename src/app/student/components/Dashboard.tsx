import { useEffect, useState } from "react";
import { Flame, ListChecks, TrendingUp, Shield, Network, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { View } from "./TopBar";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/auth/AuthContext";

const BLUE = "#4493BF";
const NAVY = "#0D2543";

interface DashboardProps {
  onNavigate: (v: View) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { user } = useAuth();
  const [activity, setActivity] = useState<number[]>(Array(364).fill(0));
  const [streak, setStreak] = useState(0);
  const [pendingAssignments, setPendingAssignments] = useState<{ id: string; title: string; dueLabel: string; overdue: boolean }[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string; progress: number }[]>([]);
  const [recentScores, setRecentScores] = useState<{ id: string; title: string; score: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState<string>("");

  const monthLabels = (() => {
      const labels = [];
      for (let i = 11; i >= 0; i--) {
          const d = new Date();
          d.setDate(1); // CRITICAL: Fixes the Feb/Mar 31st rollover bug
          d.setMonth(d.getMonth() - i);
          labels.push(d.toLocaleString('default', { month: 'short' }).toUpperCase());
      }
      return labels;
  })();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const shades = ["bg-gray-100", "#cfe3ef", "#a6cde0", "#4493BF", "#0D2543"];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = fullName ? fullName.split(" ")[0] : (user?.user_metadata?.name?.split(" ")[0] || user?.email?.split("@")[0] || "Student");

  useEffect(() => {
    if (!user || !user.id) return;
    if (!navigator.onLine) {
        setLoading(false);
        return;
    }
    let isMounted = true;
    (async () => {
      try {
        // Fetch user profile full name
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        if (profile?.full_name && isMounted) {
          setFullName(profile.full_name);
        }

        // Helper for local date strings YYYY-MM-DD
        const getLocalDateString = (d: Date = new Date()) => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        const todayStr = getLocalDateString();

        // 1. Get activity data for streak & heatmap calculation
        const { data: progressData } = await supabase.from("student_progress").select("updated_at").eq("student_id", user.id);
        const { data: submissionsData } = await supabase.from("submissions").select("submitted_at").eq("student_id", user.id);
        
        let { data: studentEvents } = await supabase.from("activity_events").select("created_at, event_type").eq("user_id", user.id);
        if (!studentEvents) studentEvents = [];

        // Check if there is an event logged today (local time)
        const hasEventToday = studentEvents.some((e) => {
          const eventDate = new Date(e.created_at);
          const eventLocalStr = getLocalDateString(eventDate);
          return eventLocalStr === todayStr;
        });

        if (!hasEventToday) {
          const { data: newEvent, error: insertError } = await supabase
            .from("activity_events")
            .insert({
              user_id: user.id,
              event_type: "LOGIN",
              metadata: { source: "web_app" }
            })
            .select("created_at, event_type")
            .single();

          if (!insertError && newEvent) {
            studentEvents.push(newEvent);
          }
        }

        const dateIntensity: Record<string, number> = {};
        const addDateEvent = (dateStr?: string | null, type: 'light' | 'dark' = 'light') => {
          if (!dateStr) return;
          const dateObj = new Date(dateStr);
          if (isNaN(dateObj.getTime())) return;
          const localDateStr = getLocalDateString(dateObj);
          const val = type === 'dark' ? 4 : 2;
          dateIntensity[localDateStr] = Math.max(dateIntensity[localDateStr] || 0, val);
        };

        progressData?.forEach((p) => addDateEvent(p.updated_at, 'dark'));
        submissionsData?.forEach((s) => addDateEvent(s.submitted_at, 'dark'));
        studentEvents.forEach((e) => {
          const isDark = e.event_type === 'MODULE_COMPLETED' || e.event_type === 'ASSIGNMENT_SUBMITTED';
          addDateEvent(e.created_at, isDark ? 'dark' : 'light');
        });

        // 2. Populate heatmap array (364 days) ending on Saturday of current week
        const newAct = Array(364).fill(0);
        const todayObj = new Date();
        const endDate = new Date(todayObj);
        endDate.setDate(todayObj.getDate() + (6 - todayObj.getDay()));
        endDate.setHours(0, 0, 0, 0); // local midnight of Saturday
        const endTime = endDate.getTime();

        Object.entries(dateIntensity).forEach(([dateStr, intensity]) => {
          const [y, m, d] = dateStr.split('-').map(Number);
          const eTime = new Date(y, m - 1, d).getTime(); // local midnight
          const diffDays = Math.round((endTime - eTime) / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays < 364) {
            const idx = 363 - diffDays;
            newAct[idx] = intensity;
          }
        });

        // 3. Calculate consecutive days streak
        let calculatedStreak = 0;

        const { data: streakData, error: streakError } = await supabase
          .from('learning_streaks')
          .select('*')
          .eq('student_id', user.id)
          .single();

        if (streakData) {
          calculatedStreak = streakData.current_streak;
          // Only update if the streak hasn't been updated today
          if (streakData.last_activity_date !== todayStr) {
            
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = getLocalDateString(yesterday);

            // Determine if streak continues or resets
            let newStreak = streakData.current_streak;
            if (streakData.last_activity_date === yesterdayStr) {
               newStreak += 1; // Streak continues
            } else {
               newStreak = 1;  // Streak broken, reset
            }

            const newLongest = Math.max(newStreak, streakData.longest_streak || 0);
            calculatedStreak = newStreak;

            // Update the database
            await supabase.from('learning_streaks').update({
              current_streak: newStreak,
              longest_streak: newLongest,
              last_activity_date: todayStr,
              updated_at: new Date().toISOString()
            }).eq('student_id', user.id);
          }
        } else {
          calculatedStreak = 1;
          // First time streak creation
          await supabase.from('learning_streaks').insert({
              student_id: user.id,
              current_streak: 1,
              longest_streak: 1,
              last_activity_date: todayStr
          });
        }

        // 4. Retrieve Cohorts & Courses
        const { data: cs, error: csError } = await supabase.from("cohort_students").select("cohort_id").eq("student_id", user.id);
        if (csError) console.error("Supabase Error [cohort_students]:", csError.message, csError.details, csError.hint);
        const cohortIds = cs?.map((c) => c.cohort_id) || [];

        const { data: cm, error: cmError } = await supabase.from("cohort_modules").select("module_id, unlock_at").in("cohort_id", cohortIds.length ? cohortIds : ['00000000-0000-0000-0000-000000000000']);
        if (cmError) console.error("Supabase Error [cohort_modules]:", cmError.message, cmError.details, cmError.hint);
        const unlockedMods = cm || [];
        const unlockedModIds = new Set(unlockedMods.map((c) => c.module_id));

        const { data: dbCourses } = await supabase.from("courses").select("id, title, modules(id, title)").eq("is_active", true);
        const { data: prog } = await supabase.from("student_progress").select("module_id, completed").eq("student_id", user.id).eq("completed", true);
        const completedModIds = new Set(prog?.map((p) => p.module_id) || []);

        const courseList: any[] = [];
        dbCourses?.forEach((c: any) => {
          let doneMods = 0;
          let totalMods = 0;
          c.modules?.forEach((m: any) => {
            if (unlockedModIds.has(m.id)) {
              totalMods++;
              if (completedModIds.has(m.id)) doneMods++;
            }
          });
          if (totalMods > 0) {
            courseList.push({ id: c.id, title: c.title, progress: Math.round((doneMods / totalMods) * 100) });
          }
        });

        // 5. Query live pending assignments for student's cohorts
        const { data: ac, error: acError } = await supabase.from("assignment_cohorts").select("assignment_id").in("cohort_id", cohortIds.length ? cohortIds : ['00000000-0000-0000-0000-000000000000']);
        if (acError) console.error("Supabase Error [assignment_cohorts]:", acError.message, acError.details, acError.hint);
        const assignmentIds = ac?.map((item) => item.assignment_id) || [];

        const { data: dbAssignments, error: assignError } = await supabase
          .from("assignments")
          .select("id, title, due_date, status")
          .in("id", assignmentIds.length ? assignmentIds : ['00000000-0000-0000-0000-000000000000'])
          .in("status", ["published", "Published"]);
        if (assignError) console.error("Supabase Error [assignments]:", assignError.message, assignError.details, assignError.hint);

        const { data: subs } = await supabase.from("submissions").select("assignment_id").eq("student_id", user.id);
        const submittedIds = new Set(subs?.map((s) => s.assignment_id) || []);

        const pending: any[] = [];
        const now = new Date();

        dbAssignments?.forEach((a: any) => {
          if (!submittedIds.has(a.id)) {
            const dueDate = a.due_date ? new Date(a.due_date) : null;
            const overdue = dueDate ? now > dueDate : false;
            let dueLabel = "THIS WEEK";
            if (dueDate) {
              const diffTime = dueDate.getTime() - now.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              if (overdue) {
                dueLabel = "OVERDUE";
              } else if (diffDays <= 1) {
                dueLabel = "DUE TODAY";
              } else if (diffDays <= 7) {
                dueLabel = "THIS WEEK";
              } else {
                dueLabel = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
              }
            }
            pending.push({
              id: a.id,
              title: a.title,
              dueLabel,
              overdue,
            });
          }
        });

        // 6. Submissions with scores
        const { data: gradedSubs } = await supabase.from("submissions").select("id, grade, module_id").eq("student_id", user.id).not("grade", "is", null);
        const scores = gradedSubs?.map((s) => {
          let mTitle = "Module Assessment";
          dbCourses?.forEach((c: any) => {
            const m = c.modules?.find((mod: any) => mod.id === s.module_id);
            if (m) mTitle = m.title;
          });
          return { id: s.id, title: mTitle, score: s.grade || 0 };
        }) || [];

        if (!isMounted) return;
        setStreak(calculatedStreak);
        setActivity(newAct);
        setCourses(courseList.slice(0, 2));
        setPendingAssignments(pending.slice(0, 3)); // show top 3
        setRecentScores(scores.slice(0, 2)); // show top 2
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [user]);

  if (!navigator.onLine && (!courses || courses.length === 0)) {
    return <div className="p-8 text-center text-gray-500">You are offline. Please reconnect to view this content.</div>;
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin size-8" style={{ color: BLUE }} />
      </div>
    );
  }

  return (
    <div className="w-full px-4 md:px-8 lg:px-12 xl:px-16 py-6 h-[calc(100vh-80px)] flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[24px] font-bold" style={{ color: NAVY, letterSpacing: "-0.3px" }}>
            {greeting}, {firstName}!
          </h1>
        </div>
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex gap-4 items-start">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "#e7f0f7" }}>
            <Flame className="w-7 h-7" style={{ color: BLUE }} />
          </div>
          <div>
            <div className="text-[32px] font-bold leading-none" style={{ color: NAVY }}>{streak} Days</div>
            <div className="text-sm tracking-widest text-gray-400 mt-1 mb-3">LEARNING STREAK</div>
            <p className="text-sm text-gray-600 leading-relaxed max-w-xs">
              {streak < 3
                ? "Every step counts! Start a learning module today to build up your streak and master your safety skills."
                : "You're on a roll! Complete a module today to keep your streak alive and reach your monthly goal."}
            </p>
          </div>
        </div>

        <div className="md:border-l md:pl-6 border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: NAVY }}>Assignments to Finish</h3>
            <button onClick={() => onNavigate("assignments")} className="text-gray-400 hover:text-[#0D2543]"><ListChecks className="w-4 h-4" /></button>
          </div>
          <div className="space-y-2">
            {pendingAssignments.length === 0 && <div className="text-sm text-gray-400">All caught up!</div>}
            {pendingAssignments.map((a) => (
              <button
                key={a.id}
                onClick={() => onNavigate("assignments")}
                className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-lg px-4 py-3 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${a.overdue ? "bg-red-500" : ""}`} style={a.overdue ? {} : { backgroundColor: BLUE }} />
                  <span className="text-sm font-medium" style={{ color: NAVY }}>{a.title}</span>
                </div>
                <span className={`text-[16px] tracking-wider font-semibold px-2.5 py-1 rounded-md ${a.overdue ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-500"}`}>
                  {a.dueLabel}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex-1 min-h-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: NAVY }}>Continue Learning</h3>
              <div className="flex gap-1 text-gray-400">
                <button className="p-1 hover:text-[#0D2543]"><ChevronLeft className="w-4 h-4" /></button>
                <button className="p-1 hover:text-[#0D2543]"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 flex-1">
              {courses.length === 0 && <div className="text-sm text-gray-400 col-span-2 flex items-center justify-center h-full">No active courses</div>}
              {courses.map((c) => (
                <CourseCard key={c.id} icon={<Shield className="w-7 h-7 text-gray-400" />} title={c.title} progress={c.progress} onClick={() => onNavigate("courses")} />
              ))}
            </div>
          </div>

          <div className="md:border-l md:pl-6 border-gray-100 flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold" style={{ color: NAVY }}>Recent Scores</h3>
              <TrendingUp className="w-4 h-4 text-gray-400" />
            </div>
            {recentScores.length === 0 && <div className="text-sm text-gray-400 flex-1 flex items-center justify-center">No scores yet</div>}
            <div className="flex-1 flex flex-col justify-center gap-6">
              {recentScores.map((s) => (
                <div key={s.id} className="w-full">
                  <ScoreBar label={s.title} value={s.score} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold mb-3" style={{ color: NAVY }}>Learning Activity</h3>
        <div className="flex gap-1.5">
          <div className="flex flex-col text-[9px] text-gray-500 gap-[2px]" style={{ paddingTop: 16 }}>
            {days.map((d, i) => (
              <span key={i} className="h-[11px] leading-[11px]" style={{ visibility: i % 2 === 1 ? "visible" : "hidden" }}>{d}</span>
            ))}
          </div>
          <div className="flex-1 min-w-0 overflow-x-auto">
            <div className="flex justify-between text-[9px] text-gray-500 mb-1" style={{ minWidth: 572 }}>
              {monthLabels.map((m, i) => <span key={i}>{m[0] + m.slice(1).toLowerCase()}</span>)}
            </div>
            <div className="grid grid-rows-7 grid-flow-col gap-[2px]" style={{ minWidth: 572, gridTemplateColumns: 'repeat(52, 1fr)' }}>
              {activity.map((v, i) => (
                <span key={i} className="h-[11px] rounded-[2px]" style={v === 0 ? { backgroundColor: "#ebedf0" } : { backgroundColor: shades[v] }} />
              ))}
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <span>Less</span>
                {shades.map((s, i) => (
                  <span key={i} className="w-2.5 h-2.5 rounded-sm" style={i === 0 ? { backgroundColor: "#ebedf0" } : { backgroundColor: s }} />
                ))}
                <span>More</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CourseCard({ icon, title, progress, onClick }: { icon: React.ReactNode; title: string; progress: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left group flex flex-col h-full w-full">
      <div className="bg-gray-100 group-hover:bg-gray-200 transition-colors rounded-lg flex-1 flex items-center justify-center w-full mb-3 min-h-[100px]">{icon}</div>
      <div className="text-sm font-medium mb-2 leading-snug w-full" style={{ color: NAVY }}>{title}</div>
      <div className="flex items-center gap-2 w-full mt-auto">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full" style={{ width: `${progress}%`, backgroundColor: BLUE }} />
        </div>
        <span className="text-sm text-gray-400">{progress}%</span>
      </div>
    </button>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm" style={{ color: NAVY }}>{label}</span>
        <span className="text-sm font-semibold" style={{ color: BLUE }}>{value}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full" style={{ width: `${value}%`, backgroundColor: BLUE }} />
      </div>
    </div>
  );
}

