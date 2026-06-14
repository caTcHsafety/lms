import { useState, useRef, useEffect } from "react";
import { LayoutDashboard, Users, Inbox, LogOut, ChevronDown, Pencil } from "lucide-react";
import logo from "@/assets/login/logo.png";
import { useAuth } from "@/app/auth/AuthContext";
import { supabase } from "@/lib/supabase";
import { ProfileEditor } from "@/components/ProfileEditor";

export type MentorView = "dashboard" | "roster" | "queue";

interface TopNavProps {
  view: MentorView;
  onChange: (v: MentorView) => void;
  pendingCount: number;
  unreadBroadcasts: number;
}

const tabs: { id: MentorView; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "roster", label: "Cohort", icon: Users },
  { id: "queue", label: "Evaluations", icon: Inbox },
];

export function TopNav({ view, onChange, pendingCount, unreadBroadcasts }: TopNavProps) {
  const { user } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [fullName, setFullName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single();
      if (data?.full_name) setFullName(data.full_name);
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    })();
  }, [user]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const displayName = fullName ||
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Mentor";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const userEmail = user?.email || "";

  return (
    <>
    <header className="sticky top-0 z-40 h-16 bg-[#f3f3f5] border-b border-[#c4c6ce] shadow-[0px_1px_0.5px_rgba(0,0,0,0.05)]">
      <div className="h-full max-w-[1400px] mx-auto px-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt="SafetyCatch" className="h-9 w-auto object-contain" />
        </div>

        <nav className="h-[50px] px-1.5 bg-white/80 border border-white/45 rounded-full shadow-[0px_8px_24px_0px_rgba(13,37,67,0.08)] backdrop-blur-md flex items-center gap-1">
          {tabs.map((t) => {
            const active = view === t.id;
            const badge =
              t.id === "queue" ? pendingCount : t.id === "dashboard" ? unreadBroadcasts : 0;
            return (
              <button
                key={t.id}
                onClick={() => onChange(t.id)}
                className={`relative h-[38px] px-4 rounded-full flex items-center gap-2 transition-all duration-200 ${
                  active
                    ? "bg-[#0c3455] text-white shadow-[0px_4px_7px_rgba(13,37,67,0.35)]"
                    : "text-[#0c3455] hover:bg-[#0c3455]/5"
                }`}
              >
                <t.icon className="h-4 w-4" />
                <span>{t.label}</span>
                {badge > 0 && (
                  <span
                    className={`min-w-[18px] h-[18px] px-1 rounded-full grid place-items-center text-[11px] font-semibold ${
                      active ? "bg-white text-[#0c3455]" : "bg-[#0c3455] text-white"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-3 hover:bg-[#0c3455]/5 px-3 py-1.5 rounded-xl transition-all duration-200 text-left"
          >
            <div className="text-right leading-tight hidden sm:block">
              <div className="text-sm font-medium text-[#0c3455]">{displayName}</div>
              <div className="text-xs text-[#717182]">Mentor</div>
            </div>
            <div className="h-9 w-9 rounded-full bg-[#0c3455] grid place-items-center text-white text-sm font-semibold shadow-[0px_2px_4px_rgba(13,37,67,0.15)] relative overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <ChevronDown className={`h-4 w-4 text-[#717182] transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-[#e5e7ec] shadow-[0px_10px_30px_rgba(13,37,67,0.1)] py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-2 border-b border-[#e5e7ec]">
                <div className="font-medium text-[#0c3455] text-sm truncate">{displayName}</div>
                <div className="text-xs text-[#717182] truncate mt-0.5">{userEmail}</div>
                <div className="inline-block px-2 py-0.5 rounded-full bg-[#0c3455]/5 text-[#0c3455] text-[10px] font-semibold uppercase tracking-wider mt-2">
                  Mentor Portal
                </div>
              </div>
              <div className="p-1">
                <button
                  onClick={() => { setDropdownOpen(false); setProfileEditorOpen(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#0c3455] hover:bg-[#f3f3f5] rounded-xl transition-colors text-left font-medium"
                >
                  <Pencil className="h-4 w-4" />
                  Edit Profile
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left font-medium"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
    <ProfileEditor
      open={profileEditorOpen}
      onClose={() => setProfileEditorOpen(false)}
      currentName={fullName || displayName}
      currentAvatarUrl={avatarUrl}
      onSaved={(newName, newAvatar) => {
        setFullName(newName);
        setAvatarUrl(newAvatar);
      }}
    />
    </>
  );
}
