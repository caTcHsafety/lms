import { useMemo, useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { ISpringUploader } from "@/lib/ispringUploader";
import { toast } from "sonner";
import {
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  Video,
  FileText,
  FileBadge,
  Link2,
  HelpCircle,
  MoreHorizontal,
  RotateCcw,
  Eye,
  Pencil,
  Copy,
  Archive,
  Filter,
  ArrowUpDown,
  Folder,
  FolderOpen,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Check,
  X,
  UserPlus,
  Upload,
  FolderPlus,
  FileUp,
  Trash2,
  Users,
  GraduationCap,
  Layers,
  BookOpen,
  ArrowLeft,
  Download,
} from "lucide-react";

type ContentType = "VIDEO" | "PPT" | "PDF" | "SCORM" | "LINK" | "QUIZ" | "SLIDES" | "DOCUMENT";
type Status = "Published" | "Draft" | "Under Review" | "Archived";

type Module = {
  id: string;
  name: string;
  type: ContentType;
  trainers: string[];
  updated: string;
  status: Status;
  duration?: string;
};

type Subject = {
  id: string;
  name: string;
  modules: Module[];
};

type Course = {
  id: string;
  code: string;
  name: string;
  subjects: Subject[];
  owner: string;
};

const COURSES: Course[] = []; // Default empty, populated by Supabase

const TYPE_META: Record<ContentType, { icon: typeof Video; bg: string; fg: string }> = {
  VIDEO: { icon: Video, bg: "bg-[#dff0fa]", fg: "text-[#00587c]" },
  PPT: { icon: FileText, bg: "bg-[#ececef]", fg: "text-[#1a1c1d]" },
  PDF: { icon: FileBadge, bg: "bg-[#fde8e3]", fg: "text-[#923a1f]" },
  SCORM: { icon: FileBadge, bg: "bg-[#e6efe8]", fg: "text-[#1E5631]" },
  LINK: { icon: Link2, bg: "bg-[#eceaff]", fg: "text-[#3a3786]" },
  QUIZ: { icon: HelpCircle, bg: "bg-[#fff3d6]", fg: "text-[#7a5a00]" },
  SLIDES: { icon: FileText, bg: "bg-[#ececef]", fg: "text-[#1a1c1d]" },
  DOCUMENT: { icon: FileBadge, bg: "bg-[#fde8e3]", fg: "text-[#923a1f]" },
};

const STATUS_META: Record<Status, { dot: string; text: string; icon: typeof CheckCircle2 }> = {
  Published: { dot: "bg-[#1E5631]", text: "text-[#1E5631]", icon: CheckCircle2 },
  Draft: { dot: "bg-[#74777E]", text: "text-[#44474e]", icon: Clock },
  "Under Review": { dot: "bg-[#e6a700]", text: "text-[#7a5a00]", icon: AlertTriangle },
  Archived: { dot: "bg-[#c4c6ce]", text: "text-[#74777E]", icon: Archive },
};



const isValidUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

type Row =
  | { kind: "course"; course: Course; depth: 0 }
  | { kind: "subject"; subject: Subject; course: Course; depth: 1 }
  | { kind: "module"; module: Module; subject: Subject; course: Course; depth: 2 };

export function ContentVaultRedesigned() {
  const [courses, setCourses] = useState<Course[]>(COURSES);
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set(["cyber", "osha"]));
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set(["cyber-net", "osha-haz"]));
  const [selectedModuleId, setSelectedModuleId] = useState<string>("m1");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | ContentType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [sortBy, setSortBy] = useState<"updated" | "name">("updated");
  const [trainerOverrides, setTrainerOverrides] = useState<Record<string, string[]>>({});
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [draftTrainers, setDraftTrainers] = useState<string[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);

  // Course trainer assignment dialog
  const [courseTrainerDlgOpen, setCourseTrainerDlgOpen] = useState(false);
  const [selectedCourseForTrainer, setSelectedCourseForTrainer] = useState<Course | null>(null);
  const [courseTrainerSearch, setCourseTrainerSearch] = useState("");
  const [selectedCourseTrainers, setSelectedCourseTrainers] = useState<string[]>([]);
  const [selectedModulesForCourse, setSelectedModulesForCourse] = useState<Set<string>>(new Set());
  const [expandedSubjectsInDialog, setExpandedSubjectsInDialog] = useState<Set<string>>(new Set());

  // +New module dialog
  const [newOpen, setNewOpen] = useState(false);
  const [newMode, setNewMode] = useState<"existing" | "newSubject" | "newCourse">("existing");
  const [newCourseId, setNewCourseId] = useState<string>("cyber");
  const [newSubjectId, setNewSubjectId] = useState<string>("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newCourseCode, setNewCourseCode] = useState("");
  const [newCourseName, setNewCourseName] = useState("");
  const [newModuleName, setNewModuleName] = useState("");
  const [newModuleType, setNewModuleType] = useState<ContentType>("VIDEO");

  // New Revision uploader
  const [revOpen, setRevOpen] = useState(false);
  const [revFiles, setRevFiles] = useState<File[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [revNote, setRevNote] = useState("");
  const [revDragOver, setRevDragOver] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadProgress, setUploadProgress] = useState({ files: 0, totalFiles: 0, bytes: 0, totalBytes: 0 });
  const [uploadError, setUploadError] = useState("");
  const uploaderRef = useRef<ISpringUploader | null>(null);

  // Versions and Preview state
  const [previewVersion, setPreviewVersion] = useState<{ id: string; label: string; current: boolean; status: string; date: string; author: string; note: string; content_url: string; } | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  type Cohort = { id: string; name: string; students: number; moduleIds: string[]; created: string };

  // Cohort student details
  type CohortStudent = {
    id: string;
    fullName: string;
    email: string;
    isActive: boolean;
    modulesCompleted: number;
    totalModules: number;
    submissionsCount: number;
    lastActive: string | null;
  };
  type CohortAssignment = {
    id: string;
    title: string;
    description: string | null;
    dueDate: string | null;
    studentId: string;
    studentName: string;
    submissionStatus: string | null;
    submissionUrl: string | null;
    feedback: string | null;
    submittedAt: string | null;
    reviewedAt: string | null;
    answersJson: Record<string, string> | null;
  };
  const [cohortStudents, setCohortStudents] = useState<CohortStudent[]>([]);
  const [cohortAssignments, setCohortAssignments] = useState<CohortAssignment[]>([]);

  const loadVaultData = async () => {
    try {
      const [cr, sr, mr, tr, mvr, co, cm, cs, pr] = await Promise.all([
        supabase.from("courses").select("*").eq("is_active", true),
        supabase.from("subjects").select("*"),
        supabase.from("modules").select("*").order("order_index"),
        supabase.from("module_trainers").select("*"),
        supabase.from("module_versions").select("*").eq("is_published", true),
        supabase.from("cohorts").select("*"),
        supabase.from("cohort_modules").select("*"),
        supabase.from("cohort_students").select("*"),
        supabase.from("profiles").select("id, full_name, email").eq("role", "trainer"),
      ]);

      if (cr.data && sr.data && mr.data) {
        const builtCourses: Course[] = cr.data.map((c: any) => ({
          id: c.id,
          code: c.code || "N/A",
          name: c.title,
          owner: c.owner || "System Admin",
          subjects: sr.data
            .filter((s: any) => s.course_id === c.id)
            .map((s: any) => ({
              id: s.id,
              name: s.name,
              modules: mr.data
                .filter((m: any) => m.subject_id === s.id)
                .map((m: any) => {
                  const trainers = tr.data?.filter((t: any) => t.module_id === m.id).map((t: any) => t.trainer_name || '').filter(Boolean) || [];
                  const activeVersion = mvr.data?.find((v: any) => v.module_id === m.id);
                  return {
                    id: m.id,
                    name: m.title,
                    type: m.type as ContentType,
                    trainers,
                    updated: activeVersion ? activeVersion.created_at : m.created_at,
                    status: (activeVersion ? activeVersion.status : "Draft") as Status,
                    duration: m.duration || "N/A",
                  };
                }),
            })),
        }));
        setCourses(builtCourses);
        const allModules = builtCourses.flatMap(c => c.subjects.flatMap(s => s.modules));
        if (allModules.length > 0) {
          setSelectedModuleId((prev) => (prev && isValidUUID(prev)) ? prev : allModules[0].id);
        }
        if (builtCourses.length > 0) {
          setNewCourseId((prev) => (prev && prev !== "cyber") ? prev : builtCourses[0].id);
          const firstSubject = builtCourses.find(c => c.subjects.length > 0)?.subjects[0];
          if (firstSubject) {
            setNewSubjectId((prev) => prev ? prev : firstSubject.id);
          }
          // Expand all database courses and subjects on load
          setExpandedCourses((prev) => {
            const next = new Set(prev);
            builtCourses.forEach(c => next.add(c.id));
            return next;
          });
          setExpandedSubjects((prev) => {
            const next = new Set(prev);
            builtCourses.forEach(c => c.subjects.forEach(s => next.add(s.id)));
            return next;
          });
        }
      }

      if (co.data) {
        const builtCohorts: Cohort[] = co.data.map((c: any) => {
          const moduleIds = cm.data
            ? cm.data.filter((m: any) => m.cohort_id === c.id).map((m: any) => m.module_id)
            : [];
          const studentsCount = cs.data
            ? cs.data.filter((s: any) => s.cohort_id === c.id).length
            : 0;
          return {
            id: c.id,
            name: c.name,
            students: studentsCount,
            moduleIds: moduleIds,
            created: c.created_at ? c.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
          };
        });
        setCohorts(builtCohorts);
        
        setSelectedCohortId((prevId) => {
          if (builtCohorts.some((bc) => bc.id === prevId)) return prevId;
          return builtCohorts[0]?.id ?? "";
        });
      } else {
        setCohorts([]);
        setSelectedCohortId("");
      }

      if (pr.data) {
        setTrainers(pr.data);
      }
    } catch (err) {
      console.error("Failed to load vault data", err);
    }
  };

  // Fetch Courses and Cohorts Structure
  useEffect(() => {
    loadVaultData();
  }, []);

  // Fetch Versions for selected module
  useEffect(() => {
    async function fetchVersions() {
      if (!selectedModuleId || !isValidUUID(selectedModuleId)) {
        setVersions([]);
        return;
      }
      setLoadingVersions(true);
      const { data, error } = await supabase
        .from("module_versions")
        .select("*")
        .eq("module_id", selectedModuleId)
        .order("version_number", { ascending: false });

      if (data && !error) {
        setVersions(
          data.map((v) => ({
            id: v.id,
            label: `v${v.version_number}`,
            current: v.is_published,
            status: v.status,
            date: new Date(v.created_at).toLocaleDateString(),
            author: v.author || "System",
            note: v.note || "No note",
            content_url: v.content_url
          }))
        );
      }
      setLoadingVersions(false);
    }
    fetchVersions();
  }, [selectedModuleId]);

  const handleRestoreVersion = async (versionId: string) => {
    // Optimistic UI update
    setVersions((prev) =>
      prev.map((v) => ({
        ...v,
        current: v.id === versionId,
        status: v.id === versionId ? "Published" : "Archived",
      }))
    );

    // DB Update
    if (selectedModuleId && isValidUUID(selectedModuleId)) {
       await supabase.from("module_versions").update({ is_published: false, status: 'Archived' }).eq("module_id", selectedModuleId);
       await supabase.from("module_versions").update({ is_published: true, status: 'Published' }).eq("id", versionId);
       await loadVaultData();
    }
  };

  const handleViewVersion = async (v: any) => {
    let displayUrl = v.content_url;
    if (v.content_url && (v.content_url.includes("supabase.co/storage") || v.content_url.includes("/storage/v1/object"))) {
      const parts = v.content_url.split("module_content/");
      if (parts.length > 1) {
        const storagePath = decodeURIComponent(parts[1]);
        const { data, error } = await supabase.storage.from("module_content").createSignedUrl(storagePath, 3600);
        if (!error && data?.signedUrl) {
          displayUrl = data.signedUrl;
        }
      }
    }
    setPreviewVersion({ ...v, content_url: displayUrl });
  };

  // Sub-tab state — Modules vs Cohort Access
  const [subTab, setSubTab] = useState<"modules" | "cohorts">("modules");

  // Cohort access state
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>("");
  const [cohortSearch, setCohortSearch] = useState("");

  // Create cohort dialog (wizard)
  const [coDlgOpen, setCoDlgOpen] = useState(false);
  const [coStep, setCoStep] = useState<1 | 2 | 3 | 4>(1);
  const [coName, setCoName] = useState("");
  const [coStudents, setCoStudents] = useState<number>(0);
  const [coCourseIds, setCoCourseIds] = useState<Set<string>>(new Set());
  const [coSubjectIds, setCoSubjectIds] = useState<Set<string>>(new Set());
  const [coModuleIds, setCoModuleIds] = useState<Set<string>>(new Set());
  const [editingCohortId, setEditingCohortId] = useState<string | null>(null);

  const openCreateCohort = () => {
    setEditingCohortId(null);
    setCoStep(1);
    setCoName("");
    setCoStudents(0);
    setCoCourseIds(new Set());
    setCoSubjectIds(new Set());
    setCoModuleIds(new Set());
    setCoDlgOpen(true);
  };
  const openManageCohort = (c: Cohort) => {
    setEditingCohortId(c.id);
    setCoStep(2);
    setCoName(c.name);
    setCoStudents(c.students);
    const initialModules = new Set(c.moduleIds);
    const initialSubjects = new Set<string>();
    const initialCourses = new Set<string>();
    courses.forEach((co) =>
      co.subjects.forEach((s) =>
        s.modules.forEach((m) => {
          if (initialModules.has(m.id)) {
            initialSubjects.add(s.id);
            initialCourses.add(co.id);
          }
        })
      )
    );
    setCoCourseIds(initialCourses);
    setCoSubjectIds(initialSubjects);
    setCoModuleIds(initialModules);
    setCoDlgOpen(true);
  };
  const toggleSetItem = <T,>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, value: T) =>
    setter((prev) => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
  const saveCohort = async () => {
    if (!coName.trim()) return;
    try {
      if (editingCohortId) {
        // Update cohort name
        const { error: err1 } = await supabase
          .from("cohorts")
          .update({ name: coName.trim() })
          .eq("id", editingCohortId);
        if (err1) throw err1;

        // Clear and insert modules
        const { error: err2 } = await supabase
          .from("cohort_modules")
          .delete()
          .eq("cohort_id", editingCohortId);
        if (err2) throw err2;

        if (coModuleIds.size > 0) {
          const { error: err3 } = await supabase
            .from("cohort_modules")
            .insert(
              Array.from(coModuleIds).map((mId) => ({
                cohort_id: editingCohortId,
                module_id: mId,
                unlock_at: new Date().toISOString(),
              }))
            );
          if (err3) throw err3;
        }
        toast.success("Cohort updated successfully");
      } else {
        // Create new cohort with required start_date and end_date
        const { data: newC, error: err1 } = await supabase
          .from("cohorts")
          .insert({
            name: coName.trim(),
            start_date: new Date().toISOString().slice(0, 10),
            end_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          })
          .select()
          .single();
        if (err1) throw err1;

        if (newC && coModuleIds.size > 0) {
          const { error: err2 } = await supabase
            .from("cohort_modules")
            .insert(
              Array.from(coModuleIds).map((mId) => ({
                cohort_id: newC.id,
                module_id: mId,
                unlock_at: new Date().toISOString(),
              }))
            );
          if (err2) throw err2;
        }
        toast.success("Cohort created successfully");
        if (newC) {
          setSelectedCohortId(newC.id);
        }
      }
      setCoDlgOpen(false);
      await loadVaultData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save cohort");
    }
  };

  const deleteCohort = async (cohortId: string) => {
    if (!confirm("Are you sure you want to delete this cohort? All student and module assignments will be removed.")) {
      return;
    }
    try {
      const { error } = await supabase.from("cohorts").delete().eq("id", cohortId);
      if (error) throw error;
      toast.success("Cohort deleted successfully");
      await loadVaultData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete cohort");
    }
  };

  // Load students for selected cohort
  const loadCohortStudents = async (cohortId: string) => {
    try {
      const { data: csData } = await supabase
        .from("cohort_students")
        .select("student_id")
        .eq("cohort_id", cohortId);

      if (!csData || csData.length === 0) {
        setCohortStudents([]);
        setCohortAssignments([]);
        return;
      }

      const studentIds = csData.map((s: any) => s.student_id);

      const [profilesRes, progressRes, submissionsRes, activityRes, assignmentsRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, is_active").in("id", studentIds),
        supabase.from("student_progress").select("student_id, completed").in("student_id", studentIds),
        supabase.from("submissions").select("*").in("student_id", studentIds),
        supabase.from("activity_events").select("user_id, created_at, event_type").in("user_id", studentIds).eq("event_type", "LOGIN").order("created_at", { ascending: false }),
        supabase.from("assignments").select("*, assignment_cohorts!inner(cohort_id)").eq("assignment_cohorts.cohort_id", cohortId),
      ]);

      const cohort = cohorts.find(c => c.id === cohortId);
      const totalMods = cohort?.moduleIds.length ?? 0;

      const students: CohortStudent[] = (profilesRes.data || []).map((p: any) => {
        const completed = (progressRes.data || []).filter((pr: any) => pr.student_id === p.id && pr.completed).length;
        const subs = (submissionsRes.data || []).filter((s: any) => s.student_id === p.id).length;
        const lastEvent = (activityRes.data || []).find((a: any) => a.user_id === p.id);

        return {
          id: p.id,
          fullName: p.full_name || p.email,
          email: p.email,
          isActive: p.is_active ?? true,
          modulesCompleted: completed,
          totalModules: totalMods,
          submissionsCount: subs,
          lastActive: lastEvent?.created_at || null,
        };
      });

      // Build assignment details with submission info per student
      const assignments: CohortAssignment[] = [];
      for (const a of (assignmentsRes.data || [])) {
        for (const sid of studentIds) {
          const studentProfile = (profilesRes.data || []).find((p: any) => p.id === sid);
          const sub = (submissionsRes.data || []).find((s: any) => s.student_id === sid && s.assignment_id === a.id);
          assignments.push({
            id: a.id,
            title: a.title || "Untitled",
            description: a.description || null,
            dueDate: a.due_date || null,
            studentId: sid,
            studentName: studentProfile?.full_name || studentProfile?.email || "Unknown",
            submissionStatus: sub?.status || null,
            submissionUrl: sub?.file_url || null,
            feedback: sub?.feedback || null,
            submittedAt: sub?.submitted_at || null,
            reviewedAt: sub?.reviewed_at || null,
            answersJson: sub?.answers_json || null,
          });
        }
      }

      setCohortStudents(students);
      setCohortAssignments(assignments);
    } catch (err) {
      console.error("Failed to load cohort students", err);
      setCohortStudents([]);
      setCohortAssignments([]);
    }
  };

  // Toggle student active/inactive
  const toggleStudentAccess = async (studentId: string, currentActive: boolean) => {
    const newActive = !currentActive;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: newActive })
        .eq("id", studentId);
      if (error) throw error;

      setCohortStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, isActive: newActive } : s))
      );
      toast.success(newActive ? "Student access granted" : "Student access revoked");
    } catch (err: any) {
      toast.error(err.message || "Failed to update access");
    }
  };

  // Toggle ALL students active/inactive
  const toggleAllStudentsAccess = async (makeActive: boolean) => {
    if (cohortStudents.length === 0) return;
    try {
      const ids = cohortStudents.map(s => s.id);
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: makeActive })
        .in("id", ids);
      if (error) throw error;
      setCohortStudents((prev) => prev.map((s) => ({ ...s, isActive: makeActive })));
      toast.success(makeActive ? "All students activated" : "All students deactivated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update access");
    }
  };

  // Download cohort details as CSV
  const downloadCohortCSV = () => {
    if (!selectedCohort) return;
    const rows: string[] = [];

    // Header section
    rows.push("COHORT AUDIT REPORT");
    rows.push(`Generated,${new Date().toLocaleString()}`);
    rows.push("");
    rows.push("COHORT DETAILS");
    rows.push("Name,Students Enrolled,Modules Assigned,Created Date");
    rows.push(`"${selectedCohort.name}",${selectedCohort.students},${selectedCohort.moduleIds.length},${selectedCohort.created}`);
    rows.push("");

    // Students section
    rows.push("ENROLLED STUDENTS");
    rows.push("Name,Email,Status,Modules Completed,Total Modules,Submissions,Last Active");
    for (const s of cohortStudents) {
      rows.push(`"${s.fullName}","${s.email}",${s.isActive ? "Active" : "Inactive"},${s.modulesCompleted},${s.totalModules},${s.submissionsCount},"${s.lastActive ? new Date(s.lastActive).toLocaleString() : "Never"}"`);
    }
    rows.push("");

    // Modules section
    rows.push("ASSIGNED MODULES");
    rows.push("Module Name,Course,Subject,Type,Status");
    for (const m of cohortModules) {
      const loc = moduleLocation(m.id);
      const courseName = loc ? loc.course.name : "—";
      const subjectName = loc ? loc.subject.name : "—";
      rows.push(`"${m.name}","${courseName}","${subjectName}","${m.type}","${m.status}"`);
    }
    rows.push("");

    // Assignments & Submissions section
    rows.push("ASSIGNMENTS AND SUBMISSIONS");
    rows.push("Assignment Title,Student Name,Status,Submitted Date,Feedback,Student Answers");
    for (const a of cohortAssignments) {
      const submittedDate = a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : "Not submitted";
      const feedback = (a.feedback || "—").replace(/"/g, '""');
      // For file submissions show file URL, for DOCX block answers show inline text
      let answersText = "—";
      if (a.submissionUrl) {
        answersText = a.submissionUrl;
      } else if (a.answersJson && Object.keys(a.answersJson).length > 0) {
        // Extract plain text from HTML answers
        const div = document.createElement("div");
        answersText = Object.entries(a.answersJson)
          .map(([key, html]) => {
            div.innerHTML = html;
            return `${key}: ${div.textContent || ""}`;
          })
          .join(" | ")
          .replace(/"/g, '""');
      }
      rows.push(`"${a.title}","${a.studentName}","${a.submissionStatus || "Not submitted"}","${submittedDate}","${feedback}","${answersText}"`);
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedCohort.name.replace(/\s+/g, "_")}_audit_report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Reload students when cohort changes
  useEffect(() => {
    if (selectedCohortId && subTab === "cohorts") {
      loadCohortStudents(selectedCohortId);
    }
  }, [selectedCohortId, subTab]);

  // Per-cohort direct uploads
  type CohortUpload = { id: string; name: string; size: number; kind: ContentType; uploaded: string; courseId: string; subjectId: string; moduleId: string; note?: string; url?: string; subjectName?: string; moduleName?: string };
  const [cohortUploads, setCohortUploads] = useState<Record<string, CohortUpload[]>>({});
  const [upDlgOpen, setUpDlgOpen] = useState(false);
  const [upFiles, setUpFiles] = useState<{ name: string; size: number; kind: ContentType; file: File }[]>([]);
  const [upDragOver, setUpDragOver] = useState(false);
  const [upCourseId, setUpCourseId] = useState<string>("");
  const [upSubjectId, setUpSubjectId] = useState<string>("");
  const [upModuleId, setUpModuleId] = useState<string>("");
  const [upNote, setUpNote] = useState("");
  const [upLoading, setUpLoading] = useState(false);

  const kindFromName = (name: string): ContentType => {
    const ext = name.toLowerCase().split(".").pop() ?? "";
    if (["mp4", "mov", "webm", "avi", "mkv"].includes(ext)) return "VIDEO";
    if (["ppt", "pptx", "key"].includes(ext)) return "PPT";
    if (["pdf"].includes(ext)) return "PDF";
    if (["doc", "docx", "rtf", "txt"].includes(ext)) return "PDF";
    if (["zip", "scorm"].includes(ext)) return "SCORM";
    return "LINK";
  };
  const openUploadDialog = () => {
    setUpFiles([]);
    setUpDragOver(false);
    setUpNote("");
    // Default to first assigned module if any, else first course/subject/module
    const cohort = cohorts.find((c) => c.id === selectedCohortId);
    const firstAssignedId = cohort?.moduleIds[0];
    let defaultCourse = "";
    let defaultSubject = "";
    let defaultModule = "";
    if (firstAssignedId) {
      const loc = moduleLocation(firstAssignedId);
      if (loc) {
        defaultCourse = loc.course.id;
        defaultSubject = loc.subject.id;
        defaultModule = firstAssignedId;
      }
    }
    if (!defaultCourse) {
      const c0 = courses[0];
      defaultCourse = c0?.id ?? "";
      defaultSubject = c0?.subjects[0]?.id ?? "";
      defaultModule = c0?.subjects[0]?.modules[0]?.id ?? "";
    }
    setUpCourseId(defaultCourse);
    setUpSubjectId(defaultSubject);
    setUpModuleId(defaultModule);
    setUpDlgOpen(true);
  };
  const addUpFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).map((f) => ({ name: f.name, size: f.size, kind: kindFromName(f.name), file: f }));
    setUpFiles((prev) => [...prev, ...arr]);
  };
  const removeUpFile = (idx: number) => setUpFiles((prev) => prev.filter((_, i) => i !== idx));
  const submitUpload = async () => {
    if (!selectedCohort || upFiles.length === 0) return;
    setUpLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const TEN_MB = 10 * 1024 * 1024;
      const r2PublicUrl = import.meta.env.VITE_R2_PUBLIC_URL || '';
      const additions: CohortUpload[] = [];

      for (let i = 0; i < upFiles.length; i++) {
        const f = upFiles[i];
        const fileExt = f.name.split('.').pop()?.toLowerCase() || '';
        let contentUrl = "";

        if (f.size > TEN_MB || f.kind === "SCORM" || f.kind === "VIDEO") {
          // Large files and SCORM → R2 via presigned URL
          const r2Key = `cohort-uploads/${selectedCohort.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { data: presignData, error: presignErr } = await supabase.functions.invoke("r2-presign", {
            body: { key: r2Key, contentType: f.file.type || "application/octet-stream" },
          });
          if (presignErr || !presignData?.presignedUrl) {
            throw new Error(presignErr?.message || "Failed to get presigned URL");
          }
          const uploadResp = await fetch(presignData.presignedUrl, {
            method: "PUT",
            body: f.file,
            headers: { "Content-Type": f.file.type || "application/octet-stream" },
          });
          if (!uploadResp.ok) throw new Error(`R2 upload failed: ${uploadResp.status}`);
          contentUrl = `${r2PublicUrl}/${r2Key}`;
        } else {
          // Small files → Supabase Storage
          const uniqueName = `cohort-uploads/${selectedCohort.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { error: uploadErr } = await supabase.storage.from("module_content").upload(uniqueName, f.file);
          if (uploadErr) throw uploadErr;
          const { data: publicUrlData } = supabase.storage.from("module_content").getPublicUrl(uniqueName);
          contentUrl = publicUrlData.publicUrl;
        }

        // Get module/subject names for display
        const selectedModuleObj = courses.find(c => c.id === upCourseId)?.subjects.find(s => s.id === upSubjectId)?.modules.find(m => m.id === upModuleId);
        const selectedSubjectObj = courses.find(c => c.id === upCourseId)?.subjects.find(s => s.id === upSubjectId);

        additions.push({
          id: `up-${Date.now()}-${i}`,
          name: f.name,
          size: f.size,
          kind: f.kind,
          uploaded: today,
          courseId: upCourseId,
          subjectId: upSubjectId,
          moduleId: upModuleId,
          note: upNote.trim() || undefined,
          url: contentUrl,
          subjectName: selectedSubjectObj?.name || "",
          moduleName: selectedModuleObj?.name || "",
        });

        // Persist to cohort_uploads table
        await supabase.from("cohort_uploads").insert({
          cohort_id: selectedCohort.id,
          file_name: f.name,
          file_url: contentUrl,
          file_size_bytes: f.size,
          file_type: f.kind,
          note: upNote.trim() || null,
          module_id: upModuleId || null,
          subject_name: selectedSubjectObj?.name || null,
          module_name: selectedModuleObj?.name || null,
        });

        // If it's a video and assigned to a module, set as module's video_url
        if (f.kind === "VIDEO" && upModuleId) {
          await supabase.from("modules").update({ video_url: contentUrl }).eq("id", upModuleId);
        }
      }

      setCohortUploads((prev) => ({
        ...prev,
        [selectedCohort.id]: [...(prev[selectedCohort.id] ?? []), ...additions],
      }));
      toast.success(`${additions.length} file(s) uploaded successfully`);
      setUpDlgOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUpLoading(false);
    }
  };
  const deleteUpload = (cohortId: string, uploadId: string) => {
    setCohortUploads((prev) => ({
      ...prev,
      [cohortId]: (prev[cohortId] ?? []).filter((u) => u.id !== uploadId),
    }));
  };

  const updateModuleStatus = async (next: Status) => {
    if (!selectedModule || !isValidUUID(selectedModule.id)) {
      toast.error("Invalid module selected");
      return;
    }

    try {
      // Find current published version of this module
      const { data: currentVersions, error: fetchErr } = await supabase
        .from("module_versions")
        .select("*")
        .eq("module_id", selectedModule.id)
        .eq("is_published", true);

      if (fetchErr) throw fetchErr;

      if (currentVersions && currentVersions.length > 0) {
        // Update the status of the current published version
        const { error: updateErr } = await supabase
          .from("module_versions")
          .update({ status: next })
          .eq("id", currentVersions[0].id);

        if (updateErr) throw updateErr;
      } else {
        // Find any version of this module to update its status or insert a new one
        const { data: anyVersions, error: fetchAnyErr } = await supabase
          .from("module_versions")
          .select("*")
          .eq("module_id", selectedModule.id)
          .order("version_number", { ascending: false });

        if (fetchAnyErr) throw fetchAnyErr;

        if (anyVersions && anyVersions.length > 0) {
          const { error: updateErr } = await supabase
            .from("module_versions")
            .update({ status: next })
            .eq("id", anyVersions[0].id);

          if (updateErr) throw updateErr;
        } else {
          // If no versions exist, insert a default one
          const { error: insertErr } = await supabase
            .from("module_versions")
            .insert({
              module_id: selectedModule.id,
              version_number: 1,
              is_published: next === "Published",
              status: next,
              note: "Initial version",
              author: "System Admin",
              content_url: "https://placeholder-url.com"
            });

          if (insertErr) throw insertErr;
        }
      }

      toast.success(`Module status updated to ${next}`);
      await loadVaultData();
    } catch (err: any) {
      console.error("Failed to update status", err);
      toast.error(err.message || "Failed to update status");
    } finally {
      setStatusMenuOpen(false);
    }
  };

  const openNewDialog = () => {
    setNewMode("existing");
    setNewCourseId(selectedCourseCrumb?.id ?? courses[0]?.id ?? "");
    setNewSubjectId(selectedSubjectCrumb?.id ?? courses[0]?.subjects[0]?.id ?? "");
    setNewSubjectName("");
    setNewCourseCode("");
    setNewCourseName("");
    setNewModuleName("");
    setNewModuleType("VIDEO");
    setNewOpen(true);
  };
  const createNew = async () => {
    if (!newModuleName.trim()) return;

    try {
      let createdCourseId = newCourseId;
      let createdSubjectId = newSubjectId;
      let createdModuleId = "";

      if (newMode === "newCourse") {
        if (!newCourseName.trim() || !newSubjectName.trim()) return;

        // 1. Insert Course
        const courseCode = newCourseCode.trim() || newCourseName.trim().slice(0, 3).toUpperCase() + "-" + Math.floor(100 + Math.random() * 900);
        const { data: courseData, error: courseError } = await supabase
          .from("courses")
          .insert({
            title: newCourseName.trim(),
            code: courseCode,
            owner: "System Admin",
            is_active: true
          })
          .select()
          .single();

        if (courseError) throw courseError;
        createdCourseId = courseData.id;

        // 2. Insert Subject
        const { data: subjectData, error: subjectError } = await supabase
          .from("subjects")
          .insert({
            course_id: createdCourseId,
            name: newSubjectName.trim()
          })
          .select()
          .single();

        if (subjectError) throw subjectError;
        createdSubjectId = subjectData.id;

      } else if (newMode === "newSubject") {
        if (!newSubjectName.trim()) return;

        // 1. Insert Subject
        const { data: subjectData, error: subjectError } = await supabase
          .from("subjects")
          .insert({
            course_id: newCourseId,
            name: newSubjectName.trim()
          })
          .select()
          .single();

        if (subjectError) throw subjectError;
        createdSubjectId = subjectData.id;
      }

      // Determine order index
      const course = courses.find((c) => c.id === createdCourseId);
      const subject = course?.subjects.find((s) => s.id === createdSubjectId);
      const orderIndex = subject ? subject.modules.length : 0;

      // 3. Insert Module
      const { data: moduleData, error: moduleError } = await supabase
        .from("modules")
        .insert({
          course_id: createdCourseId,
          subject_id: createdSubjectId,
          title: newModuleName.trim(),
          type: newModuleType,
          order_index: orderIndex,
          duration: "N/A"
        })
        .select()
        .single();

      if (moduleError) throw moduleError;
      createdModuleId = moduleData.id;

      // 4. Insert Initial Version Row into module_versions
      const { error: versionError } = await supabase
        .from("module_versions")
        .insert({
          module_id: createdModuleId,
          version_number: 1,
          content_url: "https://placeholder-url.com",
          is_published: false,
          status: "Draft",
          note: "Initial module draft",
          author: "System Admin"
        });

      if (versionError) throw versionError;

      toast.success("Successfully created new content structure!");

      // Expand newly created course/subject and select module
      setExpandedCourses((s) => new Set(s).add(createdCourseId));
      setExpandedSubjects((s) => new Set(s).add(createdSubjectId));
      setSelectedModuleId(createdModuleId);
      setNewOpen(false);

      // Refresh data from DB
      await loadVaultData();

    } catch (err: any) {
      console.error("Failed to create new course/subject/module", err);
      toast.error(err.message || "Failed to create content structure");
    }
  };

  const openRevisionDialog = () => {
    setRevFiles([]);
    setRevNote("");
    setRevDragOver(false);
    setUploadStatus("idle");
    setUploadProgress({ files: 0, totalFiles: 0, bytes: 0, totalBytes: 0 });
    setUploadError("");
    setRevOpen(true);
  };
  const addRevFiles = (files: FileList | File[]) => {
    setRevFiles((prev) => [...prev, ...Array.from(files)]);
  };
  const removeRevFile = (idx: number) => setRevFiles((prev) => prev.filter((_, i) => i !== idx));
  const submitRevision = async () => {
    if (revFiles.length === 0) return;
    if (!selectedModuleId || !isValidUUID(selectedModuleId)) {
      toast.error("Cannot publish revision: Invalid module selected");
      return;
    }

    const isFolder = revFiles.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));

    if (isFolder) {
      const hasIndex = revFiles.some(f => {
        const parts = f.webkitRelativePath.split('/');
        const relativePath = parts.slice(1).join('/');
        return relativePath === 'index.html';
      });

      if (!hasIndex) {
        setUploadStatus("error");
        setUploadError("Invalid iSpring package. No index.html found.");
        return;
      }

      setUploadStatus("uploading");
      setUploadError("");

      const versionId = Date.now().toString();

      const uploader = new ISpringUploader({
        files: revFiles as unknown as FileList,
        moduleId: selectedModuleId,
        versionId,
        onProgress: (files, totalFiles, bytes, totalBytes) => {
          setUploadProgress({ files, totalFiles, bytes, totalBytes });
        },
      });

      uploaderRef.current = uploader;

      try {
        const { indexUrl } = await uploader.upload();
        
        await supabase
          .from("module_versions")
          .update({ is_published: false, status: 'Archived' })
          .eq("module_id", selectedModuleId);
          
        await supabase
          .from("modules")
          .update({ type: "SCORM" })
          .eq("id", selectedModuleId);

        const nextVerNum = versions.length > 0 ? Math.max(...versions.map(v => parseInt(v.label.replace('v', '')) || 0)) + 1 : 1;
        let authorName = "System Admin";
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
          if (profile?.full_name) {
            authorName = profile.full_name;
          }
        }

        const { data: newVer, error: insertError } = await supabase
          .from("module_versions")
          .insert({
            module_id: selectedModuleId,
            version_number: nextVerNum,
            note: revNote,
            is_published: true,
            status: 'Published',
            author: authorName,
            content_url: indexUrl
          })
          .select()
          .single();

        if (insertError) throw insertError;

        toast.success(`Successfully published revision v${nextVerNum}`);
        setUploadStatus("success");
        await loadVaultData();

      } catch (err: any) {
        setUploadStatus("error");
        setUploadError(err.message || "An error occurred during upload.");
      } finally {
        uploaderRef.current = null;
      }
    } else {
      setIsPublishing(true);
      try {
        const nextVerNum = versions.length > 0 ? Math.max(...versions.map(v => parseInt(v.label.replace('v', '')) || 0)) + 1 : 1;
        
        let authorName = "System Admin";
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
          if (profile?.full_name) {
            authorName = profile.full_name;
          }
        }

        const file = revFiles[0];
        const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
        
        let newFormat: ContentType = "VIDEO";
        if (['pdf', 'ppt', 'pptx', 'doc', 'docx'].includes(fileExt)) {
          newFormat = ['pdf', 'doc', 'docx'].includes(fileExt) ? "DOCUMENT" : "SLIDES";
        } else if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(fileExt)) {
          newFormat = "VIDEO";
        }

        let contentUrl = "";
        const TEN_MB = 10 * 1024 * 1024;
        const isVideoFile = ['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(fileExt);

        if (file.size > TEN_MB || isVideoFile) {
          // Large files and ALL videos → upload to Cloudflare R2 via presigned URL
          const r2Key = `content/${selectedModuleId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { data: presignData, error: presignErr } = await supabase.functions.invoke("r2-presign", {
            body: { key: r2Key, contentType: file.type || "application/octet-stream" },
          });
          if (presignErr || !presignData?.presignedUrl) {
            throw new Error(presignErr?.message || "Failed to get presigned URL");
          }
          const uploadResp = await fetch(presignData.presignedUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type || "application/octet-stream" },
          });
          if (!uploadResp.ok) throw new Error(`R2 upload failed: ${uploadResp.status}`);
          const r2PublicUrl = import.meta.env.VITE_R2_PUBLIC_URL || '';
          contentUrl = `${r2PublicUrl}/${r2Key}`;
        } else {
          // Small file → upload to Supabase Storage
          const uniqueName = `${selectedModuleId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { error: uploadErr } = await supabase.storage.from("module_content").upload(uniqueName, file);
          if (uploadErr) throw uploadErr;
          const { data: publicUrlData } = supabase.storage.from("module_content").getPublicUrl(uniqueName);
          contentUrl = publicUrlData.publicUrl;
        }

        await supabase
          .from("module_versions")
          .update({ is_published: false, status: 'Archived' })
          .eq("module_id", selectedModuleId);
          
        await supabase
          .from("modules")
          .update({ type: newFormat })
          .eq("id", selectedModuleId);

        const { data: newVer, error: insertError } = await supabase
          .from("module_versions")
          .insert({
            module_id: selectedModuleId,
            version_number: nextVerNum,
            note: revNote,
            is_published: true,
            status: 'Published',
            author: authorName,
            content_url: contentUrl
          })
          .select()
          .single();

        if (insertError) throw insertError;

        toast.success(`Successfully published revision v${nextVerNum}`);

        if (newVer) {
          setVersions((prev) => [
            {
              id: newVer.id,
              label: `v${newVer.version_number}`,
              current: newVer.is_published,
              status: newVer.status,
              date: new Date(newVer.created_at).toLocaleDateString(),
              author: newVer.author || "System",
              note: newVer.note || "No note",
              content_url: newVer.content_url
            },
            ...prev.map(v => ({ ...v, current: false, status: 'Archived' }))
          ]);
        }

        setCourses((prev) =>
          prev.map((c) => ({
            ...c,
            subjects: c.subjects.map((s) => ({
              ...s,
              modules: s.modules.map((m) =>
                m.id === selectedModule.id ? { ...m, updated: new Date().toISOString().slice(0, 10), status: "Published", type: newFormat } : m,
              ),
            })),
          })),
        );

        setRevOpen(false);
      } catch (err: any) {
        toast.error(err.message || "Failed to publish revision");
      } finally {
        setIsPublishing(false);
      }
    }
  };

  const getTrainers = (m: Module) => trainerOverrides[m.id] ?? m.trainers;
  const openAssignDialog = () => {
    setDraftTrainers(getTrainers(selectedModule));
    setAssignSearch("");
    setAssignOpen(true);
  };
  const toggleDraftTrainer = (name: string) =>
    setDraftTrainers((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  const saveAssign = async () => {
    if (!selectedModule || !isValidUUID(selectedModule.id)) {
      toast.error("Invalid module selected");
      return;
    }
    try {
      const originalTrainers = getTrainers(selectedModule);
      const removedTrainers = originalTrainers.filter(t => !draftTrainers.includes(t));
      const addedTrainers = draftTrainers.filter(t => !originalTrainers.includes(t));

      // 1. Delete removed trainers (by name match since that's how they're stored in module.trainers)
      if (removedTrainers.length > 0) {
        for (const tName of removedTrainers) {
          // Try by trainer_id first, fall back to name
          const trainer = trainers.find(t => t.full_name === tName);
          if (trainer) {
            await supabase.from("module_trainers").delete().match({ module_id: selectedModule.id, trainer_id: trainer.id });
          } else {
            await supabase.from("module_trainers").delete().match({ module_id: selectedModule.id, trainer_name: tName });
          }
        }
      }

      // 2. Insert new trainer assignments (with both trainer_id and trainer_name)
      if (addedTrainers.length > 0) {
        const { error: insError } = await supabase
          .from("module_trainers")
          .insert(
            addedTrainers.map((name) => {
              const trainer = trainers.find(t => t.full_name === name);
              return {
                module_id: selectedModule.id,
                trainer_name: name,
                trainer_id: trainer?.id || null,
              };
            })
          );
        if (insError) throw insError;
      }

      toast.success("Trainers assigned successfully");
      await loadVaultData();
      setAssignOpen(false);
    } catch (err: any) {
      console.error("Failed to save trainer assignments", err);
      toast.error(err.message || "Failed to save trainer assignments");
    }
  };

  const toggleCourse = (id: string) => {
    const next = new Set(expandedCourses);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedCourses(next);
  };
  const toggleSubject = (id: string) => {
    const next = new Set(expandedSubjects);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedSubjects(next);
  };

  const deleteCourse = async (courseId: string, courseName: string) => {
    if (!confirm(`Delete course "${courseName}"? This will permanently delete all subjects, modules, and versions inside it.`)) return;
    try {
      const { data: mods } = await supabase.from('modules').select('id').eq('course_id', courseId);
      const modIds = mods?.map(m => m.id) || [];

      // Clean R2 for all modules in this course (best-effort)
      if (modIds.length > 0) {
        try {
          // Delete all R2 objects under each module's content folder
          for (const modId of modIds) {
            await supabase.functions.invoke('r2-delete', { body: { prefix: `content/${modId}/` } });
          }
        } catch (r2Err) {
          console.warn("R2 cleanup failed (non-blocking):", r2Err);
        }

        await supabase.from('cohort_modules').delete().in('module_id', modIds);
        await supabase.from('module_versions').delete().in('module_id', modIds);
        await supabase.from('module_trainers').delete().in('module_id', modIds);
        await supabase.from('student_progress').delete().in('module_id', modIds);
        await supabase.from('submissions').delete().in('module_id', modIds);
        await supabase.from('modules').delete().in('id', modIds);
      }
      await supabase.from('subjects').delete().eq('course_id', courseId);
      const { error } = await supabase.from('courses').delete().eq('id', courseId);
      if (error) throw error;
      if (selectedModuleId && modIds.includes(selectedModuleId)) setSelectedModuleId('');
      toast.success(`Course "${courseName}" deleted`);
      await loadVaultData();
    } catch (err: any) {
      toast.error('Failed to delete course: ' + err.message);
    }
  };

  const deleteSubject = async (subjectId: string, subjectName: string) => {
    if (!confirm(`Delete subject "${subjectName}"? This will permanently delete all modules and versions inside it.`)) return;
    try {
      const { data: mods } = await supabase.from('modules').select('id').eq('subject_id', subjectId);
      const modIds = mods?.map(m => m.id) || [];

      // Clean R2 (best-effort)
      if (modIds.length > 0) {
        try {
          for (const modId of modIds) {
            await supabase.functions.invoke('r2-delete', { body: { prefix: `content/${modId}/` } });
          }
        } catch (r2Err) {
          console.warn("R2 cleanup failed (non-blocking):", r2Err);
        }

        await supabase.from('cohort_modules').delete().in('module_id', modIds);
        await supabase.from('module_versions').delete().in('module_id', modIds);
        await supabase.from('module_trainers').delete().in('module_id', modIds);
        await supabase.from('student_progress').delete().in('module_id', modIds);
        await supabase.from('submissions').delete().in('module_id', modIds);
        await supabase.from('modules').delete().in('id', modIds);
      }
      const { error } = await supabase.from('subjects').delete().eq('id', subjectId);
      if (error) throw error;
      if (selectedModuleId && modIds.includes(selectedModuleId)) setSelectedModuleId('');
      toast.success(`Subject "${subjectName}" deleted`);
      await loadVaultData();
    } catch (err: any) {
      toast.error('Failed to delete subject: ' + err.message);
    }
  };

  const deleteModule = async (moduleId: string, moduleName: string) => {
    if (!confirm(`Delete module "${moduleName}"? This will permanently delete all versions, files, and progress data.`)) return;
    try {
      // 1. Delete ALL R2 files under content/{moduleId}/ (index.html, data/, everything)
      try {
        await supabase.functions.invoke('r2-delete', { body: { prefix: `content/${moduleId}/` } });
      } catch (r2Err) {
        console.warn("R2 cleanup failed (non-blocking):", r2Err);
      }

      // 2. Delete DB records
      await supabase.from('cohort_modules').delete().eq('module_id', moduleId);
      await supabase.from('module_versions').delete().eq('module_id', moduleId);
      await supabase.from('module_trainers').delete().eq('module_id', moduleId);
      await supabase.from('student_progress').delete().eq('module_id', moduleId);
      await supabase.from('submissions').delete().eq('module_id', moduleId);
      const { error } = await supabase.from('modules').delete().eq('id', moduleId);
      if (error) throw error;
      if (selectedModuleId === moduleId) setSelectedModuleId('');
      toast.success(`Module "${moduleName}" deleted`);
      await loadVaultData();
    } catch (err: any) {
      toast.error('Failed to delete module: ' + err.message);
    }
  };

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const q = search.toLowerCase();

    for (const course of courses) {
      const visibleSubjects = course.subjects
        .map((subject) => {
          const visibleModules = subject.modules.filter((m) => {
            if (typeFilter !== "all" && m.type !== typeFilter) return false;
            if (statusFilter !== "all" && m.status !== statusFilter) return false;
            if (q && !(`${m.name} ${subject.name} ${course.name} ${m.trainers.join(" ")}`.toLowerCase().includes(q))) return false;
            return true;
          });
          return { subject, visibleModules };
        })
        .filter((s) => s.visibleModules.length > 0);

      if (visibleSubjects.length === 0) continue;

      out.push({ kind: "course", course, depth: 0 });
      if (!expandedCourses.has(course.id)) continue;

      for (const { subject, visibleModules } of visibleSubjects) {
        out.push({ kind: "subject", subject, course, depth: 1 });
        if (!expandedSubjects.has(subject.id)) continue;

        const sortedModules = [...visibleModules].sort((a, b) =>
          sortBy === "updated" ? b.updated.localeCompare(a.updated) : a.name.localeCompare(b.name)
        );
        for (const module of sortedModules) {
          out.push({ kind: "module", module, subject, course, depth: 2 });
        }
      }
    }
    return out;
  }, [courses, search, typeFilter, statusFilter, sortBy, expandedCourses, expandedSubjects]);

  const flatModules = useMemo(() => {
    const list: Module[] = [];
    courses.forEach((c) => c.subjects.forEach((s) => s.modules.forEach((m) => list.push(m))));
    return list;
  }, [courses]);
  const totalModules = flatModules.length;
  const publishedCount = flatModules.filter((m) => m.status === "Published").length;
  const selectedModule = flatModules.find((m) => m.id === selectedModuleId) ?? flatModules[0];
  const selectedCourseCrumb = courses.find((c) => c.subjects.some((s) => s.modules.some((m) => m.id === selectedModule.id)));
  const selectedSubjectCrumb = selectedCourseCrumb?.subjects.find((s) => s.modules.some((m) => m.id === selectedModule.id));

  const selectedCohort = cohorts.find((c) => c.id === selectedCohortId) ?? cohorts[0];
  const cohortModules = selectedCohort
    ? flatModules.filter((m) => selectedCohort.moduleIds.includes(m.id))
    : [];
  function moduleLocation(mId: string) {
    for (const c of courses) {
      for (const s of c.subjects) {
        if (s.modules.some((m) => m.id === mId)) return { course: c, subject: s };
      }
    }
    return null;
  }

  return (
    <div className="-mx-10 -my-10 h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Sub-tab bar */}
      <div className="h-12 shrink-0 bg-white border-b border-[#e2e2e4] px-5 flex items-center gap-1">
        {([
          { id: "modules", label: "Modules", icon: <Layers className="size-3.5" /> },
          { id: "cohorts", label: "Cohort Access", icon: <Users className="size-3.5" /> },
        ] as const).map((t) => {
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`relative h-full px-3.5 inline-flex items-center gap-1.5 font-['Inter'] text-[16px] font-semibold transition-colors duration-150 focus:outline-none ${
                active ? "text-[#0d2543]" : "text-[#74777E] hover:text-[#0d2543]"
              }`}
            >
              {t.icon}
              {t.label}
              <span
                className={`absolute left-2 right-2 -bottom-px h-[2px] rounded-t ${
                  active ? "bg-[#0d2543]" : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>

      {subTab === "modules" && (
      <div className="flex flex-1 min-h-0">
      {/* ── Master: list ──────────────────────────────────────── */}
      <aside className="w-[420px] shrink-0 border-r border-[#e2e2e4] bg-white flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-[#e2e2e4]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-['Inter'] font-semibold text-[#0d2543]" style={{ fontSize: 18 }}>Content Vault</h2>
              <p className="font-['Inter'] text-xs text-[#74777E] mt-0.5">
                {totalModules} modules · {publishedCount} published
              </p>
            </div>
            <button
              onClick={openNewDialog}
              className="bg-[#00658d] hover:bg-[#004d6b] active:bg-[#003d54] text-white pl-3 pr-4 py-2 rounded-full font-['Inter'] font-semibold text-sm flex items-center gap-1.5 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#00658d] focus:ring-offset-2"
            >
              <Plus className="size-4" />
              New
            </button>
          </div>

          {/* Toolbar — single row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#74777E]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search courses, modules, trainers…"
                className="w-full bg-[#f3f3f5] border border-transparent rounded-md pl-8 pr-3 py-1.5 font-['Inter'] text-sm text-[#1a1c1d] placeholder-[#74777E] focus:bg-white focus:border-[#4493bf] focus:ring-2 focus:ring-[#4493bf] outline-none transition-all duration-150"
              />
            </div>
            <ToolbarSelect
              icon={<Filter className="size-3.5" />}
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as "all" | ContentType)}
              options={[
                { value: "all", label: "All types" },
                ...Object.keys(TYPE_META).map((t) => ({ value: t, label: t })),
              ]}
            />
            <ToolbarSelect
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as "all" | Status)}
              options={[
                { value: "all", label: "All status" },
                ...Object.keys(STATUS_META).map((s) => ({ value: s, label: s })),
              ]}
            />
            <ToolbarSelect
              icon={<ArrowUpDown className="size-3.5" />}
              value={sortBy}
              onChange={(v) => setSortBy(v as "updated" | "name")}
              options={[
                { value: "updated", label: "Recent" },
                { value: "name", label: "Name A–Z" },
              ]}
            />
          </div>
        </div>

        {/* Active filter chips */}
        {(typeFilter !== "all" || statusFilter !== "all" || search) && (
          <div className="px-5 py-2 border-b border-[#f0f0f2] flex items-center gap-1.5 flex-wrap">
            {search && <Chip label={`"${search}"`} onClear={() => setSearch("")} />}
            {typeFilter !== "all" && <Chip label={`Type: ${typeFilter}`} onClear={() => setTypeFilter("all")} />}
            {statusFilter !== "all" && <Chip label={`Status: ${statusFilter}`} onClear={() => setStatusFilter("all")} />}
            <span className="ml-auto font-['Inter'] text-xs text-[#74777E]">
              {rows.filter((r) => r.kind === "module").length} results
            </span>
          </div>
        )}

        {/* Tree list — sticky column header */}
        <div className="flex-1 overflow-auto [scrollbar-width:thin] [scrollbar-color:#c4c6ce_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#c4c6ce] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#9aa0a6]">
          <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-[#e2e2e4] px-5 py-1.5 z-10">
            <div className="grid grid-cols-[1fr_auto] gap-2 font-['Inter'] font-semibold text-xs text-[#74777E] uppercase tracking-[0.6px]">
              <span>Structure</span>
              <span>Updated</span>
            </div>
          </div>

          {rows.length === 0 && (
            <div className="text-center py-16 px-5">
              <p className="font-['Inter'] text-sm text-[#74777E]">No content matches your filters.</p>
            </div>
          )}

          {rows.map((row) => {
            if (row.kind === "course") {
              const expanded = expandedCourses.has(row.course.id);
              const count = row.course.subjects.reduce((s, sub) => s + sub.modules.length, 0);
              return (
                <div
                  key={`c-${row.course.id}`}
                  className="group w-full grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center px-5 py-2 hover:bg-[#fafafb] border-b border-[#f6f6f7]"
                >
                  <button
                    onClick={() => toggleCourse(row.course.id)}
                    className="flex items-center gap-2 min-w-0 text-left focus:outline-none"
                  >
                    <ChevronRight className={`size-3.5 text-[#74777E] shrink-0 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
                    {expanded ? <FolderOpen className="size-4 text-[#0d2543] shrink-0" /> : <Folder className="size-4 text-[#0d2543] shrink-0" />}
                    <span className="font-['Inter'] font-semibold text-sm text-[#0d2543] truncate">{row.course.name}</span>
                    <span className="font-['Inter'] text-sm text-[#74777E] shrink-0">· {count}</span>
                  </button>
                  <span className="font-['Inter'] text-xs text-[#74777E] tracking-[0.2px]">{row.course.code}</span>
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      // Open course trainer assignment dialog
                      setSelectedCourseForTrainer(row.course);
                      
                      // Get all unique trainer IDs from all modules in this course
                      const allTrainerIds = new Set<string>();
                      const allModuleIds = new Set<string>();
                      const allSubjectIds = new Set<string>();
                      
                      row.course.subjects.forEach(subject => {
                        allSubjectIds.add(subject.id);
                        subject.modules.forEach(module => {
                          allModuleIds.add(module.id);
                          // Find trainer IDs for this module from trainers array
                          trainers.forEach(t => {
                            if (module.trainers.includes(t.full_name)) {
                              allTrainerIds.add(t.id);
                            }
                          });
                        });
                      });
                      
                      setSelectedCourseTrainers(Array.from(allTrainerIds));
                      setSelectedModulesForCourse(allModuleIds);
                      setExpandedSubjectsInDialog(allSubjectIds);
                      setCourseTrainerSearch("");
                      setCourseTrainerDlgOpen(true);
                    }}
                    title="Assign trainers to course"
                    className="size-6 rounded flex items-center justify-center text-[#74777E] opacity-0 group-hover:opacity-100 hover:bg-[#e6f4ea] hover:text-[#1e5631] transition-all duration-150 focus:outline-none focus:opacity-100"
                  >
                    <UserPlus className="size-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteCourse(row.course.id, row.course.name); }}
                    title="Delete course"
                    className="size-6 rounded flex items-center justify-center text-[#74777E] opacity-0 group-hover:opacity-100 hover:bg-[#fde8e8] hover:text-[#c0392b] transition-all duration-150 focus:outline-none focus:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              );
            }

            if (row.kind === "subject") {
              const expanded = expandedSubjects.has(row.subject.id);
              return (
                <div
                  key={`s-${row.subject.id}`}
                  className="group w-full grid grid-cols-[1fr_auto] gap-2 items-center pl-10 pr-3 py-1.5 hover:bg-[#fafafb] border-b border-[#f6f6f7]"
                >
                  <button
                    onClick={() => toggleSubject(row.subject.id)}
                    className="flex items-center gap-2 min-w-0 text-left focus:outline-none"
                  >
                    <ChevronRight className={`size-3 text-[#74777E] shrink-0 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
                    <span className="font-['Inter'] font-medium text-sm text-[#1a1c1d] truncate">{row.subject.name}</span>
                    <span className="font-['Inter'] text-sm text-[#74777E] shrink-0">· {row.subject.modules.length}</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSubject(row.subject.id, row.subject.name); }}
                    title="Delete subject"
                    className="size-6 rounded flex items-center justify-center text-[#74777E] opacity-0 group-hover:opacity-100 hover:bg-[#fde8e8] hover:text-[#c0392b] transition-all duration-150 focus:outline-none focus:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              );
            }

            const m = row.module;
            const isSelected = m.id === selectedModuleId;
            const TypeIcon = TYPE_META[m.type].icon;
            return (
              <div
                key={`m-${m.id}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedModuleId(m.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedModuleId(m.id)}
                className={`group w-full grid grid-cols-[1fr_auto_auto] gap-3 items-center pl-16 pr-3 py-1.5 cursor-pointer border-b border-[#f6f6f7] focus:outline-none transition-colors duration-150 ${
                  isSelected ? "bg-[#eaf3f9] border-l-2 border-l-[#00658d] pl-[62px]" : "hover:bg-[#fafafb]"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`shrink-0 size-5 rounded ${TYPE_META[m.type].bg} ${TYPE_META[m.type].fg} flex items-center justify-center`}>
                    <TypeIcon className="size-3" />
                  </span>
                  <span className={`font-['Inter'] text-[16px] truncate ${isSelected ? "text-[#0d2543] font-semibold" : "text-[#1a1c1d]"}`}>{m.name}</span>
                </div>
                <span className="font-['Inter'] text-sm text-[#74777E] shrink-0 tabular-nums">{formatRelative(m.updated)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteModule(m.id, m.name); }}
                  title="Delete module"
                  aria-label="Delete module"
                  className="size-6 rounded flex items-center justify-center text-[#74777E] opacity-0 group-hover:opacity-100 hover:bg-[#fde8e8] hover:text-[#c0392b] transition-all duration-150 focus:outline-none focus:opacity-100 focus:ring-1 focus:ring-[#4493bf]"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      {/* ── Detail: inspector ─────────────────────────────────── */}
      <main className="flex-1 min-w-0 bg-[#fafafb] flex flex-col">
        {selectedModule ? (
          <>
        {/* Breadcrumb + actions */}
        <div className="px-8 py-3 border-b border-[#e2e2e4] bg-white flex items-center justify-between gap-4">
          <nav className="flex items-center gap-1.5 min-w-0 font-['Inter'] text-sm">
            <span className="text-[#74777E]">{selectedCourseCrumb?.code}</span>
            <ChevronRight className="size-3 text-[#c4c6ce]" />
            <span className="text-[#74777E] truncate">{selectedCourseCrumb?.name}</span>
            <ChevronRight className="size-3 text-[#c4c6ce]" />
            <span className="text-[#74777E] truncate">{selectedSubjectCrumb?.name}</span>
            <ChevronRight className="size-3 text-[#c4c6ce]" />
            <span className="text-[#1a1c1d] font-semibold truncate">{selectedModule.name}</span>
          </nav>
          <div className="flex items-center gap-1 shrink-0">
            <IconBtn
              icon={<Eye className="size-4" />}
              label="Preview"
              onClick={() => {
                const currentVer = versions.find(v => v.current);
                if (currentVer) {
                  handleViewVersion(currentVer);
                } else if (versions.length > 0) {
                  handleViewVersion(versions[0]);
                } else {
                  toast.error("No versions available to preview");
                }
              }}
            />
            <IconBtn icon={<Pencil className="size-4" />} label="Edit" />
            <IconBtn icon={<Copy className="size-4" />} label="Duplicate" />
            <IconBtn icon={<Archive className="size-4" />} label="Archive" />
            <IconBtn
              icon={<Trash2 className="size-4" />}
              label="Delete module"
              onClick={() => deleteModule(selectedModule.id, selectedModule.name)}
              danger
            />
            <div className="w-px h-5 bg-[#e2e2e4] mx-1" />
            <button
              onClick={openRevisionDialog}
              className="bg-[#0d2543] hover:bg-[#0a1d33] active:bg-[#071628] text-white px-3.5 py-1.5 rounded-md font-['Inter'] font-semibold text-sm flex items-center gap-1.5 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0d2543] focus:ring-offset-2"
            >
              <RotateCcw className="size-3.5" />
              New Revision
            </button>
          </div>
        </div>

        {/* Body — left-aligned, not centered */}
        <div className="flex-1 overflow-auto px-6 py-4 [scrollbar-width:thin] [scrollbar-color:#c4c6ce_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#c4c6ce] [&::-webkit-scrollbar-thumb]:rounded-full">
          <div className="max-w-[860px] space-y-6">
            {/* Title + status row */}
            <header>
              <div className="flex items-center gap-2 mb-2">
                <TypePill type={selectedModule.type} />
                <StatusPill status={selectedModule.status} />
                {selectedModule.duration && (
                  <span className="font-['Inter'] text-sm text-[#74777E]">· {selectedModule.duration}</span>
                )}
              </div>
              <h1 className="font-['Inter'] font-semibold text-[#0d2543]" style={{ fontSize: 22 }}>
                {selectedModule.name}
              </h1>
              <p className="font-['Inter'] text-sm text-[#74777E] mt-1">
                Last updated {formatRelative(selectedModule.updated)} · Owner {selectedCourseCrumb?.owner}
              </p>
            </header>

            {/* Metadata grid — flat, no nested cards */}
            <section className="grid grid-cols-3 gap-x-8 gap-y-5 py-5 border-y border-[#e2e2e4]">
              <Meta label="Course">
                <span className="font-['Inter'] text-sm text-[#1a1c1d]">{selectedCourseCrumb?.name}</span>
              </Meta>
              <Meta label="Subject">
                <span className="font-['Inter'] text-sm text-[#1a1c1d]">{selectedSubjectCrumb?.name}</span>
              </Meta>
              <Meta label="Module Code">
                <span className="font-['Inter'] text-sm text-[#1a1c1d] tabular-nums">{selectedCourseCrumb?.code}-{selectedModule.id.toUpperCase()}</span>
              </Meta>

              <Meta label="Assigned Trainers" hint="Trainers who can deliver this module.">
                <div className="flex items-center -space-x-1.5">
                  {getTrainers(selectedModule).length === 0 && (
                    <span className="font-['Inter'] text-sm text-[#74777E] italic mr-2">No trainers assigned</span>
                  )}
                  {getTrainers(selectedModule).slice(0, 3).map((t, i) => (
                    <span
                      key={t}
                      title={t}
                      className="size-6 rounded-full bg-[#dff0fa] border border-white flex items-center justify-center font-['Inter'] font-semibold text-sm text-[#00587c]"
                      style={{ zIndex: 10 - i }}
                    >
                      {t.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                    </span>
                  ))}
                  {getTrainers(selectedModule).length > 3 && (
                    <span
                      title={getTrainers(selectedModule).slice(3).join(", ")}
                      className="size-6 rounded-full bg-[#0d2543] border border-white flex items-center justify-center font-['Inter'] font-semibold text-sm text-white"
                      style={{ zIndex: 1 }}
                    >
                      +{getTrainers(selectedModule).length - 3}
                    </span>
                  )}
                  <button
                    onClick={openAssignDialog}
                    className="ml-3 font-['Inter'] text-sm text-[#00658d] hover:text-[#004d6b] hover:underline transition-colors duration-150 focus:outline-none focus:underline"
                  >
                    Manage ({getTrainers(selectedModule).length})
                  </button>
                </div>
              </Meta>

              <Meta label="Status">
                <div className="relative inline-block">
                  <button
                    type="button"
                    onClick={() => setStatusMenuOpen((o) => !o)}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 -mx-2 -my-1 hover:bg-[#F1F4F8] transition-colors duration-150 focus:outline-none focus:bg-[#F1F4F8]"
                  >
                    <StatusPill status={selectedModule.status} />
                    <ChevronDown className="size-3 text-[#74777E]" />
                  </button>
                  {statusMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setStatusMenuOpen(false)} />
                      <div className="absolute left-0 mt-1 z-20 min-w-[170px] rounded-lg border border-[rgba(13,37,67,0.10)] bg-white shadow-[0_10px_24px_-6px_rgba(13,37,67,0.18)] py-1">
                        {(Object.keys(STATUS_META) as Status[]).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => updateModuleStatus(s)}
                            className="w-full flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-[#F1F4F8] transition-colors duration-100"
                          >
                            <StatusPill status={s} />
                            {selectedModule.status === s && <Check className="size-3.5 text-[#00658d]" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </Meta>

              <Meta label="Format">
                <TypePill type={selectedModule.type} />
              </Meta>
            </section>

            {/* Version history — left-aligned table, hover actions */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-['Inter'] font-semibold text-[#0d2543]" style={{ fontSize: 15 }}>Version history</h2>
                <span className="font-['Inter'] text-sm text-[#74777E]">{versions.length} revisions</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e2e2e4]">
                    <th className="text-left font-['Inter'] font-semibold text-xs text-[#74777E] uppercase tracking-[0.6px] py-2 pr-3 w-[80px]">Version</th>
                    <th className="text-left font-['Inter'] font-semibold text-xs text-[#74777E] uppercase tracking-[0.6px] py-2 pr-3">Note</th>
                    <th className="text-left font-['Inter'] font-semibold text-xs text-[#74777E] uppercase tracking-[0.6px] py-2 pr-3 w-[140px]">Author</th>
                    <th className="text-left font-['Inter'] font-semibold text-xs text-[#74777E] uppercase tracking-[0.6px] py-2 pr-3 w-[110px]">Date</th>
                    <th className="text-right font-['Inter'] font-semibold text-xs text-[#74777E] uppercase tracking-[0.6px] py-2 w-[100px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v) => (
                    <tr key={v.id} className="group border-b border-[#f0f0f2] hover:bg-white transition-colors duration-150">
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`size-1.5 rounded-full ${v.current ? "bg-[#00658d]" : "bg-[#c4c6ce]"}`} />
                          <span className={`font-['Inter'] text-[16px] tabular-nums ${v.current ? "font-semibold text-[#0d2543]" : "text-[#44474e]"}`}>{v.label}</span>
                          {v.current && (
                            <span className="font-['Inter'] font-semibold text-xs text-[#00658d] uppercase tracking-[0.5px]">Current</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 font-['Inter'] text-sm text-[#1a1c1d] truncate max-w-[360px]">{v.note}</td>
                      <td className="py-2.5 pr-3 font-['Inter'] text-sm text-[#44474e]">{v.author}</td>
                      <td className="py-2.5 pr-3 font-['Inter'] text-sm text-[#44474e] tabular-nums">{v.date}</td>
                      <td className="py-2.5 text-right">
                        <div className="inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
                          <button onClick={() => handleViewVersion(v)} className="px-2 py-1 rounded font-['Inter'] font-semibold text-xs text-[#44474e] hover:bg-[#f3f3f5] hover:text-[#0d2543] uppercase tracking-[0.5px] transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-[#4493bf]">View</button>
                          {!v.current && (
                            <button onClick={() => handleRestoreVersion(v.id)} className="px-2 py-1 rounded font-['Inter'] font-semibold text-xs text-[#1E5631] hover:bg-[#e6efe8] uppercase tracking-[0.5px] transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-[#4493bf]">Restore</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center font-['Inter'] text-[#74777E]">
            No modules available. Create a course and module first.
          </div>
        )}
      </main>
      </div>
      )}

      {subTab === "cohorts" && (
        <div className="flex flex-1 min-h-0">
          {/* Master: cohort list */}
          <aside className="w-[420px] shrink-0 border-r border-[#e2e2e4] bg-white flex flex-col">
            <div className="px-5 pt-5 pb-3 border-b border-[#e2e2e4]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-['Inter'] font-semibold text-[#0d2543]" style={{ fontSize: 18 }}>Cohorts</h2>
                  <p className="font-['Inter'] text-xs text-[#74777E] mt-0.5">
                    {cohorts.length} cohorts · {cohorts.reduce((s, c) => s + c.students, 0)} students
                  </p>
                </div>
                <button
                  onClick={openCreateCohort}
                  className="bg-[#00658d] hover:bg-[#004d6b] active:bg-[#003d54] text-white pl-3 pr-4 py-2 rounded-full font-['Inter'] font-semibold text-sm flex items-center gap-1.5 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#00658d] focus:ring-offset-2"
                >
                  <Plus className="size-4" />
                  New Cohort
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#74777E]" />
                <input
                  value={cohortSearch}
                  onChange={(e) => setCohortSearch(e.target.value)}
                  placeholder="Search cohorts…"
                  className="w-full bg-[#f3f3f5] border border-transparent rounded-md pl-8 pr-3 py-1.5 font-['Inter'] text-sm text-[#1a1c1d] placeholder-[#74777E] focus:bg-white focus:border-[#4493bf] focus:ring-2 focus:ring-[#4493bf] outline-none transition-all duration-150"
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {cohorts
                .filter((c) => !cohortSearch || c.name.toLowerCase().includes(cohortSearch.toLowerCase()))
                .map((c) => {
                  const active = c.id === selectedCohortId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCohortId(c.id)}
                      className={`w-full text-left px-5 py-3.5 border-b border-[#f0f0f2] transition-colors duration-100 ${
                        active ? "bg-[#eaf3f9]" : "hover:bg-[#fafafa]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className={`font-['Inter'] text-[16px] truncate ${active ? "font-semibold text-[#0d2543]" : "font-medium text-[#1a1c1d]"}`}>{c.name}</div>
                          <div className="flex items-center gap-3 mt-1 font-['Inter'] text-sm text-[#74777E]">
                            <span className="inline-flex items-center gap-1"><GraduationCap className="size-3" />{c.students} students</span>
                            <span className="inline-flex items-center gap-1"><BookOpen className="size-3" />{c.moduleIds.length} modules</span>
                          </div>
                        </div>
                        <ChevronRight className="size-4 text-[#c4c6ce] shrink-0 mt-0.5" />
                      </div>
                    </button>
                  );
                })}
              {cohorts.length === 0 && (
                <div className="px-5 py-6 text-center font-['Inter'] text-sm text-[#74777E]">
                  No cohorts yet. Create one to assign course materials.
                </div>
              )}
            </div>
          </aside>

          {/* Detail: assigned modules for selected cohort */}
          <main className="flex-1 min-w-0 bg-[#fafafa] overflow-auto">
            {selectedCohort && (
              <>
                <div className="bg-white border-b border-[#e2e2e4] px-8 py-5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-['Inter'] font-semibold text-[#0d2543] text-[20px] truncate">{selectedCohort.name}</h2>
                    <div className="flex items-center gap-4 mt-1 font-['Inter'] text-sm text-[#74777E]">
                      <span className="inline-flex items-center gap-1"><GraduationCap className="size-3.5" />{selectedCohort.students} students</span>
                      <span className="inline-flex items-center gap-1"><BookOpen className="size-3.5" />{selectedCohort.moduleIds.length} modules assigned</span>
                      <span>Created {formatRelative(selectedCohort.created)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={downloadCohortCSV}
                      className="bg-white border border-[#c4c6ce] hover:bg-[#fafafa] text-[#0d2543] px-4 py-2 rounded-md font-['Inter'] font-semibold text-sm inline-flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-[#4493bf]"
                    >
                      <Download className="size-3.5" />
                      CSV
                    </button>
                    <button
                      onClick={() => openManageCohort(selectedCohort)}
                      className="bg-[#0d2543] hover:bg-[#0a1d33] text-white px-4 py-2 rounded-md font-['Inter'] font-semibold text-sm inline-flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-[#4493bf]"
                    >
                      <Pencil className="size-3.5" />
                      Manage Content
                    </button>
                    <button
                      onClick={() => deleteCohort(selectedCohort.id)}
                      className="bg-[#c0392b] hover:bg-[#a93226] text-white px-4 py-2 rounded-md font-['Inter'] font-semibold text-sm inline-flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-[#c0392b]"
                    >
                      <Trash2 className="size-3.5" />
                      Delete Cohort
                    </button>
                  </div>
                </div>

                <div className="p-8">
                  <h3 className="font-['Inter'] font-semibold text-xs text-[#44474e] uppercase tracking-[0.6px] mb-3">Assigned Modules</h3>
                  {cohortModules.length === 0 ? (
                    <div className="bg-white rounded-xl border border-dashed border-[#c4c6ce] p-12 text-center">
                      <Users className="size-8 text-[#c4c6ce] mx-auto mb-3" />
                      <p className="font-['Inter'] text-sm text-[#74777E] mb-4">No content assigned to this cohort yet.</p>
                      <button
                        onClick={() => openManageCohort(selectedCohort)}
                        className="bg-[#00658d] hover:bg-[#004d6b] text-white px-4 py-2 rounded-md font-['Inter'] font-semibold text-sm"
                      >
                        Assign Content
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-[#e2e2e4] overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-[#fafafa] border-b border-[#e2e2e4]">
                          <tr>
                            <th className="text-left font-['Inter'] font-semibold text-xs uppercase tracking-[0.6px] text-[#74777E] px-4 py-2.5">MODULE</th>
                            <th className="text-left font-['Inter'] font-semibold text-xs uppercase tracking-[0.6px] text-[#74777E] px-4 py-2.5">COURSE / SUBJECT</th>
                            <th className="text-left font-['Inter'] font-semibold text-xs uppercase tracking-[0.6px] text-[#74777E] px-4 py-2.5">Type</th>
                            <th className="text-left font-['Inter'] font-semibold text-xs uppercase tracking-[0.6px] text-[#74777E] px-4 py-2.5">Status</th>
                            <th className="text-left font-['Inter'] font-semibold text-xs uppercase tracking-[0.6px] text-[#74777E] px-4 py-2.5">Updated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cohortModules.map((m) => {
                            const loc = moduleLocation(m.id);
                            return (
                              <tr key={m.id} className="border-b border-[#f0f0f2] last:border-b-0 hover:bg-[#fafafa]">
                                <td className="px-4 py-3 font-['Inter'] text-sm text-[#1a1c1d] font-medium">{m.name}</td>
                                <td className="px-4 py-3 font-['Inter'] text-sm text-[#74777E]">
                                  {loc ? `${loc.course.name} · ${loc.subject.name}` : "—"}
                                </td>
                                <td className="px-4 py-3"><TypePill type={m.type} /></td>
                                <td className="px-4 py-3"><StatusPill status={m.status} /></td>
                                <td className="px-4 py-3 font-['Inter'] text-sm text-[#74777E] tabular-nums">{formatRelative(m.updated)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Cohort Students */}
                  <div className="mt-8">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-['Inter'] font-semibold text-xs text-[#44474e] uppercase tracking-[0.6px]">Students</h3>
                      <div className="flex items-center gap-2">
                        {cohortStudents.length > 0 && (
                          <>
                            <button
                              onClick={() => toggleAllStudentsAccess(true)}
                              className="px-2.5 py-1 rounded-md text-[11px] font-semibold font-['Inter'] bg-[#e6f4ea] text-[#1e7e34] hover:bg-[#c8e6c9] transition-colors"
                            >
                              Activate All
                            </button>
                            <button
                              onClick={() => toggleAllStudentsAccess(false)}
                              className="px-2.5 py-1 rounded-md text-[11px] font-semibold font-['Inter'] bg-[#fde8e8] text-[#c0392b] hover:bg-[#f5c6cb] transition-colors"
                            >
                              Deactivate All
                            </button>
                          </>
                        )}
                        <span className="font-['Inter'] text-sm text-[#74777E]">
                          {cohortStudents.length} enrolled
                        </span>
                      </div>
                    </div>
                    {cohortStudents.length === 0 ? (
                      <div className="bg-white rounded-xl border border-dashed border-[#c4c6ce] p-8 text-center">
                        <GraduationCap className="size-7 text-[#c4c6ce] mx-auto mb-2" />
                        <p className="font-['Inter'] text-sm text-[#74777E]">
                          No students enrolled in this cohort yet.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl border border-[#e2e2e4] overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-[#fafafa] border-b border-[#e2e2e4]">
                            <tr>
                              <th className="text-left font-['Inter'] font-semibold text-xs uppercase tracking-[0.6px] text-[#74777E] px-4 py-2.5">Student</th>
                              <th className="text-left font-['Inter'] font-semibold text-xs uppercase tracking-[0.6px] text-[#74777E] px-4 py-2.5">Progress</th>
                              <th className="text-left font-['Inter'] font-semibold text-xs uppercase tracking-[0.6px] text-[#74777E] px-4 py-2.5">Submissions</th>
                              <th className="text-left font-['Inter'] font-semibold text-xs uppercase tracking-[0.6px] text-[#74777E] px-4 py-2.5">Last Active</th>
                              <th className="text-center font-['Inter'] font-semibold text-xs uppercase tracking-[0.6px] text-[#74777E] px-4 py-2.5">Access</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cohortStudents.map((student) => (
                              <tr key={student.id} className="border-b border-[#f0f0f2] last:border-b-0 hover:bg-[#fafafa]">
                                <td className="px-4 py-3">
                                  <div className="font-['Inter'] text-sm text-[#1a1c1d] font-medium">{student.fullName}</div>
                                  <div className="font-['Inter'] text-xs text-[#74777E]">{student.email}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-24 h-1.5 bg-[#e2e2e4] rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-[#00658d] rounded-full transition-all"
                                        style={{ width: `${student.totalModules > 0 ? (student.modulesCompleted / student.totalModules) * 100 : 0}%` }}
                                      />
                                    </div>
                                    <span className="font-['Inter'] text-xs text-[#74777E] tabular-nums">
                                      {student.modulesCompleted}/{student.totalModules}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-['Inter'] text-sm text-[#74777E] tabular-nums">
                                  {student.submissionsCount}
                                </td>
                                <td className="px-4 py-3 font-['Inter'] text-sm text-[#74777E] tabular-nums">
                                  {student.lastActive ? formatRelative(student.lastActive) : "Never"}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <button
                                    onClick={() => toggleStudentAccess(student.id, student.isActive)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold font-['Inter'] transition-colors ${
                                      student.isActive
                                        ? "bg-[#e6f4ea] text-[#1e7e34] hover:bg-[#c8e6c9]"
                                        : "bg-[#fde8e8] text-[#c0392b] hover:bg-[#f5c6cb]"
                                    }`}
                                  >
                                    {student.isActive ? "Active" : "Inactive"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  {/* Cohort Assignments & Submissions */}
                  <div className="mt-8">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-['Inter'] font-semibold text-xs text-[#44474e] uppercase tracking-[0.6px]">Assignments & Submissions</h3>
                      <span className="font-['Inter'] text-sm text-[#74777E]">
                        {[...new Set(cohortAssignments.map(a => a.id))].length} assignments
                      </span>
                    </div>
                    {cohortAssignments.length === 0 ? (
                      <div className="bg-white rounded-xl border border-dashed border-[#c4c6ce] p-8 text-center">
                        <FileUp className="size-7 text-[#c4c6ce] mx-auto mb-2" />
                        <p className="font-['Inter'] text-sm text-[#74777E]">
                          No assignments given to this cohort yet.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {[...new Set(cohortAssignments.map(a => a.id))].map((assignmentId) => {
                          const assignment = cohortAssignments.find(a => a.id === assignmentId)!;
                          const studentSubmissions = cohortAssignments.filter(a => a.id === assignmentId);
                          return (
                            <div key={assignmentId} className="bg-white rounded-xl border border-[#e2e2e4] overflow-hidden">
                              <div className="px-4 py-3 border-b border-[#f0f0f2] bg-[#fafafa]">
                                <div className="font-['Inter'] text-sm font-semibold text-[#0d2543]">{assignment.title}</div>
                                {assignment.description && (
                                  <p className="font-['Inter'] text-xs text-[#74777E] mt-0.5">{assignment.description}</p>
                                )}
                                {assignment.dueDate && (
                                  <span className="font-['Inter'] text-xs text-[#74777E] mt-1 inline-block">Due: {assignment.dueDate.slice(0, 10)}</span>
                                )}
                              </div>
                              <table className="w-full">
                                <thead className="border-b border-[#f0f0f2]">
                                  <tr>
                                    <th className="text-left font-['Inter'] font-semibold text-[10px] uppercase tracking-[0.5px] text-[#74777E] px-4 py-2">Student</th>
                                    <th className="text-left font-['Inter'] font-semibold text-[10px] uppercase tracking-[0.5px] text-[#74777E] px-4 py-2">Status</th>
                                    <th className="text-left font-['Inter'] font-semibold text-[10px] uppercase tracking-[0.5px] text-[#74777E] px-4 py-2">Submitted</th>
                                    <th className="text-left font-['Inter'] font-semibold text-[10px] uppercase tracking-[0.5px] text-[#74777E] px-4 py-2">Feedback</th>
                                    <th className="text-left font-['Inter'] font-semibold text-[10px] uppercase tracking-[0.5px] text-[#74777E] px-4 py-2">File</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {studentSubmissions.map((sub) => (
                                    <tr key={`${sub.id}-${sub.studentId}`} className="border-b border-[#f0f0f2] last:border-b-0">
                                      <td className="px-4 py-2 font-['Inter'] text-xs text-[#1a1c1d]">{sub.studentName}</td>
                                      <td className="px-4 py-2">
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                          sub.submissionStatus === "approved" ? "bg-[#e6f4ea] text-[#1e7e34]" :
                                          sub.submissionStatus === "needs_revision" ? "bg-[#fff3cd] text-[#856404]" :
                                          sub.submissionStatus === "pending" ? "bg-[#e8f0fe] text-[#1a73e8]" :
                                          "bg-[#f3f3f5] text-[#74777E]"
                                        }`}>
                                          {sub.submissionStatus || "Not submitted"}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 font-['Inter'] text-xs text-[#74777E] tabular-nums">
                                        {sub.submittedAt ? formatRelative(sub.submittedAt) : "—"}
                                      </td>
                                      <td className="px-4 py-2 font-['Inter'] text-xs text-[#74777E] max-w-[200px] truncate">
                                        {sub.feedback || "—"}
                                      </td>
                                      <td className="px-4 py-2">
                                        {sub.submissionUrl ? (
                                          <a href={sub.submissionUrl} target="_blank" rel="noopener noreferrer" className="text-[#00658d] text-xs hover:underline">View Submission</a>
                                        ) : sub.answersJson && Object.keys(sub.answersJson).length > 0 ? (
                                          <span className="text-[#1e7e34] text-xs font-medium">✓ Answered</span>
                                        ) : "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
            {!selectedCohort && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#fafafa]">
                <Users className="size-12 text-[#c4c6ce] mb-3" />
                <h3 className="font-['Inter'] font-semibold text-lg text-[#0d2543]">No Cohort Selected</h3>
                <p className="font-['Inter'] text-sm text-[#74777E] max-w-sm mt-1">
                  Select a cohort from the list on the left, or create a new cohort to assign custom course modules and upload private materials.
                </p>
              </div>
            )}
          </main>
        </div>
      )}

      {upDlgOpen && selectedCohort && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(13,37,67,0.45)] backdrop-blur-sm p-6"
          onClick={() => setUpDlgOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-[0_20px_60px_rgba(13,37,67,0.25)] w-[640px] max-w-full max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[rgba(15,32,60,0.07)] flex items-center justify-between">
              <div>
                <h2 className="font-['Inter'] font-semibold text-[17px] text-[#0B1B33]">Upload Content</h2>
                <p className="font-['Inter'] text-sm text-[#74777E] mt-0.5">
                  For <span className="font-semibold text-[#0d2543]">{selectedCohort.name}</span> · video, PPT, PDF, DOCX
                </p>
              </div>
              <button onClick={() => setUpDlgOpen(false)} className="size-8 rounded-md hover:bg-[#f3f3f5] flex items-center justify-center text-[#74777E]">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-4">
              {/* Course / Subject / Module selectors with create-new */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-['Inter'] font-semibold text-xs text-[#74777E] uppercase tracking-[0.6px] mb-1 block">Course</label>
                  <select
                    value={upCourseId}
                    onChange={async (e) => {
                      const id = e.target.value;
                      if (id === "__new__") {
                        const name = prompt("Enter new course name:");
                        if (!name?.trim()) return;
                        const code = name.trim().substring(0, 4).toUpperCase() + "-" + Date.now().toString(36).slice(-3);
                        const { data, error } = await supabase.from("courses").insert({ title: name.trim(), code, is_active: true }).select().single();
                        if (error) { toast.error(error.message); return; }
                        toast.success("Course created");
                        await loadVaultData();
                        setUpCourseId(data.id);
                      } else {
                        setUpCourseId(id);
                        const c = courses.find((cc) => cc.id === id);
                        const s0 = c?.subjects[0];
                        setUpSubjectId(s0?.id ?? "");
                        setUpModuleId(s0?.modules[0]?.id ?? "");
                      }
                    }}
                    className="w-full bg-white border border-[#c4c6ce] rounded-md px-2.5 py-2 font-['Inter'] text-sm focus:border-[#4493bf] focus:ring-2 focus:ring-[#4493bf] outline-none"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                    <option value="__new__">+ Create New Course</option>
                  </select>
                </div>
                <div>
                  <label className="font-['Inter'] font-semibold text-xs text-[#74777E] uppercase tracking-[0.6px] mb-1 block">Subject</label>
                  <select
                    value={upSubjectId}
                    onChange={async (e) => {
                      const id = e.target.value;
                      if (id === "__new__") {
                        const name = prompt("Enter new subject name:");
                        if (!name?.trim() || !upCourseId) return;
                        const { data, error } = await supabase.from("subjects").insert({ name: name.trim(), course_id: upCourseId }).select().single();
                        if (error) { toast.error(error.message); return; }
                        toast.success("Subject created");
                        await loadVaultData();
                        setUpSubjectId(data.id);
                      } else {
                        setUpSubjectId(id);
                        const c = courses.find((cc) => cc.id === upCourseId);
                        const s = c?.subjects.find((ss) => ss.id === id);
                        setUpModuleId(s?.modules[0]?.id ?? "");
                      }
                    }}
                    disabled={!upCourseId}
                    className="w-full bg-white border border-[#c4c6ce] rounded-md px-2.5 py-2 font-['Inter'] text-sm focus:border-[#4493bf] focus:ring-2 focus:ring-[#4493bf] outline-none disabled:bg-[#f3f3f5]"
                  >
                    {(courses.find((c) => c.id === upCourseId)?.subjects ?? []).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                    <option value="__new__">+ Create New Subject</option>
                  </select>
                </div>
                <div>
                  <label className="font-['Inter'] font-semibold text-xs text-[#74777E] uppercase tracking-[0.6px] mb-1 block">Module</label>
                  <select
                    value={upModuleId}
                    onChange={async (e) => {
                      const id = e.target.value;
                      if (id === "__new__") {
                        const name = prompt("Enter new module name:");
                        if (!name?.trim() || !upSubjectId) return;
                        const code = "M-" + Date.now().toString(36).slice(-4).toUpperCase();
                        const { data, error } = await supabase.from("modules").insert({ title: name.trim(), subject_id: upSubjectId, type: "SCORM", code }).select().single();
                        if (error) { toast.error(error.message); return; }
                        toast.success("Module created");
                        await loadVaultData();
                        setUpModuleId(data.id);
                      } else {
                        setUpModuleId(id);
                      }
                    }}
                    disabled={!upSubjectId}
                    className="w-full bg-white border border-[#c4c6ce] rounded-md px-2.5 py-2 font-['Inter'] text-sm focus:border-[#4493bf] focus:ring-2 focus:ring-[#4493bf] outline-none disabled:bg-[#f3f3f5]"
                  >
                    {(() => {
                      const moduleList = courses.find((c) => c.id === upCourseId)?.subjects.find((s) => s.id === upSubjectId)?.modules ?? [];
                      if (moduleList.length === 0) {
                        return <option value="">No modules available - create one</option>;
                      }
                      return moduleList.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ));
                    })()}
                    <option value="__new__">+ Create New Module</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-['Inter'] font-semibold text-xs text-[#74777E] uppercase tracking-[0.6px] mb-1 block">Note (optional)</label>
                <input
                  value={upNote}
                  onChange={(e) => setUpNote(e.target.value)}
                  placeholder="e.g. Supplementary case study for this cohort"
                  className="w-full bg-white border border-[#c4c6ce] rounded-md px-3 py-2 font-['Inter'] text-sm focus:border-[#4493bf] focus:ring-2 focus:ring-[#4493bf] outline-none"
                />
              </div>

              <label
                onDragOver={(e) => { e.preventDefault(); setUpDragOver(true); }}
                onDragLeave={() => setUpDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setUpDragOver(false);
                  if (e.dataTransfer.files) addUpFiles(e.dataTransfer.files);
                }}
                className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors duration-150 ${
                  upDragOver ? "border-[#4493bf] bg-[#eaf3f9]" : "border-[#c4c6ce] hover:bg-[#fafafa]"
                }`}
              >
                <input
                  type="file"
                  multiple
                  accept=".mp4,.mov,.webm,.avi,.mkv,.ppt,.pptx,.key,.pdf,.doc,.docx,.rtf,.txt,.zip"
                  className="hidden"
                  onChange={(e) => e.target.files && addUpFiles(e.target.files)}
                />
                <FileUp className="size-8 text-[#74777E] mx-auto mb-2" />
                <p className="font-['Inter'] text-sm text-[#1a1c1d] font-semibold">Drop files or click to browse</p>
                <p className="font-['Inter'] text-sm text-[#74777E] mt-1">MP4 · PPT · PDF · DOCX · SCORM (zip)</p>
              </label>

              {upFiles.length > 0 && (
                <div className="border border-[#e2e2e4] rounded-lg divide-y divide-[#f0f0f2]">
                  {upFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2">
                      <TypePill type={f.kind} />
                      <span className="font-['Inter'] text-sm text-[#1a1c1d] flex-1 truncate">{f.name}</span>
                      <span className="font-['Inter'] text-sm text-[#74777E] tabular-nums">{formatBytes(f.size)}</span>
                      <button
                        onClick={() => removeUpFile(i)}
                        className="size-7 inline-flex items-center justify-center rounded-md text-[#74777E] hover:bg-[#f3f3f5] hover:text-[#c0392b]"
                        aria-label="Remove"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[rgba(15,32,60,0.07)] flex items-center justify-end gap-2 bg-[#F7F9FC]">
              <button
                onClick={() => setUpDlgOpen(false)}
                className="px-4 py-2 rounded-lg font-['Inter'] font-semibold text-sm text-[#44474e] hover:bg-white border border-transparent hover:border-[rgba(15,32,60,0.08)]"
              >
                Cancel
              </button>
              <button
                onClick={submitUpload}
                disabled={upFiles.length === 0 || upLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-['Inter'] font-semibold text-sm text-white bg-[#0d2543] hover:bg-[#0a1d36] disabled:bg-[#c4c6ce] disabled:cursor-not-allowed"
              >
                <Upload className="size-3.5" />
                {upLoading ? "Uploading…" : `Upload ${upFiles.length > 0 ? `(${upFiles.length})` : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {coDlgOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(13,37,67,0.45)] backdrop-blur-sm p-6"
          onClick={() => setCoDlgOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-[0_20px_60px_rgba(13,37,67,0.25)] w-[760px] max-w-full max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[rgba(15,32,60,0.07)] flex items-center justify-between">
              <div>
                <h2 className="font-['Inter'] font-semibold text-[17px] text-[#0B1B33]">
                  {editingCohortId ? "Manage Cohort Content" : "Create Cohort"}
                </h2>
                <p className="font-['Inter'] text-sm text-[#74777E] mt-0.5">Step {coStep} of 4 — {["Cohort details", "Select courses (optional)", "Select subjects (optional)", "Select modules (optional)"][coStep - 1]}</p>
              </div>
              <button onClick={() => setCoDlgOpen(false)} className="size-8 rounded-md hover:bg-[#f3f3f5] flex items-center justify-center text-[#74777E]">
                <X className="size-4" />
              </button>
            </div>

            {/* Stepper */}
            <div className="px-6 py-3 border-b border-[#f0f0f2] flex items-center gap-2">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="flex items-center gap-2 flex-1">
                  <div className={`size-6 rounded-full inline-flex items-center justify-center font-['Inter'] text-[16px] font-bold ${coStep >= n ? "bg-[#0d2543] text-white" : "bg-[#e2e2e4] text-[#74777E]"}`}>{n}</div>
                  {n < 4 && <div className={`h-px flex-1 ${coStep > n ? "bg-[#0d2543]" : "bg-[#e2e2e4]"}`} />}
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-auto p-6">
              {coStep === 1 && (
                <div className="space-y-4 max-w-[480px]">
                  <div>
                    <label className="font-['Inter'] font-semibold text-xs text-[#44474e] uppercase tracking-[0.6px] mb-1.5 block">Cohort name</label>
                    <input
                      autoFocus
                      value={coName}
                      onChange={(e) => setCoName(e.target.value)}
                      placeholder="e.g. Cyber Cohort — Fall 2026"
                      className="w-full bg-white border border-[#c4c6ce] rounded-md px-3 py-2 font-['Inter'] text-sm focus:border-[#4493bf] focus:ring-2 focus:ring-[#4493bf] outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-['Inter'] font-semibold text-xs text-[#44474e] uppercase tracking-[0.6px] mb-1.5 block">Students enrolled</label>
                    <input
                      type="number"
                      min={0}
                      value={coStudents}
                      onChange={(e) => setCoStudents(Math.max(0, Number(e.target.value) || 0))}
                      className="w-32 bg-white border border-[#c4c6ce] rounded-md px-3 py-2 font-['Inter'] text-sm focus:border-[#4493bf] focus:ring-2 focus:ring-[#4493bf] outline-none tabular-nums"
                    />
                    <p className="font-['Inter'] text-sm text-[#74777E] mt-1">You can wire students to this cohort later from User Management.</p>
                  </div>
                </div>
              )}

              {coStep === 2 && (
                <div>
                  <p className="font-['Inter'] text-sm text-[#44474e] mb-3">Select the courses whose materials will be available to this cohort.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {courses.map((c) => {
                      const checked = coCourseIds.has(c.id);
                      return (
                        <label key={c.id} className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors duration-150 ${checked ? "border-[#0d2543] bg-[#eaf3f9]" : "border-[#e2e2e4] hover:bg-[#fafafa]"}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              toggleSetItem(setCoCourseIds, c.id);
                              if (checked) {
                                setCoSubjectIds((prev) => {
                                  const next = new Set(prev);
                                  c.subjects.forEach((s) => next.delete(s.id));
                                  return next;
                                });
                                setCoModuleIds((prev) => {
                                  const next = new Set(prev);
                                  c.subjects.forEach((s) => s.modules.forEach((m) => next.delete(m.id)));
                                  return next;
                                });
                              }
                            }}
                            className="mt-0.5 size-4 accent-[#0d2543]"
                          />
                          <div className="min-w-0">
                            <div className="font-['Inter'] font-semibold text-sm text-[#1a1c1d] truncate">{c.name}</div>
                            <div className="font-['Inter'] text-sm text-[#74777E] mt-0.5">{c.code} · {c.subjects.length} subjects</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {coStep === 3 && (
                <div>
                  <p className="font-['Inter'] text-sm text-[#44474e] mb-3">Pick which subjects to include from each selected course.</p>
                  {Array.from(coCourseIds).length === 0 && (
                    <div className="text-center py-10 font-['Inter'] text-sm text-[#74777E]">Go back and select at least one course.</div>
                  )}
                  <div className="space-y-4">
                    {courses.filter((c) => coCourseIds.has(c.id)).map((c) => (
                      <div key={c.id}>
                        <h4 className="font-['Inter'] font-semibold text-xs text-[#74777E] uppercase tracking-[0.6px] mb-2">{c.name}</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {c.subjects.map((s) => {
                            const checked = coSubjectIds.has(s.id);
                            return (
                              <label key={s.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors duration-150 ${checked ? "border-[#0d2543] bg-[#eaf3f9]" : "border-[#e2e2e4] hover:bg-[#fafafa]"}`}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    toggleSetItem(setCoSubjectIds, s.id);
                                    if (checked) {
                                      setCoModuleIds((prev) => {
                                        const next = new Set(prev);
                                        s.modules.forEach((m) => next.delete(m.id));
                                        return next;
                                      });
                                    }
                                  }}
                                  className="mt-0.5 size-4 accent-[#0d2543]"
                                />
                                <div className="min-w-0">
                                  <div className="font-['Inter'] font-semibold text-sm text-[#1a1c1d] truncate">{s.name}</div>
                                  <div className="font-['Inter'] text-sm text-[#74777E] mt-0.5">{s.modules.length} modules</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {coStep === 4 && (
                <div>
                  <p className="font-['Inter'] text-sm text-[#44474e] mb-3">Choose the specific modules to assign to this cohort.</p>
                  {Array.from(coSubjectIds).length === 0 && (
                    <div className="text-center py-10 font-['Inter'] text-sm text-[#74777E]">Go back and select at least one subject.</div>
                  )}
                  <div className="space-y-4">
                    {courses.filter((c) => coCourseIds.has(c.id)).map((c) => {
                      const subjs = c.subjects.filter((s) => coSubjectIds.has(s.id));
                      if (subjs.length === 0) return null;
                      return (
                        <div key={c.id}>
                          <h4 className="font-['Inter'] font-semibold text-xs text-[#74777E] uppercase tracking-[0.6px] mb-2">{c.name}</h4>
                          <div className="space-y-3">
                            {subjs.map((s) => {
                              const allOn = s.modules.every((m) => coModuleIds.has(m.id));
                              return (
                                <div key={s.id} className="border border-[#e2e2e4] rounded-lg overflow-hidden">
                                  <div className="bg-[#fafafa] px-3 py-2 border-b border-[#e2e2e4] flex items-center justify-between">
                                    <span className="font-['Inter'] font-semibold text-sm text-[#1a1c1d]">{s.name}</span>
                                    <button
                                      onClick={() => {
                                        setCoModuleIds((prev) => {
                                          const next = new Set(prev);
                                          if (allOn) s.modules.forEach((m) => next.delete(m.id));
                                          else s.modules.forEach((m) => next.add(m.id));
                                          return next;
                                        });
                                      }}
                                      className="font-['Inter'] text-sm font-semibold text-[#00658d] hover:underline"
                                    >
                                      {allOn ? "Clear all" : "Select all"}
                                    </button>
                                  </div>
                                  <div className="divide-y divide-[#f0f0f2]">
                                    {s.modules.map((m) => {
                                      const checked = coModuleIds.has(m.id);
                                      return (
                                        <label key={m.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${checked ? "bg-[#eaf3f9]" : "hover:bg-[#fafafa]"}`}>
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleSetItem(setCoModuleIds, m.id)}
                                            className="size-4 accent-[#0d2543]"
                                          />
                                          <TypePill type={m.type} />
                                          <span className="font-['Inter'] text-sm text-[#1a1c1d] flex-1 truncate">{m.name}</span>
                                          <StatusPill status={m.status} />
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[rgba(15,32,60,0.07)] flex items-center justify-between bg-[#F7F9FC]">
              <div className="font-['Inter'] text-sm text-[#74777E]">
                {coModuleIds.size} modules · {coSubjectIds.size} subjects · {coCourseIds.size} courses
              </div>
              <div className="flex items-center gap-2">
                {coStep > 1 && (
                  <button
                    onClick={() => setCoStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-['Inter'] font-semibold text-sm text-[#44474e] hover:bg-white border border-transparent hover:border-[rgba(15,32,60,0.08)]"
                  >
                    <ArrowLeft className="size-3.5" />
                    Back
                  </button>
                )}
                <button
                  onClick={() => setCoDlgOpen(false)}
                  className="px-4 py-2 rounded-lg font-['Inter'] font-semibold text-sm text-[#44474e] hover:bg-white border border-transparent hover:border-[rgba(15,32,60,0.08)]"
                >
                  Cancel
                </button>
                {coStep < 4 ? (
                  <button
                    onClick={() => setCoStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
                    disabled={coStep === 1 && !coName.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-['Inter'] font-semibold text-sm text-white bg-[#0d2543] hover:bg-[#0a1d36] disabled:bg-[#c4c6ce] disabled:cursor-not-allowed"
                  >
                    Continue
                    <ChevronRight className="size-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={saveCohort}
                    disabled={false}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-['Inter'] font-semibold text-sm text-white bg-[#0d2543] hover:bg-[#0a1d36] disabled:bg-[#c4c6ce] disabled:cursor-not-allowed"
                  >
                    <Check className="size-3.5" />
                    {editingCohortId ? "Save Changes" : "Create Cohort"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {assignOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(13,37,67,0.45)] backdrop-blur-sm p-6"
          onClick={() => setAssignOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-[0_24px_60px_rgba(13,37,67,0.25)] border border-[rgba(15,32,60,0.08)] w-full max-w-[520px] max-h-[88vh] flex flex-col overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-[rgba(15,32,60,0.07)] flex items-start justify-between gap-4">
              <div>
                <h2 className="font-['Inter'] font-semibold text-[17px] text-[#0B1B33] tracking-[-0.2px]">Assign Trainers</h2>
                <p className="mt-1 font-['Inter'] text-sm text-[#6F7480]">
                  Select one or more trainers who can deliver{" "}
                  <span className="font-medium text-[#1a1c1d]">{selectedModule.name}</span>.
                </p>
              </div>
              <button
                onClick={() => setAssignOpen(false)}
                aria-label="Close"
                className="size-8 rounded-full flex items-center justify-center text-[#6F7480] hover:bg-[#f3f3f5] hover:text-[#0d2543] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="px-6 pt-4 pb-3 border-b border-[rgba(15,32,60,0.07)]">
              <div className="relative">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9097A2] pointer-events-none" />
                <input
                  autoFocus
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  placeholder="Search trainers…"
                  className="w-full bg-[#F7F9FC] border border-[rgba(15,32,60,0.07)] rounded-lg pl-9 pr-3 py-2 font-['Inter'] text-sm text-[#0B1B33] placeholder:text-[#9097A2] focus:outline-none focus:ring-2 focus:ring-[#4493bf] focus:bg-white transition-all duration-150"
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-['Inter'] text-xs font-semibold uppercase tracking-[0.6px] text-[#6F7480]">
                  {draftTrainers.length} selected
                </span>
                {draftTrainers.length > 0 && (
                  <button
                    onClick={() => setDraftTrainers([])}
                    className="font-['Inter'] text-sm text-[#00658d] hover:text-[#004d6b] hover:underline focus:outline-none focus:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto px-2 py-2 [scrollbar-width:thin] [scrollbar-color:#c4c6ce_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#c4c6ce] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#0d2543]/40">
              {trainers.filter((t) => (t.full_name || "").toLowerCase().includes(assignSearch.toLowerCase())).map((t) => {
                const checked = draftTrainers.includes(t.full_name);
                const initials = (t.full_name || "").split(" ").map((p: string) => p[0]).join("").slice(0, 2);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleDraftTrainer(t.full_name)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-[#4493bf] ${
                      checked ? "bg-[rgba(0,101,141,0.08)]" : "hover:bg-[#F7F9FC]"
                    }`}
                  >
                    <span
                      className={`size-[18px] rounded-[5px] border flex items-center justify-center transition-colors duration-100 ${
                        checked ? "bg-[#0d2543] border-[#0d2543] text-white" : "border-[#c4c6ce] bg-white text-transparent"
                      }`}
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    <span className="size-7 rounded-full bg-[#dff0fa] flex items-center justify-center font-['Inter'] font-semibold text-sm text-[#00587c]">
                      {initials}
                    </span>
                    <span className="flex-1 font-['Inter'] text-sm text-[#0B1B33]">{t.full_name}</span>
                  </button>
                );
              })}
              {trainers.filter((t) => (t.full_name || "").toLowerCase().includes(assignSearch.toLowerCase())).length === 0 && (
                <div className="px-3 py-6 text-center font-['Inter'] text-sm text-[#6F7480]">
                  No trainers match "{assignSearch}".
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[rgba(15,32,60,0.07)] flex items-center justify-end gap-2 bg-[#F7F9FC]">
              <button
                onClick={() => setAssignOpen(false)}
                className="px-4 py-2 rounded-lg font-['Inter'] font-semibold text-sm text-[#44474e] hover:bg-white border border-transparent hover:border-[rgba(15,32,60,0.08)] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf]"
              >
                Cancel
              </button>
              <button
                onClick={saveAssign}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-['Inter'] font-semibold text-sm text-white bg-[#0d2543] hover:bg-[#0a1d36] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf] shadow-[0_1px_2px_rgba(13,37,67,0.25),inset_0_1px_0_rgba(255,255,255,0.1)]"
              >
                <UserPlus className="size-3.5" />
                Save Assignments
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Course Trainer Assignment Dialog */}
      {courseTrainerDlgOpen && selectedCourseForTrainer && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(13,37,67,0.45)] backdrop-blur-sm p-6"
          onClick={() => setCourseTrainerDlgOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-[0_24px_60px_rgba(13,37,67,0.25)] border border-[rgba(15,32,60,0.08)] w-full max-w-[680px] max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-[rgba(15,32,60,0.07)] flex items-start justify-between gap-4">
              <div>
                <h2 className="font-['Inter'] font-semibold text-[17px] text-[#0B1B33] tracking-[-0.2px]">Assign Trainers to Course</h2>
                <p className="mt-1 font-['Inter'] text-sm text-[#6F7480]">
                  Select trainers and modules for{" "}
                  <span className="font-medium text-[#1a1c1d]">{selectedCourseForTrainer.name}</span>
                </p>
              </div>
              <button
                onClick={() => setCourseTrainerDlgOpen(false)}
                aria-label="Close"
                className="size-8 rounded-full flex items-center justify-center text-[#6F7480] hover:bg-[#f3f3f5] hover:text-[#0d2543] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto [scrollbar-width:thin] [scrollbar-color:#c4c6ce_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#c4c6ce] [&::-webkit-scrollbar-thumb]:rounded-full">
              {/* Trainers Section */}
              <div className="px-6 pt-5 pb-4 border-b border-[rgba(15,32,60,0.07)]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-['Inter'] font-semibold text-sm text-[#0B1B33] uppercase tracking-[0.6px]">Select Trainers</h3>
                  <span className="font-['Inter'] text-xs text-[#6F7480] tabular-nums">
                    {selectedCourseTrainers.length} selected
                  </span>
                </div>
                <div className="relative mb-3">
                  <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9097A2] pointer-events-none" />
                  <input
                    value={courseTrainerSearch}
                    onChange={(e) => setCourseTrainerSearch(e.target.value)}
                    placeholder="Search trainers…"
                    className="w-full bg-[#F7F9FC] border border-[rgba(15,32,60,0.07)] rounded-lg pl-9 pr-3 py-2 font-['Inter'] text-sm text-[#0B1B33] placeholder:text-[#9097A2] focus:outline-none focus:ring-2 focus:ring-[#4493bf] focus:bg-white transition-all duration-150"
                  />
                </div>
                <div className="space-y-1 max-h-[180px] overflow-auto pr-1 [scrollbar-width:thin] [scrollbar-color:#c4c6ce_transparent] [&::-webkit-scrollbar]:w-1">
                  {trainers.filter((t) => (t.full_name || "").toLowerCase().includes(courseTrainerSearch.toLowerCase())).map((t) => {
                    const checked = selectedCourseTrainers.includes(t.id);
                    const initials = (t.full_name || "").split(" ").map((p: string) => p[0]).join("").slice(0, 2);
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          setSelectedCourseTrainers(prev =>
                            prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id]
                          );
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-[#4493bf] ${
                          checked ? "bg-[rgba(0,101,141,0.08)]" : "hover:bg-[#F7F9FC]"
                        }`}
                      >
                        <span
                          className={`size-[18px] rounded-[5px] border flex items-center justify-center transition-colors duration-100 ${
                            checked ? "bg-[#0d2543] border-[#0d2543] text-white" : "border-[#c4c6ce] bg-white text-transparent"
                          }`}
                        >
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                        <span className="size-7 rounded-full bg-[#dff0fa] flex items-center justify-center font-['Inter'] font-semibold text-sm text-[#00587c]">
                          {initials}
                        </span>
                        <span className="flex-1 font-['Inter'] text-sm text-[#0B1B33]">{t.full_name}</span>
                      </button>
                    );
                  })}
                  {trainers.filter((t) => (t.full_name || "").toLowerCase().includes(courseTrainerSearch.toLowerCase())).length === 0 && (
                    <div className="px-3 py-6 text-center font-['Inter'] text-sm text-[#6F7480]">
                      No trainers found.
                    </div>
                  )}
                </div>
              </div>

              {/* Modules Selection Section */}
              <div className="px-6 pt-5 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-['Inter'] font-semibold text-sm text-[#0B1B33] uppercase tracking-[0.6px]">Select Modules</h3>
                  <div className="flex items-center gap-2">
                    <span className="font-['Inter'] text-xs text-[#6F7480] tabular-nums">
                      {selectedModulesForCourse.size} selected
                    </span>
                    {selectedModulesForCourse.size > 0 && (
                      <button
                        onClick={() => setSelectedModulesForCourse(new Set())}
                        className="font-['Inter'] text-xs text-[#00658d] hover:text-[#004d6b] hover:underline focus:outline-none"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2 max-h-[280px] overflow-auto pr-1 [scrollbar-width:thin] [scrollbar-color:#c4c6ce_transparent] [&::-webkit-scrollbar]:w-1">
                  {selectedCourseForTrainer.subjects.map((subject) => {
                    const subjectModuleIds = subject.modules.map(m => m.id);
                    const allSelected = subjectModuleIds.every(id => selectedModulesForCourse.has(id));
                    const someSelected = subjectModuleIds.some(id => selectedModulesForCourse.has(id)) && !allSelected;
                    const isExpanded = expandedSubjectsInDialog.has(subject.id);
                    
                    return (
                      <div key={subject.id} className="border border-[rgba(15,32,60,0.08)] rounded-lg overflow-hidden bg-white">
                        {/* Subject Header */}
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-[#F7F9FC] hover:bg-[#ECEEF1] transition-colors">
                          <button
                            onClick={() => {
                              setExpandedSubjectsInDialog(prev => {
                                const next = new Set(prev);
                                isExpanded ? next.delete(subject.id) : next.add(subject.id);
                                return next;
                              });
                            }}
                            className="size-5 rounded flex items-center justify-center text-[#6F7480] hover:bg-white hover:text-[#0d2543] transition-colors focus:outline-none focus:ring-2 focus:ring-[#4493bf]"
                          >
                            <ChevronRight className={`size-3.5 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedModulesForCourse(prev => {
                                const next = new Set(prev);
                                if (allSelected) {
                                  subjectModuleIds.forEach(id => next.delete(id));
                                } else {
                                  subjectModuleIds.forEach(id => next.add(id));
                                }
                                return next;
                              });
                            }}
                            className="size-[18px] rounded-[5px] border flex items-center justify-center transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-[#4493bf]"
                            style={{
                              backgroundColor: allSelected ? "#0d2543" : someSelected ? "#0d2543" : "white",
                              borderColor: allSelected || someSelected ? "#0d2543" : "#c4c6ce",
                              color: allSelected || someSelected ? "white" : "transparent"
                            }}
                          >
                            {someSelected ? (
                              <div className="w-2 h-0.5 bg-white rounded" />
                            ) : (
                              <Check className="size-3" strokeWidth={3} />
                            )}
                          </button>
                          <Folder className="size-4 text-[#6F7480]" />
                          <span className="flex-1 font-['Inter'] font-medium text-sm text-[#0B1B33]">{subject.name}</span>
                          <span className="font-['Inter'] text-xs text-[#6F7480] tabular-nums">
                            {subject.modules.filter(m => selectedModulesForCourse.has(m.id)).length}/{subject.modules.length}
                          </span>
                        </div>

                        {/* Modules List */}
                        {isExpanded && (
                          <div className="px-3 py-2 space-y-1 bg-white">
                            {subject.modules.map((module) => {
                              const moduleSelected = selectedModulesForCourse.has(module.id);
                              const meta = TYPE_META[module.type];
                              const Icon = meta.icon;
                              
                              return (
                                <button
                                  key={module.id}
                                  onClick={() => {
                                    setSelectedModulesForCourse(prev => {
                                      const next = new Set(prev);
                                      moduleSelected ? next.delete(module.id) : next.add(module.id);
                                      return next;
                                    });
                                  }}
                                  className={`w-full flex items-center gap-2.5 pl-7 pr-3 py-2 rounded-md text-left transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-[#4493bf] ${
                                    moduleSelected ? "bg-[rgba(0,101,141,0.06)]" : "hover:bg-[#F7F9FC]"
                                  }`}
                                >
                                  <span
                                    className={`size-[16px] rounded border flex items-center justify-center transition-colors duration-100 ${
                                      moduleSelected ? "bg-[#0d2543] border-[#0d2543] text-white" : "border-[#c4c6ce] bg-white text-transparent"
                                    }`}
                                  >
                                    <Check className="size-2.5" strokeWidth={3} />
                                  </span>
                                  <span className={`size-5 rounded flex items-center justify-center ${meta.bg} ${meta.fg}`}>
                                    <Icon className="size-3" />
                                  </span>
                                  <span className="flex-1 font-['Inter'] text-sm text-[#44474e]">{module.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[rgba(15,32,60,0.07)] flex items-center justify-between gap-3 bg-[#F7F9FC]">
              <div className="font-['Inter'] text-xs text-[#6F7480]">
                {selectedCourseTrainers.length > 0 && selectedModulesForCourse.size > 0 ? (
                  <>
                    <span className="font-semibold text-[#0d2543]">{selectedCourseTrainers.length}</span> trainer{selectedCourseTrainers.length !== 1 ? "s" : ""} → <span className="font-semibold text-[#0d2543]">{selectedModulesForCourse.size}</span> module{selectedModulesForCourse.size !== 1 ? "s" : ""}
                  </>
                ) : (
                  "Select trainers and modules to assign"
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCourseTrainerDlgOpen(false)}
                  className="px-4 py-2 rounded-lg font-['Inter'] font-semibold text-sm text-[#44474e] hover:bg-white border border-transparent hover:border-[rgba(15,32,60,0.08)] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf]"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!selectedCourseForTrainer || selectedCourseTrainers.length === 0 || selectedModulesForCourse.size === 0) {
                      toast.error("Please select both trainers and modules");
                      return;
                    }
                    
                    try {
                      const moduleIds = Array.from(selectedModulesForCourse);

                      // Delete existing trainer assignments for selected modules
                      await supabase
                        .from("module_trainers")
                        .delete()
                        .in("module_id", moduleIds);

                      // Insert new assignments
                      const insertData = [];
                      for (const trainerId of selectedCourseTrainers) {
                        const trainer = trainers.find(t => t.id === trainerId);
                        if (!trainer) continue;
                        
                        for (const moduleId of moduleIds) {
                          insertData.push({
                            module_id: moduleId,
                            trainer_id: trainerId,
                            trainer_name: trainer.full_name
                          });
                        }
                      }

                      if (insertData.length > 0) {
                        const { error } = await supabase
                          .from("module_trainers")
                          .insert(insertData);
                        
                        if (error) throw error;
                      }

                      toast.success(`Assigned ${selectedCourseTrainers.length} trainer(s) to ${moduleIds.length} module(s)`);
                      await loadVaultData();
                      setCourseTrainerDlgOpen(false);
                      setSelectedCourseTrainers([]);
                      setSelectedModulesForCourse(new Set());
                      setExpandedSubjectsInDialog(new Set());
                      setCourseTrainerSearch("");
                    } catch (err: any) {
                      toast.error(err.message || "Failed to assign trainers");
                    }
                  }}
                  disabled={selectedCourseTrainers.length === 0 || selectedModulesForCourse.size === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-['Inter'] font-semibold text-sm text-white bg-[#0d2543] hover:bg-[#0a1d36] disabled:bg-[#c4c6ce] disabled:cursor-not-allowed transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf] shadow-[0_1px_2px_rgba(13,37,67,0.25),inset_0_1px_0_rgba(255,255,255,0.1)]"
                >
                  <UserPlus className="size-3.5" />
                  Assign Selected
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {assignOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(13,37,67,0.45)] backdrop-blur-sm p-6"
          onClick={() => setAssignOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-[0_24px_60px_rgba(13,37,67,0.25)] border border-[rgba(15,32,60,0.08)] w-full max-w-[520px] max-h-[88vh] flex flex-col overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-[rgba(15,32,60,0.07)] flex items-start justify-between gap-4">
              <div>
                <h2 className="font-['Inter'] font-semibold text-[17px] text-[#0B1B33] tracking-[-0.2px]">Assign Trainers</h2>
                <p className="mt-1 font-['Inter'] text-sm text-[#6F7480]">
                  Select one or more trainers who can deliver{" "}
                  <span className="font-medium text-[#1a1c1d]">{selectedModule.name}</span>.
                </p>
              </div>
              <button
                onClick={() => setAssignOpen(false)}
                aria-label="Close"
                className="size-8 rounded-full flex items-center justify-center text-[#6F7480] hover:bg-[#f3f3f5] hover:text-[#0d2543] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="px-6 pt-4 pb-3 border-b border-[rgba(15,32,60,0.07)]">
              <div className="relative">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9097A2] pointer-events-none" />
                <input
                  autoFocus
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  placeholder="Search trainers…"
                  className="w-full bg-[#F7F9FC] border border-[rgba(15,32,60,0.07)] rounded-lg pl-9 pr-3 py-2 font-['Inter'] text-sm text-[#0B1B33] placeholder:text-[#9097A2] focus:outline-none focus:ring-2 focus:ring-[#4493bf] focus:bg-white transition-all duration-150"
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-['Inter'] text-xs font-semibold uppercase tracking-[0.6px] text-[#6F7480]">
                  {draftTrainers.length} selected
                </span>
                {draftTrainers.length > 0 && (
                  <button
                    onClick={() => setDraftTrainers([])}
                    className="font-['Inter'] text-sm text-[#00658d] hover:text-[#004d6b] hover:underline focus:outline-none focus:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto px-2 py-2 [scrollbar-width:thin] [scrollbar-color:#c4c6ce_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#c4c6ce] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#0d2543]/40">
              {trainers.filter((t) => (t.full_name || "").toLowerCase().includes(assignSearch.toLowerCase())).map((t) => {
                const checked = draftTrainers.includes(t.full_name);
                const initials = (t.full_name || "").split(" ").map((p: string) => p[0]).join("").slice(0, 2);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleDraftTrainer(t.full_name)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-[#4493bf] ${
                      checked ? "bg-[rgba(0,101,141,0.08)]" : "hover:bg-[#F7F9FC]"
                    }`}
                  >
                    <span
                      className={`size-[18px] rounded-[5px] border flex items-center justify-center transition-colors duration-100 ${
                        checked ? "bg-[#0d2543] border-[#0d2543] text-white" : "border-[#c4c6ce] bg-white text-transparent"
                      }`}
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    <span className="size-7 rounded-full bg-[#dff0fa] flex items-center justify-center font-['Inter'] font-semibold text-sm text-[#00587c]">
                      {initials}
                    </span>
                    <span className="flex-1 font-['Inter'] text-sm text-[#0B1B33]">{t.full_name}</span>
                  </button>
                );
              })}
              {trainers.filter((t) => (t.full_name || "").toLowerCase().includes(assignSearch.toLowerCase())).length === 0 && (
                <div className="px-3 py-6 text-center font-['Inter'] text-sm text-[#6F7480]">
                  No trainers match “{assignSearch}”.
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[rgba(15,32,60,0.07)] flex items-center justify-end gap-2 bg-[#F7F9FC]">
              <button
                onClick={() => setAssignOpen(false)}
                className="px-4 py-2 rounded-lg font-['Inter'] font-semibold text-sm text-[#44474e] hover:bg-white border border-transparent hover:border-[rgba(15,32,60,0.08)] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf]"
              >
                Cancel
              </button>
              <button
                onClick={saveAssign}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-['Inter'] font-semibold text-sm text-white bg-[#0d2543] hover:bg-[#0a1d36] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf] shadow-[0_1px_2px_rgba(13,37,67,0.25),inset_0_1px_0_rgba(255,255,255,0.1)]"
              >
                <UserPlus className="size-3.5" />
                Save Assignments
              </button>
            </div>
          </div>
        </div>
      )}

      {newOpen && (() => {
        const activeCourse = courses.find((c) => c.id === newCourseId) ?? courses[0];
        const canSubmit =
          !!newModuleName.trim() &&
          (newMode === "existing"
            ? !!newSubjectId
            : newMode === "newSubject"
            ? !!newSubjectName.trim()
            : !!newCourseName.trim() && !!newSubjectName.trim());
        return (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(13,37,67,0.45)] backdrop-blur-sm p-6"
            onClick={() => setNewOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-[0_24px_60px_rgba(13,37,67,0.25)] border border-[rgba(15,32,60,0.08)] w-full max-w-[560px] max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-[rgba(15,32,60,0.07)] flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-['Inter'] font-semibold text-[17px] text-[#0B1B33] tracking-[-0.2px]">Create New Module</h2>
                  <p className="mt-1 font-['Inter'] text-sm text-[#6F7480]">
                    Add a module to an existing subject, or create a new subject first.
                  </p>
                </div>
                <button
                  onClick={() => setNewOpen(false)}
                  aria-label="Close"
                  className="size-8 rounded-full flex items-center justify-center text-[#6F7480] hover:bg-[#f3f3f5] hover:text-[#0d2543] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf]"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex-1 overflow-auto px-6 py-5 space-y-5 [scrollbar-width:thin] [scrollbar-color:#c4c6ce_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#c4c6ce] [&::-webkit-scrollbar-thumb]:rounded-full">
                <div className="grid grid-cols-3 gap-2">
                  {(["existing", "newSubject", "newCourse"] as const).map((mode) => {
                    const active = newMode === mode;
                    const Icon = mode === "existing" ? Folder : mode === "newSubject" ? FolderPlus : Plus;
                    const title =
                      mode === "existing" ? "Existing Subject" : mode === "newSubject" ? "New Subject" : "New Course";
                    const sub =
                      mode === "existing"
                        ? "Add to a folder you already have."
                        : mode === "newSubject"
                        ? "New folder in an existing course."
                        : "Brand-new course, subject & module.";
                    return (
                      <button
                        key={mode}
                        onClick={() => setNewMode(mode)}
                        className={`flex flex-col items-start gap-2 px-3 py-3 rounded-lg border text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf] ${
                          active
                            ? "border-[#0d2543] bg-[rgba(13,37,67,0.04)]"
                            : "border-[rgba(15,32,60,0.10)] hover:border-[rgba(15,32,60,0.2)] bg-white"
                        }`}
                      >
                        <span className={`size-8 rounded-md flex items-center justify-center shrink-0 ${active ? "bg-[#0d2543] text-white" : "bg-[#F1F4F8] text-[#44474e]"}`}>
                          <Icon className="size-4" />
                        </span>
                        <span>
                          <span className="block font-['Inter'] font-semibold text-sm text-[#0B1B33]">{title}</span>
                          <span className="block font-['Inter'] text-sm text-[#6F7480] mt-0.5">{sub}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {newMode === "newCourse" ? (
                  <div className="grid grid-cols-[120px_1fr] gap-3">
                    <div>
                      <label className="block font-['Inter'] text-xs font-semibold uppercase tracking-[0.6px] text-[#6F7480] mb-1.5">Course Code</label>
                      <input
                        value={newCourseCode}
                        onChange={(e) => setNewCourseCode(e.target.value)}
                        placeholder="e.g. ENV-201"
                        className="w-full bg-[#F7F9FC] border border-[rgba(15,32,60,0.10)] rounded-lg px-3 py-2 font-['Inter'] text-sm text-[#0B1B33] placeholder:text-[#9097A2] focus:outline-none focus:ring-2 focus:ring-[#4493bf] focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-['Inter'] text-xs font-semibold uppercase tracking-[0.6px] text-[#6F7480] mb-1.5">Course Name</label>
                      <input
                        value={newCourseName}
                        onChange={(e) => setNewCourseName(e.target.value)}
                        placeholder="e.g. Environmental Compliance"
                        className="w-full bg-[#F7F9FC] border border-[rgba(15,32,60,0.10)] rounded-lg px-3 py-2 font-['Inter'] text-sm text-[#0B1B33] placeholder:text-[#9097A2] focus:outline-none focus:ring-2 focus:ring-[#4493bf] focus:bg-white"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block font-['Inter'] text-xs font-semibold uppercase tracking-[0.6px] text-[#6F7480] mb-1.5">Course</label>
                    <select
                      value={newCourseId}
                      onChange={(e) => {
                        setNewCourseId(e.target.value);
                        const c = courses.find((cc) => cc.id === e.target.value);
                        setNewSubjectId(c?.subjects[0]?.id ?? "");
                      }}
                      className="w-full bg-[#F7F9FC] border border-[rgba(15,32,60,0.10)] rounded-lg px-3 py-2 font-['Inter'] text-sm text-[#0B1B33] focus:outline-none focus:ring-2 focus:ring-[#4493bf] focus:bg-white"
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {newMode === "existing" ? (
                  <div>
                    <label className="block font-['Inter'] text-xs font-semibold uppercase tracking-[0.6px] text-[#6F7480] mb-1.5">Subject / Folder</label>
                    <select
                      value={newSubjectId}
                      onChange={(e) => setNewSubjectId(e.target.value)}
                      className="w-full bg-[#F7F9FC] border border-[rgba(15,32,60,0.10)] rounded-lg px-3 py-2 font-['Inter'] text-sm text-[#0B1B33] focus:outline-none focus:ring-2 focus:ring-[#4493bf] focus:bg-white"
                    >
                      {activeCourse?.subjects.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block font-['Inter'] text-xs font-semibold uppercase tracking-[0.6px] text-[#6F7480] mb-1.5">New Subject Name</label>
                    <input
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      placeholder="e.g. Identity & Access Management"
                      className="w-full bg-[#F7F9FC] border border-[rgba(15,32,60,0.10)] rounded-lg px-3 py-2 font-['Inter'] text-sm text-[#0B1B33] placeholder:text-[#9097A2] focus:outline-none focus:ring-2 focus:ring-[#4493bf] focus:bg-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-['Inter'] text-xs font-semibold uppercase tracking-[0.6px] text-[#6F7480] mb-1.5">Module Name</label>
                  <input
                    value={newModuleName}
                    onChange={(e) => setNewModuleName(e.target.value)}
                    placeholder="e.g. Phishing Awareness Workshop"
                    className="w-full bg-[#F7F9FC] border border-[rgba(15,32,60,0.10)] rounded-lg px-3 py-2 font-['Inter'] text-sm text-[#0B1B33] placeholder:text-[#9097A2] focus:outline-none focus:ring-2 focus:ring-[#4493bf] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block font-['Inter'] text-xs font-semibold uppercase tracking-[0.6px] text-[#6F7480] mb-1.5">Format</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(["VIDEO", "PPT", "PDF", "SCORM", "LINK", "QUIZ"] as ContentType[]).map((t) => {
                      const active = newModuleType === t;
                      return (
                        <button
                          key={t}
                          onClick={() => setNewModuleType(t)}
                          className={`px-3 py-1.5 rounded-full font-['Inter'] font-semibold text-[16px] tracking-[0.4px] uppercase transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf] ${
                            active
                              ? "bg-[#0d2543] text-white border border-[#0d2543]"
                              : "bg-white text-[#44474e] border border-[rgba(15,32,60,0.10)] hover:border-[rgba(15,32,60,0.25)]"
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 font-['Inter'] text-sm text-[#6F7480]">
                    Content can be uploaded later via <span className="font-semibold text-[#0d2543]">New Revision</span>.
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-[rgba(15,32,60,0.07)] flex items-center justify-end gap-2 bg-[#F7F9FC]">
                <button
                  onClick={() => setNewOpen(false)}
                  className="px-4 py-2 rounded-lg font-['Inter'] font-semibold text-sm text-[#44474e] hover:bg-white border border-transparent hover:border-[rgba(15,32,60,0.08)] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf]"
                >
                  Cancel
                </button>
                <button
                  onClick={createNew}
                  disabled={!canSubmit}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-['Inter'] font-semibold text-sm text-white bg-[#0d2543] hover:bg-[#0a1d36] disabled:bg-[#c4c6ce] disabled:cursor-not-allowed transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf] shadow-[0_1px_2px_rgba(13,37,67,0.25),inset_0_1px_0_rgba(255,255,255,0.1)]"
                >
                  <Plus className="size-3.5" />
                  Create Module
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {revOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(13,37,67,0.45)] backdrop-blur-sm p-6"
          onClick={() => setRevOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-[0_24px_60px_rgba(13,37,67,0.25)] border border-[rgba(15,32,60,0.08)] w-full max-w-[600px] max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-[rgba(15,32,60,0.07)] flex items-start justify-between gap-4">
              <div>
                <h2 className="font-['Inter'] font-semibold text-[17px] text-[#0B1B33] tracking-[-0.2px]">New Revision</h2>
                <p className="mt-1 font-['Inter'] text-sm text-[#6F7480]">
                  Upload an updated version for{" "}
                  <span className="font-medium text-[#1a1c1d]">{selectedModule.name}</span>.
                </p>
              </div>
              <button
                onClick={() => setRevOpen(false)}
                aria-label="Close"
                className="size-8 rounded-full flex items-center justify-center text-[#6F7480] hover:bg-[#f3f3f5] hover:text-[#0d2543] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto px-6 py-5 space-y-4 [scrollbar-width:thin] [scrollbar-color:#c4c6ce_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#c4c6ce] [&::-webkit-scrollbar-thumb]:rounded-full">
              <label
                onDragOver={(e) => { e.preventDefault(); setRevDragOver(true); }}
                onDragLeave={() => setRevDragOver(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setRevDragOver(false);

                  const items = e.dataTransfer.items;
                  if (!items || items.length === 0) {
                    if (e.dataTransfer.files?.length) addRevFiles(e.dataTransfer.files);
                    return;
                  }

                  const allFiles: File[] = [];

                  const traverseFileTree = async (item: any, path = "") => {
                    return new Promise<void>((resolve) => {
                      if (item.isFile) {
                        item.file((file: File) => {
                          Object.defineProperty(file, "webkitRelativePath", {
                            value: path + file.name,
                            writable: false,
                          });
                          allFiles.push(file);
                          resolve();
                        });
                      } else if (item.isDirectory) {
                        const dirReader = item.createReader();
                        const readEntries = () => {
                          dirReader.readEntries(async (entries: any[]) => {
                            if (entries.length > 0) {
                              for (const entry of entries) {
                                await traverseFileTree(entry, path + item.name + "/");
                              }
                              // Read more entries in case of large directories
                              readEntries();
                            } else {
                              resolve();
                            }
                          });
                        };
                        readEntries();
                      } else {
                        resolve();
                      }
                    });
                  };

                  for (let i = 0; i < items.length; i++) {
                    const item = items[i].webkitGetAsEntry();
                    if (item) {
                      await traverseFileTree(item);
                    }
                  }

                  if (allFiles.length > 0) {
                    addRevFiles(allFiles);
                  }
                }}
                className={`block cursor-pointer rounded-xl border-2 border-dashed transition-all duration-150 px-6 py-6 text-center ${
                  revDragOver
                    ? "border-[#00658d] bg-[rgba(0,101,141,0.06)]"
                    : "border-[rgba(15,32,60,0.18)] bg-[#F7F9FC] hover:border-[#00658d] hover:bg-[rgba(0,101,141,0.04)]"
                }`}
              >
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  accept="video/*,.ppt,.pptx,.pdf,.doc,.docx,.xls,.xlsx,.zip,.scorm,image/*,.mp4,.mov,.webm"
                  onChange={(e) => e.target.files && addRevFiles(e.target.files)}
                />
                <div className="mx-auto size-12 rounded-full bg-white border border-[rgba(15,32,60,0.10)] shadow-[0_1px_2px_rgba(13,37,67,0.06)] flex items-center justify-center text-[#0d2543] mb-3">
                  <Upload className="size-5" />
                </div>
                <div className="font-['Inter'] font-semibold text-sm text-[#0B1B33]">
                  Drag &amp; drop files here
                </div>
                <div className="font-['Inter'] text-sm text-[#6F7480] mt-1">
                  or <span className="text-[#00658d] font-semibold">click to browse</span> · MP4, PPTX, PDF, DOCX, SCORM, ZIP…
                </div>
              </label>

              {revFiles.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-['Inter'] text-xs font-semibold uppercase tracking-[0.6px] text-[#6F7480]">
                    {revFiles.length} file{revFiles.length > 1 ? "s" : ""} ready
                  </div>
                  <ul className="space-y-1.5">
                    {revFiles.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[rgba(15,32,60,0.07)] bg-white">
                        <span className="size-8 rounded-md bg-[#F1F4F8] flex items-center justify-center text-[#0d2543] shrink-0">
                          <FileUp className="size-4" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-['Inter'] text-sm text-[#0B1B33] truncate">{f.name}</div>
                          <div className="font-['Inter'] text-sm text-[#6F7480]">{formatBytes(f.size)}</div>
                        </div>
                        <button
                          onClick={() => removeRevFile(i)}
                          aria-label="Remove file"
                          className="size-7 rounded-md flex items-center justify-center text-[#6F7480] hover:bg-[#f3f3f5] hover:text-[#9F2A1C] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf]"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <label className="block font-['Inter'] text-xs font-semibold uppercase tracking-[0.6px] text-[#6F7480] mb-1.5">Revision Notes</label>
                <textarea
                  value={revNote}
                  onChange={(e) => setRevNote(e.target.value)}
                  rows={3}
                  placeholder="What changed in this revision?"
                  className="w-full bg-[#F7F9FC] border border-[rgba(15,32,60,0.10)] rounded-lg px-3 py-2 font-['Inter'] text-sm text-[#0B1B33] placeholder:text-[#9097A2] focus:outline-none focus:ring-2 focus:ring-[#4493bf] focus:bg-white resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[rgba(15,32,60,0.07)] flex flex-col gap-3 bg-[#F7F9FC]">
              {uploadStatus === "idle" && (
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setRevOpen(false)}
                    className="px-4 py-2 rounded-lg font-['Inter'] font-semibold text-sm text-[#44474e] hover:bg-white border border-transparent hover:border-[rgba(15,32,60,0.08)] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitRevision}
                    disabled={revFiles.length === 0 || isPublishing}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-['Inter'] font-semibold text-sm text-white bg-[#0d2543] hover:bg-[#0a1d36] disabled:bg-[#c4c6ce] disabled:cursor-not-allowed transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf] shadow-[0_1px_2px_rgba(13,37,67,0.25),inset_0_1px_0_rgba(255,255,255,0.1)]"
                  >
                    {isPublishing ? (
                      <RotateCcw className="size-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3.5" />
                    )}
                    Publish Revision
                  </button>
                </div>
              )}

              {uploadStatus === "uploading" && (
                <div className="w-full">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-['Inter'] text-[13px] font-semibold text-[#0B1B33]">Uploading: {uploadProgress.files} / {uploadProgress.totalFiles} files</span>
                    <span className="font-['Inter'] text-[13px] text-[#00658d] font-semibold">{uploadProgress.totalBytes > 0 ? Math.round((uploadProgress.bytes / uploadProgress.totalBytes) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-[#e2e2e4] rounded-full h-2 overflow-hidden">
                    <div className="bg-[#00658d] h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress.totalBytes > 0 ? (uploadProgress.bytes / uploadProgress.totalBytes) * 100 : 0}%` }}></div>
                  </div>
                  <div className="text-right mt-1 font-['Inter'] text-[11px] text-[#6F7480]">
                    ({formatBytes(uploadProgress.bytes)} / {formatBytes(uploadProgress.totalBytes)})
                  </div>
                </div>
              )}

              {uploadStatus === "success" && (
                <div className="flex items-center justify-between">
                  <p className="font-['Inter'] text-[13px] font-semibold text-[#1E5631]">Upload complete! The revision is now live.</p>
                  <button onClick={() => setRevOpen(false)} className="px-4 py-2 rounded-lg font-['Inter'] font-semibold text-[13px] text-white bg-[#0d2543] hover:bg-[#0a1d36]">
                    Done
                  </button>
                </div>
              )}

              {uploadStatus === "error" && (
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="font-['Inter'] text-[13px] font-semibold text-[#923a1f]">Upload failed</p>
                    <p className="font-['Inter'] text-[12px] text-[#923a1f] mt-1">{uploadError}</p>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => { setUploadStatus("idle"); setRevOpen(false); }} className="px-4 py-2 rounded-lg font-['Inter'] font-semibold text-[13px] text-[#44474e] hover:bg-white">
                      Cancel
                    </button>
                    <button onClick={submitRevision} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-['Inter'] font-semibold text-[13px] text-white bg-[#0d2543] hover:bg-[#0a1d36]">
                      <RotateCcw className="size-3.5" />
                      Retry Upload
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d2543]/80 backdrop-blur-sm p-8">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e2e2e4] flex items-center justify-between">
              <div>
                <h3 className="font-['Inter'] font-semibold text-[18px] text-[#0d2543]">{selectedModule.name}</h3>
                <p className="font-['Inter'] text-sm text-[#74777E] mt-0.5">Version {previewVersion.label} · {previewVersion.note}</p>
              </div>
              <button
                onClick={() => setPreviewVersion(null)}
                className="p-2 text-[#74777E] hover:text-[#1a1c1d] hover:bg-[#f3f3f5] rounded-full transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf]"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 bg-[#f3f3f5] flex items-center justify-center p-4">
              {/* Basic content renderer for demonstration based on the mock content URL */}
              {previewVersion.content_url?.endsWith('.mp4') ? (
                <video src={previewVersion.content_url} controls className="max-w-full max-h-full rounded shadow-sm bg-black" />
              ) : previewVersion.content_url?.includes('supabase-storage-url') || previewVersion.content_url?.includes('placeholder-url') ? (
                <div className="flex flex-col items-center justify-center text-center p-8 bg-white border border-[#e2e2e4] rounded-xl shadow-sm w-full h-full">
                  <div className="size-16 rounded-full bg-[#f3f3f5] flex items-center justify-center mb-4">
                    <FileBadge className="size-8 text-[#0d2543]" />
                  </div>
                  <h3 className="font-['Inter'] font-semibold text-[18px] text-[#0d2543]">File Preview Not Available</h3>
                  <p className="font-['Inter'] text-[15px] text-[#44474e] max-w-md mt-2 leading-relaxed">
                    This file was uploaded as a placeholder during testing. Real content previews require active Supabase Storage integration.
                  </p>
                  <div className="mt-6 px-4 py-2 bg-[#f3f3f5] border border-[#e2e2e4] rounded-lg">
                    <span className="font-['Inter'] text-xs font-semibold text-[#74777E] uppercase tracking-[0.6px] mr-2">File URL:</span>
                    <span className="font-['Inter'] text-sm font-mono text-[#1a1c1d]">{previewVersion.content_url}</span>
                  </div>
                </div>
              ) : (
                <iframe src={previewVersion.content_url} className="w-full h-full rounded shadow-sm bg-white border border-[#e2e2e4]" title="Content Preview" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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
        className={`appearance-none bg-[#f3f3f5] hover:bg-[#ececef] border border-transparent hover:border-[#e2e2e4] rounded-md ${icon ? "pl-7" : "pl-2.5"} pr-6 py-1.5 font-['Inter'] font-medium text-[16px] text-[#44474e] cursor-pointer focus:bg-white focus:border-[#4493bf] focus:ring-1 focus:ring-[#4493bf] outline-none transition-all duration-150`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {icon && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#74777E] pointer-events-none">{icon}</span>}
      <ChevronRight className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-[#74777E] rotate-90 pointer-events-none" />
    </div>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 bg-[#eaf3f9] text-[#00587c] px-2 py-0.5 rounded-full font-['Inter'] text-xs font-medium">
      {label}
      <button onClick={onClear} aria-label={`Remove ${label}`} className="hover:text-[#003d54] focus:outline-none">×</button>
    </span>
  );
}

function TypePill({ type }: { type: ContentType }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 ${meta.bg} ${meta.fg} px-1.5 py-0.5 rounded font-['Inter'] font-semibold text-[16px] uppercase tracking-[0.5px]`}>
      <Icon className="size-3" />
      {type}
    </span>
  );
}

function StatusPill({ status }: { status: Status }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 font-['Inter'] font-medium text-[16px] ${meta.text}`}>
      <span className={`size-1.5 rounded-full ${meta.dot}`} />
      {status}
    </span>
  );
}

function Meta({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <span className="font-['Inter'] font-semibold text-xs text-[#74777E] uppercase tracking-[0.6px]">{label}</span>
        {hint && (
          <span title={hint} className="text-[#9aa0a6] cursor-help">
            <HelpCircle className="size-3" />
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function IconBtn({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick?: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick || (() => {})}
      aria-label={label}
      title={label}
      className={`size-8 rounded-md flex items-center justify-center transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf] ${
        danger
          ? "text-[#c0392b] hover:bg-[#fde8e8] hover:text-[#a93226]"
          : "text-[#44474e] hover:bg-[#f3f3f5] hover:text-[#0d2543]"
      }`}
    >
      {icon}
    </button>
  );
}

function formatRelative(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const days = Math.round((now - then) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

