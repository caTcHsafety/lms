import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/auth/AuthContext";
import {
  Calendar, ClipboardList, Folder, Trophy, AlertTriangle, CheckCircle2, Info,
  ChevronLeft, FileText, Upload, Download, MessageSquare, Loader2,
  Eye, X, Maximize2, Minimize2,
} from "lucide-react";
import { toast } from "sonner";
import { saveToOfflineVault, addToOfflineVaultIndex } from "@/lib/offlineVault";
import { get } from "idb-keyval";


const BLUE = "#4493BF";
const NAVY = "#0D2543";

interface Task {
  id: string;
  title: string;
  desc: string;
  date: string;
  module: string;
  status: "overdue" | "pending" | "completed";
  points: number;
  moduleName: string;
  dueLabel: string;
  instructions: string[];
  intro: string;
  grade?: string;
  gradeNum?: number;
  feedback?: string;
  evalStatus?: string;
  submittedAt?: string;
  fileName?: string;
  fileUrl?: string;
  files?: any[];
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function Assignments() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inlineViewUrl, setInlineViewUrl] = useState<string | null>(null);
  const [inlineViewName, setInlineViewName] = useState<string | null>(null);
  const inlineViewerRef = useRef<HTMLDivElement>(null);
  const [downloadedFiles, setDownloadedFiles] = useState<Record<string, boolean>>({});
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (inlineViewUrl && inlineViewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(inlineViewUrl.split('#')[0]);
      }
    };
  }, [inlineViewUrl]);


  useEffect(() => {
    if (!user || !user.id) return;
    if (!navigator.onLine) {
      try {
        const cachedStr = localStorage.getItem(`student_assignments_${user.id}`);
        if (cachedStr) {
          const cachedAssignments = JSON.parse(cachedStr);
          if (cachedAssignments && cachedAssignments.length > 0) {
            setTasks(cachedAssignments);
            setSelectedId(cachedAssignments[0].id);
          }
        }
      } catch (e) {
        console.error("Failed to load offline cache:", e);
      } finally {
        setLoading(false);
      }
      return;
    }
    let isMounted = true;
    (async () => {
      try {
        const { data: cs, error: csError } = await supabase.from("cohort_students").select("cohort_id").eq("student_id", user.id);
        if (csError) console.error("Supabase Error [cohort_students]:", csError.message, csError.details, csError.hint);
        const cohortIds = cs?.map((c) => c.cohort_id) || [];

        const { data: ac, error: acError } = await supabase.from("assignment_cohorts").select("assignment_id").in("cohort_id", cohortIds.length ? cohortIds : ['00000000-0000-0000-0000-000000000000']);
        if (acError) console.error("Supabase Error [assignment_cohorts]:", acError.message, acError.details, acError.hint);
        const assignmentIds = ac?.map((item) => item.assignment_id) || [];

        const { data: dbAssignments, error: assignError } = await supabase
          .from("assignments")
          .select(`
            id, title, description, due_date, status, created_at,
            assignment_files ( id, file_name, file_size_bytes, file_url )
          `)
          .in("id", assignmentIds.length ? assignmentIds : ['00000000-0000-0000-0000-000000000000'])
          .in("status", ["published", "Published"]);
        if (assignError) console.error("Supabase Error [assignments]:", assignError.message, assignError.details, assignError.hint);

        const { data: subs, error: subsError } = await supabase.from("submissions").select("*").eq("student_id", user.id);
        if (subsError) console.error("Supabase Error [submissions]:", subsError.message, subsError.details, subsError.hint);
        
        const localSubsCached = localStorage.getItem(`student_submissions_${user.id}`);
        const localSubs = localSubsCached ? JSON.parse(localSubsCached) : {};

        const newTasks: Task[] = (dbAssignments || []).map((a: any) => {
          const sub = subs?.find((s) => s.assignment_id === a.id || s.module_id === a.id) || localSubs[a.id];
          const dueDate = a.due_date ? new Date(a.due_date) : null;
          const now = new Date();
          const overdue = dueDate ? (now > dueDate && !sub) : false;

          return {
            id: a.id,
            title: a.title,
            desc: a.description || "No description provided.",
            date: a.due_date ? new Date(a.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No due date",
            module: "Assignment",
            status: sub ? "completed" : (overdue ? "overdue" : "pending"),
            points: 100,
            moduleName: "General",
            dueLabel: a.due_date ? new Date(a.due_date).toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "No due date",
            instructions: ["Review the attached files.", "Complete the required work.", "Submit your final deliverables."],
            intro: a.description || "No description provided.",
            grade: sub?.grade ? `${sub.grade}/100` : (sub ? "Pending" : undefined),
            gradeNum: sub?.grade,
            feedback: sub?.feedback,
            evalStatus: sub?.status,
            submittedAt: sub?.submitted_at ? new Date(sub.submitted_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : (sub?.submittedAt || undefined),
            fileName: sub?.file_name || sub?.fileName || (sub?.file_url ? sub.file_url.split('/').pop() : undefined),
            fileUrl: sub?.file_url || undefined,
            files: a.assignment_files || []
          };
        });

        if (!isMounted) return;
        localStorage.setItem(`student_assignments_${user.id}`, JSON.stringify(newTasks));
        setTasks(newTasks);
        if (newTasks.length > 0) setSelectedId(newTasks[0].id);
      } catch (err) {
        console.error("Error loading student assignments:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [user]);
  useEffect(() => {
    const activeSelected = tasks.find((t) => t.id === selectedId);
    if (!activeSelected) return;
    const checkOffline = async () => {
      if (!activeSelected.files) return;
      const statuses: Record<string, boolean> = {};
      for (const f of activeSelected.files) {
         const entry = await get(`offline_vault_${f.id}`);
         if (entry) statuses[f.id] = true;
      }
      setDownloadedFiles(statuses);
    };
    checkOffline();
    setInlineViewUrl(null);
    setInlineViewName(null);
    setSelectedFile(null);
  }, [selectedId, tasks]);

  useEffect(() => {
    const fetchExistingSubmission = async () => {
      if (!user?.id || !selectedId) return;
      
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('student_id', user.id)
        .eq('assignment_id', selectedId)
        .maybeSingle();

      if (data) {
        setTasks(ts => ts.map(t => t.id === selectedId ? {
          ...t,
          status: "completed",
          submittedAt: data.submitted_at ? new Date(data.submitted_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : new Date().toLocaleString(),
          fileName: data.file_name || (data.file_url ? data.file_url.split('/').pop() : "Submission"),
          grade: data.grade ? `${data.grade}/100` : "Pending",
          gradeNum: data.grade,
          feedback: data.feedback,
          evalStatus: data.status,
          fileUrl: data.file_url
        } : t));
      }
    };

    fetchExistingSubmission();
  }, [selectedId, user?.id]);

  const selected = tasks.find((t) => t.id === selectedId);
  const incomplete = tasks.filter((t) => t.status !== "completed");
  const completed = tasks.filter((t) => t.status === "completed");

  const handleConfirmSubmit = async () => {
    if (!user || !selectedId || !selectedFile) return;
    setIsUploading(true);
    
    const filePath = `${user.id}/${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const { data, error } = await supabase.storage
      .from("student_submissions")
      .upload(filePath, selectedFile, { upsert: true });

    if (!error && data) {
      const { data: urlData } = supabase.storage.from("student_submissions").getPublicUrl(data.path);
      
      const { error: insertError } = await supabase.from("submissions").insert({
        assignment_id: selectedId,
        student_id: user.id,
        file_url: urlData.publicUrl,
        status: "pending"
      });

      if (!insertError) {
        try {
          await supabase.from("activity_events").insert({
            user_id: user.id,
            event_type: "ASSIGNMENT_SUBMITTED",
            metadata: { assignment_id: selectedId }
          });
        } catch (e) {
          console.error("Activity tracking error:", e);
        }

        setTasks(ts => ts.map(t => t.id === selectedId ? {
          ...t,
          status: "completed",
          submittedAt: new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }),
          fileName: selectedFile.name,
          grade: "Pending"
        } : t));
      } else {
        console.error("Submission insert error:", insertError);
        toast.error("Failed to save submission record.");
      }
    } else {
      console.error("Upload error:", error);
      toast.error("Failed to upload submission.");
    }
    
    setSelectedFile(null);
    setIsUploading(false);
  };

  const handleDownload = () => {
    if (selected?.fileName) alert(`Downloading ${selected.fileName}`);
  };

  const handlePreviewFile = async (file: any) => {
    if (previewLoading) return;
    try {
      if (!navigator.onLine) {
        const entry = await get(`offline_vault_${file.id}`) as any;
        if (entry && entry.blob) {
            const url = URL.createObjectURL(entry.blob);
            setInlineViewUrl(url + '#toolbar=0');
            setInlineViewName(file.file_name);
        } else {
            toast.error("File not available offline. Please download it first.");
        }
        return;
      }

      setPreviewLoading(file.id);
      
      const match = file.file_url.match(/assignment_files\/(.+)$/);
      if (!match || !match[1]) {
          console.error("Invalid file URL format:", file.file_url);
          return;
      }
      const cleanPath = match[1];

      const { data: blob, error } = await supabase.storage.from('assignment_files').download(cleanPath);
      if (error) {
          console.error("Supabase Download Error:", error);
          throw error;
      }

      const url = URL.createObjectURL(blob);
      setInlineViewUrl(url + '#toolbar=0');
      setInlineViewName(file.file_name);
    } catch (err) {
      console.error("Error previewing file:", err);
      toast.error("Failed to load file preview securely.");
    } finally {
      setPreviewLoading(null);
    }
  };

  const handleSaveToOfflineVault = async (blob: Blob, fileId: string, fileName: string) => {
    const fileExt = fileName.split('.').pop() || 'pdf';
    await saveToOfflineVault(fileId, blob, {
      title: fileName,
      type: fileExt
    });
    await addToOfflineVaultIndex(fileId);
    setDownloadedFiles(prev => ({...prev, [fileId]: true}));
    toast.success("File successfully saved to offline vault.");
  };


  if (!navigator.onLine && (!tasks || tasks.length === 0)) {
    return <div className="p-8 text-center text-gray-500">You are offline. Please reconnect to view this content.</div>;
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin size-8" style={{ color: BLUE }} />
      </div>
    );
  }
  if (!selected) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col items-center justify-center min-h-[50vh] text-center">
        <p className="text-sm font-medium" style={{ color: NAVY }}>No assignments found</p>
        <p className="text-sm text-gray-500 mt-1">Check back when your mentor assigns new work.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 grid gap-5" style={{ gridTemplateColumns: sidebarOpen ? "320px 1fr" : "1fr" }}>
      {sidebarOpen && (
        <aside className="space-y-5">
          <section>
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4" style={{ color: BLUE }} />
                <h3 className="text-sm font-semibold" style={{ color: NAVY }}>Incomplete Tasks</h3>
              </div>
              <span className="text-xs rounded-full px-2 py-0.5" style={{ backgroundColor: "#e7f0f7", color: BLUE }}>{incomplete.length}</span>
            </div>
            <div className="space-y-3">
              {incomplete.map((t) => (
                <TaskCard key={t.id} task={t} active={selectedId === t.id} onClick={() => setSelectedId(t.id)} />
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3 px-1">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <h3 className="text-sm font-semibold" style={{ color: NAVY }}>Completed Tasks</h3>
            </div>
            <div className="space-y-3">
              {completed.map((t) => (
                <TaskCard key={t.id} task={t} active={selectedId === t.id} onClick={() => setSelectedId(t.id)} />
              ))}
            </div>
          </section>
        </aside>
      )}

      <main className="relative bg-white rounded-2xl p-7 shadow-sm border border-gray-100">
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="absolute -left-3 top-8 w-6 h-12 bg-white border border-gray-200 rounded-r-lg flex items-center justify-center text-gray-400 hover:text-[#0D2543] z-10"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform ${sidebarOpen ? "" : "rotate-180"}`} />
        </button>

        <div className="flex items-start justify-between mb-3">
          <h1 className="text-[26px] font-bold" style={{ color: NAVY }}>{selected.title}</h1>
          {selected.status === "overdue" && (
            <span className="flex items-center gap-1.5 bg-red-50 text-red-500 text-xs px-3 py-1.5 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5" /> Overdue by 2 days
            </span>
          )}
          {selected.status === "completed" && (
            <span className="flex items-center gap-1.5 bg-green-50 text-green-600 text-xs px-3 py-1.5 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" /> {selected.grade === "Pending" ? "Submitted" : "Graded"}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-6 text-sm text-gray-500 mb-6">
          <span className="flex items-center gap-1.5"><Folder className="w-4 h-4" /> {selected.moduleName}</span>
          <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Due: {selected.dueLabel}</span>
          <span className="flex items-center gap-1.5"><Trophy className="w-4 h-4" /> Points: {selected.points}</span>
        </div>

        <h2 className="text-sm font-semibold mb-3" style={{ color: NAVY }}>Instructions</h2>
        <p className="text-sm text-gray-600 mb-3 leading-relaxed">{selected.intro}</p>
        <p className="text-sm text-gray-600 mb-3">Please ensure you cover the following key areas:</p>
        <ul className="space-y-2 mb-5 pl-4">
          {selected.instructions.map((ins, i) => (
            <li key={i} className="text-sm text-gray-600 leading-relaxed">{ins}</li>
          ))}
        </ul>

        {selected.files && selected.files.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold mb-3" style={{ color: NAVY }}>Reference Files</h2>
            <ul className="space-y-2">
              {selected.files.map((f: any, i: number) => (
                <li
                  key={f.id || i}
                  className="bg-gray-50/50 rounded-lg border border-gray-100 px-4 py-3 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-md bg-[#e7f0f7] text-[#4493BF] flex items-center justify-center font-semibold text-sm flex-shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <button
                        onClick={() => handlePreviewFile(f)}
                        className="text-sm font-medium hover:underline text-[#4493BF] text-left focus:outline-none truncate block max-w-xs md:max-w-md"
                      >
                        {f.file_name}
                      </button>
                      <div className="text-xs text-gray-400">{formatBytes(f.file_size_bytes)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handlePreviewFile(f)}
                      disabled={previewLoading === f.id}
                      className="text-gray-400 hover:text-[#4493BF] p-2 rounded-lg hover:bg-[#e7f0f7]/50 transition-colors duration-150 relative disabled:opacity-50"
                      title="View in app"
                    >
                      {previewLoading === f.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#4493BF]" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={async () => {
                        if (previewLoading) return;
                        try {
                          setPreviewLoading(f.id);
                          
                          const match = f.file_url.match(/assignment_files\/(.+)$/);
                          if (!match || !match[1]) {
                              console.error("Invalid file URL format:", f.file_url);
                              return;
                          }
                          const cleanPath = match[1];

                          const { data: blob, error } = await supabase.storage.from('assignment_files').download(cleanPath);
                          if (error) {
                              console.error("Supabase Download Error:", error);
                              throw error;
                          }
                          await handleSaveToOfflineVault(blob, f.id, f.file_name);
                        } catch (err) {
                          console.error("Error saving file offline:", err);
                          toast.error("Failed to save file offline.");
                        } finally {
                          setPreviewLoading(null);
                        }
                      }}
                      disabled={previewLoading === f.id || downloadedFiles[f.id]}
                      className="text-gray-400 hover:text-[#4493BF] p-2 rounded-lg hover:bg-[#e7f0f7]/50 transition-colors duration-150 relative disabled:opacity-50"
                      title={downloadedFiles[f.id] ? "Downloaded" : "Download File"}
                    >
                      {previewLoading === f.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#4493BF]" />
                      ) : downloadedFiles[f.id] ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {inlineViewUrl && (
          <div className="mb-6 flex flex-col w-full">
            <div ref={inlineViewerRef} className="w-full flex flex-col bg-white rounded-xl overflow-hidden border border-gray-100 relative">
              <iframe src={inlineViewUrl} className="w-full h-[500px] md:h-[600px] bg-gray-900 border-none" title={inlineViewName || "Preview"} />
            </div>
            <div className="h-14 border border-t-0 border-[#0D2543]/10 bg-[#F2F4F7] rounded-b-lg flex items-center justify-end px-4 gap-3 flex-shrink-0 mt-[-4px]">
              <button
                onClick={() => {
                  if (inlineViewerRef.current) {
                    if (inlineViewerRef.current.requestFullscreen) {
                      inlineViewerRef.current.requestFullscreen();
                    } else if ((inlineViewerRef.current as any).webkitRequestFullscreen) {
                      (inlineViewerRef.current as any).webkitRequestFullscreen();
                    }
                  }
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md bg-white border border-[#0D2543]/10 text-[#0D2543] hover:bg-gray-50"
              >
                <Maximize2 className="w-4 h-4" /> Full Screen
              </button>
            </div>
          </div>
        )}

        <div className="rounded-lg p-4 mb-6 border" style={{ backgroundColor: "#f0f6fa", borderColor: "#cfe3ef" }}>
          <div className="flex items-center gap-2 text-sm font-medium mb-1" style={{ color: BLUE }}>
            <Info className="w-4 h-4" /> Note
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            Submissions must be in PDF or DOCX format. Make sure to adhere to the IEEE citation format for any external references used.
          </p>
        </div>

        <div className="border-t border-gray-100 pt-6">
          <h2 className="text-sm font-semibold mb-4" style={{ color: NAVY }}>Your Submission</h2>

          {selected.status !== "completed" && <UploadBox selectedFile={selectedFile} setSelectedFile={setSelectedFile} isUploading={isUploading} onConfirm={handleConfirmSubmit} />}

          {selected.status === "completed" && (
            <>
              <div className="bg-green-50/40 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-green-500" />
                  <div>
                    <div className="text-sm font-medium" style={{ color: NAVY }}>Submitted successfully</div>
                    <div className="text-sm text-gray-500">Completed on {selected.submittedAt}</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-red-50 flex items-center justify-center text-red-500 text-sm font-semibold">PDF</div>
                  <div>
                    <div className="text-sm font-medium" style={{ color: NAVY }}>{selected.fileName}</div>
                    <div className="text-sm text-gray-400">4.2 MB</div>
                  </div>
                </div>
                <button onClick={handleDownload} className="text-gray-400 hover:text-[#0D2543] p-2 rounded hover:bg-gray-50">
                  <Download className="w-4 h-4" />
                </button>
              </div>
              {(selected.evalStatus === 'approved' || selected.evalStatus === 'needs_revision' || selected.evalStatus === 'graded') ? (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                  <div className="flex items-center gap-2 mb-2 text-blue-800 font-medium">
                    <MessageSquare className="w-4 h-4" />
                    Instructor Feedback
                  </div>
                  <p className="text-sm text-blue-900 mb-2 leading-relaxed">
                    {selected.feedback || "Your instructor has reviewed your submission but did not leave written feedback."}
                  </p>
                  {selected.gradeNum != null && (
                    <div className="text-sm font-bold text-blue-900 mt-2">
                      Grade: {selected.gradeNum}/100
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function TaskCard({ task, active, onClick }: { task: Task; active: boolean; onClick: () => void }) {
  const done = task.status === "completed";
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-xl p-4 border transition-all ${active ? "" : "border-gray-100 hover:border-gray-200"}`}
      style={active ? { borderColor: BLUE, boxShadow: `0 0 0 3px rgba(68,147,191,0.15)` } : undefined}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-sm font-semibold" style={{ color: done ? "#9ca3af" : NAVY, textDecoration: done ? "line-through" : "none" }}>{task.title}</div>
        {task.status === "overdue" && <span className="text-sm bg-red-50 text-red-500 px-2 py-0.5 rounded-md flex-shrink-0">Overdue</span>}
        {done && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
      </div>
      <p className={`text-[16px] mb-3 leading-snug ${done ? "text-gray-400" : "text-gray-500"}`}>{task.desc}</p>
      <div className="flex gap-3 text-sm text-gray-400">
        {done ? (
          <>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Submitted: {task.submittedAt?.split(" at")[0] || task.date}</span>
            {task.grade && task.grade !== "Pending" && <span className="flex items-center gap-1"><Trophy className="w-3 h-3" /> Grade: {task.grade}</span>}
          </>
        ) : (
          <>
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {task.date}</span>
            <span className="flex items-center gap-1"><Folder className="w-3 h-3" /> {task.module}</span>
          </>
        )}
      </div>
    </button>
  );
}

function UploadBox({ 
  selectedFile, 
  setSelectedFile, 
  isUploading, 
  onConfirm 
}: { 
  selectedFile: File | null; 
  setSelectedFile: (f: File | null) => void; 
  isUploading: boolean; 
  onConfirm: () => void; 
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (selectedFile) {
    return (
      <div className="w-full border border-gray-200 rounded-xl p-6 bg-white shadow-sm flex flex-col items-center">
        <div className="flex items-center gap-3 w-full mb-6 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <FileText className="w-6 h-6 text-[#4493BF]" />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#0D2543] truncate">{selectedFile.name}</p>
                <p className="text-xs text-gray-400">{formatBytes(selectedFile.size)}</p>
            </div>
            <button 
                onClick={() => setSelectedFile(null)} 
                disabled={isUploading}
                className="text-gray-400 hover:text-red-500 p-2 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
        <button
            onClick={onConfirm}
            disabled={isUploading}
            className="w-full bg-[#4493BF] hover:bg-[#3882ab] text-white py-3 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
        >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isUploading ? "Uploading..." : "Confirm Submit"}
        </button>
      </div>
    );
  }

  return (
    <>
      <input 
        type="file" 
        className="hidden" 
        accept=".pdf,.docx,.zip"
        ref={fileInputRef} 
        onChange={(e) => {
          if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
        }} 
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="w-full border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 py-12 flex flex-col items-center hover:border-[#4493BF] hover:bg-[#f0f6fa] transition-colors disabled:opacity-50"
      >
        <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-3">
          <Upload className="w-5 h-5" style={{ color: BLUE }} />
        </div>
        <div className="text-sm font-medium mb-1" style={{ color: NAVY }}>
          Click to upload or drag and drop
        </div>
        <div className="text-sm text-gray-400">Supported formats: PDF, DOCX, ZIP (Max size: 25MB)</div>
      </button>
    </>
  );
}

