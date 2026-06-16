import { useEffect, useState } from "react";
import { TopNav, type TrainerRoute } from "./components/TopNav";
import { Dashboard } from "./components/Dashboard";
import { ContentVault } from "./components/ContentVault";
import { TheaterMode } from "./components/TheaterMode";
import { ISpringViewer } from "./components/ISpringViewer";
import type { Deck, TrainerKit, Broadcast } from "./data";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/auth/AuthContext";
import { Loader2 } from "lucide-react";

export default function App() {
  const { user } = useAuth();
  const [route, setRoute] = useState<TrainerRoute>("dashboard");
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [trainerKits, setTrainerKits] = useState<TrainerKit[]>([]);
  const [theater, setTheater] = useState<{ deckId: string; version: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Real-time offline status tracker
  const [isOnline, setIsOnline] = useState(true); // Start as true to avoid flash
  
  useEffect(() => {
    // Check immediately on mount
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      setIsLoading(true);

      // Check if offline and use cached data
      const isOffline = !navigator.onLine;
      if (isOffline) {
        try {
          const cachedKits = localStorage.getItem(`trainer_kits_${user.id}`);
          const cachedDecks = localStorage.getItem(`trainer_decks_${user.id}`);
          const cachedBroadcasts = localStorage.getItem(`trainer_broadcasts_${user.id}`);
          
          if (cachedKits && cachedDecks && cachedBroadcasts) {
            setTrainerKits(JSON.parse(cachedKits));
            setDecks(JSON.parse(cachedDecks));
            setBroadcasts(JSON.parse(cachedBroadcasts));
            setIsLoading(false);
            return;
          } else {
            // No cached data available offline
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.error("Failed to load offline trainer data:", e);
          setIsLoading(false);
          return;
        }
      }

      try {
        // Add timeout to prevent hanging
        const timeout = (ms: number) => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), ms)
        );

        const [
          { data: profileData },
          { data: coursesData },
          { data: modulesData },
          { data: subjectsData },
          { data: broadcastsData },
        ] = await Promise.race([
          Promise.all([
            supabase.from("profiles").select("full_name").eq("id", user.id).single(),
            supabase.from("courses").select("*").eq("is_active", true),
            supabase.from("modules").select(`*, module_versions (*)`).order("order_index"),
            supabase.from("subjects").select("*"),
            supabase.from("broadcasts").select(`
              *,
              published_by_profile:profiles!broadcasts_published_by_fkey ( full_name ),
              broadcast_audiences ( role_target, cohort_target ),
              broadcast_acks (broadcast_id, user_id, acked_at, dismissed_at)
            `).order("published_at", { ascending: false }),
          ]),
          timeout(5000) // 5 second timeout
        ]) as any;

        let assignedModuleIds: string[] = [];
        if (user?.id) {
          const { data: assignments } = await supabase
            .from("module_trainers")
            .select("module_id")
            .eq("trainer_id", user.id);
          assignedModuleIds = (assignments || []).map((a: any) => a.module_id);
        }

        const assignedModulesData = (modulesData || []).filter(m => assignedModuleIds.includes(m.id));
        const activeCourseIds = new Set(assignedModulesData.map(m => m.course_id));
        const assignedCoursesData = (coursesData || []).filter(c => activeCourseIds.has(c.id));

        const kits: TrainerKit[] = (assignedCoursesData || []).map((course) => {
          const courseModules = (assignedModulesData || []).filter((m) => m.course_id === course.id);
          
          // Categorize modules by type
          const slideTypes = ['SCORM', 'PPT', 'SLIDES'];
          const videoTypes = ['VIDEO'];
          const docTypes = ['PDF', 'DOCUMENT', 'DOCX'];
          
          const deckModules = courseModules.filter(m => slideTypes.includes(m.type || ''));
          const videoModules = courseModules.filter(m => videoTypes.includes(m.type || '') || m.video_url);
          const docModules = courseModules.filter(m => docTypes.includes(m.type || '') || (!m.type && m.module_versions?.[0]?.content_url?.endsWith('.pdf')));

          const videos: Video[] = videoModules.map(m => {
            const publishedVer = m.module_versions?.find((v: any) => v.is_published) || m.module_versions?.[0];
            return {
              id: m.id,
              title: m.title,
              durationMin: parseInt(m.duration) || 0,
              presenter: "Trainer",
              description: m.description || "",
              url: m.video_url || publishedVer?.content_url || "",
            };
          });

          const documents: Document[] = docModules.map(m => {
            const publishedVer = m.module_versions?.find((v: any) => v.is_published) || m.module_versions?.[0];
            const url = publishedVer?.content_url || "";
            const ext = url.split('.').pop()?.toUpperCase() || "PDF";
            return {
              id: m.id,
              title: m.title,
              format: (ext === "PDF" ? "PDF" : ext === "DOCX" ? "DOCX" : "PDF") as "PDF" | "DOCX" | "XLSX",
              pages: 0,
              sizeMB: 0,
              updated: publishedVer?.created_at ? new Date(publishedVer.created_at).toLocaleDateString() : "",
              url,
            };
          });

          return {
            courseCode: `C-${course.id.substring(0, 4).toUpperCase()}`,
            courseTitle: course.title,
            subject: course.description || "General",
            assignedBy: "System",
            assignedAt: course.created_at ? new Date(course.created_at).toLocaleDateString() : "",
            summary: course.description || "",
            totalLearners: 0,
            videos,
            documents,
            deckIds: deckModules.map((m) => m.id),
          };
        });

        const mappedDecks: Deck[] = (assignedModulesData || [])
          .filter(mod => ['SCORM', 'PPT', 'SLIDES'].includes(mod.type || ''))
          .map((mod) => {
          const versions = (mod.module_versions || []).map((v: any) => ({
            version: `v${v.version_number}`,
            date: v.published_at ? new Date(v.published_at).toLocaleDateString() : "",
            note: "Published version",
          }));
          
          if (versions.length === 0) {
            versions.push({ version: "v1", date: new Date().toLocaleDateString(), note: "Initial" });
          }

          const parentCourse = coursesData?.find((c) => c.id === mod.course_id);
          const parentSubject = subjectsData?.find((s) => s.id === mod.subject_id);

          return {
            id: mod.id,
            code: `M-${mod.id.substring(0, 4).toUpperCase()}`,
            title: mod.title,
            program: parentCourse?.title || "Unknown Program",
            subject: parentCourse?.description || "General",
            subject_id: mod.subject_id,
            subject_name: parentSubject?.name || "General",
            versions: versions.sort((a, b) => b.version.localeCompare(a.version)),
            isIspring: mod.type === "SCORM",
            ispringUrl: mod.module_versions?.[0]?.content_url,
          };
        });

        const mappedBroadcasts: Broadcast[] = (broadcastsData || [])
          .filter((b) => {
            // Only show broadcasts targeted at trainer role or individually at this user
            const audiences = b.broadcast_audiences || [];
            const acks = b.broadcast_acks || [];
            const targetedByRole = audiences.some((a: any) => a.role_target === 'trainer');
            const targetedIndividually = acks.some((a: any) => a.user_id === user.id);
            if (!targetedByRole && !targetedIndividually) return false;
            // Hide dismissed broadcasts
            const myAck = acks.find((a: any) => a.user_id === user.id);
            if (myAck?.dismissed_at) return false;
            return true;
          })
          .map((b) => {
          const acked = b.broadcast_acks?.some((ack: any) => ack.user_id === user.id && ack.acked_at !== null);
          let fromName = "Admin";
          if (b.published_by_profile && !Array.isArray(b.published_by_profile) && b.published_by_profile.full_name) {
             fromName = b.published_by_profile.full_name;
          }
          return {
            id: b.id,
            title: b.title,
            body: b.content,
            from: fromName,
            postedAt: b.published_at ? new Date(b.published_at).toLocaleDateString() : "",
            priority: b.priority === "urgent" || b.priority === "high" ? "critical" : "standard",
            read: !b.requires_ack || !!acked,
          };
        });

        const finalDecks = mappedDecks;

        setTrainerKits(kits);
        setDecks(finalDecks);
        setBroadcasts(mappedBroadcasts);

        // Cache for offline use
        localStorage.setItem(`trainer_kits_${user.id}`, JSON.stringify(kits));
        localStorage.setItem(`trainer_decks_${user.id}`, JSON.stringify(finalDecks));
        localStorage.setItem(`trainer_broadcasts_${user.id}`, JSON.stringify(mappedBroadcasts));

      } catch (err) {
        console.error("Error loading trainer data", err);
        
        // Try loading from cache on error
        try {
          const cachedKits = localStorage.getItem(`trainer_kits_${user.id}`);
          const cachedDecks = localStorage.getItem(`trainer_decks_${user.id}`);
          const cachedBroadcasts = localStorage.getItem(`trainer_broadcasts_${user.id}`);
          
          if (cachedKits && cachedDecks && cachedBroadcasts) {
            setTrainerKits(JSON.parse(cachedKits));
            setDecks(JSON.parse(cachedDecks));
            setBroadcasts(JSON.parse(cachedBroadcasts));
          }
        } catch (cacheErr) {
          console.error("Failed to load cached trainer data:", cacheErr);
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [user]);

  const unread = broadcasts.filter((b) => !b.read).length;

  const acknowledge = async (id: string) => {
    if (!user) return;
    try {
      setBroadcasts((bs) => bs.map((b) => (b.id === id ? { ...b, read: true } : b)));
      await supabase.from("broadcast_acks").upsert({
        broadcast_id: id,
        user_id: user.id,
        acked_at: new Date().toISOString()
      }, { onConflict: 'broadcast_id,user_id' });
    } catch (err) {
      console.error("Failed to acknowledge", err);
    }
  };

  const clearAcknowledged = async () => {
    if (!user) return;
    const acknowledged = broadcasts.filter(b => b.read);
    if (acknowledged.length === 0) return;
    setBroadcasts(prev => prev.filter(b => !b.read));
    try {
      await supabase.from("broadcast_acks").update({ dismissed_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .in("broadcast_id", acknowledged.map(b => b.id));
    } catch (err) {
      console.error("Failed to clear acknowledged", err);
      setBroadcasts(prev => [...prev, ...acknowledged]);
    }
  };

  const launch = (deckId: string, version: string) => setTheater({ deckId, version });

  const activeDeck = theater ? decks.find((d) => d.id === theater.deckId) : null;

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-[#f3f3f5] font-['Inter'] antialiased flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-[#0d2543] size-8" />
          <p className="text-sm text-[#717182]">Loading trainer content...</p>
        </div>
      </div>
    );
  }

  // Show offline message if no data available
  if (!navigator.onLine && decks.length === 0 && trainerKits.length === 0) {
    return (
      <div className="min-h-screen w-full bg-[#f3f3f5] font-['Inter'] antialiased">
        <TopNav route={route} onNavigate={setRoute} unread={0} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md px-6">
            <div className="size-16 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="size-8" />
            </div>
            <h2 className="text-xl font-semibold text-[#0d2543] mb-2">Offline Mode</h2>
            <p className="text-[#717182]">
              You are offline and no content has been cached. Please reconnect to the internet to load your trainer content.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#f3f3f5] font-['Inter'] antialiased">
      <TopNav route={route} onNavigate={setRoute} unread={unread} />

      {/* Offline Indicator Banner */}
      {!isOnline && (
        <div className="text-white px-4 py-2 text-center text-sm font-medium" style={{ backgroundColor: "#0D2543" }}>
          Offline Mode - Only Downloaded Content Will Be Shown.
        </div>
      )}

      {route === "dashboard" && (
        <Dashboard
          broadcasts={broadcasts}
          decks={decks}
          onAcknowledge={acknowledge}
          onClearAcknowledged={clearAcknowledged}
          onLaunch={launch}
          onGoToVault={() => setRoute("vault")}
        />
      )}
      {route === "vault" && (
        <ContentVault decks={decks} kits={trainerKits} onLaunch={launch} />
      )}

      {activeDeck && theater && (
        activeDeck.isIspring || activeDeck.ispringUrl ? (
          <ISpringViewer
            url={activeDeck.ispringUrl || ""}
            deckCode={activeDeck.code}
            version={theater.version}
            totalSlides={activeDeck.slides}
            onExit={() => setTheater(null)}
          />
        ) : (
          <TheaterMode
            deck={activeDeck}
            version={theater.version}
            onExit={() => setTheater(null)}
          />
        )
      )}
    </div>
  );
}
