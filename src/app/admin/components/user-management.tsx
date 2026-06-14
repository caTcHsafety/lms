import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import {
  Search,
  Plus,
  UserPlus,
  MoreHorizontal,
  ChevronRight,
  Mail,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  Users,
  Inbox,
  X,
  Download,
  ChevronDown,
  Copy,
} from "lucide-react";

type Role = "Senior Trainer" | "Lead Mentor" | "Trainer" | "Mentor";
type MentorStatus = "Active" | "On Leave" | "At Capacity";
type StudentStatus = "Unassigned" | "Active" | "Pending Onboarding";

type Mentor = {
  id: string;
  name: string;
  role: Role;
  email: string;
  capacity: number;
  status: MentorStatus;
  studentIds: string[];
  lastActive: string;
};

type Student = {
  id: string;
  name: string;
  email: string;
  cohorts: string[];
  enrolled: string;
  status: StudentStatus;
  mentorId?: string;
};

const INITIAL_STUDENTS: Student[] = [
  { id: "s1", name: "Alex Johnson", email: "alex.j@northwind.io", cohorts: ["Cyber-2026-Q2"], enrolled: "2026-05-21", status: "Unassigned" },
  { id: "s2", name: "Maria Garcia", email: "m.garcia@northwind.io", cohorts: ["Cyber-2026-Q2", "OSHA-2026-Q2"], enrolled: "2026-05-21", status: "Unassigned" },
  { id: "s3", name: "David Chen", email: "d.chen@northwind.io", cohorts: ["OSHA-2026-Q2"], enrolled: "2026-05-20", status: "Unassigned" },
  { id: "s4", name: "Sarah Williams", email: "s.williams@northwind.io", cohorts: ["Cyber-2026-Q2"], enrolled: "2026-05-20", status: "Unassigned" },
  { id: "s5", name: "Jamal Robinson", email: "j.robinson@northwind.io", cohorts: ["Fire-2026-Q2"], enrolled: "2026-05-19", status: "Unassigned" },
  { id: "s6", name: "Aisha Patel", email: "a.patel@northwind.io", cohorts: ["OSHA-2026-Q2", "Fire-2026-Q2"], enrolled: "2026-05-19", status: "Unassigned" },
  { id: "s7", name: "Liam O'Connor", email: "l.oconnor@northwind.io", cohorts: ["Cyber-2026-Q2"], enrolled: "2026-05-18", status: "Pending Onboarding" },
  { id: "s8", name: "Yuki Tanaka", email: "y.tanaka@northwind.io", cohorts: ["Electrical-2026"], enrolled: "2026-05-18", status: "Unassigned" },
  { id: "s9", name: "Nora Ahmed", email: "n.ahmed@northwind.io", cohorts: ["Fire-2026-Q2"], enrolled: "2026-05-17", status: "Unassigned" },
  { id: "s10", name: "Diego Morales", email: "d.morales@northwind.io", cohorts: ["Cyber-2026-Q2"], enrolled: "2026-05-17", status: "Unassigned" },
  { id: "s11", name: "Hannah Lee", email: "h.lee@northwind.io", cohorts: ["OSHA-2026-Q2"], enrolled: "2026-05-16", status: "Unassigned" },
  { id: "s12", name: "Marcus Bell", email: "m.bell@northwind.io", cohorts: ["Electrical-2026"], enrolled: "2026-05-15", status: "Pending Onboarding" },
  { id: "s13", name: "Priya Iyer", email: "p.iyer@northwind.io", cohorts: ["Cyber-2026-Q2"], enrolled: "2026-05-14", status: "Active", mentorId: "u1" },
  { id: "s14", name: "Tomás Vela", email: "t.vela@northwind.io", cohorts: ["Cyber-2026-Q2"], enrolled: "2026-05-13", status: "Active", mentorId: "u1" },
  { id: "s15", name: "Kelsey Howard", email: "k.howard@northwind.io", cohorts: ["OSHA-2026-Q2"], enrolled: "2026-05-12", status: "Active", mentorId: "u2" },
  { id: "s16", name: "Reginald Adebayo", email: "r.adebayo@northwind.io", cohorts: ["Fire-2026-Q2"], enrolled: "2026-05-11", status: "Active", mentorId: "u4" },
  { id: "s17", name: "Mei Lin", email: "m.lin@northwind.io", cohorts: ["Cyber-2026-Q2"], enrolled: "2026-05-10", status: "Active", mentorId: "u3" },
  { id: "s18", name: "Ava Brooks", email: "a.brooks@northwind.io", cohorts: ["Electrical-2026"], enrolled: "2026-05-10", status: "Active", mentorId: "u5" },
  { id: "s19", name: "Owen Schultz", email: "o.schultz@northwind.io", cohorts: ["OSHA-2026-Q2"], enrolled: "2026-05-09", status: "Active", mentorId: "u2" },
  { id: "s20", name: "Fatima Nasser", email: "f.nasser@northwind.io", cohorts: ["Cyber-2026-Q2"], enrolled: "2026-05-08", status: "Active", mentorId: "u1" },
];

const INITIAL_MENTORS: Mentor[] = [
  { id: "u1", name: "John Doe", role: "Senior Trainer", email: "john.doe@safetycatch.com", capacity: 20, status: "Active", studentIds: ["s13", "s14", "s20"], lastActive: "2026-05-23" },
  { id: "u2", name: "Sarah Smith", role: "Lead Mentor", email: "sarah.smith@safetycatch.com", capacity: 12, status: "Active", studentIds: ["s15", "s19"], lastActive: "2026-05-22" },
  { id: "u3", name: "Michael Brown", role: "Trainer", email: "michael.b@safetycatch.com", capacity: 25, status: "At Capacity", studentIds: Array.from({ length: 25 }).map((_, i) => `x${i}`), lastActive: "2026-05-22" },
  { id: "u4", name: "Linda Park", role: "Mentor", email: "linda.park@safetycatch.com", capacity: 15, status: "Active", studentIds: ["s16"], lastActive: "2026-05-21" },
  { id: "u5", name: "Devon Wright", role: "Trainer", email: "devon.w@safetycatch.com", capacity: 20, status: "Active", studentIds: ["s18"], lastActive: "2026-05-20" },
  { id: "u6", name: "Priya Singh", role: "Mentor", email: "priya.singh@safetycatch.com", capacity: 15, status: "On Leave", studentIds: [], lastActive: "2026-05-12" },
  { id: "u7", name: "Carlos Rivera", role: "Trainer", email: "carlos.r@safetycatch.com", capacity: 20, status: "Active", studentIds: Array.from({ length: 11 }).map((_, i) => `y${i}`), lastActive: "2026-05-22" },
  { id: "u8", name: "Emily Chen", role: "Lead Mentor", email: "emily.chen@safetycatch.com", capacity: 12, status: "Active", studentIds: Array.from({ length: 6 }).map((_, i) => `z${i}`), lastActive: "2026-05-23" },
];

const STATUS_META: Record<MentorStatus, { dot: string; text: string }> = {
  Active: { dot: "bg-[#1E5631]", text: "text-[#1E5631]" },
  "On Leave": { dot: "bg-[#74777E]", text: "text-[#44474e]" },
  "At Capacity": { dot: "bg-[#c0392b]", text: "text-[#c0392b]" },
};

const INITIAL_COHORTS = Array.from(new Set(INITIAL_STUDENTS.flatMap((s) => s.cohorts)));

type Scope = "unassigned" | { mentorId: string };

export function UserManagementRedesigned() {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [cohortsList, setCohortsList] = useState<{ id: string; name: string }[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      // 1. Fetch cohorts
      const { data: cohortsData, error: cohortsError } = await supabase
        .from("cohorts")
        .select("id, name");
      if (cohortsError) throw cohortsError;
      setCohortsList(cohortsData || []);

      // 2. Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*");
      if (profilesError) throw profilesError;

      // 3. Fetch mentorships
      const { data: mentorshipsData, error: mentorshipsError } = await supabase
        .from("mentorships")
        .select("*");
      if (mentorshipsError) throw mentorshipsError;

      // 4. Fetch cohort students
      const { data: cohortStudentsData, error: cohortStudentsError } = await supabase
        .from("cohort_students")
        .select("*");
      if (cohortStudentsError) throw cohortStudentsError;

      // 5. Fetch mentor settings
      const { data: mentorSettingsData, error: mentorSettingsError } = await supabase
        .from("mentor_settings")
        .select("*");
      if (mentorSettingsError) throw mentorSettingsError;

      // 6. Fetch module trainers & modules
      const { data: moduleTrainersData, error: moduleTrainersError } = await supabase
        .from("module_trainers")
        .select("module_id, trainer_id, trainer_name");
      if (moduleTrainersError) throw moduleTrainersError;

      const { data: modulesData, error: modulesError } = await supabase
        .from("modules")
        .select("id, title");
      if (modulesError) throw modulesError;

      // Map Mentors
      const mentorProfiles = (profilesData || []).filter(p => p.role === "mentor");
      const mappedMentors: Mentor[] = mentorProfiles.map(p => {
        const settings = (mentorSettingsData || []).find(s => s.mentor_id === p.id);
        const capacity = settings?.max_capacity ?? 15;
        const studentIds = (mentorshipsData || [])
          .filter(m => m.mentor_id === p.id && m.active)
          .map(m => m.student_id);
        return {
          id: p.id,
          name: p.full_name || "",
          role: "Mentor",
          email: p.email || "",
          capacity,
          status: studentIds.length >= capacity ? "At Capacity" : "Active",
          studentIds,
          lastActive: p.created_at || new Date().toISOString()
        };
      });
      setMentors(mappedMentors);

      // Map Students
      const studentProfiles = (profilesData || []).filter(p => p.role === "student");
      const mappedStudents: Student[] = studentProfiles.map(p => {
        const studentCohortIds = (cohortStudentsData || [])
          .filter(cs => cs.student_id === p.id)
          .map(cs => cs.cohort_id);
        const studentCohorts = studentCohortIds
          .map(cid => (cohortsData || []).find(c => c.id === cid)?.name)
          .filter(Boolean) as string[];

        const mentorship = (mentorshipsData || []).find(m => m.student_id === p.id && m.active);

        return {
          id: p.id,
          name: p.full_name || "",
          email: p.email || "",
          cohorts: studentCohorts,
          enrolled: p.created_at ? p.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
          status: mentorship ? "Active" : p.must_reset_pw ? "Pending Onboarding" : "Unassigned",
          mentorId: mentorship?.mentor_id || undefined
        };
      });
      setStudents(mappedStudents);

      // Map Trainers
      const trainerProfiles = (profilesData || []).filter(p => p.role === "trainer");
      const mappedTrainers: Trainer[] = trainerProfiles.map(p => {
        const trainerModules = (moduleTrainersData || [])
          .filter(mt => mt.trainer_id === p.id)
          .map(mt => (modulesData || []).find(m => m.id === mt.module_id)?.title)
          .filter(Boolean) as string[];

        return {
          id: p.id,
          name: p.full_name || "",
          email: p.email || "",
          createdAt: p.created_at ? p.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
          assignedContent: trainerModules
        };
      });
      setTrainers(mappedTrainers);

    } catch (err: any) {
      console.error("Error loading user management data:", err);
      toast.error("Failed to load user management data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const cohortOptions = useMemo(
    () => cohortsList.map((c) => c.name),
    [cohortsList],
  );
  const [scope, setScope] = useState<Scope>("unassigned");
  const [mentorSearch, setMentorSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [cohortFilter, setCohortFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | StudentStatus>("all");
  const [sortBy, setSortBy] = useState<"enrolled" | "name" | "cohort">("enrolled");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignMentorId, setAssignMentorId] = useState<string>("");

  const isUnassigned = scope === "unassigned";
  const currentMentor = !isUnassigned ? mentors.find((m) => m.id === scope.mentorId) : undefined;

  const filteredMentors = useMemo(() => {
    const q = mentorSearch.toLowerCase();
    return mentors.filter(
      (m) => !q || m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [mentorSearch, mentors]);

  const allStudentsScope = useMemo(() => {
    if (isUnassigned) return students.filter((s) => !s.mentorId);
    return students.filter((s) => s.mentorId === scope.mentorId);
  }, [scope, isUnassigned, students]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.toLowerCase();
    return allStudentsScope
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
      .filter((s) => cohortFilter === "all" || s.cohorts.includes(cohortFilter))
      .filter((s) => statusFilter === "all" || s.status === statusFilter)
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "cohort") return (a.cohorts[0] ?? "").localeCompare(b.cohorts[0] ?? "");
        return b.enrolled.localeCompare(a.enrolled);
      });
  }, [allStudentsScope, studentSearch, cohortFilter, statusFilter, sortBy]);

  const toggleSelected = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (selected.size === filteredStudents.length) setSelected(new Set());
    else setSelected(new Set(filteredStudents.map((s) => s.id)));
  };
  const clearSelection = () => setSelected(new Set());

  const totals = {
    mentors: mentors.length,
    active: mentors.filter((m) => m.status === "Active").length,
    unassigned: students.filter((s) => !s.mentorId).length,
    students: students.length,
  };

  const [tab, setTab] = useState<"mentors" | "trainers">("mentors");

  // Add Mentor dialog
  const [mentorOpen, setMentorOpen] = useState(false);
  const [mName, setMName] = useState("");
  const [mEmail, setMEmail] = useState("");
  const [mCapacity, setMCapacity] = useState<string>("15");
  const mValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mEmail);
  const mCanSubmit = mName.trim().length > 0 && mValidEmail && Number(mCapacity) > 0;
  const openAddMentor = () => { setMName(""); setMEmail(""); setMCapacity("15"); setMentorOpen(true); };
  const submitMentor = async () => {
    if (!mCanSubmit || loading) return;
    const password = generatePassword();
    const email = mEmail.trim().toLowerCase();
    const name = mName.trim();
    const capacity = Number(mCapacity);

    try {
      setLoading(true);
      console.log("[DEBUG submitMentor] Starting mentor signup for:", email);
      const secondaryClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      );

      const { data: authData, error: authError } = await secondaryClient.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error("No user ID returned");

      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        email,
        full_name: name,
        role: "mentor",
        temp_password: password,
        must_reset_pw: true,
      });

      if (profileError) throw profileError;

      const { error: settingsError } = await supabase.from("mentor_settings").insert({
        mentor_id: userId,
        max_capacity: capacity,
        current_load: 0,
      });

      if (settingsError) throw settingsError;

      setMentorOpen(false);
      try {
        await navigator.clipboard.writeText(`Name: ${name}\nEmail: ${email}\nTemporary password: ${password}`);
        toast.success(`Mentor created! Temporary password copied to clipboard.`);
      } catch {
        toast.success(`Mentor created! Temporary password: ${password}`, { duration: 10000 });
      }
      loadData();
    } catch (err: any) {
      console.error("Error creating mentor:", err);
      toast.error("Failed to create mentor: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Add Student dialog (only from Unassigned)
  const [studentOpen, setStudentOpen] = useState(false);
  const [sName, setSName] = useState("");
  const [sEmail, setSEmail] = useState("");
  const [sDob, setSDob] = useState("");
  const [sCohorts, setSCohorts] = useState<string[]>([]);
  const [sCred, setSCred] = useState<{ name: string; email: string; cohorts: string[]; password: string } | null>(null);
  const [sCopied, setSCopied] = useState(false);
  const sValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sEmail);
  const sCanSubmit = sName.trim().length > 0 && sValidEmail && sCohorts.length > 0;
  const openAddStudent = () => { setSName(""); setSEmail(""); setSDob(""); setSCohorts([]); setStudentOpen(true); };
  const toggleSCohort = (c: string) =>
    setSCohorts((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  const submitStudent = async () => {
    if (!sCanSubmit || loading) return;
    const password = generatePassword();
    const email = sEmail.trim().toLowerCase();
    const name = sName.trim();

    try {
      setLoading(true);
      console.log("[DEBUG submitStudent] Starting student signup for:", email);
      const secondaryClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      );

      const { data: authData, error: authError } = await secondaryClient.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error("No user ID returned");

      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        email,
        full_name: name,
        role: "student",
        temp_password: password,
        must_reset_pw: true,
        ...(sDob ? { date_of_birth: sDob } : {}),
      });

      if (profileError) throw profileError;

      // Assign cohorts
      for (const cohortName of sCohorts) {
        const cohortId = cohortsList.find((c) => c.name === cohortName)?.id;
        if (cohortId) {
          const { error: csError } = await supabase.from("cohort_students").insert({
            cohort_id: cohortId,
            student_id: userId,
          });
          if (csError) console.error("Error inserting cohort_student:", csError);
        }
      }

      setStudentOpen(false);
      setSCred({ name, email, cohorts: [...sCohorts], password });
      setSCopied(false);
      try {
        await navigator.clipboard.writeText(`Name: ${name}\nEmail: ${email}\nCohorts: ${sCohorts.join(", ")}\nTemporary password: ${password}`);
        toast.success("Student created! Credentials copied to clipboard.");
      } catch {
        toast.success(`Student created! Temporary password: ${password}`, { duration: 10000 });
      }
      loadData();
    } catch (err: any) {
      console.error("Error creating student:", err);
      toast.error("Failed to create student: " + err.message);
    } finally {
      setLoading(false);
    }
  };
  const copyStudentCred = async () => {
    if (!sCred) return;
    const block = `Name: ${sCred.name}\nEmail: ${sCred.email}\nCohorts: ${sCred.cohorts.join(", ")}\nTemporary password: ${sCred.password}`;
    try {
      await navigator.clipboard.writeText(block);
      setSCopied(true);
      toast.success("Password copied to clipboard");
      setTimeout(() => setSCopied(false), 2000);
    } catch {
      setSCopied(false);
      toast.error("Failed to copy password");
    }
  };

  // Edit student cohorts dialog (opened by clicking a student row)
  const [editStudentId, setEditStudentId] = useState<string | null>(null);
  const [editCohorts, setEditCohorts] = useState<string[]>([]);
  const openEditStudent = (s: Student) => {
    setEditStudentId(s.id);
    setEditCohorts([...s.cohorts]);
  };
  const toggleEditCohort = (c: string) =>
    setEditCohorts((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  const saveEditCohorts = async () => {
    if (!editStudentId) return;
    try {
      setLoading(true);
      // Delete old cohorts
      const { error: deleteError } = await supabase
        .from("cohort_students")
        .delete()
        .eq("student_id", editStudentId);
      if (deleteError) throw deleteError;

      // Insert new cohorts
      for (const cohortName of editCohorts) {
        const cohortId = cohortsList.find((c) => c.name === cohortName)?.id;
        if (cohortId) {
          const { error: insertError } = await supabase
            .from("cohort_students")
            .insert({
              cohort_id: cohortId,
              student_id: editStudentId,
            });
          if (insertError) throw insertError;
        }
      }

      setEditStudentId(null);
      toast.success("Successfully updated student cohorts!");
      loadData();
    } catch (err: any) {
      console.error("Error updating cohorts:", err);
      toast.error("Failed to update cohorts: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteStudent = async (studentId: string) => {
    if (!confirm("Are you sure you want to delete this student profile?")) return;
    try {
      setLoading(true);
      await supabase.from("mentorships").delete().eq("student_id", studentId);
      await supabase.from("cohort_students").delete().eq("student_id", studentId);
      const { error } = await supabase.from("profiles").delete().eq("id", studentId);
      if (error) throw error;
      toast.success("Student profile deleted successfully");
      clearSelection();
      loadData();
    } catch (err: any) {
      console.error("Error deleting student:", err);
      toast.error("Failed to delete student: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteMentor = async (mentorId: string) => {
    if (!confirm("Are you sure you want to delete this mentor profile? All assigned students will become unassigned.")) return;
    try {
      setLoading(true);
      await supabase.from("mentorships").delete().eq("mentor_id", mentorId);
      await supabase.from("mentor_settings").delete().eq("mentor_id", mentorId);
      const { error } = await supabase.from("profiles").delete().eq("id", mentorId);
      if (error) throw error;
      toast.success("Mentor profile deleted successfully");
      setScope("unassigned");
      loadData();
    } catch (err: any) {
      console.error("Error deleting mentor:", err);
      toast.error("Failed to delete mentor: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const editingStudent = editStudentId ? students.find((s) => s.id === editStudentId) : null;

  if (tab === "trainers") {
    return (
      <div className="-mx-10 -my-10 h-[calc(100vh-64px)] bg-[#F1F4F8] flex flex-col overflow-hidden">
        <UmTabBar tab={tab} setTab={setTab} />
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <TrainersPanel
            trainers={trainers}
            setTrainers={setTrainers}
            onRefresh={loadData}
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)] bg-[#F1F4F8]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 rounded-full border-4 border-[#0d2543]/20 border-t-[#0d2543] animate-spin" />
          <p className="font-['Inter'] font-semibold text-sm text-[#0d2543]">Syncing with Supabase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-10 -my-10 h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      <UmTabBar tab={tab} setTab={setTab} />
      <div className="flex-1 flex min-h-0">
      {/* ── Master: mentor list ───────────────────────────────── */}
      <aside className="w-[340px] shrink-0 border-r border-[#e2e2e4] bg-white flex flex-col min-h-0">
        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-[#e2e2e4]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-['Inter'] font-semibold text-[#0d2543]" style={{ fontSize: 16 }}>People</h2>
              <p className="font-['Inter'] text-xs text-[#74777E] mt-0.5">
                {totals.mentors} mentors · {totals.students} students
              </p>
            </div>
            <button
              onClick={openAddMentor}
              aria-label="Invite mentor"
              title="Invite mentor"
              className="size-8 rounded-md flex items-center justify-center text-[#0d2543] hover:bg-[#f3f3f5] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf]"
            >
              <UserPlus className="size-4" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#74777E]" />
            <input
              value={mentorSearch}
              onChange={(e) => setMentorSearch(e.target.value)}
              placeholder="Search mentors…"
              className="w-full bg-[#f3f3f5] border border-transparent rounded-md pl-8 pr-3 py-1.5 font-['Inter'] text-sm text-[#1a1c1d] placeholder-[#74777E] focus:bg-white focus:border-[#4493bf] focus:ring-2 focus:ring-[#4493bf] outline-none transition-all duration-150"
            />
          </div>
        </div>

        {/* Scope: Unassigned shortcut */}
        <button
          onClick={() => { setScope("unassigned"); clearSelection(); }}
          className={`w-full flex items-center gap-2.5 px-4 py-2.5 border-b border-[#e2e2e4] text-left focus:outline-none transition-colors duration-150 ${
            isUnassigned ? "bg-[#eaf3f9] border-l-2 border-l-[#00658d]" : "hover:bg-[#fafafb]"
          }`}
        >
          <span className="size-7 rounded-md bg-[#fff3d6] text-[#7a5a00] flex items-center justify-center shrink-0">
            <Inbox className="size-3.5" />
          </span>
          <div className="flex-1 min-w-0">
            <div className={`font-['Inter'] text-[13px] truncate ${isUnassigned ? "font-semibold text-[#0d2543]" : "font-medium text-[#1a1c1d]"}`}>Unassigned students</div>
            <div className="font-['Inter'] text-[11px] text-[#74777E]">Needs assignment</div>
          </div>
          <span className="font-['Inter'] font-semibold text-[11px] text-[#7a5a00] bg-[#fff3d6] px-1.5 py-0.5 rounded">{totals.unassigned}</span>
        </button>

        <div className="px-4 pt-3 pb-1 font-['Inter'] font-semibold text-[10px] text-[#74777E] uppercase tracking-[0.6px]">
          Mentors
        </div>

        <div className="flex-1 overflow-auto [scrollbar-width:thin] [scrollbar-color:#c4c6ce_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#c4c6ce] [&::-webkit-scrollbar-thumb]:rounded-full">
          {filteredMentors.length === 0 && (
            <div className="text-center py-12 px-4 font-['Inter'] text-sm text-[#74777E]">No mentors match.</div>
          )}
          {filteredMentors.map((m) => {
            const isActive = !isUnassigned && scope.mentorId === m.id;
            const assigned = m.studentIds.length;
            const pct = Math.min(100, Math.round((assigned / m.capacity) * 100));
            const initials = m.name.split(" ").map((p) => p[0]).join("").slice(0, 2);
            return (
              <button
                key={m.id}
                onClick={() => { setScope({ mentorId: m.id }); clearSelection(); }}
                className={`w-full grid grid-cols-[auto_1fr_auto] gap-2.5 items-center px-4 py-2 border-b border-[#f6f6f7] text-left focus:outline-none transition-colors duration-150 ${
                  isActive ? "bg-[#eaf3f9] border-l-2 border-l-[#00658d] pl-[14px]" : "hover:bg-[#fafafb]"
                }`}
              >
                <span className="size-7 rounded-full bg-[#dff0fa] text-[#00587c] flex items-center justify-center font-['Inter'] font-semibold text-[11px] shrink-0">
                  {initials}
                </span>
                <div className="min-w-0">
                  <div className={`font-['Inter'] text-[13px] truncate ${isActive ? "font-semibold text-[#0d2543]" : "font-medium text-[#1a1c1d]"}`}>{m.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-['Inter'] text-[11px] text-[#74777E] truncate">{m.role}</span>
                    <span className={`size-1 rounded-full ${STATUS_META[m.status].dot}`} />
                    <span className={`font-['Inter'] text-[11px] ${STATUS_META[m.status].text} truncate`}>{m.status}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="h-1 flex-1 bg-[#f0f0f2] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${pct >= 100 ? "bg-[#c0392b]" : pct >= 80 ? "bg-[#e6a700]" : "bg-[#00658d]"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-['Inter'] text-[10px] text-[#74777E] tabular-nums shrink-0">{assigned}/{m.capacity}</span>
                  </div>
                </div>
                <ChevronRight className={`size-3.5 text-[#c4c6ce] shrink-0 transition-transform duration-150 ${isActive ? "text-[#00658d]" : ""}`} />
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Detail: students panel ───────────────────────────── */}
      <main className="flex-1 min-w-0 min-h-0 bg-[#fafafb] flex flex-col">
        {/* Detail header */}
        <div className="px-8 py-4 border-b border-[#e2e2e4] bg-white">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {isUnassigned ? (
                <>
                  <h1 className="font-['Inter'] font-semibold text-[#0d2543]" style={{ fontSize: 20 }}>Unassigned students</h1>
                  <p className="font-['Inter'] text-[13px] text-[#74777E] mt-0.5">
                    {totals.unassigned} students awaiting a mentor · select rows and assign in bulk
                  </p>
                </>
              ) : currentMentor && (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="size-9 rounded-full bg-[#dff0fa] text-[#00587c] flex items-center justify-center font-['Inter'] font-semibold text-[13px]">
                      {currentMentor.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                    </span>
                    <div>
                      <h1 className="font-['Inter'] font-semibold text-[#0d2543]" style={{ fontSize: 18 }}>{currentMentor.name}</h1>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-['Inter'] text-[12px] text-[#74777E]">{currentMentor.role}</span>
                        <span className="font-['Inter'] text-[12px] text-[#c4c6ce]">·</span>
                        <a href={`mailto:${currentMentor.email}`} className="font-['Inter'] text-[12px] text-[#00658d] hover:underline">{currentMentor.email}</a>
                        <span className="font-['Inter'] text-[12px] text-[#c4c6ce]">·</span>
                        <span className={`font-['Inter'] text-[12px] flex items-center gap-1 ${STATUS_META[currentMentor.status].text}`}>
                          <span className={`size-1.5 rounded-full ${STATUS_META[currentMentor.status].dot}`} />
                          {currentMentor.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!isUnassigned && currentMentor && (
                <>
                  <div className="px-3 py-1 bg-[#f3f3f5] rounded-md mr-2">
                    <span className="font-['Inter'] text-[11px] text-[#74777E]">Capacity </span>
                    <span className="font-['Inter'] font-semibold text-[13px] text-[#0d2543] tabular-nums">{currentMentor.studentIds.length}/{currentMentor.capacity}</span>
                  </div>
                  <button
                    onClick={() => deleteMentor(currentMentor.id)}
                    className="bg-[#c0392b] hover:bg-[#a93226] text-white px-3 py-1.5 rounded-md font-['Inter'] font-semibold text-[13px] mr-2 transition-colors duration-200"
                  >
                    Delete Mentor
                  </button>
                </>
              )}
              <IconBtn icon={<Download className="size-4" />} label="Export" />
              <IconBtn icon={<MoreHorizontal className="size-4" />} label="More" />
              {isUnassigned && (
                <button
                  onClick={openAddStudent}
                  className="ml-1 bg-[#0d2543] hover:bg-[#0a1d33] active:bg-[#071628] text-white px-3.5 py-1.5 rounded-md font-['Inter'] font-semibold text-[13px] flex items-center gap-1.5 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0d2543] focus:ring-offset-2"
                >
                  <Plus className="size-3.5" />
                  Add student
                </button>
              )}
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-1.5 mt-4">
            <div className="relative flex-1 max-w-[360px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#74777E]" />
              <input
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search students…"
                className="w-full bg-[#f3f3f5] border border-transparent rounded-md pl-8 pr-3 py-1.5 font-['Inter'] text-sm text-[#1a1c1d] placeholder-[#74777E] focus:bg-white focus:border-[#4493bf] focus:ring-2 focus:ring-[#4493bf] outline-none transition-all duration-150"
              />
            </div>
            <ToolbarSelect
              icon={<Filter className="size-3.5" />}
              value={cohortFilter}
              onChange={setCohortFilter}
              options={[{ value: "all", label: "All cohorts" }, ...cohortOptions.map((c) => ({ value: c, label: c }))]}
            />
            <ToolbarSelect
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as "all" | StudentStatus)}
              options={[
                { value: "all", label: "All status" },
                { value: "Unassigned", label: "Unassigned" },
                { value: "Active", label: "Active" },
                { value: "Pending Onboarding", label: "Pending" },
              ]}
            />
            <ToolbarSelect
              icon={<ArrowUpDown className="size-3.5" />}
              value={sortBy}
              onChange={(v) => setSortBy(v as "enrolled" | "name" | "cohort")}
              options={[
                { value: "enrolled", label: "Recent" },
                { value: "name", label: "Name A–Z" },
                { value: "cohort", label: "Cohort" },
              ]}
            />
            {(cohortFilter !== "all" || statusFilter !== "all" || studentSearch) && (
              <button
                onClick={() => { setCohortFilter("all"); setStatusFilter("all"); setStudentSearch(""); }}
                className="ml-1 font-['Inter'] text-[12px] text-[#00658d] hover:text-[#004d6b] hover:underline transition-colors duration-150 focus:outline-none focus:underline"
              >
                Reset
              </button>
            )}
            <span className="ml-auto font-['Inter'] text-[12px] text-[#74777E]">
              {filteredStudents.length} of {allStudentsScope.length}
            </span>
          </div>
        </div>

        {/* Bulk action bar — visible only when rows selected */}
        {selected.size > 0 && (
          <div className="px-8 py-2.5 bg-[#eaf3f9] border-b border-[#c5dde9] flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
            <CheckCircle2 className="size-4 text-[#00658d]" />
            <span className="font-['Inter'] font-semibold text-[13px] text-[#0d2543]">
              {selected.size} selected
            </span>
            <div className="h-4 w-px bg-[#c5dde9]" />
            <div className="flex items-center gap-1.5">
              <label className="font-['Inter'] text-[12px] text-[#44474e]">Assign to</label>
              <div className="relative">
                <select
                  value={assignMentorId}
                  onChange={(e) => setAssignMentorId(e.target.value)}
                  className="appearance-none bg-white border border-[#c4c6ce] rounded-md pl-2.5 pr-7 py-1 font-['Inter'] text-[12px] text-[#1a1c1d] cursor-pointer hover:bg-[#fafafa] focus:border-[#4493bf] focus:ring-1 focus:ring-[#4493bf] outline-none transition-all duration-150 min-w-[160px]"
                >
                  <option value="">Pick mentor…</option>
                  {mentors.filter((m) => m.status !== "On Leave" && m.studentIds.length < m.capacity).map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.studentIds.length}/{m.capacity})</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-[#74777E] pointer-events-none" />
              </div>
              <button
                disabled={!assignMentorId}
                onClick={async () => {
                  if (!assignMentorId || selected.size === 0) return;
                  try {
                    setLoading(true);
                    for (const studentId of Array.from(selected)) {
                      await supabase.from("mentorships").delete().eq("student_id", studentId);
                      const { error } = await supabase.from("mentorships").insert({
                        mentor_id: assignMentorId,
                        student_id: studentId,
                        active: true,
                      });
                      if (error) throw error;
                    }
                    toast.success("Successfully assigned students to mentor!");
                    clearSelection();
                    loadData();
                  } catch (err: any) {
                    console.error("Error assigning students:", err);
                    toast.error("Failed to assign students: " + err.message);
                  } finally {
                    setLoading(false);
                  }
                }}
                className="bg-[#0d2543] hover:bg-[#0a1d33] disabled:bg-[#c4c6ce] disabled:cursor-not-allowed text-white px-3 py-1 rounded-md font-['Inter'] font-semibold text-[12px] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0d2543] focus:ring-offset-1"
              >
                Assign
              </button>
            </div>
            
            
            <button className="ml-auto font-['Inter'] text-[12px] text-[#44474e] hover:text-[#0d2543] flex items-center gap-1 transition-colors duration-150 focus:outline-none focus:underline" onClick={clearSelection}>
              <X className="size-3.5" /> Clear
            </button>
          </div>
        )}

        {/* Students table */}
        <div className="flex-1 overflow-auto [scrollbar-width:thin] [scrollbar-color:#c4c6ce_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#c4c6ce] [&::-webkit-scrollbar-thumb]:rounded-full">
          {filteredStudents.length === 0 ? (
            <div className="px-8 py-20 text-center">
              <div className="size-12 mx-auto mb-3 rounded-full bg-[#f3f3f5] flex items-center justify-center">
                <Users className="size-5 text-[#74777E]" />
              </div>
              <p className="font-['Inter'] font-medium text-[14px] text-[#1a1c1d]">No students to show</p>
              <p className="font-['Inter'] text-[13px] text-[#74777E] mt-1">
                {isUnassigned ? "All students have been assigned a mentor." : "This mentor has no students matching your filters."}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-[#fafafb]">
                <tr className="border-b border-[#e2e2e4]">
                  <th className="text-left px-8 py-2 w-[40px]">
                    {(() => {
                      const allChecked = selected.size === filteredStudents.length && filteredStudents.length > 0;
                      const isIndeterminate = selected.size > 0 && selected.size < filteredStudents.length;
                      const filled = allChecked || isIndeterminate;
                      return (
                        <label className="inline-flex items-center justify-center cursor-pointer relative">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            ref={(el) => { if (el) el.indeterminate = isIndeterminate; }}
                            onChange={toggleAll}
                            className="peer sr-only"
                          />
                          <span
                            aria-hidden
                            className={`size-[15px] rounded-[4px] border bg-white transition-all duration-150 peer-hover:border-[#74777E] peer-focus-visible:ring-2 peer-focus-visible:ring-[#4493bf]/40 peer-focus-visible:ring-offset-1 flex items-center justify-center ${
                              filled ? "bg-[#0d2543] border-[#0d2543]" : "border-[#c4c6ce]"
                            }`}
                          >
                            {isIndeterminate ? (
                              <svg viewBox="0 0 12 12" fill="none" className="size-[10px] text-white">
                                <path d="M2.5 6H9.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                              </svg>
                            ) : allChecked ? (
                              <svg viewBox="0 0 12 12" fill="none" className="size-[10px] text-white">
                                <path d="M2.5 6.2L4.8 8.5L9.5 3.8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : null}
                          </span>
                        </label>
                      );
                    })()}
                  </th>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Cohort</Th>
                  <Th>Status</Th>
                  <Th className="text-right pr-8 w-[120px]">Enrolled</Th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => {
                  const isSelected = selected.has(s.id);
                  return (
                    <tr
                      key={s.id}
                      onClick={() => openEditStudent(s)}
                      title="Click to edit cohorts"
                      className={`group border-b border-[#f0f0f2] cursor-pointer transition-colors duration-150 ${
                        isSelected ? "bg-[#eaf3f9]" : "hover:bg-white"
                      }`}
                    >
                      <td className="px-8 py-2 w-[40px]" onClick={(e) => e.stopPropagation()}>
                        <label className="inline-flex items-center justify-center cursor-pointer relative">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelected(s.id)}
                            className="peer sr-only"
                          />
                          <span
                            aria-hidden
                            className="size-[15px] rounded-[4px] border border-[#c4c6ce] bg-white transition-all duration-150 peer-hover:border-[#74777E] peer-focus-visible:ring-2 peer-focus-visible:ring-[#4493bf]/40 peer-focus-visible:ring-offset-1 peer-checked:bg-[#0d2543] peer-checked:border-[#0d2543] flex items-center justify-center"
                          >
                            <svg
                              viewBox="0 0 12 12"
                              fill="none"
                              className="size-[10px] text-white opacity-0 scale-75 transition-all duration-150 peer-checked:opacity-100 peer-checked:scale-100"
                              style={{ display: isSelected ? "block" : "none" }}
                            >
                              <path d="M2.5 6.2L4.8 8.5L9.5 3.8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        </label>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="size-6 rounded-full bg-[#f0f0f2] text-[#44474e] flex items-center justify-center font-['Inter'] font-semibold text-[10px] shrink-0">
                            {s.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                          </span>
                          <span className="font-['Inter'] font-semibold text-[13px] text-[#0d2543] truncate">{s.name}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4 font-['Inter'] text-[12px] text-[#44474e] truncate max-w-[220px]">{s.email}</td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap items-center gap-1 max-w-[260px]">
                          {s.cohorts.length === 0 && (
                            <span className="font-['Inter'] text-[11px] text-[#74777E] italic">No cohort</span>
                          )}
                          {s.cohorts.slice(0, 2).map((c) => (
                            <span key={c} className="font-['Inter'] text-[11px] text-[#44474e] bg-[#f0f0f2] px-1.5 py-0.5 rounded font-medium">{c}</span>
                          ))}
                          {s.cohorts.length > 2 && (
                            <span title={s.cohorts.slice(2).join(", ")} className="font-['Inter'] text-[11px] text-[#44474e] bg-[#e2e2e4] px-1.5 py-0.5 rounded font-semibold">+{s.cohorts.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <StudentStatusPill status={s.status} />
                      </td>
                      <td className="py-2 pr-8 text-right font-['Inter'] text-[12px] text-[#74777E] tabular-nums">{formatRelative(s.enrolled)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer status */}
        <div className="px-8 py-2 border-t border-[#e2e2e4] bg-white flex items-center justify-between">
          <span className="font-['Inter'] text-[11px] text-[#74777E]">
            Showing {filteredStudents.length} of {allStudentsScope.length} students
          </span>
          <span className="font-['Inter'] text-[11px] text-[#74777E]">
            {totals.active}/{totals.mentors} mentors active · {totals.unassigned} unassigned
          </span>
        </div>
      </main>
      </div>

      {/* Add Mentor dialog */}
      {mentorOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(13,37,67,0.45)] backdrop-blur-sm p-6"
          onClick={() => setMentorOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-[0_24px_48px_-12px_rgba(13,37,67,0.35)] w-full max-w-[480px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-[rgba(13,37,67,0.07)]">
              <div>
                <h2 className="font-['Inter'] font-semibold text-[#0d2543]" style={{ fontSize: 18 }}>Add Mentor</h2>
                <p className="font-['Inter'] text-[12px] text-[#74777E] mt-0.5">New mentors start in Active status.</p>
              </div>
              <button onClick={() => setMentorOpen(false)} className="text-[#74777E] hover:text-[#0d2543] p-1 rounded-md hover:bg-[#F1F4F8] transition-colors duration-150">
                <X className="size-4" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="font-['Inter'] font-semibold text-[11px] uppercase tracking-[0.5px] text-[#74777E] block mb-1.5">Name</label>
                <input
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  placeholder="e.g. Aarav Mehta"
                  className="w-full px-3 py-2 bg-white border border-[rgba(13,37,67,0.15)] rounded-md font-['Inter'] text-[13px] text-[#0d2543] focus:outline-none focus:border-[#00658d] focus:ring-2 focus:ring-[rgba(0,101,141,0.15)] transition-all duration-150"
                />
              </div>
              <div>
                <label className="font-['Inter'] font-semibold text-[11px] uppercase tracking-[0.5px] text-[#74777E] block mb-1.5">Email</label>
                <input
                  type="email"
                  value={mEmail}
                  onChange={(e) => setMEmail(e.target.value)}
                  placeholder="mentor@safetycatch.io"
                  className="w-full px-3 py-2 bg-white border border-[rgba(13,37,67,0.15)] rounded-md font-['Inter'] text-[13px] text-[#0d2543] focus:outline-none focus:border-[#00658d] focus:ring-2 focus:ring-[rgba(0,101,141,0.15)] transition-all duration-150"
                />
                {mEmail.length > 0 && !mValidEmail && (
                  <p className="mt-1 font-['Inter'] text-[11px] text-[#9F2A1C]">Enter a valid email address.</p>
                )}
              </div>
              <div>
                <label className="font-['Inter'] font-semibold text-[11px] uppercase tracking-[0.5px] text-[#74777E] block mb-1.5">Capacity</label>
                <input
                  type="number"
                  min={1}
                  value={mCapacity}
                  onChange={(e) => setMCapacity(e.target.value)}
                  placeholder="e.g. 15"
                  className="w-full px-3 py-2 bg-white border border-[rgba(13,37,67,0.15)] rounded-md font-['Inter'] text-[13px] text-[#0d2543] focus:outline-none focus:border-[#00658d] focus:ring-2 focus:ring-[rgba(0,101,141,0.15)] transition-all duration-150"
                />
                <p className="mt-1 font-['Inter'] text-[11px] text-[#74777E]">Maximum number of students this mentor can take on.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-[rgba(13,37,67,0.07)] bg-[#F7F9FC]">
              <button onClick={() => setMentorOpen(false)} className="px-3.5 py-1.5 rounded-md font-['Inter'] font-semibold text-[13px] text-[#44474e] hover:bg-[#e6eaf0] transition-colors duration-150">
                Cancel
              </button>
              <button
                onClick={submitMentor}
                disabled={!mCanSubmit || loading}
                className="px-3.5 py-1.5 rounded-md font-['Inter'] font-semibold text-[13px] bg-[#0d2543] text-white hover:bg-[#0a1d33] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
              >
                {loading ? "Creating..." : "Create & Generate Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Student dialog */}
      {studentOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(13,37,67,0.45)] backdrop-blur-sm p-6"
          onClick={() => setStudentOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-[0_24px_48px_-12px_rgba(13,37,67,0.35)] w-full max-w-[480px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-[rgba(13,37,67,0.07)]">
              <div>
                <h2 className="font-['Inter'] font-semibold text-[#0d2543]" style={{ fontSize: 18 }}>Add Student</h2>
                <p className="font-['Inter'] text-[12px] text-[#74777E] mt-0.5">A temporary password will be generated on save.</p>
              </div>
              <button onClick={() => setStudentOpen(false)} className="text-[#74777E] hover:text-[#0d2543] p-1 rounded-md hover:bg-[#F1F4F8] transition-colors duration-150">
                <X className="size-4" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="font-['Inter'] font-semibold text-[11px] uppercase tracking-[0.5px] text-[#74777E] block mb-1.5">Name</label>
                <input
                  value={sName}
                  onChange={(e) => setSName(e.target.value)}
                  placeholder="e.g. Riya Sharma"
                  className="w-full px-3 py-2 bg-white border border-[rgba(13,37,67,0.15)] rounded-md font-['Inter'] text-[13px] text-[#0d2543] focus:outline-none focus:border-[#00658d] focus:ring-2 focus:ring-[rgba(0,101,141,0.15)] transition-all duration-150"
                />
              </div>
              <div>
                <label className="font-['Inter'] font-semibold text-[11px] uppercase tracking-[0.5px] text-[#74777E] block mb-1.5">Learner ID / Email</label>
                <input
                  type="email"
                  value={sEmail}
                  onChange={(e) => setSEmail(e.target.value)}
                  placeholder="learner@northwind.io"
                  className="w-full px-3 py-2 bg-white border border-[rgba(13,37,67,0.15)] rounded-md font-['Inter'] text-[13px] text-[#0d2543] focus:outline-none focus:border-[#00658d] focus:ring-2 focus:ring-[rgba(0,101,141,0.15)] transition-all duration-150"
                />
                {sEmail.length > 0 && !sValidEmail && (
                  <p className="mt-1 font-['Inter'] text-[11px] text-[#9F2A1C]">Enter a valid email address.</p>
                )}
              </div>
              <div>
                <label className="font-['Inter'] font-semibold text-[11px] uppercase tracking-[0.5px] text-[#74777E] block mb-1.5">Date of Birth</label>
                <input
                  type="date"
                  value={sDob}
                  onChange={(e) => setSDob(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[rgba(13,37,67,0.15)] rounded-md font-['Inter'] text-[13px] text-[#0d2543] focus:outline-none focus:border-[#00658d] focus:ring-2 focus:ring-[rgba(0,101,141,0.15)] transition-all duration-150"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-['Inter'] font-semibold text-[11px] uppercase tracking-[0.5px] text-[#74777E]">Cohorts</label>
                  <span className="font-['Inter'] text-[11px] text-[#74777E]">{sCohorts.length} selected</span>
                </div>
                <div className="max-h-[180px] overflow-auto border border-[rgba(13,37,67,0.15)] rounded-md bg-white divide-y divide-[#f0f0f2]">
                  {cohortOptions.length === 0 && (
                    <div className="px-3 py-3 font-['Inter'] text-[12px] text-[#74777E] italic">No cohorts available — create one in Content Vault → Cohort Access.</div>
                  )}
                  {cohortOptions.map((c) => {
                    const checked = sCohorts.includes(c);
                    return (
                      <label key={c} className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer ${checked ? "bg-[#eaf3f9]" : "hover:bg-[#fafafa]"}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleSCohort(c)} className="size-3.5 accent-[#0d2543]" />
                        <span className="font-['Inter'] text-[13px] text-[#0d2543]">{c}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-1 font-['Inter'] text-[11px] text-[#74777E]">Pick one or more existing cohorts. A student can be in multiple.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-[rgba(13,37,67,0.07)] bg-[#F7F9FC]">
              <button onClick={() => setStudentOpen(false)} className="px-3.5 py-1.5 rounded-md font-['Inter'] font-semibold text-[13px] text-[#44474e] hover:bg-[#e6eaf0] transition-colors duration-150">
                Cancel
              </button>
              <button
                onClick={submitStudent}
                disabled={!sCanSubmit || loading}
                className="px-3.5 py-1.5 rounded-md font-['Inter'] font-semibold text-[13px] bg-[#0d2543] text-white hover:bg-[#0a1d33] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
              >
                {loading ? "Creating..." : "Create & Generate Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student credential dialog */}
      {sCred && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-[rgba(13,37,67,0.45)] backdrop-blur-sm p-6"
          onClick={() => setSCred(null)}
        >
          <div
            className="bg-white rounded-xl shadow-[0_24px_48px_-12px_rgba(13,37,67,0.35)] w-full max-w-[520px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-3 border-b border-[rgba(13,37,67,0.07)] flex items-start justify-between">
              <div className="flex items-start gap-2.5">
                <span className="size-8 rounded-full bg-[#E6F1E9] text-[#1E5631] flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="size-4" />
                </span>
                <div>
                  <h2 className="font-['Inter'] font-semibold text-[#0d2543]" style={{ fontSize: 18 }}>Student Created</h2>
                  <p className="font-['Inter'] text-[12px] text-[#74777E] mt-0.5">
                    Copy the temporary password and send it to the student — it won&apos;t be shown again.
                  </p>
                </div>
              </div>
              <button onClick={() => setSCred(null)} className="text-[#74777E] hover:text-[#0d2543] p-1 rounded-md hover:bg-[#F1F4F8] transition-colors duration-150">
                <X className="size-4" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1.5 font-['Inter'] text-[13px]">
                <span className="text-[#74777E]">Name</span>
                <span className="text-[#0d2543] font-semibold">{sCred.name}</span>
                <span className="text-[#74777E]">Email</span>
                <span className="text-[#0d2543] font-semibold">{sCred.email}</span>
                <span className="text-[#74777E]">Cohorts</span>
                <span className="text-[#0d2543] font-semibold">{sCred.cohorts.join(", ") || "—"}</span>
              </div>
              <div>
                <label className="font-['Inter'] font-semibold text-[11px] uppercase tracking-[0.5px] text-[#74777E] block mb-1.5">Temporary Password</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-[#F7F9FC] border border-[rgba(13,37,67,0.10)] rounded-md font-mono text-[14px] text-[#0d2543] tracking-[0.5px] select-all break-all">
                    {sCred.password}
                  </code>
                  <button
                    onClick={copyStudentCred}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-md font-['Inter'] font-semibold text-[12px] transition-colors duration-150 ${
                      sCopied ? "bg-[#E6F1E9] text-[#1E5631]" : "bg-[#0d2543] text-white hover:bg-[#0a1d33]"
                    }`}
                  >
                    {sCopied ? <CheckCircle2 className="size-3.5" /> : <Copy className="size-3.5" />}
                    {sCopied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="mt-2 font-['Inter'] text-[11px] text-[#A56A00] bg-[#FFF3D6] border border-[rgba(165,106,0,0.20)] rounded-md px-2.5 py-1.5">
                  Share via your usual secure channel. The student should change this on first login.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-[rgba(13,37,67,0.07)] bg-[#F7F9FC]">
              <button onClick={() => setSCred(null)} className="px-3.5 py-1.5 rounded-md font-['Inter'] font-semibold text-[13px] bg-[#0d2543] text-white hover:bg-[#0a1d33] transition-colors duration-150">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Cohorts dialog (click a student row) */}
      {editingStudent && (
        <div
          className="fixed inset-0 z-[105] flex items-center justify-center bg-[rgba(13,37,67,0.45)] backdrop-blur-sm p-6"
          onClick={() => setEditStudentId(null)}
        >
          <div
            className="bg-white rounded-xl shadow-[0_24px_48px_-12px_rgba(13,37,67,0.35)] w-full max-w-[480px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-[rgba(13,37,67,0.07)]">
              <div className="min-w-0">
                <h2 className="font-['Inter'] font-semibold text-[#0d2543] truncate" style={{ fontSize: 18 }}>Edit Cohorts</h2>
                <p className="font-['Inter'] text-[12px] text-[#74777E] mt-0.5 truncate">
                  {editingStudent.name} · {editingStudent.email}
                </p>
              </div>
              <button onClick={() => setEditStudentId(null)} className="text-[#74777E] hover:text-[#0d2543] p-1 rounded-md hover:bg-[#F1F4F8] transition-colors duration-150">
                <X className="size-4" />
              </button>
            </div>

            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-['Inter'] font-semibold text-[11px] uppercase tracking-[0.5px] text-[#74777E]">Assigned Cohorts</label>
                <span className="font-['Inter'] text-[11px] text-[#74777E]">{editCohorts.length} selected</span>
              </div>
              <div className="max-h-[280px] overflow-auto border border-[rgba(13,37,67,0.15)] rounded-md bg-white divide-y divide-[#f0f0f2]">
                {cohortOptions.length === 0 && (
                  <div className="px-3 py-3 font-['Inter'] text-[12px] text-[#74777E] italic">No cohorts available.</div>
                )}
                {cohortOptions.map((c) => {
                  const checked = editCohorts.includes(c);
                  return (
                    <label key={c} className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer ${checked ? "bg-[#eaf3f9]" : "hover:bg-[#fafafa]"}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleEditCohort(c)} className="size-3.5 accent-[#0d2543]" />
                      <span className="font-['Inter'] text-[13px] text-[#0d2543]">{c}</span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-1 font-['Inter'] text-[11px] text-[#74777E]">A student can belong to multiple cohorts. Cohorts are created in Content Vault → Cohort Access.</p>
            </div>

            <div className="flex items-center justify-between px-6 py-3 border-t border-[rgba(13,37,67,0.07)] bg-[#F7F9FC]">
              <button
                onClick={() => {
                  deleteStudent(editingStudent.id);
                  setEditStudentId(null);
                }}
                className="bg-[#c0392b] hover:bg-[#a93226] text-white px-3 py-1.5 rounded-md font-['Inter'] font-semibold text-[13px] transition-colors duration-150"
              >
                Delete Student
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditStudentId(null)} className="px-3.5 py-1.5 rounded-md font-['Inter'] font-semibold text-[13px] text-[#44474e] hover:bg-[#e6eaf0] transition-colors duration-150">
                  Cancel
                </button>
                <button
                  onClick={saveEditCohorts}
                  className="px-3.5 py-1.5 rounded-md font-['Inter'] font-semibold text-[13px] bg-[#0d2543] text-white hover:bg-[#0a1d33] transition-colors duration-150"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UmTabBar({ tab, setTab }: { tab: "mentors" | "trainers"; setTab: (t: "mentors" | "trainers") => void }) {
  return (
    <div className="bg-white border-b border-[#e2e2e4] px-6 py-2 flex items-center gap-1">
      {([
        { id: "mentors", label: "Mentors & Students" },
        { id: "trainers", label: "Trainers" },
      ] as const).map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-md font-['Inter'] font-semibold text-[12px] tracking-[0.2px] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf] ${
              active ? "bg-[#0d2543] text-white" : "text-[#44474e] hover:bg-[#F1F4F8]"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

type Trainer = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  assignedContent: string[];
};

const INITIAL_TRAINERS: Trainer[] = [
  { id: "t1", name: "John Doe", email: "john.doe@safetycatch.io", createdAt: "2026-02-14", assignedContent: ["Advanced Risk Mitigation", "Zero-Trust Architecture", "Energy Isolation Principles"] },
  { id: "t2", name: "Sarah Smith", email: "sarah.smith@safetycatch.io", createdAt: "2026-02-14", assignedContent: ["Threat Assessment Framework"] },
  { id: "t3", name: "Michael Brown", email: "michael.brown@safetycatch.io", createdAt: "2026-03-02", assignedContent: ["Firewall Hardening Lab", "Authorized Worker Procedures", "Field Audit Reference"] },
  { id: "t4", name: "Priya Singh", email: "priya.singh@safetycatch.io", createdAt: "2026-03-18", assignedContent: ["OWASP Top 10 — 2026 Edition", "API Auth Patterns Quiz"] },
  { id: "t5", name: "Linda Park", email: "linda.park@safetycatch.io", createdAt: "2026-04-04", assignedContent: ["Worksite Walk-Through Procedures", "Chemical Exposure Limits"] },
  { id: "t6", name: "Emily Chen", email: "emily.chen@safetycatch.io", createdAt: "2026-04-12", assignedContent: ["PPE Selection Matrix", "Fuel Source Classification", "Sprinkler System Inspection"] },
  { id: "t7",  name: "Rohan Iyer",      email: "rohan.iyer@safetycatch.io",      createdAt: "2026-04-15", assignedContent: ["Advanced Risk Mitigation", "Field Audit Reference"] },
  { id: "t8",  name: "Aisha Khan",      email: "aisha.khan@safetycatch.io",      createdAt: "2026-04-18", assignedContent: ["OWASP Top 10 — 2026 Edition"] },
  { id: "t9",  name: "Daniel Okafor",   email: "daniel.okafor@safetycatch.io",   createdAt: "2026-04-22", assignedContent: ["Firewall Hardening Lab", "Zero-Trust Architecture"] },
  { id: "t10", name: "Mei Lin",         email: "mei.lin@safetycatch.io",         createdAt: "2026-04-25", assignedContent: ["Sprinkler System Inspection"] },
  { id: "t11", name: "Carlos Rivera",   email: "carlos.rivera@safetycatch.io",   createdAt: "2026-04-28", assignedContent: ["Authorized Worker Procedures", "PPE Selection Matrix"] },
  { id: "t12", name: "Hannah Becker",   email: "hannah.becker@safetycatch.io",   createdAt: "2026-05-01", assignedContent: [] },
  { id: "t13", name: "Yusuf Aydın",     email: "yusuf.aydin@safetycatch.io",     createdAt: "2026-05-03", assignedContent: ["Chemical Exposure Limits", "Fuel Source Classification"] },
  { id: "t14", name: "Olivia Müller",   email: "olivia.muller@safetycatch.io",   createdAt: "2026-05-05", assignedContent: ["Energy Isolation Principles"] },
  { id: "t15", name: "Arjun Verma",     email: "arjun.verma@safetycatch.io",     createdAt: "2026-05-07", assignedContent: ["API Auth Patterns Quiz", "Threat Assessment Framework"] },
  { id: "t16", name: "Sophie Laurent",  email: "sophie.laurent@safetycatch.io",  createdAt: "2026-05-09", assignedContent: ["Worksite Walk-Through Procedures"] },
  { id: "t17", name: "Marcus Hale",     email: "marcus.hale@safetycatch.io",     createdAt: "2026-05-11", assignedContent: ["Field Audit Reference", "Advanced Risk Mitigation", "OWASP Top 10 — 2026 Edition"] },
  { id: "t18", name: "Naomi Tanaka",    email: "naomi.tanaka@safetycatch.io",    createdAt: "2026-05-13", assignedContent: ["PPE Selection Matrix"] },
  { id: "t19", name: "Ethan Wallace",   email: "ethan.wallace@safetycatch.io",   createdAt: "2026-05-15", assignedContent: [] },
  { id: "t20", name: "Zara Ahmed",      email: "zara.ahmed@safetycatch.io",      createdAt: "2026-05-16", assignedContent: ["Zero-Trust Architecture", "Firewall Hardening Lab"] },
  { id: "t21", name: "Liam O'Connor",   email: "liam.oconnor@safetycatch.io",    createdAt: "2026-05-18", assignedContent: ["Sprinkler System Inspection", "Fuel Source Classification"] },
  { id: "t22", name: "Fatima Noor",     email: "fatima.noor@safetycatch.io",     createdAt: "2026-05-19", assignedContent: ["Chemical Exposure Limits"] },
  { id: "t23", name: "Diego Salazar",   email: "diego.salazar@safetycatch.io",   createdAt: "2026-05-20", assignedContent: ["Authorized Worker Procedures"] },
  { id: "t24", name: "Grace Adeyemi",   email: "grace.adeyemi@safetycatch.io",   createdAt: "2026-05-21", assignedContent: ["Energy Isolation Principles", "Worksite Walk-Through Procedures"] },
  { id: "t25", name: "Tomáš Novák",     email: "tomas.novak@safetycatch.io",     createdAt: "2026-05-22", assignedContent: ["Threat Assessment Framework"] },
  { id: "t26", name: "Ananya Reddy",    email: "ananya.reddy@safetycatch.io",    createdAt: "2026-05-23", assignedContent: [] },
];

function generatePassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;
  const pick = (pool: string) => pool[Math.floor(Math.random() * pool.length)];
  const base = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  for (let i = 0; i < 8; i++) base.push(pick(all));
  return base.sort(() => Math.random() - 0.5).join("");
}

function trainerAvatarColor(name: string) {
  const colors = ["#00658d", "#0d2543", "#8B5CF6", "#16A34A", "#D97706", "#DC2626", "#EC4899"];
  return colors[name.charCodeAt(0) % colors.length];
}

// Derived metadata for assigned content — gives the detail panel richer cards.
const CONTENT_META: Record<string, { format: "Video" | "Lab" | "Quiz" | "Reference" | "SOP"; track: string; learners: number; updated: string }> = {
  "Advanced Risk Mitigation":       { format: "Video",     track: "Risk & Compliance",   learners: 142, updated: "2026-05-18" },
  "Zero-Trust Architecture":        { format: "Video",     track: "Cyber Security",      learners: 96,  updated: "2026-05-12" },
  "Energy Isolation Principles":    { format: "SOP",       track: "Industrial Safety",   learners: 188, updated: "2026-04-29" },
  "Threat Assessment Framework":    { format: "Reference", track: "Cyber Security",      learners: 71,  updated: "2026-05-04" },
  "Firewall Hardening Lab":         { format: "Lab",       track: "Cyber Security",      learners: 58,  updated: "2026-05-21" },
  "Authorized Worker Procedures":   { format: "SOP",       track: "Industrial Safety",   learners: 211, updated: "2026-03-30" },
  "Field Audit Reference":          { format: "Reference", track: "Risk & Compliance",   learners: 124, updated: "2026-04-11" },
  "OWASP Top 10 — 2026 Edition":    { format: "Reference", track: "Cyber Security",      learners: 167, updated: "2026-05-22" },
  "API Auth Patterns Quiz":         { format: "Quiz",      track: "Cyber Security",      learners: 89,  updated: "2026-05-08" },
  "Worksite Walk-Through Procedures": { format: "SOP",     track: "Industrial Safety",   learners: 154, updated: "2026-04-02" },
  "Chemical Exposure Limits":       { format: "Reference", track: "Chemical Safety",     learners: 102, updated: "2026-03-25" },
  "PPE Selection Matrix":           { format: "Reference", track: "Industrial Safety",   learners: 199, updated: "2026-05-15" },
  "Fuel Source Classification":     { format: "Reference", track: "Fire Safety",         learners: 88,  updated: "2026-04-18" },
  "Sprinkler System Inspection":    { format: "Lab",       track: "Fire Safety",         learners: 64,  updated: "2026-05-09" },
};

function formatBadge(format: string) {
  switch (format) {
    case "Video":     return { bg: "rgba(0,101,141,0.10)",  fg: "#00658d" };
    case "Lab":       return { bg: "rgba(139,92,246,0.12)", fg: "#6D28D9" };
    case "Quiz":      return { bg: "rgba(217,119,6,0.12)",  fg: "#B45309" };
    case "Reference": return { bg: "rgba(13,37,67,0.08)",   fg: "#0d2543" };
    case "SOP":       return { bg: "rgba(22,163,74,0.12)",  fg: "#15803D" };
    default:          return { bg: "#F1F4F8", fg: "#44474e" };
  }
}

function TrainersPanel({
  trainers,
  setTrainers,
  onRefresh,
}: {
  trainers: Trainer[];
  setTrainers: React.Dispatch<React.SetStateAction<Trainer[]>>;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [credential, setCredential] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return trainers;
    return trainers.filter((t) => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q));
  }, [trainers, search]);

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draftEmail);
  const canSubmit = draftName.trim().length > 0 && validEmail;

  const openAdd = () => {
    setDraftName("");
    setDraftEmail("");
    setAddOpen(true);
  };

  const submitTrainer = async () => {
    if (!canSubmit || loading) return;
    const password = generatePassword();
    const email = draftEmail.trim().toLowerCase();
    const name = draftName.trim();

    try {
      setLoading(true);
      console.log("[DEBUG submitTrainer] Starting trainer signup for:", email);
      const secondaryClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      );

      const { data: authData, error: authError } = await secondaryClient.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error("No user ID returned");

      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        email,
        full_name: name,
        role: "trainer",
        temp_password: password,
        must_reset_pw: true,
      });

      if (profileError) throw profileError;

      setAddOpen(false);
      setCredential({ name, email, password });
      setCopied(false);
      try {
        await navigator.clipboard.writeText(`Name: ${name}\nEmail: ${email}\nTemporary password: ${password}`);
        toast.success("Trainer created! Credentials copied to clipboard.");
      } catch {
        toast.success(`Trainer created! Temporary password: ${password}`, { duration: 10000 });
      }
      onRefresh();
    } catch (err: any) {
      console.error("Error creating trainer:", err);
      toast.error("Failed to create trainer: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyCreds = async () => {
    if (!credential) return;
    const block = `Name: ${credential.name}\nEmail: ${credential.email}\nTemporary password: ${credential.password}`;
    try {
      await navigator.clipboard.writeText(block);
      setCopied(true);
      toast.success("Password copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      toast.error("Failed to copy password");
    }
  };

  const deleteTrainer = async (trainerId: string) => {
    if (!confirm("Are you sure you want to delete this trainer profile?")) return;
    try {
      // First delete from module_trainers
      const { error: mtError } = await supabase.from("module_trainers").delete().eq("trainer_id", selected?.id);
      if (mtError) console.error("Error deleting module_trainers:", mtError);

      const { error } = await supabase.from("profiles").delete().eq("id", trainerId);
      if (error) throw error;
      toast.success("Trainer profile deleted successfully");
      setSelectedId("");
      onRefresh();
    } catch (err: any) {
      console.error("Error deleting trainer:", err);
      toast.error("Failed to delete trainer: " + err.message);
    }
  };

  const [selectedId, setSelectedId] = useState<string>("");
  useEffect(() => {
    if (!selectedId && trainers.length > 0) {
      setSelectedId(trainers[0].id);
    }
  }, [trainers, selectedId]);
  const selected = trainers.find((t) => t.id === selectedId) ?? filtered[0] ?? null;

  const totalAssignments = trainers.reduce((sum, t) => sum + t.assignedContent.length, 0);
  const unassigned = trainers.filter((t) => t.assignedContent.length === 0).length;
  const avgLoad = trainers.length ? (totalAssignments / trainers.length).toFixed(1) : "0";

  return (
    <div className="bg-[#EEF1F6] h-[calc(100vh-110px)] flex flex-col">
      <div className="max-w-[1320px] w-full mx-auto px-8 pt-5 pb-2 flex items-center justify-between gap-4 flex-wrap shrink-0">
        <div>
          <h1 className="font-['Inter'] font-semibold text-[#0d2543] tracking-[-0.3px]" style={{ fontSize: 20 }}>
            Trainers
          </h1>
          <p className="font-['Inter'] text-[12px] text-[#6B7280] mt-0.5">
            {trainers.length} trainers · manage accounts, issue credentials, and audit content ownership.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="bg-[#0d2543] hover:bg-[#0a1d33] active:bg-[#071628] text-white px-3.5 py-1.5 rounded-md font-['Inter'] font-semibold text-[13px] flex items-center gap-1.5 shadow-[0_1px_2px_rgba(13,37,67,0.20)] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#0d2543] focus:ring-offset-2"
        >
          <UserPlus className="size-4" />
          Add Trainer
        </button>
      </div>

      <div className="max-w-[1320px] w-full mx-auto px-8 pb-6 flex-1 min-h-0">
        <div className="grid grid-cols-[300px_1fr] gap-4 h-full">
          {/* LIST */}
          <div className="bg-white rounded-[10px] border border-[rgba(13,37,67,0.07)] shadow-[0_1px_2px_rgba(13,37,67,0.04),0_1px_6px_rgba(13,37,67,0.04)] overflow-hidden flex flex-col min-h-0">
            <div className="px-2.5 py-2 border-b border-[rgba(13,37,67,0.06)] shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#9aa0a6]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search trainers…"
                  className="w-full pl-8 pr-3 py-1.5 bg-[#F1F4F8] border border-transparent rounded-md font-['Inter'] text-[12.5px] text-[#0d2543] placeholder:text-[#9aa0a6] focus:outline-none focus:border-[#00658d] focus:bg-white focus:ring-2 focus:ring-[rgba(0,101,141,0.12)] transition-all duration-150"
                />
              </div>
            </div>
            <div className="px-3 py-1.5 border-b border-[rgba(13,37,67,0.06)] flex items-center justify-between shrink-0 bg-[#FAFBFD]">
              <span className="font-['Inter'] font-semibold text-[10px] uppercase tracking-[0.6px] text-[#74777E]">Trainer</span>
              <span className="font-['Inter'] font-semibold text-[10px] uppercase tracking-[0.6px] text-[#74777E] tabular-nums">{filtered.length}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#c4c6ce_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#c4c6ce] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#0d2543]/40">
              {filtered.length === 0 ? (
                <div className="px-4 py-12 text-center font-['Inter'] text-[13px] text-[#9aa0a6]">No trainers match.</div>
              ) : (
                <ul>
                  {filtered.map((t) => {
                    const active = t.id === selectedId;
                    return (
                      <li key={t.id}>
                        <button
                          onClick={() => setSelectedId(t.id)}
                          className={`w-full text-left flex items-center gap-2 pr-2.5 h-[44px] transition-colors duration-100 ${
                            active
                              ? "bg-[rgba(0,101,141,0.08)] pl-[7px] border-l-[3px] border-[#00658d]"
                              : "pl-2.5 border-l-[3px] border-transparent hover:bg-[#F7F9FC]"
                          }`}
                        >
                          <span
                            className="size-7 rounded-full flex items-center justify-center font-['Inter'] font-semibold text-[10.5px] text-white shrink-0"
                            style={{ background: trainerAvatarColor(t.name) }}
                          >
                            {t.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-['Inter'] font-semibold text-[12.5px] text-[#0d2543] truncate leading-tight">
                              {t.name}
                            </div>
                            <div className="font-['Inter'] text-[10.5px] text-[#74777E] truncate leading-tight mt-0.5">{t.email}</div>
                          </div>
                          <span className={`font-['Inter'] font-semibold text-[10.5px] tabular-nums rounded-full px-1.5 min-w-[20px] text-center shrink-0 ${
                            t.assignedContent.length === 0
                              ? "bg-transparent text-[#c4c6ce]"
                              : active
                                ? "bg-[#00658d] text-white"
                                : "bg-[#F1F4F8] text-[#44474e]"
                          }`}>
                            {t.assignedContent.length}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* DETAIL */}
          {selected ? (
            <div className="flex flex-col gap-4 h-full min-h-0">
              {/* Profile card */}
              <div className="bg-white rounded-[10px] border border-[rgba(13,37,67,0.07)] shadow-[0_1px_2px_rgba(13,37,67,0.04),0_1px_6px_rgba(13,37,67,0.04)] overflow-hidden shrink-0">
                <div className="px-5 py-3.5 flex items-start gap-3.5">
                  <span
                    className="size-14 rounded-full flex items-center justify-center font-['Inter'] font-semibold text-[18px] text-white shrink-0 shadow-[0_2px_4px_rgba(0,0,0,0.12)]"
                    style={{ background: trainerAvatarColor(selected.name) }}
                  >
                    {selected.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-['Inter'] font-semibold text-[#0d2543] tracking-[-0.2px]" style={{ fontSize: 18 }}>
                        {selected.name}
                      </h2>
                      <span className="inline-flex items-center gap-1.5 bg-[#E6F1E9] text-[#15803D] rounded-full px-2 py-0.5 font-['Inter'] font-semibold text-[11px] tracking-[0.2px]">
                        <span className="size-1.5 rounded-full bg-current" />
                        Active
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                      <a href={`mailto:${selected.email}`} className="inline-flex items-center gap-1.5 font-['Inter'] text-[13px] text-[#00658d] hover:underline">
                        <Mail className="size-3.5" />
                        {selected.email}
                      </a>
                      <span className="font-['Inter'] text-[12px] text-[#9aa0a6]">·</span>
                      <span className="font-['Inter'] text-[12px] text-[#74777E]">
                        Added {new Date(selected.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteTrainer(selected.id)}
                    className="bg-[#c0392b] hover:bg-[#a93226] text-white px-3 py-1.5 rounded-md font-['Inter'] font-semibold text-[13px] transition-colors duration-200"
                  >
                    Delete Trainer
                  </button>
                </div>
              </div>

              {/* Assigned Content */}
              <div className="bg-white rounded-[10px] border border-[rgba(13,37,67,0.07)] shadow-[0_1px_2px_rgba(13,37,67,0.04),0_1px_6px_rgba(13,37,67,0.04)] overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="px-5 py-3 flex items-center gap-3 border-b border-[rgba(13,37,67,0.06)] shrink-0">
                  <span className="font-['Inter'] font-semibold text-[11px] uppercase tracking-[0.6px] text-[#74777E]">
                    Assigned Content
                  </span>
                  <div className="flex-1 h-px bg-[rgba(13,37,67,0.06)]" />
                  <span className="font-['Inter'] text-[12px] text-[#74777E] tabular-nums">{selected.assignedContent.length} items</span>
                  <button className="inline-flex items-center gap-1 text-[#00658d] hover:bg-[rgba(0,101,141,0.08)] px-2 py-1 rounded-md font-['Inter'] font-semibold text-[12px] transition-colors duration-150">
                    <Plus className="size-3.5" />
                    Assign
                  </button>
                </div>
                {selected.assignedContent.length === 0 ? (
                  <div className="flex-1 px-6 py-12 flex flex-col items-center justify-center text-center">
                    <span className="size-10 rounded-full bg-[#F1F4F8] flex items-center justify-center mb-3">
                      <Inbox className="size-4 text-[#74777E]" />
                    </span>
                    <div className="font-['Inter'] font-semibold text-[14px] text-[#0d2543]">No content assigned yet</div>
                    <p className="font-['Inter'] text-[12px] text-[#74777E] mt-1 max-w-[280px]">
                      Assign courses, labs, or references from the Content Vault to start tracking ownership.
                    </p>
                    <button className="mt-3 inline-flex items-center gap-1.5 bg-[#0d2543] text-white px-3 py-1.5 rounded-md font-['Inter'] font-semibold text-[12px] hover:bg-[#0a1d33] transition-colors duration-150">
                      <Plus className="size-3.5" />
                      Assign content
                    </button>
                  </div>
                ) : (
                  <ul className="divide-y divide-[rgba(13,37,67,0.05)] flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#c4c6ce_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#c4c6ce] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#0d2543]/40">
                    {selected.assignedContent.map((title) => {
                      const meta = CONTENT_META[title] ?? { format: "Reference" as const, track: "General", learners: 0, updated: selected.createdAt };
                      const fmt = formatBadge(meta.format);
                      return (
                        <li
                          key={title}
                          className="group flex items-center gap-3 px-5 py-3 hover:bg-[#F7F9FC] transition-colors duration-100 cursor-pointer"
                        >
                          <span
                            className="font-['Inter'] font-semibold text-[10px] tracking-[0.4px] uppercase rounded-md px-1.5 py-0.5 shrink-0 w-[68px] text-center"
                            style={{ background: fmt.bg, color: fmt.fg }}
                          >
                            {meta.format}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-['Inter'] font-semibold text-[13px] text-[#0d2543] truncate">{title}</div>
                            <div className="font-['Inter'] text-[11px] text-[#74777E] mt-0.5">{meta.track}</div>
                          </div>
                          <ChevronRight className="size-4 text-[#c4c6ce] opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[10px] border border-[rgba(13,37,67,0.07)] shadow-[0_1px_2px_rgba(13,37,67,0.04)] px-6 py-16 text-center">
              <p className="font-['Inter'] text-[13px] text-[#74777E]">Select a trainer to view details.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Trainer dialog */}
      {addOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(13,37,67,0.45)] backdrop-blur-sm p-6"
          onClick={() => setAddOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-[0_24px_48px_-12px_rgba(13,37,67,0.35)] w-full max-w-[480px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-[rgba(13,37,67,0.07)]">
              <div>
                <h2 className="font-['Inter'] font-semibold text-[#0d2543]" style={{ fontSize: 18 }}>Add Trainer</h2>
                <p className="font-['Inter'] text-[12px] text-[#74777E] mt-0.5">
                  A temporary password will be generated on save.
                </p>
              </div>
              <button
                onClick={() => setAddOpen(false)}
                className="text-[#74777E] hover:text-[#0d2543] p-1 rounded-md hover:bg-[#F1F4F8] transition-colors duration-150"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="font-['Inter'] font-semibold text-[11px] uppercase tracking-[0.5px] text-[#74777E] block mb-1.5">Name</label>
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="e.g. Aarav Mehta"
                  className="w-full px-3 py-2 bg-white border border-[rgba(13,37,67,0.15)] rounded-md font-['Inter'] text-[13px] text-[#0d2543] focus:outline-none focus:border-[#00658d] focus:ring-2 focus:ring-[rgba(0,101,141,0.15)] transition-all duration-150"
                />
              </div>
              <div>
                <label className="font-['Inter'] font-semibold text-[11px] uppercase tracking-[0.5px] text-[#74777E] block mb-1.5">Email</label>
                <input
                  type="email"
                  value={draftEmail}
                  onChange={(e) => setDraftEmail(e.target.value)}
                  placeholder="trainer@safetycatch.io"
                  className="w-full px-3 py-2 bg-white border border-[rgba(13,37,67,0.15)] rounded-md font-['Inter'] text-[13px] text-[#0d2543] focus:outline-none focus:border-[#00658d] focus:ring-2 focus:ring-[rgba(0,101,141,0.15)] transition-all duration-150"
                />
                {draftEmail.length > 0 && !validEmail && (
                  <p className="mt-1 font-['Inter'] text-[11px] text-[#9F2A1C]">Enter a valid email address.</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-[rgba(13,37,67,0.07)] bg-[#F7F9FC]">
              <button
                onClick={() => setAddOpen(false)}
                className="px-3.5 py-1.5 rounded-md font-['Inter'] font-semibold text-[13px] text-[#44474e] hover:bg-[#e6eaf0] transition-colors duration-150"
              >
                Cancel
              </button>
              <button
                onClick={submitTrainer}
                disabled={!canSubmit || loading}
                className="px-3.5 py-1.5 rounded-md font-['Inter'] font-semibold text-[13px] bg-[#0d2543] text-white hover:bg-[#0a1d33] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
              >
                {loading ? "Creating..." : "Create & Generate Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credential dialog */}
      {credential && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-[rgba(13,37,67,0.45)] backdrop-blur-sm p-6"
          onClick={() => setCredential(null)}
        >
          <div
            className="bg-white rounded-xl shadow-[0_24px_48px_-12px_rgba(13,37,67,0.35)] w-full max-w-[520px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-3 border-b border-[rgba(13,37,67,0.07)] flex items-start justify-between">
              <div className="flex items-start gap-2.5">
                <span className="size-8 rounded-full bg-[#E6F1E9] text-[#1E5631] flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="size-4" />
                </span>
                <div>
                  <h2 className="font-['Inter'] font-semibold text-[#0d2543]" style={{ fontSize: 18 }}>Trainer Created</h2>
                  <p className="font-['Inter'] text-[12px] text-[#74777E] mt-0.5">
                    Copy the temporary password and send it to the trainer — it won&apos;t be shown again.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCredential(null)}
                className="text-[#74777E] hover:text-[#0d2543] p-1 rounded-md hover:bg-[#F1F4F8] transition-colors duration-150"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1.5 font-['Inter'] text-[13px]">
                <span className="text-[#74777E]">Name</span>
                <span className="text-[#0d2543] font-semibold">{credential.name}</span>
                <span className="text-[#74777E]">Email</span>
                <span className="text-[#0d2543] font-semibold">{credential.email}</span>
              </div>

              <div>
                <label className="font-['Inter'] font-semibold text-[11px] uppercase tracking-[0.5px] text-[#74777E] block mb-1.5">Temporary Password</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-[#F7F9FC] border border-[rgba(13,37,67,0.10)] rounded-md font-mono text-[14px] text-[#0d2543] tracking-[0.5px] select-all break-all">
                    {credential.password}
                  </code>
                  <button
                    onClick={copyCreds}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-md font-['Inter'] font-semibold text-[12px] transition-colors duration-150 ${
                      copied
                        ? "bg-[#E6F1E9] text-[#1E5631]"
                        : "bg-[#0d2543] text-white hover:bg-[#0a1d33]"
                    }`}
                  >
                    {copied ? <CheckCircle2 className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="mt-2 font-['Inter'] text-[11px] text-[#A56A00] bg-[#FFF3D6] border border-[rgba(165,106,0,0.20)] rounded-md px-2.5 py-1.5">
                  Share via your usual secure channel. The trainer should change this on first login.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-[rgba(13,37,67,0.07)] bg-[#F7F9FC]">
              <button
                onClick={() => setCredential(null)}
                className="px-3.5 py-1.5 rounded-md font-['Inter'] font-semibold text-[13px] bg-[#0d2543] text-white hover:bg-[#0a1d33] transition-colors duration-150"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-white rounded-[10px] border border-[rgba(13,37,67,0.07)] shadow-[0_1px_2px_rgba(13,37,67,0.04)] px-4 py-3 flex items-center gap-3">
      <span className="size-1.5 rounded-full" style={{ background: accent }} />
      <div className="flex-1 min-w-0">
        <div className="font-['Inter'] font-semibold text-[11px] uppercase tracking-[0.6px] text-[#74777E]">{label}</div>
        <div className="font-['Inter'] font-semibold text-[#0d2543] tracking-[-0.2px] tabular-nums mt-0.5" style={{ fontSize: 20 }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function ProfileStat({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`px-5 py-3 ${last ? "" : "border-r border-[rgba(13,37,67,0.06)]"}`}>
      <div className="font-['Inter'] font-semibold text-[11px] uppercase tracking-[0.6px] text-[#74777E]">{label}</div>
      <div className="font-['Inter'] font-semibold text-[#0d2543] tabular-nums mt-0.5" style={{ fontSize: 18 }}>
        {value}
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left font-['Inter'] font-semibold text-[10px] text-[#74777E] uppercase tracking-[0.6px] py-2 pr-4 ${className}`}>
      {children}
    </th>
  );
}

function ToolbarSelect({
  icon,
  value,
  onChange,
  options,
}: {
  icon?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none bg-[#f3f3f5] hover:bg-[#ececef] border border-transparent hover:border-[#e2e2e4] rounded-md ${icon ? "pl-7" : "pl-2.5"} pr-6 py-1.5 font-['Inter'] font-medium text-[12px] text-[#44474e] cursor-pointer focus:bg-white focus:border-[#4493bf] focus:ring-1 focus:ring-[#4493bf] outline-none transition-all duration-150`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {icon && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#74777E] pointer-events-none">{icon}</span>}
      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-[#74777E] pointer-events-none" />
    </div>
  );
}

function StudentStatusPill({ status }: { status: StudentStatus }) {
  const meta =
    status === "Active" ? { dot: "bg-[#1E5631]", text: "text-[#1E5631]" } :
    status === "Pending Onboarding" ? { dot: "bg-[#e6a700]", text: "text-[#7a5a00]" } :
    { dot: "bg-[#74777E]", text: "text-[#44474e]" };
  return (
    <span className={`inline-flex items-center gap-1.5 font-['Inter'] text-[12px] ${meta.text}`}>
      <span className={`size-1.5 rounded-full ${meta.dot}`} />
      {status === "Pending Onboarding" ? "Pending" : status}
    </span>
  );
}

function IconBtn({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className="size-8 rounded-md flex items-center justify-center text-[#44474e] hover:bg-[#f3f3f5] hover:text-[#0d2543] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf]"
    >
      {icon}
    </button>
  );
}

function formatRelative(iso: string) {
  const then = new Date(iso).getTime();
  const now = new Date("2026-05-23").getTime();
  const days = Math.round((now - then) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}
