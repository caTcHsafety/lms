import { useState, useRef, useEffect } from "react";
import imgLogo from "@/imports/DefineInteractionStates-1/848d5a953dafd1fe3634da12a6906b9368a73f9e.png";
import { useAuth } from "@/app/auth/AuthContext";
import { LogOut, ChevronDown, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ProfileEditor } from "@/components/ProfileEditor";

export type TrainerRoute = "dashboard" | "vault";

const items: { id: TrainerRoute; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "vault", label: "Content Vault" },
];

interface Props {
  route: TrainerRoute;
  onNavigate: (r: TrainerRoute) => void;
  unread: number;
}

export function TopNav({ route, onNavigate, unread }: Props) {
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
    "Trainer";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const userEmail = user?.email || "";

  return (
    <>
    <header className="relative h-16 w-full bg-[#f3f3f5] border-b border-[#c4c6ce] shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
      <div className="absolute left-10 top-1/2 -translate-y-1/2 h-9 w-[100px]">
        <img src={imgLogo} alt="SafetyCatch" className="h-full w-full object-contain" />
      </div>

      <nav className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2">
        <div className="relative flex items-center gap-1 h-[50px] px-1.5 rounded-full bg-white/80 border border-white/45 shadow-[0_8px_24px_rgba(13,37,67,0.08)] backdrop-blur-md">
          {items.map((it) => {
            const active = route === it.id;
            return (
              <button
                key={it.id}
                onClick={() => onNavigate(it.id)}
                className={[
                  "relative h-[37px] px-6 rounded-full transition-all duration-200",
                  active
                    ? "bg-[#0d2543] text-white shadow-[0_4px_14px_rgba(13,37,67,0.35)] border border-white/20"
                    : "text-[#0d2543] hover:bg-black/5",
                ].join(" ")}
              >
                <span className="tracking-[0.14px]">{it.label}</span>
                {it.id === "dashboard" && unread > 0 && (
                  <span
                    className={[
                      "absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-semibold flex items-center justify-center",
                      active ? "bg-white text-[#0d2543]" : "bg-[#d4183d] text-white",
                    ].join(" ")}
                  >
                    {unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-3" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-3 hover:bg-[#0d2543]/5 px-3 py-1.5 rounded-xl transition-all duration-200 text-left"
        >
          <div className="text-right leading-tight hidden sm:block">
            <div className="text-sm font-medium text-[#0d2543]">{displayName}</div>
            <div className="text-xs text-[#717182]">Trainer</div>
          </div>
          <div className="size-9 rounded-full bg-[#0d2543] text-white flex items-center justify-center text-sm font-semibold shadow-[0px_2px_4px_rgba(13,37,67,0.15)] overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <ChevronDown className={`h-4 w-4 text-[#717182] transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white border border-[#e5e7ec] shadow-[0px_10px_30px_rgba(13,37,67,0.1)] py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-4 py-2 border-b border-[#e5e7ec]">
              <div className="font-medium text-[#0d2543] text-sm truncate">{displayName}</div>
              <div className="text-xs text-[#717182] truncate mt-0.5">{userEmail}</div>
              <div className="inline-block px-2 py-0.5 rounded-full bg-[#0d2543]/5 text-[#0d2543] text-[10px] font-semibold uppercase tracking-wider mt-2">
                Trainer Portal
              </div>
            </div>
            <div className="p-1">
              <button
                onClick={() => { setDropdownOpen(false); setProfileEditorOpen(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#0d2543] hover:bg-[#f3f3f5] rounded-xl transition-colors text-left font-medium"
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
