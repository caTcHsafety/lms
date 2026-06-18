import { AlertTriangle, Megaphone, CheckCircle2, Inbox, TrendingUp, Users, Trash2 } from "lucide-react";
import type { Broadcast, Student } from "./mentor-data";
import { useAuth } from "@/app/auth/AuthContext";

interface DashboardProps {
  broadcasts: Broadcast[];
  students: Student[];
  pendingCount: number;
  onAcknowledge: (id: string) => void;
  onClearAcknowledged: () => void;
  onOpenQueue: () => void;
  onOpenRoster: () => void;
  onOpenStudent: (id: string) => void;
}

export function Dashboard({
  broadcasts,
  students,
  pendingCount,
  onAcknowledge,
  onClearAcknowledged,
  onOpenQueue,
  onOpenRoster,
  onOpenStudent,
}: DashboardProps) {
  const { user } = useAuth();
  const unread = broadcasts.filter((b) => !b.acknowledged);
  const acknowledgedCount = broadcasts.length - unread.length;
  const stalling = students.filter((s) => s.status === "stalling");
  const avgProgress = students.length > 0 ? Math.round(students.reduce((a, s) => a + s.progress, 0) / students.length) : 0;
  const onTrack = students.filter((s) => s.status === "on-track" || s.status === "awaiting-eval").length;

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Mentor";

  return (
    <div className="grid grid-cols-12 gap-6 items-start">
      <div className="col-span-12 mb-2">
        <h1 className="text-3xl font-semibold text-[#0c3455] tracking-tight">
          Welcome back, {displayName}!
        </h1>
        <p className="text-sm text-[#717182] mt-1">Here is what is happening with your batch today.</p>
      </div>

      <div className="col-span-12 grid grid-cols-3 gap-4">
        <StatCard icon={Inbox} label="Pending evaluations" value={pendingCount} accent caption={`${pendingCount} in queue`} onClick={onOpenQueue} />
        <StatCard icon={Users} label="Batch size" value={students.length} caption={`${onTrack} progressing`} onClick={onOpenRoster} />
        <StatCard icon={TrendingUp} label="Average progress" value={`${avgProgress}%`} caption={`${stalling.length} stalling`} />
      </div>

      <section className="col-span-12 lg:col-span-7 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader
            icon={Megaphone}
            title="Broadcasts"
            subtitle={unread.length > 0 ? `${unread.length} require acknowledgment` : "All broadcasts acknowledged"}
          />
          {acknowledgedCount > 0 && (
            <button
              onClick={onClearAcknowledged}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs text-[#0c3455] bg-white border border-[#e5e7ec] hover:border-[#4493BF] hover:text-[#4493BF] transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear acknowledged ({acknowledgedCount})
            </button>
          )}
        </div>
        <div className="space-y-3">
          {broadcasts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 bg-white border border-[#e5e7ec] rounded-2xl text-center">
              <Megaphone className="h-8 w-8 text-[#717182]/40 mb-3" />
              <div className="text-[#0c3455] font-semibold text-lg">No announcements</div>
              <div className="text-sm text-[#717182] mt-1 max-w-sm mx-auto">There are no global or batch broadcasts posted at this time.</div>
            </div>
          ) : (
            broadcasts.map((b) => (
              <BroadcastCard key={b.id} broadcast={b} onAcknowledge={onAcknowledge} />
            ))
          )}
        </div>
      </section>

      <section className="col-span-12 lg:col-span-5 flex flex-col">
        <SectionHeader
          icon={Users}
          title="Batch health"
          subtitle="At-a-glance view of your assigned students"
        />

        <div className="rounded-2xl bg-white border border-[#e5e7ec] p-5 mb-3">
          <div className="flex items-end justify-between mb-3">
            <div>
              <div className="text-sm text-[#717182]">Overall completion</div>
              <div className="text-[#0c3455] text-2xl">{avgProgress}%</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-[#717182]">On track</div>
              <div className="text-[#0c3455] text-2xl">
                {onTrack}/{students.length}
              </div>
            </div>
          </div>
          <div className="h-2 rounded-full bg-[#0c3455]/10 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${avgProgress}%`,
                background: "linear-gradient(90deg, #0c3455 0%, #4493BF 100%)",
              }}
            />
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-[#e5e7ec] p-5 flex-1">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <div className="text-[#0c3455]">Flagged as stalling</div>
          </div>
          {stalling.length === 0 ? (
            <div className="text-sm text-[#717182]">No stalling students.</div>
          ) : (
            <ul className="divide-y divide-[#eef0f3]">
              {stalling.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => onOpenStudent(s.id)}
                    className="w-full flex items-center justify-between py-2.5 hover:bg-[#f7f8fa] rounded-lg px-2 -mx-2 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 grid place-items-center text-sm">
                        {s.initials}
                      </div>
                      <div>
                        <div className="text-sm text-[#0c3455]">{s.name}</div>
                        <div className="text-sm text-[#717182]">Last active {s.lastActive}</div>
                      </div>
                    </div>
                    <div className="text-sm text-[#717182]">{s.progress}%</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  caption,
  accent,
  onClick,
}: {
  icon: typeof Inbox;
  label: string;
  value: string | number;
  caption: string;
  accent?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-2xl p-5 border transition-colors ${
        accent
          ? "bg-[#0c3455] text-white border-transparent hover:bg-[#0c3455]/95"
          : "bg-white border-[#e5e7ec] hover:border-[#0c3455]/30"
      } ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-center justify-between mb-6">
        <div className={`h-9 w-9 rounded-xl grid place-items-center ${accent ? "bg-white/10" : "bg-[#0c3455]/5 text-[#0c3455]"}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className={`text-[16px] ${accent ? "text-white/70" : "text-[#717182]"}`}>{label}</div>
      </div>
      <div className="flex items-end justify-between">
        <div className={`text-3xl ${accent ? "text-white" : "text-[#0c3455]"}`}>{value}</div>
        <div className={`text-[16px] ${accent ? "text-white/70" : "text-[#717182]"}`}>{caption}</div>
      </div>
    </button>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: typeof Inbox; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="h-8 w-8 rounded-lg bg-[#0c3455]/5 text-[#0c3455] grid place-items-center">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-[#0c3455]">{title}</div>
        <div className="text-sm text-[#717182] -mt-0.5">{subtitle}</div>
      </div>
    </div>
  );
}

function BroadcastCard({
  broadcast,
  onAcknowledge,
}: {
  broadcast: Broadcast;
  onAcknowledge: (id: string) => void;
}) {
  const isUnread = !broadcast.acknowledged;
  const mandatory = broadcast.priority === "mandatory";

  return (
    <div
      className={`rounded-2xl p-5 border transition-all ${
        isUnread
          ? "bg-white border-l-4 border-l-[#0c3455] border-y-[#e5e7ec] border-r-[#e5e7ec] shadow-[0px_8px_24px_0px_rgba(13,37,67,0.06)]"
          : "bg-white/60 border-[#e5e7ec]"
      }`}
    >
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-start gap-3 min-w-0">
          {isUnread ? (
            <span className="mt-1.5 h-2 w-2 rounded-full bg-[#0c3455] shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className={`${isUnread ? "text-[#0c3455]" : "text-[#717182]"} truncate`}>{broadcast.title}</div>
              {mandatory && isUnread && (
                <span className="text-xs uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-50 text-rose-700">
                  Mandatory
                </span>
              )}
            </div>
            <div className="text-sm text-[#717182] mt-0.5">
              {broadcast.from} · {broadcast.postedAt}
            </div>
          </div>
        </div>
      </div>
      <p className={`text-[16px] leading-relaxed pl-5 ${isUnread ? "text-[#384559]" : "text-[#8a8fa0]"}`}>{broadcast.body}</p>
      <div className="pl-5 mt-3 flex items-center gap-3">
        {isUnread ? (
          <button
            onClick={() => onAcknowledge(broadcast.id)}
            className="h-9 px-4 rounded-full bg-[#0c3455] text-white text-xs hover:bg-[#0c3455]/90 shadow-[0px_4px_7px_rgba(13,37,67,0.25)]"
          >
            Acknowledge
          </button>
        ) : (
          <span className="text-sm text-emerald-700 inline-flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledged
          </span>
        )}
      </div>
    </div>
  );
}

