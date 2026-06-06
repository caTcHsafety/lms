import { Bell, HelpCircle, Mail, Phone, CheckCircle2, AlertTriangle, BookOpen, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { ProfileEditor } from "@/components/ProfileEditor";
import logo from "@/imports/image.png";
import { useAuth } from "@/app/auth/AuthContext";
import { supabase } from "@/lib/supabase";

export type View = "dashboard" | "courses" | "assignments";

interface TopBarProps {
  view: View;
  onChange: (v: View) => void;
}

interface Notification { id: string; icon: React.ReactNode; title: string; desc: string; time: string; unread: boolean; }

export function TopBar({ view, onChange }: TopBarProps) {
  const { user } = useAuth();
  const [fullName, setFullName] = useState<string>("");
  const displayName =
    fullName ||
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Student";
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [mentors, setMentors] = useState<any[]>([]);
  const [cohortNames, setCohortNames] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);

  useEffect(() => {
    if (!user || !user.id) return;
    let isMounted = true;

    const fetchNotifications = async () => {
      try {
        const { data: cohorts, error: cohortsError } = await supabase.from('cohort_students').select('cohort_id').eq('student_id', user.id);
        if (cohortsError) console.error("Supabase Error [cohort_students]:", cohortsError.message, cohortsError.details, cohortsError.hint);
        const cohortIds = cohorts?.map((c: any) => c.cohort_id) || [];

        let readIds: string[] = [];
        try {
          const readIdsStr = localStorage.getItem(`read_notification_ids_${user.id}`) || localStorage.getItem("read_notification_ids");
          if (readIdsStr) {
            readIds = JSON.parse(readIdsStr);
          }
        } catch (e) {
          console.error("Failed to parse read notification IDs", e);
        }
        let newNotifs: Notification[] = [];

        if (cohortIds.length > 0) {
          const { data: assignmentCohorts, error: acError } = await supabase.from('assignment_cohorts').select('assignment_id').in('cohort_id', cohortIds);
          if (acError) console.error("Supabase Error [assignment_cohorts]:", acError.message, acError.details, acError.hint);
          const assignIds = assignmentCohorts?.map((ac: any) => ac.assignment_id) || [];

          if (assignIds.length > 0) {
            const threeDaysFromNow = new Date();
            threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
            
            const { data: assignments, error: aError } = await supabase
              .from('assignments')
              .select('id, title, due_date')
              .in('id', assignIds)
              .lte('due_date', threeDaysFromNow.toISOString())
              .gte('due_date', new Date().toISOString());
            if (aError) console.error("Supabase Error [assignments]:", aError.message, aError.details, aError.hint);

            if (assignments && assignments.length > 0) {
              const { data: subs, error: subError } = await supabase.from('submissions').select('module_id').eq('student_id', user.id);
              if (subError) console.error("Supabase Error [submissions]:", subError.message, subError.details, subError.hint);
              const subIds = new Set(subs?.map((s: any) => s.module_id) || []);
              
              assignments.forEach((a: any) => {
                if (!subIds.has(a.id)) {
                  const nId = `asn_${a.id}`;
                  if (!readIds.includes(nId)) {
                    newNotifs.push({
                      id: nId,
                      icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
                      title: `${a.title} is due soon`,
                      desc: `Due ${new Date(a.due_date).toLocaleDateString()}`,
                      time: "recently",
                      unread: true
                    });
                  }
                }
              });
            }
          }
        }

        const { data: gradedSubs, error: gsError } = await supabase
          .from('submissions')
          .select('id, grade, submitted_at, status')
          .eq('student_id', user.id)
          .neq('status', 'pending')
          .order('submitted_at', { ascending: false })
          .limit(5);
        if (gsError) console.error("Supabase Error [submissions grades]:", gsError.message, gsError.details, gsError.hint);

        if (gradedSubs) {
          gradedSubs.forEach((s: any) => {
            const assignTitle = 'Assignment';
            const nId = `sub_${s.id}`;
            if (!readIds.includes(nId)) {
              newNotifs.push({
                id: nId,
                icon: <CheckCircle2 className="w-4 h-4 text-green-500" />,
                title: `${assignTitle} graded`,
                desc: `You scored ${s.grade || 0}/100`,
                time: new Date(s.submitted_at).toLocaleDateString(),
                unread: true
              });
            }
          });
        }

        if (cohortIds.length > 0) {
          const { data: recentModules, error: rmError } = await supabase
            .from('cohort_modules')
            .select('id, created_at, modules(title)')
            .in('cohort_id', cohortIds)
            .order('created_at', { ascending: false })
            .limit(5);
          if (rmError) console.error("Supabase Error [cohort_modules]:", rmError.message, rmError.details, rmError.hint);

          if (recentModules) {
            recentModules.forEach((rm: any) => {
              const modTitle = (rm.modules as any)?.title || 'Module';
              const nId = `mod_${rm.id}`;
              if (!readIds.includes(nId)) {
                newNotifs.push({
                  id: nId,
                  icon: <BookOpen className="w-4 h-4" style={{ color: "#4493BF" }} />,
                  title: `New lecture available`,
                  desc: modTitle,
                  time: new Date(rm.created_at).toLocaleDateString(),
                  unread: true
                });
              }
            });
          }
        }

        if (isMounted) setNotifs(newNotifs);
      } catch (e) {
        console.error("Notifications fetch error:", e);
      }
    };

    const fetchMentors = async () => {
      try {
        const { data: mData } = await supabase
          .from('mentorships')
          .select('mentor_id')
          .eq('student_id', user.id)
          .eq('active', true);
          
        if (mData && mData.length > 0 && mData[0].mentor_id) {
          const { data: pData } = await supabase
            .from('profiles')
            .select('id, full_name, email, role')
            .eq('id', mData[0].mentor_id);
            
          if (pData && pData.length > 0 && isMounted) {
            setMentors(pData);
          }
        }
      } catch (e) {
        console.error("Mentor fetch error:", e);
      }
    };

    const fetchProfile = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', user.id)
          .single();
        if (data?.full_name && isMounted) {
          setFullName(data.full_name);
        }
        if (data?.avatar_url && isMounted) {
          setAvatarUrl(data.avatar_url);
        }
      } catch (e) {
        console.error("Profile fetch error:", e);
      }
    };

    const fetchCohorts = async () => {
      try {
        const { data } = await supabase
          .from('cohort_students')
          .select('cohorts(name)')
          .eq('student_id', user.id);
        if (data && isMounted) {
          const names = data.map((row: any) => row.cohorts?.name).filter(Boolean);
          setCohortNames(names);
        }
      } catch (e) {
        console.error("Cohort fetch error:", e);
      }
    };

    fetchNotifications();
    fetchMentors();
    fetchProfile();
    fetchCohorts();

    return () => { isMounted = false; };
  }, [user]);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (profileRef.current && !profileRef.current.contains(t)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(t)) setNotifOpen(false);
      if (helpRef.current && !helpRef.current.contains(t)) setHelpOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unreadCount = notifs.filter((n) => n.unread).length;
  const tabs: { id: View; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "courses", label: "My Courses" },
    { id: "assignments", label: "Assignments" },
  ];

  const markAllRead = () => {
    try {
      const currentIds = notifs.map(n => n.id);
      const readIdsStr = localStorage.getItem(`read_notification_ids_${user?.id}`) || localStorage.getItem("read_notification_ids");
      const readIds: string[] = readIdsStr ? JSON.parse(readIdsStr) : [];
      const updatedReadIds = Array.from(new Set([...readIds, ...currentIds]));
      localStorage.setItem(`read_notification_ids_${user?.id}`, JSON.stringify(updatedReadIds));
    } catch (e) {
      console.error(e);
    }
    setNotifs([]);
  };

  const handleNotificationClick = (id: string) => {
    try {
      const readIdsStr = localStorage.getItem(`read_notification_ids_${user?.id}`) || localStorage.getItem("read_notification_ids");
      const readIds: string[] = readIdsStr ? JSON.parse(readIdsStr) : [];
      if (!readIds.includes(id)) {
        readIds.push(id);
        localStorage.setItem(`read_notification_ids_${user?.id}`, JSON.stringify(readIds));
      }
    } catch (e) {
      console.error(e);
    }
    setNotifs((ns) => ns.filter((n) => n.id !== id));
  };

  return (
    <>
    <div className="w-full bg-[#ebe9e1] border-b border-[#d6d3c7] relative z-30">
      <div className="h-14 px-4 md:px-8 lg:px-12 xl:px-16 flex items-center justify-between w-full">
        <button onClick={() => onChange("dashboard")} className="w-40 flex items-center hover:opacity-80">
          <img src={logo} alt="SafetyCatch" className="h-8 w-auto object-contain" />
        </button>

        <div className="bg-[#dcd9cb] rounded-full p-1 flex items-center">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`px-5 py-1.5 rounded-full text-[16px] transition-colors ${
                view === t.id ? "text-white shadow-sm font-medium" : "text-[#5a5a4a] hover:text-[#0D2543]"
              }`}
              style={view === t.id ? { backgroundColor: "#0D2543" } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-40 justify-end">
          <div ref={notifRef} className="relative">
            <button
              onClick={() => { setNotifOpen((v) => !v); setMenuOpen(false); setHelpOpen(false); }}
              className="relative p-1.5 rounded-md hover:bg-[#dcd9cb]"
              style={{ color: "#0D2543" }}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-40 overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                  <span className="text-sm font-semibold" style={{ color: "#0D2543" }}>Notifications</span>
                  <button onClick={markAllRead} className="text-sm" style={{ color: "#4493BF" }}>Mark all read</button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifs.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-500">
                      No notifications
                    </div>
                  ) : (
                    notifs.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleNotificationClick(n.id)}
                        className={`w-full text-left flex gap-3 px-4 py-3 hover:bg-gray-50 ${n.unread ? "bg-blue-50/30" : ""}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">{n.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium" style={{ color: "#0D2543" }}>{n.title}</div>
                          <div className="text-sm text-gray-500 mb-1">{n.desc}</div>
                          <div className="text-sm text-gray-400">{n.time}</div>
                        </div>
                        {n.unread && <span className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: "#4493BF" }} />}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div ref={helpRef} className="relative">
            <button
              onClick={() => { setHelpOpen((v) => !v); setMenuOpen(false); setNotifOpen(false); }}
              className="p-1.5 rounded-md hover:bg-[#dcd9cb]"
              style={{ color: "#0D2543" }}
              aria-label="Help"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            {helpOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-40">
                <button className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-gray-50" style={{ color: "#0D2543" }}>Help Center</button>
                <button className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-gray-50" style={{ color: "#0D2543" }}>Contact Support</button>
                <button className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-gray-50" style={{ color: "#0D2543" }}>Keyboard Shortcuts</button>
              </div>
            )}
          </div>

          <div ref={profileRef} className="relative">
            <button
              onClick={() => { setMenuOpen((v) => !v); setNotifOpen(false); setHelpOpen(false); }}
              className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-transparent hover:ring-[#0D2543]/30"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#0d2543] text-white flex items-center justify-center text-xs font-semibold">
                  {displayName.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2)}
                </div>
              )}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 p-5 z-40">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full overflow-hidden mb-2">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#0d2543] text-white flex items-center justify-center text-xl font-semibold">
                        {displayName.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-semibold" style={{ color: "#0D2543" }}>{displayName}</div>
                  <div className="text-sm text-gray-500">{cohortNames.length > 0 ? cohortNames.join(", ") : "Student"}</div>
                  <button
                    onClick={() => { setMenuOpen(false); setProfileEditorOpen(true); }}
                    className="mt-2 text-xs text-[#4493BF] hover:underline flex items-center gap-1"
                  >
                    <Pencil className="w-3 h-3" /> Edit Profile
                  </button>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="text-xs tracking-wider text-gray-400 uppercase mb-2">Your Mentor</div>
                  {mentors && mentors.length > 0 ? (
                    mentors.map((mentorItem) => (
                        <div key={mentorItem.id} className="mb-3 last:mb-0">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ backgroundColor: "#e7f0f7", color: "#4493BF" }}>
                              {mentorItem.full_name?.[0] || 'M'}
                            </div>
                            <div className="text-sm font-medium" style={{ color: "#0D2543" }}>{mentorItem.full_name}</div>
                          </div>
                          {mentorItem.email && (
                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                              <Mail className="w-3 h-3" /> {mentorItem.email}
                            </div>
                          )}
                        </div>
                    ))
                  ) : (
                    <div className="p-4 text-sm text-center text-gray-500 bg-gray-50 rounded-lg">
                        No mentor assigned
                    </div>
                  )}
                </div>
                <button
                  onClick={async () => {
                    setMenuOpen(false);
                    await supabase.auth.signOut();
                  }}
                  className="w-full mt-4 pt-3 border-t border-gray-100 text-sm text-red-500 hover:text-red-600"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    <ProfileEditor
      open={profileEditorOpen}
      onClose={() => setProfileEditorOpen(false)}
      currentName={fullName || displayName}
      currentAvatarUrl={avatarUrl}
      onSaved={(newName, newAvatar) => {
        setFullName(newName);
        setAvatarUrl(newAvatar);
      }}
    />
    </>
  );
}
