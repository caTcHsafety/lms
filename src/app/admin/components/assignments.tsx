import { useMemo, useState, useEffect } from "react";
import {
  Plus,
  Upload,
  Search,
  Users,
  FileText,
  Calendar,
  Trash2,
  X,
  CheckCircle2,
  Clock,
  ChevronDown,
  GraduationCap,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Cohort = {
  id: string;
  name: string;
  course: string;
  studentCount: number;
};

type Student = {
  id: string;
  name: string;
  email: string;
  cohortId: string;
};

type Assignment = {
  id: string;
  title: string;
  description: string;
  cohortIds: string[];
  dueDate: string;
  createdAt: string;
  files: { name: string; size: number; url: string }[];
  status: "Draft" | "Published";
};

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function avatarColor(name: string) {
  if (!name) return "#00658d";
  const colors = ["#00658d", "#0d2543", "#8B5CF6", "#16A34A", "#D97706", "#DC2626", "#EC4899"];
  return colors[name.charCodeAt(0) % colors.length];
}

export function AssignmentsView() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Draft" | "Published">("all");

  // Upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftDue, setDraftDue] = useState("");
  const [draftCohorts, setDraftCohorts] = useState<string[]>([]);
  const [draftFiles, setDraftFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [cohortMenuOpen, setCohortMenuOpen] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch cohorts & courses
      const { data: cohortsData, error: cohortsError } = await supabase.from("cohorts").select("id, name");
      if (cohortsError) console.error("Cohorts Fetch Error:", cohortsError);
      
      const { data: cohortStudentsData, error: studentsError } = await supabase.from("cohort_students").select("cohort_id, student_id, profiles(full_name, email)");
      if (studentsError) console.error("Students Fetch Error:", studentsError);
      
      const parsedCohorts: Cohort[] = (cohortsData || []).map((c: any) => {
        const cCourse = "Unknown Course";
        const sCount = (cohortStudentsData || []).filter((cs: any) => cs.cohort_id === c.id).length;
        return {
          id: c.id,
          name: c.name,
          course: cCourse,
          studentCount: sCount,
        };
      });
      setCohorts(parsedCohorts);

      const parsedStudents: Student[] = (cohortStudentsData || []).map((cs: any) => ({
        id: cs.student_id,
        name: cs.profiles?.full_name || "Unknown",
        email: cs.profiles?.email || "No Email",
        cohortId: cs.cohort_id,
      }));
      setStudents(parsedStudents);

      // 2. Fetch assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("assignments")
        .select(`
          id, title, description, due_date, created_at, status,
          assignment_cohorts(cohort_id),
          assignment_files(file_name, file_size_bytes, file_url)
        `)
        .order("created_at", { ascending: false });
      if (assignmentsError) console.error("Assignments Fetch Error:", assignmentsError);

      const parsedAssignments: Assignment[] = (assignmentsData || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        description: a.description || "",
        cohortIds: (a.assignment_cohorts || []).map((ac: any) => ac.cohort_id),
        dueDate: a.due_date || "",
        createdAt: a.created_at,
        files: (a.assignment_files || []).map((f: any) => ({
          name: f.file_name,
          size: f.file_size_bytes,
          url: f.file_url,
        })),
        status: (a.status?.toLowerCase() === "published") ? "Published" : "Draft",
      }));
      
      setAssignments(parsedAssignments);
      if (parsedAssignments.length > 0 && !selectedId) {
        setSelectedId(parsedAssignments[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return assignments.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (search.trim() && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [assignments, search, statusFilter]);

  const selected = assignments.find((a) => a.id === selectedId) || null;
  const selectedCohorts = selected ? cohorts.filter((c) => selected.cohortIds.includes(c.id)) : [];
  const selectedStudents = selected ? students.filter((s) => selected.cohortIds.includes(s.cohortId)) : [];

  const openUpload = () => {
    setDraftTitle("");
    setDraftDesc("");
    setDraftDue("");
    setDraftCohorts([]);
    setDraftFiles([]);
    setUploadOpen(true);
  };

  const addFiles = (files: FileList | File[]) => {
    setDraftFiles((prev) => [...prev, ...Array.from(files)]);
  };

  const removeFile = (idx: number) => setDraftFiles((prev) => prev.filter((_, i) => i !== idx));

  const toggleDraftCohort = (id: string) =>
    setDraftCohorts((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const canSubmit = draftTitle.trim().length > 0 && draftCohorts.length > 0 && !isSubmitting;

  const submitAssignment = async (status: "Draft" | "Published") => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      // 1. Insert assignment
      const { data: newAssign, error: aErr } = await supabase.from("assignments").insert({
        title: draftTitle.trim(),
        description: draftDesc.trim(),
        due_date: draftDue ? draftDue : null,
        status: status,
        created_by: userId,
      }).select().single();
      
      if (aErr) throw aErr;
      const assignId = newAssign.id;

      // 2. Insert cohorts
      if (draftCohorts.length > 0) {
        const cohortInserts = draftCohorts.map(cId => ({ assignment_id: assignId, cohort_id: cId }));
        const { error: acErr } = await supabase.from("assignment_cohorts").insert(cohortInserts);
        if (acErr) throw acErr;
      }

      // 3. Upload files
      if (draftFiles.length > 0) {
        for (const file of draftFiles) {
          const fileExt = file.name.split('.').pop();
          const uniqueName = `${assignId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { error: uploadErr } = await supabase.storage.from("assignment_files").upload(uniqueName, file);
          if (uploadErr) throw uploadErr;

          const { data: publicUrlData } = supabase.storage.from("assignment_files").getPublicUrl(uniqueName);
          
          const { error: fileInsertError } = await supabase.from("assignment_files").insert({
            assignment_id: assignId,
            file_name: file.name,
            file_size_bytes: file.size,
            file_url: publicUrlData.publicUrl
          }).select();
          if (fileInsertError) throw fileInsertError;
        }
      }

      await fetchData();
      setSelectedId(assignId);
      setUploadOpen(false);
    } catch (err) {
      console.error("Error creating assignment:", err);
      alert("Failed to create assignment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeAssignment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this assignment?")) return;
    try {
      // Deleting the assignment will cascade delete assignment_cohorts and assignment_files
      // Note: Actual storage files might be left orphaned unless a trigger cleans them, but DB row will be gone
      const { error } = await supabase.from("assignments").delete().eq("id", id);
      if (error) throw error;
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      console.error("Failed to delete assignment:", err);
      alert("Failed to delete assignment");
    }
  };

  const publishAssignment = async (id: string) => {
    try {
      const { error } = await supabase
        .from("assignments")
        .update({ status: "Published" })
        .eq("id", id);
      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error("Failed to publish assignment:", err);
      alert("Failed to publish assignment");
    }
  };

  const getStoragePath = (url: string) => {
    if (!url) return "";
    const parts = url.split("/assignment_files/");
    if (parts.length > 1) {
      return decodeURIComponent(parts[1]);
    }
    return url;
  };

  const handleDownloadFile = async (file: { name: string; url: string }) => {
    try {
      const storagePath = getStoragePath(file.url);
      const { data: blob, error } = await supabase.storage
        .from("assignment_files")
        .download(storagePath);
      if (error) throw error;
      if (!blob) throw new Error("No blob returned");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      console.error("Error downloading file:", err);
      alert("Failed to download file securely.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[#00658d]" />
      </div>
    );
  }

  return (
    <div className="-mx-10 -my-10 h-[calc(100vh-64px)] flex overflow-hidden">
      {/* Master list */}
      <aside className="w-[420px] shrink-0 border-r border-[#e2e2e4] bg-white flex flex-col">
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="font-['Inter'] font-semibold text-[#0d2543]" style={{ fontSize: 18 }}>Assignments</h1>
              <p className="font-['Inter'] text-sm text-[#74777E] mt-0.5">{assignments.length} total · assigned by cohort</p>
            </div>
            <button
              onClick={openUpload}
              className="bg-[#0d2543] hover:bg-[#0a1d33] active:bg-[#071628] text-white px-3 py-1.5 rounded-md font-['Inter'] font-semibold text-sm flex items-center gap-1.5 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0d2543] focus:ring-offset-2"
            >
              <Plus className="size-3.5" />
              New
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#74777E]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assignments…"
              className="w-full pl-9 pr-3 py-2 bg-[#F1F4F8] border border-transparent rounded-md font-['Inter'] text-sm text-[#0d2543] placeholder:text-[#9aa0a6] focus:outline-none focus:border-[#00658d] focus:bg-white transition-colors duration-150"
            />
          </div>

          <div className="flex gap-1 mt-3">
            {(["all", "Published", "Draft"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-full font-['Inter'] font-semibold text-[11px] tracking-[0.3px] transition-colors duration-150 ${
                  statusFilter === s
                    ? "bg-[#0d2543] text-white"
                    : "bg-[#F1F4F8] text-[#44474e] hover:bg-[#e6eaf0]"
                }`}
              >
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto [scrollbar-width:thin] [scrollbar-color:#c4c6ce_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-[#c4c6ce] [&::-webkit-scrollbar-thumb]:rounded-full">
          {filtered.length === 0 ? (
            <div className="px-5 py-10 text-center font-['Inter'] text-sm text-[#74777E]">No assignments match.</div>
          ) : (
            <ul className="px-2 pb-4">
              {filtered.map((a) => {
                const isSel = selected?.id === a.id;
                const cohortNames = cohorts.filter((c) => a.cohortIds.includes(c.id))
                  .map((c) => c.name)
                  .join(", ");
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => setSelectedId(a.id)}
                      className={`w-full text-left px-3 py-3 rounded-lg mb-1 transition-colors duration-100 group ${
                        isSel
                          ? "bg-[rgba(0,101,141,0.10)] border-l-[3px] border-[#00658d] pl-[9px]"
                          : "hover:bg-[#F7F9FC] border-l-[3px] border-transparent pl-[9px]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-['Inter'] font-semibold text-sm text-[#0d2543] line-clamp-1 flex-1">{a.title}</span>
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-['Inter'] font-semibold text-[10px] tracking-[0.3px] ${
                            a.status?.toLowerCase() === "published"
                              ? "bg-[#E6F1E9] text-[#1E5631]"
                              : "bg-[#FFF3D6] text-[#A56A00]"
                          }`}
                        >
                          {a.status?.toLowerCase() === "published" ? <CheckCircle2 className="size-2.5" /> : <Clock className="size-2.5" />}
                          {a.status}
                        </span>
                      </div>
                      <div className="mt-1 font-['Inter'] text-sm text-[#74777E] line-clamp-1">{cohortNames || "No cohorts"}</div>
                      <div className="mt-1 flex items-center gap-3 font-['Inter'] text-sm text-[#9aa0a6]">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="size-3" />
                          {a.dueDate ? `Due ${formatDate(a.dueDate)}` : "No due date"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <FileText className="size-3" />
                          {a.files.length}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Detail */}
      <main className="flex-1 bg-[#F1F4F8] flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center font-['Inter'] text-sm text-[#74777E]">
            Select an assignment to view details.
          </div>
        ) : (
          <div className="flex-1 overflow-auto px-8 py-6 [scrollbar-width:thin] [scrollbar-color:#c4c6ce_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-[#c4c6ce] [&::-webkit-scrollbar-thumb]:rounded-full">
            <div className="max-w-[1100px] w-full mx-auto space-y-6">
              <header className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-['Inter'] font-semibold text-[11px] tracking-[0.3px] ${
                        selected.status?.toLowerCase() === "published"
                          ? "bg-[#E6F1E9] text-[#1E5631]"
                          : "bg-[#FFF3D6] text-[#A56A00]"
                      }`}
                    >
                      <span className={`size-1.5 rounded-full ${selected.status?.toLowerCase() === "published" ? "bg-[#1E5631]" : "bg-[#A56A00]"}`} />
                      {selected.status}
                    </span>
                    <span className="font-['Inter'] text-sm text-[#74777E]">Created {formatDate(selected.createdAt)}</span>
                  </div>
                  <h1 className="font-['Inter'] font-semibold text-[#0d2543] tracking-[-0.3px]" style={{ fontSize: 22 }}>
                    {selected.title}
                  </h1>
                  {selected.description && (
                    <p className="mt-2 font-['Inter'] text-sm text-[#44474e] leading-[1.55] max-w-[680px] whitespace-pre-wrap">{selected.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selected.status?.toLowerCase() === "draft" && (
                    <button
                      onClick={() => publishAssignment(selected.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0d2543] hover:bg-[#0a1d33] active:bg-[#071628] text-white font-['Inter'] font-semibold text-sm transition-colors duration-150"
                    >
                      <CheckCircle2 className="size-3.5" />
                      Publish
                    </button>
                  )}
                  <button
                    onClick={() => removeAssignment(selected.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[rgba(220,38,38,0.30)] text-[#9F2A1C] hover:bg-[#FDECEA] font-['Inter'] font-semibold text-sm transition-colors duration-150"
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </button>
                </div>
              </header>

              {/* Metadata grid */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white rounded-lg border border-[rgba(13,37,67,0.07)] shadow-[0_1px_2px_rgba(13,37,67,0.04)] p-4">
                  <div className="font-['Inter'] font-semibold text-xs uppercase tracking-[0.6px] text-[#74777E] mb-1">Due Date</div>
                  <div className="font-['Inter'] font-semibold text-sm text-[#0d2543] flex items-center gap-1.5">
                    <Calendar className="size-4 text-[#00658d]" />
                    {selected.dueDate ? formatDate(selected.dueDate) : "No due date"}
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-[rgba(13,37,67,0.07)] shadow-[0_1px_2px_rgba(13,37,67,0.04)] p-4">
                  <div className="font-['Inter'] font-semibold text-xs uppercase tracking-[0.6px] text-[#74777E] mb-1">Cohorts Assigned</div>
                  <div className="font-['Inter'] font-semibold text-sm text-[#0d2543] flex items-center gap-1.5">
                    <GraduationCap className="size-4 text-[#00658d]" />
                    {selectedCohorts.length}
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-[rgba(13,37,67,0.07)] shadow-[0_1px_2px_rgba(13,37,67,0.04)] p-4">
                  <div className="font-['Inter'] font-semibold text-xs uppercase tracking-[0.6px] text-[#74777E] mb-1">Total Students</div>
                  <div className="font-['Inter'] font-semibold text-sm text-[#0d2543] flex items-center gap-1.5">
                    <Users className="size-4 text-[#00658d]" />
                    {selectedStudents.length}
                  </div>
                </div>
              </section>

              {/* Files */}
              <section>
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-['Inter'] font-semibold text-xs uppercase tracking-[0.6px] text-[#74777E] whitespace-nowrap">Attached Files</span>
                  <div className="flex-1 h-px bg-[rgba(13,37,67,0.07)]" />
                </div>
                {selected.files.length === 0 ? (
                  <div className="bg-white rounded-lg border border-dashed border-[rgba(13,37,67,0.15)] px-4 py-6 text-center font-['Inter'] text-sm text-[#74777E]">
                    No files attached.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {selected.files.map((f, i) => (
                      <li
                        key={i}
                        className="bg-white rounded-lg border border-[rgba(13,37,67,0.07)] shadow-[0_1px_2px_rgba(13,37,67,0.04)] px-4 py-3 flex items-center gap-3"
                      >
                        <div className="size-9 rounded-md bg-[rgba(0,101,141,0.10)] text-[#00658d] flex items-center justify-center">
                          <FileText className="size-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-['Inter'] font-semibold text-sm text-[#0d2543] truncate">
                            {f.url ? (
                              <button
                                onClick={() => handleDownloadFile(f)}
                                className="hover:underline text-[#00658d] font-semibold text-sm text-left focus:outline-none"
                              >
                                {f.name}
                              </button>
                            ) : (
                              f.name
                            )}
                          </div>
                          <div className="font-['Inter'] text-sm text-[#74777E]">{formatBytes(f.size)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Cohorts */}
              <section>
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-['Inter'] font-semibold text-xs uppercase tracking-[0.6px] text-[#74777E] whitespace-nowrap">Assigned Cohorts</span>
                  <div className="flex-1 h-px bg-[rgba(13,37,67,0.07)]" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedCohorts.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-2 bg-white border border-[rgba(13,37,67,0.10)] rounded-full pl-2 pr-3 py-1 font-['Inter'] text-sm text-[#0d2543] shadow-[0_1px_2px_rgba(13,37,67,0.04)]"
                    >
                      <span className="size-5 rounded-full bg-[#00658d] text-white flex items-center justify-center font-semibold text-sm">
                        {c.course
                          .split(" ")
                          .map((p) => p[0])
                          .join("")
                          .slice(0, 2)}
                      </span>
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-[#74777E]">· {c.studentCount}</span>
                    </span>
                  ))}
                </div>
              </section>

              {/* Students */}
              <section>
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-['Inter'] font-semibold text-xs uppercase tracking-[0.6px] text-[#74777E] whitespace-nowrap">
                    Students in Selected Cohorts
                  </span>
                  <div className="flex-1 h-px bg-[rgba(13,37,67,0.07)]" />
                  <span className="font-['Inter'] text-sm text-[#74777E]">{selectedStudents.length} total</span>
                </div>
                {selectedStudents.length === 0 ? (
                  <div className="bg-white rounded-lg border border-dashed border-[rgba(13,37,67,0.15)] px-4 py-6 text-center font-['Inter'] text-sm text-[#74777E]">
                    No students in the assigned cohorts.
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-[rgba(13,37,67,0.07)] shadow-[0_1px_2px_rgba(13,37,67,0.04)] overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[rgba(13,37,67,0.07)] bg-[#F7F9FC]">
                          <th className="text-left font-['Inter'] font-semibold text-xs uppercase tracking-[0.5px] text-[#74777E] px-4 py-2.5">Student</th>
                          <th className="text-left font-['Inter'] font-semibold text-xs uppercase tracking-[0.5px] text-[#74777E] px-4 py-2.5">Email</th>
                          <th className="text-left font-['Inter'] font-semibold text-xs uppercase tracking-[0.5px] text-[#74777E] px-4 py-2.5">Cohort</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedStudents.map((s) => {
                          const cohort = cohorts.find((c) => c.id === s.cohortId);
                          return (
                            <tr
                              key={s.id}
                              className="border-b border-[rgba(13,37,67,0.05)] last:border-b-0 hover:bg-[#F7F9FC] transition-colors duration-100"
                            >
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2.5">
                                  <span
                                    className="size-7 rounded-full flex items-center justify-center font-['Inter'] font-semibold text-sm text-white"
                                    style={{ background: avatarColor(s.name) }}
                                  >
                                    {s.name
                                      .split(" ")
                                      .map((p) => p[0])
                                      .join("")
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </span>
                                  <span className="font-['Inter'] font-semibold text-sm text-[#0d2543]">{s.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 font-['Inter'] text-sm text-[#44474e]">{s.email}</td>
                              <td className="px-4 py-2.5 font-['Inter'] text-sm text-[#74777E]">{cohort?.name}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Upload dialog */}
      {uploadOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(13,37,67,0.45)] backdrop-blur-sm p-6"
          onClick={() => setUploadOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-[0_24px_48px_-12px_rgba(13,37,67,0.35)] w-full max-w-[640px] h-[600px] max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-[rgba(13,37,67,0.07)]">
              <div>
                <h2 className="font-['Inter'] font-semibold text-[#0d2543]" style={{ fontSize: 18 }}>
                  New Assignment
                </h2>
                <p className="font-['Inter'] text-sm text-[#74777E] mt-0.5">
                  Assigned at the cohort level — every student in the cohort receives it.
                </p>
              </div>
              <button
                onClick={() => setUploadOpen(false)}
                className="text-[#74777E] hover:text-[#0d2543] p-1 rounded-md hover:bg-[#F1F4F8] transition-colors duration-150"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className={`flex-1 px-6 py-4 space-y-4 [scrollbar-width:thin] [scrollbar-color:#c4c6ce_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-[#c4c6ce] [&::-webkit-scrollbar-thumb]:rounded-full ${cohortMenuOpen ? "overflow-visible" : "overflow-auto"}`}>
              <div>
                <label className="font-['Inter'] font-semibold text-xs uppercase tracking-[0.5px] text-[#74777E] block mb-1.5">Title</label>
                <input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="e.g. Q2 Risk Mitigation Case Study"
                  className="w-full px-3 py-2 bg-white border border-[rgba(13,37,67,0.15)] rounded-md font-['Inter'] text-sm text-[#0d2543] focus:outline-none focus:border-[#00658d] focus:ring-2 focus:ring-[rgba(0,101,141,0.15)] transition-all duration-150"
                />
              </div>

              <div>
                <label className="font-['Inter'] font-semibold text-xs uppercase tracking-[0.5px] text-[#74777E] block mb-1.5">Description</label>
                <textarea
                  value={draftDesc}
                  onChange={(e) => setDraftDesc(e.target.value)}
                  rows={3}
                  placeholder="Briefly describe what students should submit…"
                  className="w-full px-3 py-2 bg-white border border-[rgba(13,37,67,0.15)] rounded-md font-['Inter'] text-sm text-[#0d2543] focus:outline-none focus:border-[#00658d] focus:ring-2 focus:ring-[rgba(0,101,141,0.15)] transition-all duration-150 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-['Inter'] font-semibold text-xs uppercase tracking-[0.5px] text-[#74777E] block mb-1.5">Due Date</label>
                  <input
                    type="date"
                    value={draftDue}
                    onChange={(e) => setDraftDue(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[rgba(13,37,67,0.15)] rounded-md font-['Inter'] text-sm text-[#0d2543] focus:outline-none focus:border-[#00658d] focus:ring-2 focus:ring-[rgba(0,101,141,0.15)] transition-all duration-150"
                  />
                </div>
                <div>
                  <label className="font-['Inter'] font-semibold text-xs uppercase tracking-[0.5px] text-[#74777E] block mb-1.5">
                    Cohorts ({draftCohorts.length})
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setCohortMenuOpen((o) => !o)}
                      className="w-full h-10 flex items-center justify-between gap-2 px-3 bg-white border border-[rgba(13,37,67,0.15)] rounded-md font-['Inter'] text-sm text-[#0d2543] hover:border-[#00658d] focus:outline-none focus:border-[#00658d] focus:ring-2 focus:ring-[rgba(0,101,141,0.15)] transition-all duration-150 min-w-0"
                    >
                      <span className="truncate flex-1 text-left min-w-0">
                        {draftCohorts.length === 0
                          ? "Select cohorts…"
                          : draftCohorts.length === 1
                          ? cohorts.find((c) => c.id === draftCohorts[0])?.name
                          : `${draftCohorts.length} selected`}
                      </span>
                      <ChevronDown className="size-3.5 text-[#74777E] shrink-0" />
                    </button>
                    {cohortMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setCohortMenuOpen(false)} />
                        <div className="absolute z-50 w-full max-h-48 overflow-y-auto bg-white border rounded-md shadow-md thin-white-scrollbar py-1">
                          {cohorts.map((c) => {
                            const checked = draftCohorts.includes(c.id);
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => toggleDraftCohort(c.id)}
                                className="w-full h-9 flex items-center gap-2 px-3 hover:bg-[#F1F4F8] focus:outline-none focus-visible:bg-[#F1F4F8] transition-colors duration-100 text-left"
                              >
                                <span
                                  className={`size-4 rounded border flex items-center justify-center shrink-0 ${
                                    checked
                                      ? "bg-[#00658d] border-[#00658d]"
                                      : "bg-white border-[rgba(13,37,67,0.25)]"
                                  }`}
                                >
                                  {checked && (
                                    <svg viewBox="0 0 12 12" className="size-3 text-white block">
                                      <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="font-['Inter'] font-semibold text-sm text-[#0d2543] truncate">{c.name}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Selected cohorts preview with student counts */}
              {draftCohorts.length > 0 && (
                <div className="bg-[#F7F9FC] rounded-lg border border-[rgba(13,37,67,0.05)] p-3">
                  <div className="font-['Inter'] font-semibold text-xs uppercase tracking-[0.5px] text-[#74777E] mb-2">
                    Will be assigned to {students.filter((s) => draftCohorts.includes(s.cohortId)).length} student(s)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {cohorts.filter((c) => draftCohorts.includes(c.id)).map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1.5 bg-white border border-[rgba(13,37,67,0.10)] rounded-full px-2 py-0.5 font-['Inter'] text-xs text-[#0d2543]"
                      >
                        {c.name}
                        <button
                          type="button"
                          onClick={() => toggleDraftCohort(c.id)}
                          className="text-[#74777E] hover:text-[#9F2A1C]"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* File drop zone */}
              <div>
                <label className="font-['Inter'] font-semibold text-xs uppercase tracking-[0.5px] text-[#74777E] block mb-1.5">Attach Files</label>
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
                  }}
                  className={`block cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors duration-150 ${
                    dragOver
                      ? "border-[#00658d] bg-[rgba(0,101,141,0.05)]"
                      : "border-[rgba(13,37,67,0.15)] bg-[#F7F9FC] hover:border-[#00658d]"
                  }`}
                >
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && addFiles(e.target.files)}
                  />
                  <Upload className="size-5 text-[#00658d] mx-auto mb-1" />
                  <div className="font-['Inter'] font-semibold text-sm text-[#0d2543]">
                    Drag & drop or click to upload
                  </div>
                  <div className="font-['Inter'] text-sm text-[#74777E] mt-0.5">
                    PDF, DOCX, PPTX, video, etc.
                  </div>
                </label>

                {draftFiles.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {draftFiles.map((f, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 bg-white border border-[rgba(13,37,67,0.07)] rounded-md px-3 py-1.5"
                      >
                        <FileText className="size-3.5 text-[#00658d] shrink-0" />
                        <span className="flex-1 font-['Inter'] text-sm text-[#0d2543] truncate">{f.name}</span>
                        <span className="font-['Inter'] text-sm text-[#74777E]">{formatBytes(f.size)}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="text-[#74777E] hover:text-[#9F2A1C]"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-[rgba(13,37,67,0.07)] bg-[#F7F9FC]">
              <button
                onClick={() => setUploadOpen(false)}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 rounded-md font-['Inter'] font-semibold text-sm text-[#44474e] hover:bg-[#e6eaf0] transition-colors duration-150 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => submitAssignment("Draft")}
                disabled={!canSubmit}
                className="px-3.5 py-1.5 rounded-md font-['Inter'] font-semibold text-sm border border-[rgba(13,37,67,0.15)] text-[#0d2543] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 flex items-center gap-2"
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Save as Draft
              </button>
              <button
                onClick={() => submitAssignment("Published")}
                disabled={!canSubmit}
                className="px-3.5 py-1.5 rounded-md font-['Inter'] font-semibold text-sm bg-[#0d2543] text-white hover:bg-[#0a1d33] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 flex items-center gap-2"
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
