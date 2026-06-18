import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/auth/AuthContext";
import { createPortal } from "react-dom";
import {
  ChevronDown, ChevronRight, CheckCircle2, Circle, Play, FileText, Video, Pause,
  Download, Maximize2, ChevronLeft, X, Clock, BookOpen, MessageCircle, Paperclip,
  Code2, Bookmark, BookmarkCheck, Share2, ArrowRight, Star, Search, FileQuestion,
  Cloud, CloudDownload,
} from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { OfflineDownloadButton } from "@/components/OfflineDownloadButton";
import { saveToOfflineVault, getOfflineVaultContents, addToOfflineVaultIndex } from "@/lib/offlineVault";
import { get } from "idb-keyval";
import { toast } from "sonner";
import { SecurePDFViewer } from "./SecurePDFViewer";
const BLUE = "#4493BF";
const BLUE_TINT = "#E8F1F7";
const NAVY = "#0D2543";
const SURFACE_0 = "#F2F4F7";
const BORDER = "rgba(13,37,67,0.08)";
const BORDER_STRONG = "rgba(13,37,67,0.16)";
const TEXT_PRIMARY = "#0D2543";
const TEXT_SECONDARY = "#5B6B7D";
const TEXT_TERTIARY = "#8E9AA8";
const SHADOW_SM = "0 1px 2px rgba(13,37,67,0.04), 0 1px 6px rgba(13,37,67,0.04)";
const SHADOW_MD = "0 4px 12px -2px rgba(13,37,67,0.10), 0 2px 4px -1px rgba(13,37,67,0.05)";

type LessonKind = "video" | "reading" | "quiz" | "assignment";

interface Lesson {
  id: string;
  title: string;
  desc: string;
  kind: LessonKind;
  duration: string;
  format?: string;
  url?: string | null;
  videoUrl?: string | null;
  isIspring?: boolean;
  ispringUrl?: string | null;
}
interface Module {
  id: string;
  title: string;
  code: string;
  lessons: Lesson[];
}
interface Course {
  id: string;
  code: string;
  title: string;
  modules: Module[];
}

function subjectCode(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "SB";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase().slice(0, 2);
}

function lessonKindMeta(kind: LessonKind) {
  switch (kind) {
    case "video": return { label: "VIDEO", icon: Video, bg: "#E8F1F7", fg: BLUE };
    case "reading": return { label: "READING", icon: BookOpen, bg: "#F1ECFB", fg: "#7C5CD3" };
    case "quiz": return { label: "QUIZ", icon: FileQuestion, bg: "#FFF2E6", fg: "#D97706" };
    case "assignment": return { label: "LAB", icon: Code2, bg: "#EAF7EE", fg: "#16A34A" };
  }
}

export function MyCourses({ selectedCourseId, selectedLessonId }: { selectedCourseId?: string | null; selectedLessonId?: string | null }) {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEmptyOffline, setIsEmptyOffline] = useState(false);

  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [openCourseIds, setOpenCourseIds] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<"video" | "slides">("video");
  const [currentId, setCurrentId] = useState<string>("");
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>({});
  const [playing, setPlaying] = useState(false);
  const [offlineLessonIds, setOfflineLessonIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [discussion, setDiscussion] = useState<{ id: string; name: string; initials: string; color: string; time: string; text: string; replies: number }[]>([
    { id: "d1", name: "Maya Lin", initials: "ML", color: "#8B5CF6", time: "2h ago", text: "Could you share an example of where strategic risk overlaps with operational? The lecture treated them as disjoint.", replies: 4 },
    { id: "d2", name: "Jordan Reyes", initials: "JR", color: "#F59E0B", time: "1d ago", text: "ISO 31000 is referenced at 12:40 — is the latest revision relevant to the cost-benefit framework in Module 4?", replies: 2 },
  ]);
  const [newQuestion, setNewQuestion] = useState("");

  const postQuestion = () => {
    const text = newQuestion.trim();
    if (!text) return;
    setDiscussion((d) => [
      { id: `d${Date.now()}`, name: "Alex Chen", initials: "AC", color: BLUE, time: "just now", text, replies: 0 },
      ...d,
    ]);
    setNewQuestion("");
  };

  useEffect(() => {
    if (!user) return;
    if (!navigator.onLine) {
      (async () => {
        try {
          const cachedStr = localStorage.getItem(`student_courses_${user.id}`);
          const cachedCourses = cachedStr ? JSON.parse(cachedStr) : null;
          
          if (cachedCourses && cachedCourses.length > 0) {
            setCourses(cachedCourses);
            const initialCourseIds: Record<string, boolean> = {};
            const initialOpenIds: Record<string, boolean> = {};
            let firstLessonId = "";
            initialCourseIds[cachedCourses[0].id] = true;
            initialOpenIds[cachedCourses[0].modules[0].id] = true;
            if (cachedCourses[0].modules[0].lessons.length > 0) {
              firstLessonId = cachedCourses[0].modules[0].lessons[0].id;
            }
            setOpenCourseIds(initialCourseIds);
            setOpenIds(initialOpenIds);
            setCurrentId(firstLessonId);
            
            const cachedProg = localStorage.getItem(`student_progress_${user.id}`);
            if (cachedProg) setCompleted(JSON.parse(cachedProg));
            
            const cachedMarks = localStorage.getItem(`student_bookmarks_${user.id}`);
            if (cachedMarks) setBookmarks(JSON.parse(cachedMarks));
            
            try {
              const entries = await getOfflineVaultContents();
              const ids = new Set(entries.map(e => e.metadata.id));
              setOfflineLessonIds(ids);
            } catch (e) {}
          } else {
            setIsEmptyOffline(true);
          }
        } catch (e) {
          console.error("Failed to load offline cache:", e);
          setIsEmptyOffline(true);
        } finally {
          setLoading(false);
        }
      })();
      return;
    }
    let isMounted = true;
    (async () => {
      try {
        let mapped: Course[] = [];
        let compMap: Record<string, boolean> = {};

        const isOnline = typeof navigator !== "undefined" && navigator.onLine;

        if (isOnline) {
          try {
            const { data: cs } = await supabase.from("cohort_students").select("cohort_id").eq("student_id", user.id);
            const cohortIds = cs?.map(c => c.cohort_id) || [];

            const today = new Date().toISOString().split('T')[0];
            const { data: activeCohorts } = await supabase
              .from("cohorts")
              .select("id")
              .in("id", cohortIds)
              .gte("end_date", today)
              .lte("start_date", today);
              
            const activeCohortIds = activeCohorts?.length ? activeCohorts.map(c => c.id) : cohortIds;

            const { data: cm } = await supabase.from("cohort_modules").select("module_id").in("cohort_id", activeCohortIds);
            const unlockedModuleIds = new Set(cm?.map(c => c.module_id) || []);

            const { data: dbCourses } = await supabase
              .from("courses")
              .select(`
                id, title, description,
                modules (
                  id, title, description, order_index, type, duration, video_url, subject_id,
                  subjects ( id, name ),
                  module_versions ( id, content_url, is_published, is_ispring, ispring_r2_url )
                )
              `)
              .eq("is_active", true);

            if (dbCourses) {
              mapped = dbCourses.map((c: any) => {
                const dbMods = ((c.modules || []) as any[]).sort((a,b) => a.order_index - b.order_index);
                const subjectGroups = new Map<string, Module>();

                dbMods.filter(m => unlockedModuleIds.has(m.id)).forEach(m => {
                  const publishedVersion = m.module_versions?.find((v: any) => v.is_published) || m.module_versions?.[0];
                  const isIspring = publishedVersion?.is_ispring === true;
                  const subject = Array.isArray(m.subjects) ? m.subjects[0] : m.subjects;
                  const subjectId = m.subject_id || subject?.id || `subject_${c.id}`;
                  const subjectName = subject?.name || "General";

                  if (!subjectGroups.has(subjectId)) {
                    subjectGroups.set(subjectId, {
                      id: subjectId,
                      code: subjectCode(subjectName),
                      title: subjectName,
                      lessons: [],
                    });
                  }

                  subjectGroups.get(subjectId)!.lessons.push({
                    id: m.id,
                    title: m.title,
                    desc: m.description || "",
                    kind: (m.type === "SLIDES" || m.type === "DOCUMENT" || m.type === "PDF" || m.type === "PPT" || m.type === "SCORM") ? "reading" : "video" as LessonKind,
                    duration: m.duration || "",
                    format: m.type || "VIDEO",
                    url: publishedVersion?.content_url || null,
                    videoUrl: m.video_url || null,
                    isIspring,
                    ispringUrl: isIspring ? (publishedVersion?.ispring_r2_url || null) : null,
                  });
                });

                return {
                  id: c.id,
                  code: c.title.substring(0, 3).toUpperCase(),
                  title: c.title,
                  modules: Array.from(subjectGroups.values())
                };
              }).filter((c: any) => c.modules.some((m: Module) => m.lessons.length > 0));

              if (mapped.length > 0) {
                localStorage.setItem(`student_courses_${user.id}`, JSON.stringify(mapped));
              }
            }

            const { data: prog } = await supabase
              .from("student_progress")
              .select("module_id, completed")
              .eq("student_id", user.id)
              .eq("completed", true);
            
            if (prog) {
              prog.forEach(p => { if (p.completed) compMap[p.module_id] = true; });
              localStorage.setItem(`student_progress_${user.id}`, JSON.stringify(compMap));
            }
          } catch (err) {
            console.error("Supabase load failed, offline or error:", err);
          }
        }

        // If we couldn't load from Supabase (e.g. offline), try using cached local storage data
        if (mapped.length === 0) {
          const cached = localStorage.getItem(`student_courses_${user.id}`);
          if (cached) {
            try {
              mapped = JSON.parse(cached);
            } catch (err) {
              console.error("Failed to parse cached courses", err);
            }
          }
        }

        if (Object.keys(compMap).length === 0) {
          const cachedProg = localStorage.getItem(`student_progress_${user.id}`);
          if (cachedProg) {
            try {
              compMap = JSON.parse(cachedProg);
            } catch (err) {
              console.error("Failed to parse cached progress", err);
            }
          }
        }

        if (!isMounted) return;
        
        const finalCourses = mapped;

        setCourses(finalCourses);
        setCompleted(compMap);

        // Load bookmarks
        const stored = localStorage.getItem(`student_bookmarks_${user.id}`);
        if (stored) {
          try {
            setBookmarks(JSON.parse(stored));
          } catch (err) {
            console.error("Failed to parse bookmarks", err);
          }
        }

        // Load offline vault contents
        try {
          const entries = await getOfflineVaultContents();
          const ids = new Set(entries.map(e => e.metadata.id));
          setOfflineLessonIds(ids);
        } catch (err) {
          console.error("Failed to load offline vault content IDs", err);
        }
        
        const initialCourseIds: Record<string, boolean> = {};
        const initialOpenIds: Record<string, boolean> = {};
        let firstLessonId = "";
        const requestedCourse = selectedCourseId ? finalCourses.find((c) => c.id === selectedCourseId) : undefined;
        const requestedLesson = requestedCourse && selectedLessonId
          ? requestedCourse.modules.flatMap((m) => m.lessons).find((l) => l.id === selectedLessonId)
          : undefined;
        const initialCourse = requestedCourse || finalCourses[0];
        const initialModule = requestedLesson
          ? initialCourse?.modules.find((m) => m.lessons.some((l) => l.id === requestedLesson.id))
          : initialCourse?.modules.find((m) => m.lessons.length > 0);
        const initialLesson = requestedLesson || initialModule?.lessons[0];
        if (initialCourse && initialModule && initialLesson) {
          initialCourseIds[initialCourse.id] = true;
          initialOpenIds[initialModule.id] = true;
          firstLessonId = initialLesson.id;
        }
        setOpenCourseIds(initialCourseIds);
        setOpenIds(initialOpenIds);
        setCurrentId(firstLessonId);
      } catch (err) {
        console.error("Error in MyCourses data fetching:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [user, selectedCourseId, selectedLessonId]);
const enrolledCourses = courses;
  const allLessons = courses.flatMap((c) => c.modules.flatMap((m) => m.lessons));
  const findCourseByLesson = (lessonId: string) => courses.find((c) => c.modules.some((m) => m.lessons.some((l) => l.id === lessonId)));
  const findModuleByLesson = (lessonId: string) => courses.flatMap((c) => c.modules).find((m) => m.lessons.some((l) => l.id === lessonId));
  const current = allLessons.find((l) => l.id === currentId) ?? allLessons[0];
  const currentCourse = current ? findCourseByLesson(current.id) : null;
  const currentModule = current ? findModuleByLesson(current.id) : null;

  const handledSelectionRef = useRef<string>("");

  useEffect(() => {
    if (!selectedCourseId || courses.length === 0) return;
    const selectionKey = `${selectedCourseId}:${selectedLessonId || ""}`;
    if (handledSelectionRef.current === selectionKey) return;
    
    const selectedCourse = courses.find((c) => c.id === selectedCourseId);
    const firstModule = selectedCourse?.modules.find((m) => m.lessons.length > 0);
    const requestedLesson = selectedCourse?.modules.flatMap((m) => m.lessons).find((l) => l.id === selectedLessonId);
    const targetLesson = requestedLesson || firstModule?.lessons[0];
    const targetModule = targetLesson ? selectedCourse?.modules.find((m) => m.lessons.some((l) => l.id === targetLesson.id)) : firstModule;
    if (!selectedCourse || !targetModule || !targetLesson) return;

    setOpenCourseIds((currentOpen) => ({ ...currentOpen, [selectedCourse.id]: true }));
    setOpenIds((currentOpen) => ({ ...currentOpen, [targetModule.id]: true }));
    setCurrentId(targetLesson.id);
    handledSelectionRef.current = selectionKey;
  }, [selectedCourseId, selectedLessonId, courses]);

  useEffect(() => {
    if (current) {
      if (current.format === 'PDF' || current.format === 'SLIDES' || current.format === 'DOCUMENT' || current.format === 'PPT' || current.format === 'SCORM') {
        setTab('slides');
      } else {
        setTab('video');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [slideViewUrl, setSlideViewUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let objectUrlToRevoke: string | null = null;
    const fetchSignedUrl = async () => {
      // iSpring content uses R2 URL directly — no Supabase storage fetch needed
      if (current?.isIspring) {
        if (isMounted) setSlideViewUrl(null); // iSpring handled separately via ispringUrl
        return;
      }

      const isSlideFormat = current?.format === 'PDF' || current?.format === 'SLIDES' || current?.format === 'DOCUMENT' || current?.format === 'PPT' || current?.format === 'SCORM';

      if (current && current.url && isSlideFormat) {
        // Check if it's a Supabase Storage URL (even if full URL, extract path for private bucket access)
        const supabaseStoragePattern = /storage\/v1\/object\/(public|sign|authenticated)\/module_content\/(.+)/;
        const supabaseMatch = current.url.match(supabaseStoragePattern);
        
        // If it's an R2 URL (SCORM), use it directly as iframe src
        if (current.url.includes('r2.dev/content/') || current.url.includes('index.html')) {
          if (isMounted) setSlideViewUrl(current.url);
          return;
        }

        // If it's a Supabase Storage URL, extract the path and download as blob
        let cleanPath = '';
        if (supabaseMatch) {
          // Extract path from full Supabase URL
          cleanPath = supabaseMatch[2];
        } else if (current.url.includes('module_content/')) {
          // Handle path-only format
          cleanPath = current.url.split('module_content/')[1];
        } else {
          // Unknown format
          cleanPath = current.url;
        }
        
        cleanPath = decodeURIComponent(cleanPath.split('?')[0]).replace(/^\/+/, '').replace(/\/+$/, '');

        if (!cleanPath) {
          if (isMounted) setSlideViewUrl(null);
          return;
        }

        try {
            console.log('Downloading PDF from path:', cleanPath);
            const { data: blob, error } = await supabase.storage.from('module_content').download(cleanPath);

            if (error || !blob) {
                console.error("Failed to download file:", error);
                if (isMounted) setSlideViewUrl(null);
                return;
            }

            console.log('PDF blob downloaded successfully, size:', blob.size);

            // Create an isolated local memory URL for the iframe
            if (isMounted) {
              const objectUrl = URL.createObjectURL(blob);
              objectUrlToRevoke = objectUrl;
              console.log('Created blob URL:', objectUrl);
              setSlideViewUrl(objectUrl);
            }

        } catch (err) {
            console.error("Complete PDF Load Failure:", err);
            if (isMounted) setSlideViewUrl(null);
        }
      } else {
        if (isMounted) setSlideViewUrl(null);
      }
    };
    fetchSignedUrl();
    return () => {
      isMounted = false;
      setSlideViewUrl((currentUrl) => {
          if (currentUrl && currentUrl.startsWith('blob:')) {
              URL.revokeObjectURL(currentUrl.split('#')[0]);
          }
          return null;
      });
      if (objectUrlToRevoke) {
          URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [current]);

  useEffect(() => {
    let isMounted = true;
    const checkOfflineStatus = async () => {
        if (current) {
            if (offlineLessonIds.has(current.id)) {
                if (isMounted) setIsDownloaded(true);
                return;
            }
            try {
                const entry = await get(`offline_vault_${current.id}`);
                if (entry && isMounted) {
                    setIsDownloaded(true);
                    setOfflineLessonIds(prev => {
                        const newSet = new Set(prev);
                        newSet.add(current!.id);
                        return newSet;
                    });
                } else if (isMounted) {
                    setIsDownloaded(false);
                }
            } catch (err) {
                if (isMounted) setIsDownloaded(false);
            }
        } else {
            if (isMounted) setIsDownloaded(false);
        }
    };
    checkOfflineStatus();
    return () => { isMounted = false; };
  }, [current, offlineLessonIds]);

  const toggleCourse = (id: string) => setOpenCourseIds((o) => ({ ...o, [id]: !o[id] }));
  const toggleModule = (id: string) => setOpenIds((o) => ({ ...o, [id]: !o[id] }));

  const currentIdx = current ? allLessons.findIndex((l) => l.id === current.id) : -1;
  const nextLesson = currentIdx >= 0 ? allLessons[currentIdx + 1] : undefined;
  
  const isBookmarked = current ? !!bookmarks[current.id] : false;
  const isCompleted = current ? !!completed[current.id] : false;
  const isOfflineAvailable = current ? offlineLessonIds.has(current.id) : false;

  const moduleProgress = (m: Module) => {
    if (!m.lessons.length) return { done: 0, total: 0, pct: 0 };
    const done = m.lessons.filter((l) => completed[l.id]).length;
    return { done, total: m.lessons.length, pct: Math.round((done / m.lessons.length) * 100) };
  };

  const courseProgress = (c: Course) => {
    const mods = c.modules.map(moduleProgress);
    const totalDone = mods.reduce((sum, m) => sum + m.done, 0);
    const totalAll = mods.reduce((sum, m) => sum + m.total, 0);
    return { done: totalDone, total: totalAll, pct: totalAll === 0 ? 0 : Math.round((totalDone / totalAll) * 100) };
  };

  const handleNext = () => {
    if (nextLesson) setCurrentId(nextLesson.id);
  };

  const markComplete = async () => {
    if (!current || !user) return;
    const newVal = !isCompleted;
    setCompleted((c) => ({ ...c, [current.id]: newVal }));

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(current.id);
    if (isUuid) {
      try {
        const { error } = await supabase.from("student_progress").upsert({
          student_id: user.id,
          module_id: current.id,
          completed: newVal,
          updated_at: new Date().toISOString()
        }, { onConflict: "student_id, module_id" });

        if (error) {
          console.error("Error upserting progress:", error);
          toast.error("Failed to save progress: " + error.message);
        } else {
          if (newVal) {
            try {
              await supabase.from("activity_events").insert({
                user_id: user.id,
                event_type: "MODULE_COMPLETED",
                metadata: { module_id: current.id }
              });
            } catch (e) {
              console.error("Activity tracking error:", e);
            }
          }
          toast.success(newVal ? "Lesson marked as complete" : "Lesson marked as incomplete");
        }
      } catch (err: any) {
        console.error("Error upserting progress:", err);
      }
    } else {
      toast.success(newVal ? "Lesson marked as complete (local)" : "Lesson marked as incomplete (local)");
    }
  };
  
  const toggleBookmark = () => {
    if (current && user) {
      setBookmarks((b) => {
        const next = { ...b, [current.id]: !b[current.id] };
        localStorage.setItem(`student_bookmarks_${user.id}`, JSON.stringify(next));
        return next;
      });
    }
  };

  const handleDownload = async () => {
    if (!current || !current.url) {
      toast.error("No file URL available for this lesson.");
      return;
    }
    
    let cleanPath = current.url;
    if (cleanPath.includes('module_content/')) {
        cleanPath = cleanPath.split('module_content/')[1];
    }
    cleanPath = decodeURIComponent(cleanPath.split('?')[0]).replace(/^\/+/, '').replace(/\/+$/, '');
    
    try {
      setDownloadProgress(0);
      const progressInterval = setInterval(() => {
        setDownloadProgress(p => p !== null && p < 90 ? p + 10 : p);
      }, 300);

      const { data: blob, error } = await supabase.storage.from('module_content').download(cleanPath);
      if (error || !blob) throw new Error(error?.message || "Failed to download file");
      
      clearInterval(progressInterval);
      setDownloadProgress(100);

      await saveToOfflineVault(current.id, blob, {
        title: current.title,
        type: current.format || "VIDEO",
      });
      await addToOfflineVaultIndex(current.id);
      
      setOfflineLessonIds(prev => {
        const next = new Set(prev);
        next.add(current.id);
        return next;
      });

      setTimeout(() => {
        setDownloadProgress(null);
        setIsDownloaded(true);
        toast.success("Lesson downloaded successfully for offline use.", { id: "dl" });
      }, 500);

    } catch (err: any) {
      setDownloadProgress(null);
      console.error("Download failed:", err);
      toast.error("Failed to download lesson: " + err.message, { id: "dl" });
    }
  };

  const isMultiCourse = courses.length > 1;

  if (isEmptyOffline) {
    return <div className="p-8 text-center text-gray-500">You are offline. No downloaded courses available. Please reconnect.</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" style={{ backgroundColor: SURFACE_0 }}>
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 rounded-full border-2 border-[#4493BF] border-t-transparent animate-spin" />
          <p className="text-sm font-medium" style={{ color: TEXT_SECONDARY }}>Loading your courses…</p>
        </div>
      </div>
    );
  }
  if (!current || !currentCourse || !currentModule) {
    return <div className="flex-1 flex items-center justify-center min-h-0" style={{ backgroundColor: SURFACE_0 }}>No accessible courses found.</div>;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0" style={{ backgroundColor: SURFACE_0 }}>
      <div className="w-full max-w-[1280px] mx-auto px-6 py-6 flex-1 flex flex-col min-h-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-4" style={{ color: TEXT_TERTIARY }}>
          <span>My Courses</span>
          <ChevronRight className="w-3 h-3" />
          <span>{currentCourse.title}</span>
          <ChevronRight className="w-3 h-3" />
          <span style={{ color: TEXT_SECONDARY }}>{currentModule.title}</span>
          <ChevronRight className="w-3 h-3" />
          <span style={{ color: TEXT_PRIMARY, fontWeight: 500 }}>{current.title}</span>
        </div>

        <div className="flex flex-1 gap-5 min-h-0">
          {/* Sidebar */}
          <aside
            className="w-[320px] flex-shrink-0 rounded-xl overflow-hidden flex flex-col min-h-0"
            style={{ backgroundColor: "#fff", border: `1px solid ${BORDER}`, boxShadow: SHADOW_SM }}
          >
            {/* Header: single-course = course title + progress; multi-course = enrollment summary */}
            {!isMultiCourse ? (
              <div className="p-4 border-b" style={{ borderColor: BORDER }}>
                <div className="text-xs font-semibold tracking-[0.08em] mb-1.5" style={{ color: TEXT_TERTIARY }}>
                  ENROLLED COURSE
                </div>
                <div className="text-sm font-semibold mb-3" style={{ color: TEXT_PRIMARY, letterSpacing: "-0.2px" }}>
                  {enrolledCourses[0].title}
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm" style={{ color: TEXT_TERTIARY }}>Course progress</span>
                  <span className="text-sm font-semibold" style={{ color: TEXT_PRIMARY }}>{courseProgress(enrolledCourses[0]).pct}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#EEF1F4" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${courseProgress(enrolledCourses[0]).pct}%`, backgroundColor: BLUE }} />
                </div>
              </div>
            ) : (
              <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: BORDER }}>
                <div>
                  <div className="text-xs font-semibold tracking-[0.08em]" style={{ color: TEXT_TERTIARY }}>
                    MY ENROLLMENTS
                  </div>
                  <div className="text-sm font-semibold mt-0.5" style={{ color: TEXT_PRIMARY, letterSpacing: "-0.2px" }}>
                    {enrolledCourses.length} Courses
                  </div>
                </div>
                <div
                  className="rounded-md flex items-center justify-center text-sm font-semibold"
                  style={{ padding: "4px 10px", backgroundColor: BLUE_TINT, color: BLUE }}
                >
                  {Math.round(
                    enrolledCourses.reduce((acc, c) => acc + courseProgress(c).pct, 0) / enrolledCourses.length,
                  )}% avg
                </div>
              </div>
            )}

            <div className="px-3 py-2.5 border-b" style={{ borderColor: BORDER }}>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: TEXT_TERTIARY }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search lessons…"
                  className="w-full text-sm pl-8 pr-2.5 py-1.5 rounded-md outline-none transition-shadow"
                  style={{ backgroundColor: SURFACE_0, color: TEXT_PRIMARY }}
                  onFocus={(e) => (e.currentTarget.style.boxShadow = `0 0 0 2px ${BLUE_TINT}`)}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                />
              </div>
            </div>

            <div
              className="overflow-y-auto flex-1 min-h-0 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#d6d3c7] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#c4c0b1]"
              style={{ scrollbarWidth: "thin", scrollbarColor: "#d6d3c7 transparent" }}
            >
              {enrolledCourses.map((course) => {
                const cProg = courseProgress(course);
                const courseHasMatch = !query || course.modules.some((m) =>
                  m.lessons.some((l) => l.title.toLowerCase().includes(query.toLowerCase())),
                );
                if (!courseHasMatch) return null;
                const courseOpen = isMultiCourse ? (query ? true : !!openCourseIds[course.id]) : true;

                const moduleList = course.modules.map((m) => {
                  const isOpen = isMultiCourse ? (query ? true : !!openIds[m.id]) : (query ? true : !!openIds[m.id]);
                  const prog = moduleProgress(m);
                  const visibleLessons = query
                    ? m.lessons.filter((l) => l.title.toLowerCase().includes(query.toLowerCase()))
                    : m.lessons;
                  if (query && visibleLessons.length === 0) return null;
                  return (
                    <div key={m.id} className="border-b last:border-0" style={{ borderColor: BORDER }}>
                      <button
                        onClick={() => setOpenIds((s) => ({ ...s, [m.id]: !s[m.id] }))}
                        className="w-full flex items-center gap-2.5 text-left transition-colors hover:bg-[#F8FAFC]"
                        style={{ padding: `12px 14px 12px ${isMultiCourse ? 18 : 14}px` }}
                      >
                        <div
                          className="w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{ backgroundColor: prog.pct === 100 ? "#EAF7EE" : BLUE_TINT, color: prog.pct === 100 ? "#16A34A" : BLUE }}
                        >
                          {m.code}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate" style={{ color: TEXT_PRIMARY }}>{m.title}</div>
                          <div className="text-sm mt-0.5" style={{ color: TEXT_TERTIARY }}>
                            {prog.done}/{prog.total} lessons · {prog.pct}%
                          </div>
                        </div>
                        <ChevronDown
                          className="w-4 h-4 transition-transform flex-shrink-0"
                          style={{ color: TEXT_TERTIARY, transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                        />
                      </button>
                      {isOpen && visibleLessons.length > 0 && (
                        <div className="pb-2">
                          {visibleLessons.map((l) => {
                            const isDone = !!completed[l.id];
                            const isCurrent = current.id === l.id;
                            const isBookmarked = !!bookmarks[l.id];
                            const isOffline = offlineLessonIds.has(l.id);
                            const meta = lessonKindMeta(l.kind);
                            const Icon = meta.icon;
                            const basePad = isMultiCourse ? 22 : 16;
                            return (
                              <button
                                key={l.id}
                                onClick={() => setCurrentId(l.id)}
                                className="w-full text-left flex items-center gap-3 py-3 pr-4 transition-colors group"
                                style={{
                                  paddingLeft: isCurrent ? basePad - 3 : basePad,
                                  borderLeft: isCurrent ? `3px solid ${BLUE}` : "3px solid transparent",
                                  backgroundColor: isCurrent ? BLUE_TINT : "transparent",
                                }}
                                onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.backgroundColor = "#F8FAFC"; }}
                                onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.backgroundColor = "transparent"; }}
                              >
                                <div className="flex-shrink-0">
                                  {isDone ? (
                                    <CheckCircle2 className="w-5 h-5" style={{ color: "#16A34A" }} />
                                  ) : (
                                    <Circle
                                      className="w-5 h-5"
                                      style={{ color: isCurrent ? BLUE : "#CBD3DB", fill: isCurrent ? BLUE : "transparent" }}
                                    />
                                  )}
                                </div>
                                <span
                                  className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                                  style={{ backgroundColor: meta.bg, color: meta.fg }}
                                >
                                  <Icon className="w-4 h-4" />
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <div
                                      className="text-sm font-semibold truncate"
                                      style={{ color: isCurrent ? BLUE : isDone ? TEXT_TERTIARY : TEXT_PRIMARY, textDecoration: isDone && !isCurrent ? "line-through" : "none" }}
                                    >
                                      {l.title}
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      {isBookmarked && (
                                        <Bookmark className="w-3.5 h-3.5" style={{ color: BLUE, fill: BLUE }} />
                                      )}
                                      {isOffline && (
                                        <Cloud className="w-3.5 h-3.5" style={{ color: "#16A34A" }} />
                                      )}
                                    </div>
                                  </div>
                                  {l.duration && l.duration !== "N/A" && (
                                    <div className="flex items-center gap-1.5 mt-1 text-xs font-medium" style={{ color: TEXT_TERTIARY }}>
                                      <Clock className="w-3 h-3" /> {l.duration}
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                });

                if (!isMultiCourse) {
                  return <div key={course.id}>{moduleList}</div>;
                }

                return (
                  <div key={course.id} className="border-b last:border-0" style={{ borderColor: BORDER }}>
                    <button
                      onClick={() => setOpenCourseIds((s) => ({ ...s, [course.id]: !s[course.id] }))}
                      className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left transition-colors hover:bg-[#F8FAFC]"
                      style={{ backgroundColor: courseOpen ? SURFACE_0 : "transparent" }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[10.5px] font-bold flex-shrink-0"
                        style={{ backgroundColor: NAVY, color: "#fff", letterSpacing: "0.04em" }}
                      >
                        {course.code}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ color: TEXT_PRIMARY }}>{course.title}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: "#EEF1F4" }}>
                            <div className="h-full rounded-full" style={{ width: `${cProg.pct}%`, backgroundColor: BLUE }} />
                          </div>
                          <span className="text-[10.5px] font-semibold" style={{ color: TEXT_TERTIARY }}>{cProg.pct}%</span>
                        </div>
                      </div>
                      <ChevronDown
                        className="w-4 h-4 transition-transform flex-shrink-0"
                        style={{ color: TEXT_TERTIARY, transform: courseOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                      />
                    </button>
                    {courseOpen && <div>{moduleList}</div>}
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Detail column — single unified card */}
          <div className="flex flex-col flex-1 min-h-0">
            <div
              className="rounded-xl flex-1 flex flex-col min-h-0 overflow-hidden"
              style={{ backgroundColor: "#fff", border: `1px solid ${BORDER}`, boxShadow: SHADOW_SM }}
            >
              {/* Header section */}
              <div className="p-6 pb-4 border-b flex-shrink-0" style={{ borderColor: BORDER }}>
                <div className="flex items-start justify-between gap-6 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <KindBadge kind={current.kind} />
                      <span className="text-xs font-semibold tracking-[0.08em]" style={{ color: TEXT_TERTIARY }}>
                        {currentModule.title.toUpperCase()}
                      </span>
                    </div>
                    <h1 className="text-[22px] font-semibold" style={{ color: TEXT_PRIMARY, letterSpacing: "-0.3px", lineHeight: 1.2 }}>
                      {current.title}
                    </h1>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <OfflineDownloadButton
                      moduleId={current.id}
                      contentUrl={current.url || current.ispringUrl || ''}
                      type={current.format === 'SCORM' ? 'SCORM' : current.format === 'VIDEO' ? 'VIDEO' : 'DOCUMENT'}
                      title={current.title}
                      compact
                    />
                    <IconButton onClick={toggleBookmark} title={isBookmarked ? "Bookmarked" : "Bookmark"}>
                      {isBookmarked ? <BookmarkCheck className="w-4 h-4" style={{ color: BLUE }} /> : <Bookmark className="w-4 h-4" style={{ color: TEXT_SECONDARY }} />}
                    </IconButton>
                    <IconButton title="Share"><Share2 className="w-4 h-4" style={{ color: TEXT_SECONDARY }} /></IconButton>
                    <PrimaryButton onClick={markComplete} variant={isCompleted ? "success" : "primary"}>
                      <CheckCircle2 className="w-4 h-4" /> {isCompleted ? "Completed" : "Mark Complete"}
                    </PrimaryButton>
                  </div>
                </div>
              </div>

              {/* Tab bar */}
              <div className="flex items-center justify-between px-5 pt-3 pb-2 flex-shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: SURFACE_0 }}>
                  <SegmentTab active={tab === "slides"} onClick={() => setTab("slides")} icon={<FileText className="w-3.5 h-3.5" />}>Lecture Slides</SegmentTab>
                  <SegmentTab active={tab === "video"} onClick={() => setTab("video")} icon={<Video className="w-3.5 h-3.5" />}>Lecture Video</SegmentTab>
                </div>
                <span className="text-sm" style={{ color: TEXT_TERTIARY }}>
                  {tab === "video" && current.duration && current.duration !== "N/A" ? `Length ${current.duration}` : ""}
                </span>
              </div>

              {/* Player area */}
              <div className="p-5 pt-4 flex flex-col min-h-0 flex-1 overflow-hidden">
                {tab === "video" ? (
                  (current.videoUrl || (current.format === "VIDEO" && current.url)) ? (
                    <VideoPlayer
                      playing={playing}
                      onTogglePlay={() => setPlaying((p) => !p)}
                      duration={current.duration}
                      videoUrl={current.videoUrl || current.url || ""}
                      isDownloaded={isDownloaded}
                      onDownload={handleDownload}
                      downloadProgress={downloadProgress}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-sm font-semibold" style={{ color: NAVY }}>No video material available for this module.</div>
                  )
                ) : (
                  current.isIspring && current.ispringUrl ? (
                    <ISpringStudentViewer
                      url={current.ispringUrl}
                      lessonTitle={current.title}
                    />
                  ) : (current.format === "SLIDES" || current.format === "DOCUMENT" || current.format === "PDF" || current.format === "PPT" || current.format === "SCORM") && current.url ? (
                    (current.format === "SCORM" && current.url.startsWith('https://')) ? (
                      <ISpringStudentViewer
                        url={current.url}
                        lessonTitle={current.title}
                      />
                    ) : (
                      <SlideViewer 
                        lessonTitle={current.title} 
                        slideUrl={slideViewUrl}
                        isDownloaded={isDownloaded}
                        onDownload={handleDownload}
                        downloadProgress={downloadProgress}
                      />
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-sm font-semibold" style={{ color: NAVY }}>No slide material available for this module.</div>
                  )
                )}
              </div>

              {/* Up Next — integrated footer */}
              <div className="px-5 py-4 border-t flex-shrink-0" style={{ borderColor: BORDER }}>
                {nextLesson ? (
                  <button
                    onClick={() => setCurrentId(nextLesson.id)}
                    className="w-full text-left p-3 rounded-lg flex items-start gap-3 transition-all hover:bg-[#F8FAFC]"
                    style={{ border: `1px solid ${BORDER}` }}
                  >
                    <div className="flex-shrink-0">
                      <KindBadge kind={nextLesson.kind} dotOnly />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold tracking-[0.08em] mb-1" style={{ color: TEXT_TERTIARY }}>
                        NEXT LESSON
                      </div>
                      <div className="text-sm font-semibold mb-1" style={{ color: TEXT_PRIMARY }}>{nextLesson.title}</div>
                      {nextLesson.duration && nextLesson.duration !== "N/A" && (
                        <div className="flex items-center gap-1.5 text-sm" style={{ color: TEXT_TERTIARY }}>
                          <Clock className="w-3 h-3" /> {nextLesson.duration}
                        </div>
                      )}
                    </div>
                    <ArrowRight className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: BLUE }} />
                  </button>
                ) : (
                  <div className="text-sm py-2" style={{ color: TEXT_TERTIARY }}>You've reached the end of the course.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Discussion removed */}
      </div>
    </div>
  );
}

function KindBadge({ kind, dotOnly = false }: { kind: LessonKind; dotOnly?: boolean }) {
  const meta = lessonKindMeta(kind);
  const Icon = meta.icon;
  if (dotOnly) {
    return (
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: meta.bg, color: meta.fg }}>
        <Icon className="w-4 h-4" />
      </div>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full"
      style={{ padding: "3px 9px", backgroundColor: meta.bg, color: meta.fg, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em" }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: meta.fg }} />
      {meta.label}
    </span>
  );
}

function IconButton({ children, onClick, title }: { children: React.ReactNode; onClick?: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-9 h-9 rounded-md flex items-center justify-center transition-all"
      style={{ border: `1px solid ${BORDER}`, backgroundColor: "#fff" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = BORDER_STRONG; e.currentTarget.style.boxShadow = SHADOW_SM; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.boxShadow = "none"; }}
    >
      {children}
    </button>
  );
}

function PrimaryButton({ children, onClick, variant = "primary" }: { children: React.ReactNode; onClick?: () => void; variant?: "primary" | "success" }) {
  const bg = variant === "success" ? "#16A34A" : BLUE;
  const shadow = variant === "success" ? "0 1px 2px rgba(22,163,74,0.3)" : "0 1px 2px rgba(68,147,191,0.35)";
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 text-sm font-semibold text-white rounded-md transition-all"
      style={{ backgroundColor: bg, padding: "9px 14px", boxShadow: shadow }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = variant === "success" ? "0 4px 10px rgba(22,163,74,0.35)" : "0 4px 10px rgba(68,147,191,0.4)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = shadow; }}
    >
      {children}
    </button>
  );
}

function MetaRow({ children }: { children: React.ReactNode }) {
  return (
    null
  );
}

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: SURFACE_0, color: TEXT_SECONDARY }}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold tracking-[0.06em]" style={{ color: TEXT_TERTIARY }}>{label.toUpperCase()}</div>
        <div className="text-[12.5px] font-medium truncate" style={{ color: TEXT_PRIMARY }}>{value}</div>
      </div>
    </div>
  );
}

function SegmentTab({ children, active, onClick, icon }: { children: React.ReactNode; active: boolean; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-all focus:outline-none"
      style={{
        backgroundColor: active ? "#fff" : "transparent",
        color: active ? TEXT_PRIMARY : TEXT_TERTIARY,
        boxShadow: active ? SHADOW_SM : "none",
      }}
    >
      {icon} {children}
    </button>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "#fff", border: `1px solid ${BORDER}`, boxShadow: SHADOW_SM }}>
      {children}
    </div>
  );
}

function SectionDivider({ children, noMargin = false }: { children: React.ReactNode; noMargin?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" style={{ marginBottom: noMargin ? 0 : 14 }}>
      <span
        className="whitespace-nowrap"
        style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: TEXT_TERTIARY }}
      >
        {String(children).toUpperCase()}
      </span>
      <div className="flex-1" style={{ height: 1, backgroundColor: BORDER }} />
    </div>
  );
}

function CircularProgress({ pct }: { pct: number }) {
  const radius = 10;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="relative flex items-center justify-center w-7 h-7" title={`${pct}% Completed`}>
      <svg className="w-7 h-7 transform -rotate-90">
        <circle cx="14" cy="14" r={radius} strokeWidth="2.5" stroke="#EEF1F4" fill="transparent" />
        <circle cx="14" cy="14" r={radius} strokeWidth="2.5" stroke={BLUE} fill="transparent" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute text-[8px] font-bold" style={{ color: NAVY }}>{pct}%</span>
    </div>
  );
}

function ResourceRow({ icon, name, meta }: { icon: React.ReactNode; name: string; meta: string }) {
  return (
    <div
      className="flex items-center gap-3 py-2.5 group transition-colors"
      style={{ borderBottom: `1px solid ${BORDER}` }}
    >
      <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: SURFACE_0 }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: TEXT_PRIMARY }}>{name}</div>
        <div className="text-sm" style={{ color: TEXT_TERTIARY }}>{meta}</div>
      </div>
      <button
        className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 rounded-md flex items-center justify-center"
        style={{ backgroundColor: SURFACE_0, color: TEXT_SECONDARY }}
      >
        <Download className="w-4 h-4" />
      </button>
    </div>
  );
}

// DiscussionItem removed

function VideoPlayer({ playing, onTogglePlay, duration, videoUrl, isDownloaded, onDownload, downloadProgress }: { playing: boolean; onTogglePlay: () => void; duration: string; videoUrl: string, isDownloaded: boolean, onDownload: () => void, downloadProgress: number | null }) {
  const [fullscreen, setFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.play().catch((err) => console.error("Video play error:", err));
      } else {
        videoRef.current.pause();
      }
    }
  }, [playing]);

  useEffect(() => {
    if (!fullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [fullscreen]);

  const surface = (isFs: boolean) => (
    <div
      className={isFs ? "relative w-full h-full overflow-hidden" : "relative rounded-t-lg overflow-hidden aspect-video min-h-0 flex-1"}
      style={{ backgroundColor: NAVY }}
    >
      <video
        ref={isFs ? undefined : videoRef}
        src={videoUrl}
        className="w-full h-full object-contain"
        controls={isFs}
        onClick={onTogglePlay}
        onPlay={() => { if (!playing) onTogglePlay(); }}
        onPause={() => { if (playing) onTogglePlay(); }}
      />
      {!isFs && (
        <>
          <button onClick={onTogglePlay} className="absolute inset-0 flex items-center justify-center group bg-black/10 hover:bg-black/20 transition-colors">
            {!playing && (
              <span
                className="w-16 h-16 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform"
                style={{ backgroundColor: BLUE, boxShadow: "0 8px 24px rgba(68,147,191,0.55)" }}
              >
                <Play className="w-7 h-7 text-white ml-0.5" fill="white" />
              </span>
            )}
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full min-h-0">
      {surface(false)}
      <div className="h-12 border border-[#0D2543]/10 bg-[#F2F4F7] rounded-lg mt-2 flex items-center justify-between px-4 flex-shrink-0">
        <span className="text-xs text-[#717182]">Tip: Use the fullscreen button in the video controls for native fullscreen</span>
        <button
          onClick={() => setFullscreen(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md bg-white border border-[#0D2543]/10 text-[#0D2543] hover:bg-gray-50"
        >
          <Maximize2 className="w-4 h-4" />
          Fullscreen
        </button>
      </div>
      {fullscreen && createPortal(
        <div className="fixed inset-0 z-[2147483647] bg-[#0D2543] flex items-center justify-center">
          <div className="relative w-full h-full">
            <video
              src={videoUrl}
              className="w-full h-full object-contain"
              controls
              autoPlay
            />
            <button
              onClick={() => setFullscreen(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function ISpringStudentViewer({ url, lessonTitle }: { url: string; lessonTitle: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Use proxy URL for same-origin SW interception (offline support)
  // In dev mode, Vite proxy forwards to R2; in prod, SW handles it
  const proxyUrl = useMemo(() => {
    if (!url) return '';
    const match = url.match(/r2\.dev\/content\/(.+)$/);
    if (match) {
      return `/scorm-proxy/${match[1]}`;
    }
    return url;
  }, [url]);

  const handleFullscreen = async () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.error);
      return;
    }
    // Fullscreen the iSpring player container inside the iframe
    const iframeDoc = iframe.contentDocument;
    if (iframeDoc) {
      const player = iframeDoc.querySelector('.universal.universal_webkit')
                   || iframeDoc.querySelector('.universal')
                   || iframeDoc.querySelector('#content > div');
      if (player) {
        (player as HTMLElement).requestFullscreen().catch(console.error);
        return;
      }
    }
    // Fallback: fullscreen the iframe itself
    iframe.requestFullscreen().catch(console.error);
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div
        className="w-full h-full rounded-lg relative bg-[#0D2543]"
        style={{ overflow: 'hidden' }}
      >
        <iframe
          ref={iframeRef}
          src={proxyUrl}
          className="absolute inset-0 w-full h-full border-0"
          allowFullScreen
          title={lessonTitle}
          allow="fullscreen; autoplay"
          style={{ display: 'block' }}
          scrolling="no"
        />
        <button
          onClick={handleFullscreen}
          className="absolute bottom-[18px] right-[18px] z-[2147483647] flex items-center justify-center cursor-pointer backdrop-blur-[4px] transition-colors"
          style={{
            background: 'rgba(0,0,0,0.6)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 8,
            width: 40,
            height: 40,
          }}
          title="Toggle Fullscreen (F)"
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.8)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; }}
        >
          <svg viewBox="0 0 24 24" fill="white" width="20" height="20" className="w-5 h-5">
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function SlideViewer({ lessonTitle, slideUrl, isDownloaded, onDownload, downloadProgress }: { lessonTitle: string, slideUrl?: string | null, isDownloaded: boolean, onDownload: () => void, downloadProgress: number | null }) {
  const { user } = useAuth();
  
  if (!slideUrl) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-16 text-center bg-gray-50 rounded-lg">
        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mb-3">
          <FileText className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-sm font-semibold" style={{ color: NAVY }}>No file available for viewing.</p>
      </div>
    );
  }

  // Check if it's a PDF (blob URL or .pdf extension)
  const isPDF = slideUrl.startsWith('blob:') || slideUrl.toLowerCase().endsWith('.pdf');

  if (isPDF) {
    // Use secure PDF viewer
    const studentName = user?.user_metadata?.full_name || user?.email || 'Student';
    return (
      <SecurePDFViewer 
        pdfUrl={slideUrl} 
        lessonTitle={lessonTitle}
        studentName={studentName}
      />
    );
  }

  // For non-PDF files (like SCORM), keep using iframe
  return (
    <div className="h-full w-full bg-white rounded-lg shadow-sm border border-[#0D2543]/10 overflow-hidden relative">
      <iframe 
        src={slideUrl} 
        className="w-full h-full border-none" 
        title={lessonTitle} 
        style={{ backgroundColor: 'white' }} 
        allowFullScreen
      />
    </div>
  );
}

