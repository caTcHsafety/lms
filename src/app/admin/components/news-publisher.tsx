"use client";

import { useState, useEffect } from "react";
import { Bell, CheckCircle2, Clock, Send, Users, AlertCircle, Search, X, Loader2 } from "lucide-react";
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import { useAuth } from '@/app/auth/AuthContext';

type Broadcast = Database['public']['Tables']['broadcasts']['Row'];
type BroadcastAudience = Database['public']['Tables']['broadcast_audiences']['Row'];
type BroadcastAck = Database['public']['Tables']['broadcast_acks']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type Cohort = Database['public']['Tables']['cohorts']['Row'];
type CohortStudent = Database['public']['Tables']['cohort_students']['Row'];

type Announcement = Broadcast & {
  broadcast_audiences: BroadcastAudience[];
  broadcast_acks: BroadcastAck[];
  audienceString: string;
  audienceCount: number;
  acknowledged: number;
};

type AudienceSelection = {
  type: 'role' | 'cohort';
  value: string;
  label: string;
};

const roles: { value: Database["public"]["Enums"]["user_role"]; label: string }[] = [
  { value: 'admin', label: 'All Staff (Admins)' },
  { value: 'trainer', label: 'All Trainers' },
  { value: 'mentor', label: 'All Mentors' },
];

const priorityStyles: Record<Database["public"]["Enums"]["broadcast_priority"], { dot: string; pill: string; label: string }> = {
  urgent: { dot: "bg-[#c0392b]", pill: "bg-[#fdecea] text-[#c0392b]", label: "Urgent" },
  high: { dot: "bg-[#d35400]", pill: "bg-[#fdf2e9] text-[#d35400]", label: "High" },
  normal: { dot: "bg-[#00658d]", pill: "bg-[#e0f1f9] text-[#00658d]", label: "Normal" },
  low: { dot: "bg-[#74777E]", pill: "bg-[#f0f0f2] text-[#44474e]", label: "Low" },
};

export function NewsPublisherView() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [cohortStudents, setCohortStudents] = useState<CohortStudent[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftAudience, setDraftAudience] = useState<AudienceSelection[]>([]);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [draftPriority, setDraftPriority] = useState<Database["public"]["Enums"]["broadcast_priority"]>("normal");
  const [search, setSearch] = useState("");

  const loadData = async () => {
    try {
      const [
        { data: bData, error: bErr },
        { data: cData },
        { data: pData },
        { data: csData }
      ] = await Promise.all([
        supabase.from('broadcasts').select(`
          *,
          broadcast_audiences(role_target, cohort_target),
          broadcast_acks(id, user_id, acked_at)
        `).order('published_at', { ascending: false }),
        supabase.from('cohorts').select('id, name'),
        supabase.from('profiles').select('id, role, full_name'),
        supabase.from('cohort_students').select('student_id, cohort_id')
      ]);

      if (bErr) throw bErr;
      
      setCohorts(cData || []);
      setProfiles(pData || []);
      setCohortStudents(csData || []);

      const mapped = (bData || []).map(b => {
        const audiences = b.broadcast_audiences || [];
        const acks = b.broadcast_acks || [];
        
        let audienceStr = "No recipients";
        if (audiences.length > 0) {
          const labels = audiences.map(a => {
            if (a.cohort_target) {
              const c = (cData || []).find(x => x.id === a.cohort_target);
              return c ? c.name : 'Unknown Cohort';
            }
            if (a.role_target) {
              return roles.find(r => r.value === a.role_target)?.label || a.role_target;
            }
            return 'Unknown';
          });
          audienceStr = labels.join(', ');
        }

        const userSet = new Set<string>();

        // Role-based audiences
        audiences.forEach(a => {
          if (a.role_target && pData) {
            pData.filter(p => p.role === a.role_target).forEach(p => userSet.add(p.id));
          }
          if (a.cohort_target && csData) {
            csData.filter(cs => cs.cohort_id === a.cohort_target).forEach(cs => userSet.add(cs.student_id));
          }
        });

        // Individual targets — broadcast_acks rows pre-created with acked_at = null
        // These are users who were individually targeted (not via a role/cohort audience row)
        const individualAckUserIds = acks
          .map((a: any) => a.user_id)
          .filter((uid: string) => !userSet.has(uid));
        individualAckUserIds.forEach((uid: string) => userSet.add(uid));

        // Build audience string for individual targets if no role audiences
        if (audiences.length === 0 && individualAckUserIds.length > 0) {
          const names = individualAckUserIds
            .map((uid: string) => (pData || []).find(p => p.id === uid)?.full_name || 'Unknown')
            .join(', ');
          audienceStr = names;
        }

        return {
          ...b,
          broadcast_audiences: audiences,
          broadcast_acks: acks,
          audienceString: audienceStr,
          audienceCount: userSet.size,
          acknowledged: acks.filter((a: any) => a.acked_at !== null).length,
        } as Announcement;
      });

      setAnnouncements(mapped);
      if (mapped.length > 0 && !selectedId) {
        setSelectedId(mapped[0].id);
      }
    } catch (err) {
      console.error("Failed to load announcements:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleAudience = (item: AudienceSelection) => {
    setDraftAudience((prev) => {
      const exists = prev.find(p => p.value === item.value && p.type === item.type);
      if (exists) return prev.filter(p => !(p.value === item.value && p.type === item.type));
      return [...prev, item];
    });
  };

  const audienceLabel = (() => {
    if (draftAudience.length === 0) return "Select audience...";
    if (draftAudience.length === 1) return draftAudience[0].label;
    return `${draftAudience.length} groups selected`;
  })();

  const filtered = announcements.filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.audienceString.toLowerCase().includes(search.toLowerCase())
  );
  const selected = announcements.find((a) => a.id === selectedId) ?? filtered[0];

  const totalSent = announcements.length;
  const pendingAck = announcements.reduce((sum, a) => sum + Math.max(0, a.audienceCount - a.acknowledged), 0);
  const fullyRead = announcements.filter((a) => a.audienceCount > 0 && a.acknowledged >= a.audienceCount).length;

  const publish = async () => {
    console.log("[DEBUG NewsPublisher] publish function called. Title:", draftTitle, "Audience:", draftAudience);
    if (!draftTitle.trim() || !draftBody.trim() || draftAudience.length === 0) {
      console.log("[DEBUG NewsPublisher] Validation failed:", { title: !draftTitle.trim(), body: !draftBody.trim(), audience: draftAudience.length === 0 });
      alert("Please provide title, message, and select at least one audience.");
      return;
    }
    if (!user) {
      console.log("[DEBUG NewsPublisher] User not logged in");
      alert("You must be logged in.");
      return;
    }

    setPublishing(true);
    console.log("[DEBUG NewsPublisher] setPublishing(true). Inserting broadcast...");
    
    try {
      // 1. Insert broadcast
      const { data: bData, error: bErr } = await supabase.from('broadcasts').insert({
        title: draftTitle,
        content: draftBody,
        priority: draftPriority,
        published_by: user.id,
        requires_ack: true,
      }).select().single();

      if (bErr) {
        console.error("[DEBUG NewsPublisher] Broadcast insert error:", bErr);
        throw bErr;
      }
      console.log("[DEBUG NewsPublisher] Broadcast inserted successfully. bData:", bData);

      // 2. Insert audiences — split role-based vs individual user targets
      const roleAudiences = draftAudience.filter(a => a.type === 'role' && !a.value.startsWith('individual:'));
      const individualTargets = draftAudience.filter(a => a.value.startsWith('individual:'));

      if (roleAudiences.length > 0) {
        const audiencesToInsert = roleAudiences.map(a => ({
          broadcast_id: bData.id,
          role_target: a.value as Database["public"]["Enums"]["user_role"],
          cohort_target: null as any,
        }));
        const { error: aErr } = await supabase.from('broadcast_audiences').insert(audiencesToInsert);
        if (aErr) {
          console.error("[DEBUG NewsPublisher] Audience insert error:", aErr);
          throw aErr;
        }
      }

      // For individual targets, pre-create pending ack rows (acked_at = null = unacknowledged)
      if (individualTargets.length > 0) {
        const acksToInsert = individualTargets.map(a => ({
          broadcast_id: bData.id,
          user_id: a.value.replace('individual:', ''),
          acked_at: null as any,
        }));
        const { error: iErr } = await supabase.from('broadcast_acks').insert(acksToInsert);
        if (iErr) {
          console.error("[DEBUG NewsPublisher] Individual ack insert error:", iErr);
          throw iErr;
        }
      }
      console.log("[DEBUG NewsPublisher] Audiences inserted successfully.");

      await loadData();
      console.log("[DEBUG NewsPublisher] Data reloaded.");
      setComposeOpen(false);
      setDraftTitle("");
      setDraftBody("");
      setDraftPriority("normal");
      setDraftAudience([]);
      setSelectedId(bData.id);
    } catch (err: any) {
      console.error("[DEBUG NewsPublisher] Catch error in publish:", err);
      alert('Failed to publish: ' + err.message);
    } finally {
      setPublishing(false);
      console.log("[DEBUG NewsPublisher] publish completed, setting publishing back to false.");
    }
  };

  if (loading) {
    return (
      <div className="-mx-10 -my-10 min-h-[calc(100vh-64px)] flex items-center justify-center bg-[#f5f5f7] text-[#74777E]">
        <Loader2 className="size-6 animate-spin mr-2" />
        <span className="font-['Inter'] font-medium">Loading announcements...</span>
      </div>
    );
  }

  return (
    <div className="-mx-10 -my-10 h-[calc(100vh-64px)] bg-[#f5f5f7] p-10 overflow-y-auto overflow-x-hidden">
    <div className="space-y-6">
      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard icon={<Send className="size-5 text-[#00658d]" />} label="Announcements Sent" value={totalSent.toString()} sub="all time" />
        <MetricCard icon={<Clock className="size-5 text-[#c0392b]" />} label="Pending Acknowledgements" value={pendingAck.toString()} sub="across active memos" />
        <MetricCard icon={<CheckCircle2 className="size-5 text-[#1E5631]" />} label="Fully Read" value={`${fullyRead} / ${totalSent}`} sub="memos with 100% read" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left: list */}
        <div className="col-span-5 bg-white rounded-xl shadow-[0px_1px_1px_rgba(0,0,0,0.05)] border border-[rgba(196,198,206,0.3)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-['Inter'] font-semibold text-[#0d2543]">Announcements</h2>
            <button
              onClick={() => setComposeOpen(true)}
              className="bg-[#00658d] hover:bg-[#004d6b] active:bg-[#003d54] text-white px-4 py-2 rounded-full font-['Inter'] font-medium text-sm tracking-[0.14px] shadow-[0px_1px_1px_rgba(0,0,0,0.05)] flex items-center gap-2 transition-all duration-200 focus:ring-2 focus:ring-[#00658d] focus:ring-offset-2"
            >
              <Bell className="size-4" />
              New Memo
            </button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#74777E]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search memos or audiences..."
              className="w-full bg-[#f3f3f5] border border-transparent rounded-lg pl-10 pr-4 py-2.5 font-['Inter'] text-sm text-[#1a1c1d] placeholder-[#74777E] focus:bg-white focus:border-[#4493bf] focus:ring-2 focus:ring-[#4493bf] transition-all duration-200 outline-none"
            />
          </div>

          <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
            {filtered.length === 0 && (
              <div className="text-center py-12 text-[#74777E] font-['Inter'] text-sm">No memos match your search.</div>
            )}
            {filtered.map((a) => {
              const pct = a.audienceCount === 0 ? 100 : Math.round((a.acknowledged / a.audienceCount) * 100);
              const isActive = selected?.id === a.id;
              const prio = a.priority || "normal";
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={`w-full text-left rounded-xl p-4 border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4493bf] focus:ring-offset-2 ${
                    isActive
                      ? "bg-[#f0f7fb] border-[#4493bf] shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
                      : "bg-white border-[#e2e2e4] hover:border-[#c4c6ce] hover:bg-[#fafafa]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 size-2 rounded-full ${priorityStyles[prio].dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-['Inter'] font-semibold text-sm text-[#1a1c1d] truncate">{a.title}</h3>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full font-['Inter'] font-semibold text-[16px] uppercase tracking-[0.5px] ${priorityStyles[prio].pill}`}>
                          {priorityStyles[prio].label}
                        </span>
                      </div>
                      <p className="font-['Inter'] text-xs text-[#44474e] mt-1 flex items-center gap-1.5 truncate">
                        <Users className="size-3 shrink-0" /> <span className="truncate">{a.audienceString}</span> · {new Date(a.published_at || "").toLocaleDateString()}
                      </p>
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs font-['Inter'] text-[#44474e] mb-1">
                          <span>Acknowledged</span>
                          <span className="font-semibold">{a.acknowledged}/{a.audienceCount}</span>
                        </div>
                        <div className="h-1.5 bg-[#e2e2e4] rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${pct === 100 ? "bg-[#1E5631]" : pct >= 50 ? "bg-[#00658d]" : "bg-[#c0392b]"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: detail */}
        <div className="col-span-7 bg-white rounded-xl shadow-[0px_1px_1px_rgba(0,0,0,0.05)] border border-[rgba(196,198,206,0.3)] p-8">
          {selected ? (
            <DetailView announcement={selected} profiles={profiles} cohortStudents={cohortStudents} />
          ) : (
            <div className="text-center py-20 text-[#74777E] font-['Inter']">Select an announcement to view details.</div>
          )}
        </div>
      </div>

      {composeOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[rgba(13,37,67,0.45)] backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setComposeOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="compose-title"
            className="bg-white rounded-2xl shadow-[0px_20px_50px_rgba(0,0,0,0.25)] border border-[rgba(196,198,206,0.4)] w-full max-w-[640px] max-h-[90vh] overflow-auto"
          >
            <div className="flex items-start justify-between p-6 pb-4 border-b border-[#e2e2e4] sticky top-0 bg-white rounded-t-2xl">
              <div>
                <h2 id="compose-title" className="font-['Inter'] font-semibold text-[#0d2543]">Compose Announcement</h2>
                <p className="font-['Inter'] text-sm text-[#74777E] mt-0.5">Targeted broadcasts require an acknowledgement from each recipient.</p>
              </div>
              <button
                onClick={() => setComposeOpen(false)}
                aria-label="Close"
                className="size-9 rounded-full flex items-center justify-center text-[#44474e] hover:bg-[#f3f3f5] active:bg-[#e8e8ea] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4493bf]"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <Field label="Title">
                <input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="e.g. Updated Risk Matrix for Module 7"
                  className="w-full bg-white border border-[#c4c6ce] rounded-lg px-4 py-3 font-['Inter'] text-sm text-[#1a1c1d] placeholder-[#74777E] focus:border-[#4493bf] focus:ring-2 focus:ring-[#4493bf] transition-all duration-200 outline-none"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Audience">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setAudienceOpen((v) => !v)}
                      className="w-full bg-white border border-[#c4c6ce] rounded-lg px-4 pr-10 py-3 font-['Inter'] text-sm text-[#1a1c1d] cursor-pointer hover:bg-[#fafafa] focus:border-[#4493bf] focus:ring-2 focus:ring-[#4493bf] transition-all duration-200 outline-none text-left flex items-center justify-between"
                      aria-haspopup="listbox"
                      aria-expanded={audienceOpen}
                    >
                      <span className={draftAudience.length === 0 ? "text-[#74777E]" : "truncate"}>{audienceLabel}</span>
                    </button>
                    {audienceOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setAudienceOpen(false)} />
                        <div
                          role="listbox"
                          className="absolute z-20 left-0 right-0 mt-2 bg-white border border-[#e2e2e4] rounded-xl shadow-[0px_12px_32px_rgba(13,37,67,0.12)] max-h-[340px] flex flex-col overflow-hidden origin-top animate-in fade-in slide-in-from-top-1 duration-150"
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#f0f0f2] bg-[#fafafb]">
                            <span className="font-['Inter'] font-semibold text-xs text-[#44474e] tracking-[0.4px] uppercase">
                              {draftAudience.length === 0 ? "Choose recipients" : `${draftAudience.length} selected`}
                            </span>
                            {draftAudience.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setDraftAudience([])}
                                className="font-['Inter'] font-semibold text-xs text-[#00658d] hover:text-[#004d6b] transition-colors duration-150 focus:outline-none focus:underline"
                              >
                                Clear
                              </button>
                            )}
                          </div>

                          {/* Scrollable list */}
                          <div className="overflow-y-auto overflow-x-hidden flex-1 py-1.5 [scrollbar-width:thin] [scrollbar-color:#c4c6ce_transparent]">
                            <div className="px-4 pt-2 pb-1 flex items-center gap-2">
                              <Users className="size-3.5 text-[#74777E]" />
                              <span className="font-['Inter'] font-semibold text-xs text-[#74777E] uppercase tracking-[0.6px]">Roles</span>
                            </div>
                            {roles.map((r) => {
                              const checked = draftAudience.some(a => a.type === 'role' && a.value === r.value);
                              return (
                                <label
                                  key={r.value}
                                  className={`group flex items-center gap-3 mx-2 px-2.5 py-2 rounded-lg cursor-pointer font-['Inter'] text-sm transition-all duration-150 ${
                                    checked
                                      ? "bg-[#e6f1f7] text-[#00587c]"
                                      : "text-[#1a1c1d] hover:bg-[#f3f3f5]"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleAudience({ type: 'role', value: r.value, label: r.label })}
                                    className="size-4 rounded border-[#c4c6ce] text-[#00658d] focus:ring-2 focus:ring-[#4493bf] focus:ring-offset-1"
                                  />
                                  <span className="flex-1 font-medium">{r.label}</span>
                                  {checked && <CheckCircle2 className="size-4 text-[#00658d]" />}
                                </label>
                              );
                            })}

                            <div className="mt-2 mx-2 border-t border-[#f0f0f2]" />

                            <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                              <Users className="size-3.5 text-[#74777E]" />
                              <span className="font-['Inter'] font-semibold text-xs text-[#74777E] uppercase tracking-[0.6px]">Trainers</span>
                              <span className="ml-auto font-['Inter'] text-sm text-[#9aa0a6]">
                                {profiles.filter(p => p.role === 'trainer').length} available
                              </span>
                            </div>
                            {profiles.filter(p => p.role === 'trainer').length === 0 && (
                              <div className="px-4 py-2 text-xs text-[#74777E] font-['Inter']">No trainers found</div>
                            )}
                            {profiles.filter(p => p.role === 'trainer').map((p) => {
                              const checked = draftAudience.some(a => a.type === 'role' && a.value === `individual:${p.id}`);
                              return (
                                <label
                                  key={p.id}
                                  className={`group flex items-center gap-3 mx-2 px-2.5 py-2 rounded-lg cursor-pointer font-['Inter'] text-sm transition-all duration-150 ${
                                    checked ? "bg-[#e6f1f7] text-[#00587c]" : "text-[#1a1c1d] hover:bg-[#f3f3f5]"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleAudience({ type: 'role', value: `individual:${p.id}`, label: p.full_name })}
                                    className="size-4 rounded border-[#c4c6ce] text-[#00658d] focus:ring-2 focus:ring-[#4493bf] focus:ring-offset-1"
                                  />
                                  <span className="flex-1 font-medium">{p.full_name}</span>
                                  {checked && <CheckCircle2 className="size-4 text-[#00658d]" />}
                                </label>
                              );
                            })}

                            <div className="mt-2 mx-2 border-t border-[#f0f0f2]" />

                            <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                              <Users className="size-3.5 text-[#74777E]" />
                              <span className="font-['Inter'] font-semibold text-xs text-[#74777E] uppercase tracking-[0.6px]">Mentors</span>
                              <span className="ml-auto font-['Inter'] text-sm text-[#9aa0a6]">
                                {profiles.filter(p => p.role === 'mentor').length} available
                              </span>
                            </div>
                            {profiles.filter(p => p.role === 'mentor').length === 0 && (
                              <div className="px-4 py-2 text-xs text-[#74777E] font-['Inter']">No mentors found</div>
                            )}
                            {profiles.filter(p => p.role === 'mentor').map((p) => {
                              const checked = draftAudience.some(a => a.type === 'role' && a.value === `individual:${p.id}`);
                              return (
                                <label
                                  key={p.id}
                                  className={`group flex items-center gap-3 mx-2 px-2.5 py-2 rounded-lg cursor-pointer font-['Inter'] text-sm transition-all duration-150 ${
                                    checked ? "bg-[#e6f1f7] text-[#00587c]" : "text-[#1a1c1d] hover:bg-[#f3f3f5]"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleAudience({ type: 'role', value: `individual:${p.id}`, label: p.full_name })}
                                    className="size-4 rounded border-[#c4c6ce] text-[#00658d] focus:ring-2 focus:ring-[#4493bf] focus:ring-offset-1"
                                  />
                                  <span className="flex-1 font-medium">{p.full_name}</span>
                                  {checked && <CheckCircle2 className="size-4 text-[#00658d]" />}
                                </label>
                              );
                            })}
                          </div>

                          {/* Footer */}
                          <div className="flex items-center justify-end px-4 py-2.5 border-t border-[#f0f0f2] bg-[#fafafb]">
                            <button
                              type="button"
                              onClick={() => setAudienceOpen(false)}
                              className="px-3 py-1 rounded-full font-['Inter'] font-semibold text-xs text-white bg-[#0d2543] hover:bg-[#0a1d33] active:bg-[#071628] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#4493bf] focus:ring-offset-1"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 size-2.5 pointer-events-none" fill="none" viewBox="0 0 10 5">
                      <path d="M5 5L0 0H10L5 5V5" fill="#74777E" />
                    </svg>
                  </div>
                </Field>

                <Field label="Priority">
                  <div className="flex gap-2">
                    {(["low", "normal", "high", "urgent"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setDraftPriority(p)}
                        className={`flex-1 px-3 py-3 rounded-lg font-['Inter'] font-medium text-sm capitalize transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-[#4493bf] focus:ring-offset-2 ${
                          draftPriority === p
                            ? "bg-[#0d2543] text-white border-[#0d2543]"
                            : "bg-white text-[#44474e] border-[#c4c6ce] hover:bg-[#fafafa]"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              <Field label="Message">
                <textarea
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  rows={6}
                  placeholder="Include any links, deadlines, or actions trainers should take."
                  className="w-full bg-white border border-[#c4c6ce] rounded-lg px-4 py-3 font-['Inter'] text-sm text-[#1a1c1d] placeholder-[#74777E] focus:border-[#4493bf] focus:ring-2 focus:ring-[#4493bf] transition-all duration-200 outline-none resize-none"
                />
              </Field>

              <div className="flex items-center justify-between bg-[#f3f3f5] rounded-lg p-3">
                <div className="flex items-center gap-2 text-[#44474e] font-['Inter'] text-sm">
                  <AlertCircle className="size-4 shrink-0" />
                  Recipients must click "Acknowledge" to clear from their dashboard.
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 pt-2 border-t border-[#e2e2e4] sticky bottom-0 bg-white rounded-b-2xl">
              <button
                onClick={() => setComposeOpen(false)}
                className="px-5 py-2.5 rounded-full font-['Inter'] font-medium text-sm text-[#44474e] hover:bg-[#f3f3f5] active:bg-[#e8e8ea] transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={publish}
                disabled={!draftTitle.trim() || !draftBody.trim() || draftAudience.length === 0 || publishing}
                className="bg-[#00658d] hover:bg-[#004d6b] active:bg-[#003d54] disabled:bg-[#c4c6ce] disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-full font-['Inter'] font-medium text-sm tracking-[0.14px] shadow-[0px_1px_1px_rgba(0,0,0,0.05)] flex items-center gap-2 transition-all duration-200 focus:ring-2 focus:ring-[#00658d] focus:ring-offset-2"
              >
                {publishing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {publishing ? "Publishing..." : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

function DetailView({ announcement, profiles, cohortStudents }: { announcement: Announcement, profiles: Profile[], cohortStudents: CohortStudent[] }) {
  const pct = announcement.audienceCount === 0 ? 100 : Math.round((announcement.acknowledged / announcement.audienceCount) * 100);
  const pending = Math.max(0, announcement.audienceCount - announcement.acknowledged);

  const userSet = new Set<string>();
  announcement.broadcast_audiences.forEach(a => {
    if (a.role_target) {
      profiles.filter(p => p.role === a.role_target).forEach(p => userSet.add(p.id));
    }
    if (a.cohort_target) {
      cohortStudents.filter(cs => cs.cohort_id === a.cohort_target).forEach(cs => userSet.add(cs.student_id));
    }
  });

  // Also include individually targeted users (pre-created broadcast_acks)
  announcement.broadcast_acks.forEach(a => {
    if (!userSet.has(a.user_id)) userSet.add(a.user_id);
  });

  const recipients = Array.from(userSet).map(userId => {
    const profile = profiles.find(p => p.id === userId);
    const ack = announcement.broadcast_acks.find(a => a.user_id === userId);
    return {
      name: profile?.full_name || "Unknown User",
      acknowledged: !!ack?.acked_at,
      when: ack?.acked_at ? new Date(ack.acked_at).toLocaleString() : "—",
    };
  });

  const prio = announcement.priority || "normal";

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <span className={`inline-block px-2 py-0.5 rounded-full font-['Inter'] font-semibold text-[16px] uppercase tracking-[0.5px] mb-2 ${priorityStyles[prio].pill}`}>
            {priorityStyles[prio].label}
          </span>
          <h2 className="font-['Inter'] font-semibold text-[#0d2543]">{announcement.title}</h2>
          <p className="font-['Inter'] text-sm text-[#74777E] mt-1">
            Sent {new Date(announcement.published_at || "").toLocaleString()} · to <span className="font-semibold text-[#44474e]">{announcement.audienceString}</span>
          </p>
        </div>
        <button className="px-4 py-2 rounded-full font-['Inter'] font-medium text-sm text-[#44474e] hover:bg-[#f3f3f5] active:bg-[#e8e8ea] transition-all duration-200 border border-[#e2e2e4]">
          Resend Reminder
        </button>
      </div>

      <div className="bg-[#f3f3f5] rounded-lg p-4 mb-6 font-['Inter'] text-sm text-[#1a1c1d] leading-relaxed whitespace-pre-wrap">
        {announcement.content}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Recipients" value={announcement.audienceCount.toString()} tone="neutral" />
        <Stat label="Acknowledged" value={announcement.acknowledged.toString()} tone="good" />
        <Stat label="Outstanding" value={pending.toString()} tone={pending === 0 ? "good" : "warn"} />
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between text-sm font-['Inter'] text-[#44474e] mb-2">
          <span className="font-semibold">Read receipts</span>
          <span>{pct}% complete</span>
        </div>
        <div className="h-2 bg-[#e2e2e4] rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${pct === 100 ? "bg-[#1E5631]" : pct >= 50 ? "bg-[#00658d]" : "bg-[#c0392b]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="border-t border-[#e2e2e4] pt-4">
        <h3 className="font-['Inter'] font-bold text-sm text-[#1a1c1d] tracking-[0.14px] mb-3">Compliance Audit</h3>
        <div className="max-h-[260px] overflow-auto [scrollbar-width:thin] [scrollbar-color:#c4c6ce_transparent]">
          <table className="w-full">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-[#e2e2e4]">
                <th className="text-left font-['Inter'] font-semibold text-xs text-[#74777E] tracking-[0.5px] uppercase px-2 py-2">Recipient</th>
                <th className="text-left font-['Inter'] font-semibold text-xs text-[#74777E] tracking-[0.5px] uppercase px-2 py-2">Status</th>
                <th className="text-right font-['Inter'] font-semibold text-xs text-[#74777E] tracking-[0.5px] uppercase px-2 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {recipients.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-2 py-4 text-center text-[#74777E] text-sm font-['Inter']">No recipients found</td>
                </tr>
              )}
              {recipients.map((r, i) => (
                <tr key={i} className="border-b border-[#f0f0f2] hover:bg-[#fafafa] transition-colors duration-150">
                  <td className="px-2 py-2.5 font-['Inter'] text-sm text-[#1a1c1d]">{r.name}</td>
                  <td className="px-2 py-2.5">
                    {r.acknowledged ? (
                      <span className="inline-flex items-center gap-1 text-[#1E5631] font-['Inter'] text-sm font-semibold">
                        <CheckCircle2 className="size-4" /> Acknowledged
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[#c0392b] font-['Inter'] text-sm font-semibold">
                        <Clock className="size-4" /> Pending
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right font-['Inter'] text-sm text-[#44474e]">{r.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-['Inter'] font-bold text-xs text-[#44474e] tracking-[0.6px] uppercase mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}

function MetricCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-xl shadow-[0px_1px_1px_rgba(0,0,0,0.05)] border border-[rgba(196,198,206,0.3)] p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="size-9 rounded-lg bg-[#f3f3f5] flex items-center justify-center">{icon}</div>
        <span className="font-['Inter'] font-medium text-sm text-[#44474e]">{label}</span>
      </div>
      <div className="font-['Inter'] font-bold text-[#0d2543]" style={{ fontSize: 28 }}>{value}</div>
      <p className="font-['Inter'] text-xs text-[#74777E] mt-1">{sub}</p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "neutral" }) {
  const toneCls =
    tone === "good" ? "bg-[#e8f5ec] text-[#1E5631]" :
    tone === "warn" ? "bg-[#fdecea] text-[#c0392b]" :
    "bg-[#f3f3f5] text-[#0d2543]";
  return (
    <div className={`rounded-lg p-4 ${toneCls}`}>
      <p className="font-['Inter'] font-semibold text-xs uppercase tracking-[0.5px] opacity-80">{label}</p>
      <p className="font-['Inter'] font-bold mt-1" style={{ fontSize: 24 }}>{value}</p>
    </div>
  );
}

