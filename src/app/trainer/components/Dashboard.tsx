import { AlertCircle, CheckCircle2, Play, Radio, Clock, Layers, Trash2 } from "lucide-react";
import { useAuth } from "@/app/auth/AuthContext";
import type { Broadcast, Deck } from "../data";

interface Props {
  broadcasts: Broadcast[];
  decks: Deck[];
  onAcknowledge: (id: string) => void;
  onClearAcknowledged: () => void;
  onLaunch: (deckId: string, version: string) => void;
  onGoToVault: () => void;
}

export function Dashboard({ broadcasts, decks, onAcknowledge, onClearAcknowledged, onLaunch, onGoToVault }: Props) {
  const { user } = useAuth();
  const unread = broadcasts.filter((b) => !b.read).length;
  const acknowledgedCount = broadcasts.filter((b) => b.read).length;
  // Only show SCORM/PPT slides in quick-launch — not PDFs or videos
  const quickDecks = decks.slice(0, 4);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
    (user?.user_metadata?.name as string | undefined)?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "Trainer";

  return (
    <div className="mx-auto max-w-[1200px] px-10 py-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[#0d2543] text-[28px] font-semibold tracking-tight">{greeting}, {firstName}</h1>
          <p className="text-[#717182] text-sm mt-1">
            {unread > 0
              ? `You have ${unread} unacknowledged broadcast${unread === 1 ? "" : "s"} requiring your attention.`
              : "You're all caught up on broadcasts. Ready when you are."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <section className="col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radio size={16} className="text-[#0d2543]" />
              <h2 className="text-[#0d2543] text-sm">Broadcast Feed</h2>
              {unread > 0 && (
                <span className="ml-1 min-w-[20px] h-5 px-1.5 rounded-full bg-[#d4183d] text-white text-xs flex items-center justify-center">
                  {unread}
                </span>
              )}
            </div>
            {acknowledgedCount > 0 && (
              <button
                onClick={onClearAcknowledged}
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs text-[#0d2543] bg-white border border-[#e9ebef] hover:border-[#0d2543]/30 transition-colors"
              >
                <Trash2 size={12} />
                Clear acknowledged ({acknowledgedCount})
              </button>
            )}
          </div>

          <div className="space-y-3">
            {broadcasts.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 bg-white border border-[#e9ebef] rounded-2xl text-center">
                <Radio size={32} className="text-[#717182]/40 mb-3" />
                <div className="text-[#0d2543] font-semibold text-lg">No announcements</div>
                <div className="text-sm text-[#717182] mt-1 max-w-sm mx-auto">There are no global or trainer broadcasts posted at this time.</div>
              </div>
            ) : (
              broadcasts.map((b) => (
                <BroadcastCard key={b.id} b={b} onAcknowledge={onAcknowledge} />
              ))
            )}
          </div>
        </section>

        <aside>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-[#0d2543]" />
              <h2 className="text-[#0d2543] text-sm">Quick-Launch Decks</h2>
            </div>
            <button
              onClick={onGoToVault}
              className="text-sm text-[#0d2543] hover:underline"
            >
              Vault →
            </button>
          </div>

          <div className="space-y-2">
            {quickDecks.map((d) => {
              const latest = d.versions[0];
              return (
                <div
                  key={d.id}
                  className="group bg-white border border-[#e9ebef] rounded-xl p-3 hover:shadow-[0_4px_14px_rgba(13,37,67,0.08)] transition-shadow"
                >
                  <div className="text-sm text-[#717182]">{d.code}</div>
                  <div className="text-sm text-[#0d2543] mt-0.5 leading-tight">{d.title}</div>
                  <div className="flex items-center gap-3 mt-2 text-sm text-[#717182]">
                    <span className="ml-auto px-1.5 py-0.5 rounded bg-[#e9ebef] text-[#0d2543]">
                      {latest.version}
                    </span>
                  </div>
                  <button
                    onClick={() => onLaunch(d.id, latest.version)}
                    className="mt-3 w-full h-8 rounded-full bg-[#0d2543] text-white text-sm flex items-center justify-center gap-1.5 hover:bg-[#0d2543]/90"
                  >
                    <Play size={12} fill="currentColor" /> Present
                  </button>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}

function BroadcastCard({
  b,
  onAcknowledge,
}: {
  b: Broadcast;
  onAcknowledge: (id: string) => void;
}) {
  const critical = b.priority === "critical";
  return (
    <article
      className={[
        "relative bg-white rounded-xl p-5 border transition-all",
        b.read
          ? "border-[#e9ebef] opacity-80"
          : critical
            ? "border-[#d4183d]/30 shadow-[0_4px_14px_rgba(212,24,61,0.08)]"
            : "border-[#0d2543]/20 shadow-[0_4px_14px_rgba(13,37,67,0.06)]",
      ].join(" ")}
    >
      {!b.read && (
        <span
          className={[
            "absolute left-0 top-5 bottom-5 w-1 rounded-r-full",
            critical ? "bg-[#d4183d]" : "bg-[#0d2543]",
          ].join(" ")}
        />
      )}
      <div className="flex items-start gap-3">
        <div
          className={[
            "size-9 rounded-full flex items-center justify-center shrink-0",
            b.read
              ? "bg-[#e9ebef] text-[#717182]"
              : critical
                ? "bg-[#d4183d]/10 text-[#d4183d]"
                : "bg-[#0d2543]/10 text-[#0d2543]",
          ].join(" ")}
        >
          {b.read ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {critical && !b.read && (
              <span className="px-1.5 py-0.5 rounded bg-[#d4183d] text-white text-xs tracking-wide uppercase">
                Critical
              </span>
            )}
            {b.read ? (
              <span className="px-1.5 py-0.5 rounded bg-[#e9ebef] text-[#717182] text-xs tracking-wide uppercase">
                Acknowledged
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded bg-[#fff7d6] text-[#7a5a00] text-xs tracking-wide uppercase">
                Unread
              </span>
            )}
            <span className="text-sm text-[#717182]">
              {b.from} · {b.postedAt}
            </span>
          </div>
          <h3 className="mt-1.5 text-sm text-[#0d2543] leading-snug">{b.title}</h3>
          <p className="mt-1 text-sm text-[#4a4f5a] leading-relaxed">{b.body}</p>

          {!b.read && (
            <div className="mt-3">
              <button
                onClick={() => onAcknowledge(b.id)}
                className="h-9 px-4 rounded-full bg-[#0d2543] text-white text-xs hover:bg-[#0d2543]/90"
              >
                Acknowledge
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

