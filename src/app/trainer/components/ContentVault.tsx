import { useMemo, useState, useRef, useEffect } from "react";
import {
  Search,
  Play,
  ChevronDown,
  ChevronRight,
  Clock,
  Package,
  FileText,
  Video as VideoIcon,
  Presentation,
  Download,
  CalendarDays,
  X,
  PlayCircle,
  Maximize2,
  Folder,
  FolderOpen,
} from "lucide-react";
import type { Deck, TrainerKit, Video, Document } from "../data";
import { OfflineDownloadButton } from "@/components/OfflineDownloadButton";

interface Props {
  decks: Deck[];
  kits: TrainerKit[];
  onLaunch: (deckId: string, version: string) => void;
}

type Tab = "slides" | "videos" | "documents";

export function ContentVault({ decks, kits, onLaunch }: Props) {
  const [activeCourse, setActiveCourse] = useState(kits[0]?.courseCode ?? "");
  const [query, setQuery] = useState("");
  const [deckSearchQuery, setDeckSearchQuery] = useState("");
  const [tab, setTab] = useState<Tab>("slides");
  const [previewVideo, setPreviewVideo] = useState<Video | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<Record<string, string>>(
    () => Object.fromEntries(decks.map((d) => [d.id, d.versions[0].version])),
  );
  const [collapsedSubjects, setCollapsedSubjects] = useState<Record<string, boolean>>({});

  const filteredKits = useMemo(
    () =>
      kits.filter(
        (k) =>
          !query ||
          k.courseTitle.toLowerCase().includes(query.toLowerCase()) ||
          k.courseCode.toLowerCase().includes(query.toLowerCase()) ||
          k.subject.toLowerCase().includes(query.toLowerCase()),
      ),
    [kits, query],
  );

  const kit = kits.find((k) => k.courseCode === activeCourse) ?? null;
  const kitDecks = kit
    ? (kit.deckIds.map((id) => decks.find((d) => d.id === id)).filter(Boolean) as Deck[])
    : [];

  // Group decks by subject_name with search filtering
  const decksBySubject = useMemo(() => {
    const grouped: Record<string, Deck[]> = {};
    kitDecks.forEach((deck) => {
      // Filter by search query
      if (
        deckSearchQuery &&
        !deck.title.toLowerCase().includes(deckSearchQuery.toLowerCase()) &&
        !deck.code.toLowerCase().includes(deckSearchQuery.toLowerCase())
      ) {
        return;
      }

      const subject = deck.subject_name || "General";
      if (!grouped[subject]) {
        grouped[subject] = [];
      }
      grouped[subject].push(deck);
    });
    return grouped;
  }, [kitDecks, deckSearchQuery]);

  // Toggle folder
  const toggleFolder = (subject: string) => {
    setCollapsedSubjects((prev) => ({
      ...prev,
      [subject]: !prev[subject],
    }));
  };

  // Expand all
  const expandAll = () => {
    setCollapsedSubjects(
      Object.fromEntries(Object.keys(decksBySubject).map((s) => [s, false]))
    );
  };

  // Collapse all
  const collapseAll = () => {
    setCollapsedSubjects(
      Object.fromEntries(Object.keys(decksBySubject).map((s) => [s, true]))
    );
  };

  return (
    <div className="mx-auto max-w-[1440px] px-10 py-8">
      <style>{`
        .vault-rail-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(13,37,67,0.25) transparent;
        }
        .vault-rail-scroll::-webkit-scrollbar { width: 4px; }
        .vault-rail-scroll::-webkit-scrollbar-track { background: transparent; }
        .vault-rail-scroll::-webkit-scrollbar-thumb {
          background: rgba(13,37,67,0.18);
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .vault-rail-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(13,37,67,0.35);
          background-clip: padding-box;
          border: 2px solid transparent;
        }
      `}</style>
      <div className="mb-6">
        <h1 className="text-[#0d2543] text-[28px] tracking-tight">Content Vault</h1>
        <p className="text-[#717182] text-sm mt-1">
          Trainer kits assigned by Admin. Each kit bundles the slides, videos, and
          reference documents you need to deliver a course.
        </p>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-8">
        {/* Left rail — assigned kits */}
        <aside
          className="bg-white border border-[#e9ebef] rounded-xl overflow-hidden sticky top-6 flex flex-col vault-rail"
          style={{ height: "calc(100vh - 64px - 4rem)" }}
        >
          <div className="p-3 border-b border-[#e9ebef] shrink-0">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#717182]"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search assigned kits…"
                className="w-full h-9 pl-9 pr-3 rounded-full bg-[#f3f3f5] border border-transparent text-sm outline-none focus:border-[#0d2543]/40"
              />
            </div>
            <div className="mt-2 px-1 text-xs uppercase tracking-wide text-[#717182]">
              {filteredKits.length} kit{filteredKits.length === 1 ? "" : "s"} assigned
            </div>
          </div>
          <ul className="flex-1 min-h-0 overflow-y-auto vault-rail-scroll">
            {filteredKits.map((k) => {
              const active = k.courseCode === activeCourse;
              return (
                <li key={k.courseCode}>
                  <button
                    onClick={() => {
                      setActiveCourse(k.courseCode);
                      setTab("slides");
                    }}
                    className={[
                      "w-full text-left px-4 py-3 border-l-2 transition-colors",
                      active
                        ? "border-[#0d2543] bg-[#0d2543]/[0.04]"
                        : "border-transparent hover:bg-black/[0.03]",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={[
                          "size-8 rounded-lg flex items-center justify-center shrink-0",
                          active
                            ? "bg-[#0d2543] text-white"
                            : "bg-[#e9ebef] text-[#0d2543]",
                        ].join(" ")}
                      >
                        <Package size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-[#717182]">{k.courseCode}</span>
                          <span className="text-sm text-[#717182]">
                            {k.deckIds.length + k.videos.length + k.documents.length} items
                          </span>
                        </div>
                        <div className="text-sm text-[#0d2543] leading-tight truncate">
                          {k.courseTitle}
                        </div>
                        <div className="text-sm text-[#717182] mt-0.5 truncate">
                          {k.subject}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
            {filteredKits.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-[#717182]">
                No kits match your search.
              </li>
            )}
          </ul>
        </aside>

        {/* Right pane — kit detail */}
        <main className="min-w-0">
          {!kit ? (
            <div className="bg-white border border-[#e9ebef] rounded-xl py-16 text-center text-[#717182]">
              Select a trainer kit to view its contents.
            </div>
          ) : (
            <>
              <div className="bg-white border border-[#e9ebef] rounded-xl p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm text-[#717182]">
                      <span className="px-1.5 py-0.5 rounded bg-[#e9ebef] text-[#0d2543] tracking-wide uppercase">
                        Trainer Kit
                      </span>
                      <span>{kit.courseCode}</span>
                    </div>
                    <h2 className="mt-1 text-[22px] text-[#0d2543] leading-tight">
                      {kit.courseTitle}
                    </h2>
                    <p className="mt-1 text-sm text-[#717182]">{kit.subject}</p>
                    <p className="mt-3 text-sm text-[#4a4f5a] leading-relaxed max-w-2xl">
                      {kit.summary}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-4 pt-5 border-t border-[#e9ebef]">
                  <KitStat
                    icon={<Presentation size={14} />}
                    label="Slide decks"
                    value={kitDecks.length}
                  />
                  <KitStat
                    icon={<VideoIcon size={14} />}
                    label="Videos"
                    value={kit.videos.length}
                  />
                  <KitStat
                    icon={<FileText size={14} />}
                    label="Documents"
                    value={kit.documents.length}
                  />
                </div>

                <div className="mt-4 flex items-center gap-4 text-sm text-[#717182]">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays size={12} /> Assigned {kit.assignedAt}
                  </span>
                  <span>·</span>
                  <span>{kit.assignedBy}</span>
                </div>
              </div>

              {/* Tabs */}
              <div className="mt-6 flex items-center gap-1 border-b border-[#e9ebef]">
                <TabBtn
                  active={tab === "slides"}
                  onClick={() => setTab("slides")}
                  icon={<Presentation size={14} />}
                  label="Slide decks"
                  count={kitDecks.length}
                />
                <TabBtn
                  active={tab === "videos"}
                  onClick={() => setTab("videos")}
                  icon={<VideoIcon size={14} />}
                  label="Videos"
                  count={kit.videos.length}
                />
                <TabBtn
                  active={tab === "documents"}
                  onClick={() => setTab("documents")}
                  icon={<FileText size={14} />}
                  label="Documents"
                  count={kit.documents.length}
                />
              </div>

              {/* Search bar for slides */}
              {tab === "slides" && kitDecks.length > 0 && (
                <div className="mt-5 mb-4">
                  <div className="relative max-w-md">
                    <Search
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#717182]"
                    />
                    <input
                      type="text"
                      value={deckSearchQuery}
                      onChange={(e) => setDeckSearchQuery(e.target.value)}
                      placeholder="Search presentations by name or code..."
                      className="w-full h-10 pl-10 pr-4 rounded-lg bg-[#f3f3f5] border border-[#e9ebef] text-sm text-[#0d2543] placeholder:text-[#717182] outline-none focus:border-[#0d2543]/30 focus:bg-white transition-all"
                    />
                    {deckSearchQuery && (
                      <button
                        onClick={() => setDeckSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#717182] hover:text-[#0d2543] transition-colors"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-6">
                {tab === "slides" && (
                  <>
                    {Object.keys(decksBySubject).length > 0 && (
                      <div className="flex items-center justify-end gap-3 mb-3 text-[12px] text-[#717182]">
                        <button
                          onClick={expandAll}
                          className="hover:text-[#0d2543] transition-colors"
                        >
                          Expand all
                        </button>
                        <span className="opacity-40">·</span>
                        <button
                          onClick={collapseAll}
                          className="hover:text-[#0d2543] transition-colors"
                        >
                          Collapse all
                        </button>
                      </div>
                    )}

                    <div className="space-y-4">
                      {Object.entries(decksBySubject).map(([subjectName, subjectDecks]) => {
                        const isCollapsed = !!collapsedSubjects[subjectName];
                        return (
                          <section
                            key={subjectName}
                            className="bg-white/40 border border-[#e9ebef] rounded-xl"
                          >
                            <button
                              onClick={() => toggleFolder(subjectName)}
                              aria-expanded={!isCollapsed}
                              className="w-full flex items-center gap-2 px-4 py-3 text-left text-[#717182] hover:bg-white/70 rounded-xl transition-colors"
                            >
                              <ChevronRight
                                size={14}
                                className={[
                                  "transition-transform",
                                  isCollapsed ? "" : "rotate-90",
                                ].join(" ")}
                              />
                              {isCollapsed ? <Folder size={14} /> : <FolderOpen size={14} />}
                              <h2 className="text-[12px] uppercase tracking-wide text-[#0d2543]">
                                {subjectName}
                              </h2>
                              <span className="text-[12px]">· {subjectDecks.length}</span>
                            </button>
                            {!isCollapsed && (
                              <div className="grid grid-cols-2 gap-5 px-5 pb-5 pt-2">
                                {subjectDecks.map((d) => (
                                  <DeckCard
                                    key={d.id}
                                    deck={d}
                                    selected={selectedVersion[d.id]}
                                    onChangeVersion={(v) =>
                                      setSelectedVersion((s) => ({ ...s, [d.id]: v }))
                                    }
                                    onLaunch={() => onLaunch(d.id, selectedVersion[d.id])}
                                  />
                                ))}
                              </div>
                            )}
                          </section>
                        );
                      })}
                      {Object.keys(decksBySubject).length === 0 && (
                        <div className="text-center py-16 text-[#717182] text-sm">
                          {deckSearchQuery ? (
                            <>
                              <p>No presentations match "{deckSearchQuery}"</p>
                              <button
                                onClick={() => setDeckSearchQuery("")}
                                className="mt-3 text-[#0d2543] hover:underline text-sm"
                              >
                                Clear search
                              </button>
                            </>
                          ) : (
                            "No slide decks in this kit yet."
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {tab === "videos" && (
                  <div className="grid grid-cols-2 gap-4">
                    {kit.videos.map((v) => (
                      <VideoCard
                        key={v.id}
                        video={v}
                        onPlay={() => setPreviewVideo(v)}
                      />
                    ))}
                    {kit.videos.length === 0 && (
                      <EmptyState text="No videos in this kit yet." />
                    )}
                  </div>
                )}

                {tab === "documents" && (
                  <div className="bg-white border border-[#e9ebef] rounded-xl overflow-hidden">
                    {kit.documents.map((doc, i) => (
                      <div
                        key={doc.id}
                        className={[
                          "flex items-center gap-4 px-4 py-3",
                          i > 0 ? "border-t border-[#e9ebef]" : "",
                        ].join(" ")}
                      >
                        <div className="size-10 rounded-lg bg-[#0d2543]/[0.06] text-[#0d2543] flex items-center justify-center">
                          <FileText size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-[#0d2543] truncate">
                            {doc.title}
                          </div>
                          <div className="text-sm text-[#717182] mt-0.5">
                            {doc.format} · updated {doc.updated}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-[#e9ebef] text-[#0d2543] text-xs tracking-wide uppercase">
                          {doc.format}
                        </span>
                        {doc.url && (
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="size-9 rounded-full hover:bg-black/[0.05] text-[#0d2543] flex items-center justify-center"
                            title="View"
                          >
                            <Play size={15} />
                          </button>
                        )}
                        {doc.url && (
                          <OfflineDownloadButton
                            moduleId={doc.id}
                            contentUrl={doc.url}
                            type="DOCUMENT"
                            title={doc.title}
                            compact
                          />
                        )}
                      </div>
                    ))}
                    {kit.documents.length === 0 && (
                      <EmptyState text="No documents in this kit yet." />
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {previewVideo && (
        <VideoPreview video={previewVideo} onClose={() => setPreviewVideo(null)} />
      )}

      {previewDoc && (
        <DocPreview doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}
    </div>
  );
}

function KitStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-[#717182]">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-[20px] text-[#0d2543] tabular-nums">{value}</div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "relative flex items-center gap-2 px-4 py-2.5 text-[16px] transition-colors",
        active ? "text-[#0d2543]" : "text-[#717182] hover:text-[#0d2543]",
      ].join(" ")}
    >
      {icon}
      <span>{label}</span>
      <span
        className={[
          "px-1.5 py-0.5 rounded text-[16px] tabular-nums",
          active ? "bg-[#0d2543] text-white" : "bg-[#e9ebef] text-[#0d2543]",
        ].join(" ")}
      >
        {count}
      </span>
      {active && (
        <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-[#0d2543] rounded-full" />
      )}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="col-span-full bg-white border border-dashed border-[#e9ebef] rounded-xl py-12 text-center text-[#717182] text-sm">
      {text}
    </div>
  );
}

function DeckCard({
  deck,
  selected,
  onChangeVersion,
  onLaunch,
}: {
  deck: Deck;
  selected: string;
  onChangeVersion: (v: string) => void;
  onLaunch: () => void;
}) {
  const latest = deck.versions[0].version;
  const selectedV = deck.versions.find((v) => v.version === selected) ?? deck.versions[0];
  const isLatest = selected === latest;

  return (
    <div className="bg-white border border-[#e9ebef] rounded-xl p-6 hover:shadow-[0_8px_24px_rgba(13,37,67,0.08)] transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-[#717182] mb-1">{deck.code}</div>
          <h3 className="text-[15px] text-[#0d2543] leading-snug font-medium">{deck.title}</h3>
        </div>
        <span className="shrink-0 px-2.5 py-1 rounded bg-[#e9ebef] text-[#0d2543] text-xs tracking-wide uppercase font-medium">
          Slides
        </span>
      </div>

      <div className="mt-4 flex items-center gap-4 text-sm text-[#717182]">
        <span>{deck.versions.length} revision{deck.versions.length === 1 ? "" : "s"}</span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <label className="text-xs text-[#717182] tracking-wide uppercase">Version</label>
        <div className="relative">
          <select
            value={selected}
            onChange={(e) => onChangeVersion(e.target.value)}
            className="appearance-none h-9 pl-3 pr-8 rounded-full bg-[#f3f3f5] border border-[#e9ebef] text-sm text-[#0d2543] outline-none focus:border-[#0d2543]/40 cursor-pointer"
          >
            {deck.versions.map((v) => (
              <option key={v.version} value={v.version}>
                {v.version} · {v.date}
                {v.version === latest ? "  (latest)" : ""}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#717182] pointer-events-none"
          />
        </div>
        {!isLatest && (
          <span className="px-2 py-0.5 rounded bg-[#fff7d6] text-[#7a5a00] text-xs tracking-wide uppercase font-medium">
            Prior
          </span>
        )}
      </div>

      <p className="mt-3 text-sm text-[#717182] line-clamp-2 leading-relaxed">Note: {selectedV.note}</p>

      <div className="mt-5 flex items-center gap-2">
        <button
          onClick={onLaunch}
          className="flex-1 h-11 rounded-full bg-[#0d2543] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#0d2543]/90 transition-colors"
        >
          <Play size={14} fill="currentColor" /> Launch in Theater Mode
        </button>
        <OfflineDownloadButton
          moduleId={deck.id}
          contentUrl={deck.ispringUrl || ''}
          type="SCORM"
          title={deck.title}
          compact
        />
      </div>
    </div>
  );
}

function VideoCard({ video, onPlay }: { video: Video; onPlay: () => void }) {
  return (
    <div className="bg-white border border-[#e9ebef] rounded-xl overflow-hidden hover:shadow-[0_8px_24px_rgba(13,37,67,0.08)] transition-shadow">
      <button
        onClick={onPlay}
        className="relative w-full aspect-video bg-gradient-to-br from-[#0d2543] to-[#1c3a63] flex items-center justify-center group"
      >
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-4 left-4 size-16 rounded-full bg-white/10" />
          <div className="absolute bottom-6 right-8 size-24 rounded-full bg-white/5" />
        </div>
        <div className="relative size-14 rounded-full bg-white/15 border border-white/30 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition-transform">
          <PlayCircle size={28} className="text-white" />
        </div>
        {video.durationMin > 0 && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/55 text-white text-sm tabular-nums">
            {video.durationMin} min
          </div>
        )}
      </button>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm text-[#0d2543] leading-tight">{video.title}</div>
            <div className="mt-1 text-sm text-[#717182]">{video.presenter}</div>
          </div>
          <button
            onClick={(e) => e.stopPropagation()}
            title={`Download ${video.title}`}
            className="shrink-0 size-9 rounded-full border border-[#e9ebef] text-[#0d2543] flex items-center justify-center hover:bg-[#0d2543]/[0.06]"
          >
            {video.url ? (
              <OfflineDownloadButton
                moduleId={video.id}
                contentUrl={video.url}
                type="VIDEO"
                title={video.title}
                compact
              />
            ) : (
              <Download size={15} />
            )}
          </button>
        </div>
        <p className="mt-2 text-sm text-[#4a4f5a] leading-relaxed line-clamp-2">
          {video.description}
        </p>
      </div>
    </div>
  );
}

function VideoPreview({ video, onClose }: { video: Video; onClose: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);

  const enterFullscreen = () => {
    if (wrapRef.current?.requestFullscreen) {
      wrapRef.current.requestFullscreen();
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        ref={wrapRef}
        className="bg-[#0d2543] rounded-2xl overflow-hidden w-full max-w-3xl border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-video bg-gradient-to-br from-[#0d2543] to-[#1c3a63] flex items-center justify-center">
          {video.url ? (
            <video
              src={video.url}
              className="w-full h-full object-contain"
              controls
              autoPlay
            />
          ) : (
            <div className="size-20 rounded-full bg-white/15 border border-white/30 backdrop-blur-md flex items-center justify-center">
              <PlayCircle size={40} className="text-white" />
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 size-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"
          >
            <X size={16} />
          </button>
          <button
            onClick={enterFullscreen}
            className="absolute top-3 right-14 size-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"
            title="Full Screen"
          >
            <Maximize2 size={16} />
          </button>
        </div>
        <div className="p-5">
          <div className="text-sm text-white">{video.title}</div>
          <div className="text-sm text-white/60 mt-1">Presenter: {video.presenter}</div>
          <p className="text-sm text-white/80 mt-3 leading-relaxed">{video.description}</p>
        </div>
      </div>
    </div>
  );
}

function DocPreview({ doc, onClose }: { doc: Document; onClose: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let revoke: string | null = null;
    if (!doc.url) { setLoading(false); return; }

    const url = doc.url;
    if (url.includes('supabase.co/storage') || url.includes('module_content')) {
      // Supabase storage path — download as blob
      let cleanPath = url;
      if (cleanPath.includes('module_content/')) {
        cleanPath = cleanPath.split('module_content/')[1];
      }
      cleanPath = decodeURIComponent(cleanPath.split('?')[0]).replace(/^\/+/, '').replace(/\/+$/, '');

      import('@/lib/supabase').then(({ supabase }) => {
        supabase.storage.from('module_content').download(cleanPath).then(({ data, error }) => {
          if (error || !data) {
            console.error("Doc download error:", error);
            setLoading(false);
            return;
          }
          const blobUrl = URL.createObjectURL(data);
          revoke = blobUrl;
          setViewUrl(blobUrl + '#toolbar=0');
          setLoading(false);
        });
      });
    } else {
      // R2 or other external URL — use directly
      setViewUrl(url);
      setLoading(false);
    }

    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [doc.url]);

  const enterFullscreen = () => {
    if (wrapRef.current?.requestFullscreen) {
      wrapRef.current.requestFullscreen();
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        ref={wrapRef}
        className="bg-white rounded-2xl overflow-hidden w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-[#0d2543]">{doc.title}</h3>
            <p className="text-xs text-[#717182] mt-0.5">{doc.format} Document</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={enterFullscreen}
              className="size-8 rounded-md flex items-center justify-center text-[#0d2543] hover:bg-gray-200"
              title="Full Screen"
            >
              <Maximize2 size={16} />
            </button>
            <button
              onClick={onClose}
              className="size-8 rounded-md flex items-center justify-center text-gray-500 hover:bg-gray-200"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-sm text-gray-500">
              Loading document...
            </div>
          ) : viewUrl ? (
            <iframe
              src={viewUrl}
              className="w-full h-full border-0"
              title={doc.title}
              style={{ minHeight: 600 }}
              allowFullScreen
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-sm text-gray-500">
              No preview available for this document.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

