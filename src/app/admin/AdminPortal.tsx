import { useState, useEffect } from "react";
import { Bell, Pencil } from "lucide-react";
import svgPaths1 from "@/imports/SafetyCatchCreateNewSubjectModuleFlow-2/svg-lsxud8wepe";
import svgPaths2 from "@/imports/SafetyCatchStudentManagementUpdatedAssignedStudentsModalApplied-2/svg-4g5ull6oa2";
import imgUserAvatar from "@/imports/SafetyCatchCreateNewSubjectModuleFlow-2/9725b9588595ed588e8b73b3958f8e9f139d0e59.png";
import imgBrandLogo from "@/imports/image.png";
import { NewsPublisherView } from "./components/news-publisher";
import { SystemAnalyticsView } from "./components/system-analytics";
import { ContentVaultRedesigned } from "./components/content-vault";
import { UserManagementRedesigned } from "./components/user-management";
import { AssignmentsView } from "./components/assignments";
import { useAuth } from '@/app/auth/AuthContext';
import { supabase } from '@/lib/supabase';
import { LogOut } from 'lucide-react';
import { ProfileEditor } from "@/components/ProfileEditor";

type View = "contentVault" | "userManagement" | "assignments" | "newsPublisher" | "systemAnalytics";

export default function App() {
  const [currentView, setCurrentView] = useState<View>("contentVault");
  const [selectedTrainer, setSelectedTrainer] = useState<string>("");
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set(["cyber"]));

  const { user } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [fullName, setFullName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single();
      if (data?.full_name) setFullName(data.full_name);
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    })();
  }, [user]);

  const toggleCourse = (courseId: string) => {
    const newExpanded = new Set(expandedCourses);
    if (newExpanded.has(courseId)) {
      newExpanded.delete(courseId);
    } else {
      newExpanded.add(courseId);
    }
    setExpandedCourses(newExpanded);
  };

  const toggleStudent = (studentId: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="h-screen w-full bg-[#f5f5f7] font-['Inter'] antialiased overflow-hidden flex flex-col">
      {/* Top Navigation Bar */}
      <div className="backdrop-blur-[6px] bg-[#f3f3f5] drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)] h-[64px] border-b border-[#c4c6ce] sticky top-0 z-50">
        <div className="flex items-center justify-between h-full px-10">
          {/* Logo */}
          <a href="#" aria-label="SafetyCatch home" className="flex items-center focus:outline-none focus:ring-2 focus:ring-[#4493bf] focus:ring-offset-2 rounded">
            <img src={imgBrandLogo} alt="SafetyCatch" className="h-9 w-auto object-contain" />
          </a>

          {/* Navigation Links */}
          <div className="absolute left-1/2 -translate-x-1/2 backdrop-blur-[20px] bg-[rgba(255,255,255,0.8)] rounded-full shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] border border-[rgba(255,255,255,0.2)]">
            <div className="relative flex gap-1 p-[5px] backdrop-blur-2xl bg-[rgba(255,255,255,0.35)] rounded-full border border-[rgba(255,255,255,0.45)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_8px_24px_rgba(13,37,67,0.08)] before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-b before:from-[rgba(255,255,255,0.45)] before:to-[rgba(255,255,255,0)] before:pointer-events-none">
              {([
                { id: "contentVault", label: "Content Vault" },
                { id: "userManagement", label: "User Management" },
                { id: "assignments", label: "Assignments" },
                { id: "newsPublisher", label: "News Publisher" },
                { id: "systemAnalytics", label: "System Analytics" },
              ] as const).map((tab) => {
                const isActive = currentView === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setCurrentView(tab.id)}
                    className={`relative z-10 px-6 py-2 rounded-full font-['Inter'] font-medium text-sm tracking-[0.14px] whitespace-nowrap transition-all duration-300 ease-out backdrop-blur-md ${
                      isActive
                        ? "bg-[rgba(13,37,67,0.85)] text-white font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_4px_14px_rgba(13,37,67,0.35)] border border-[rgba(255,255,255,0.18)]"
                        : "text-[#0d2543] border border-transparent hover:bg-[rgba(255,255,255,0.55)] hover:border-[rgba(255,255,255,0.6)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] active:bg-[rgba(255,255,255,0.75)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Trailing Actions */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="focus:outline-none focus:ring-2 focus:ring-[#4493bf] focus:ring-offset-2 rounded-full"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Admin profile"
                    className="size-9 rounded-full object-cover border-2 border-white shadow-[0px_1px_2px_rgba(0,0,0,0.08)]"
                  />
                ) : (
                  <div className="size-9 rounded-full bg-[#0d2543] text-white flex items-center justify-center text-sm font-semibold border-2 border-white shadow-[0px_1px_2px_rgba(0,0,0,0.08)]">
                    {(fullName || "A").split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                )}
              </button>
              
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-[rgba(13,37,67,0.1)] rounded-xl shadow-lg z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#f0f0f2]">
                      <div className="font-['Inter'] font-semibold text-sm text-[#0d2543] truncate">
                        {fullName || user?.user_metadata?.full_name || "Administrator"}
                      </div>
                      <div className="font-['Inter'] text-xs text-[#74777E] truncate mt-0.5">
                        {user?.email || "admin@example.com"}
                      </div>
                    </div>
                    <div className="p-1">
                      <button
                        onClick={() => { setProfileOpen(false); setProfileEditorOpen(true); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#0d2543] hover:bg-[#f3f3f5] rounded-lg font-['Inter'] font-medium transition-colors duration-150"
                      >
                        <Pencil className="size-4" />
                        Edit Profile
                      </button>
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#c0392b] hover:bg-[#FDECEA] rounded-lg font-['Inter'] font-medium transition-colors duration-150"
                      >
                        <LogOut className="size-4" />
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-10">
        {currentView === "contentVault" && <ContentVaultRedesigned />}
        {currentView === "userManagement" && <UserManagementRedesigned />}
        {currentView === "assignments" && <AssignmentsView />}
        {currentView === "newsPublisher" && <NewsPublisherView />}
        {currentView === "systemAnalytics" && <SystemAnalyticsView />}
      </div>
      <ProfileEditor
        open={profileEditorOpen}
        onClose={() => setProfileEditorOpen(false)}
        currentName={fullName || (user?.user_metadata?.full_name as string) || "Administrator"}
        currentAvatarUrl={avatarUrl}
        onSaved={(newName, newAvatar) => {
          setFullName(newName);
          setAvatarUrl(newAvatar);
        }}
      />
    </div>
  );
}

function ContentVaultView({
  expandedCourses,
  toggleCourse,
}: {
  expandedCourses: Set<string>;
  toggleCourse: (id: string) => void;
}) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="grid grid-cols-12 gap-6">
        {/* Left Panel - Course List */}
        <div className="col-span-7 bg-white rounded-xl shadow-[0px_1px_1px_rgba(0,0,0,0.05)] p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-['Inter'] font-semibold text-[#0d2543]">All Courses</h2>
            <button className="bg-[#00658d] hover:bg-[#004d6b] active:bg-[#003d54] disabled:bg-[#c4c6ce] disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-full font-['Inter'] font-medium text-sm tracking-[0.14px] shadow-[0px_1px_1px_rgba(0,0,0,0.05)] flex items-center gap-2 transition-all duration-200 focus:ring-2 focus:ring-[#00658d] focus:ring-offset-2">
              <svg className="size-[10.5px]" fill="none" viewBox="0 0 10.5 10.5">
                <path d={svgPaths1.p38ac19c0} fill="white" />
              </svg>
              Create New Course
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-[#f0f0f2] border border-[#c4c6ce] rounded-lg px-4 pr-10 py-2.5 font-['Inter'] font-medium text-sm text-[#1a1c1d] cursor-pointer hover:bg-[#e8e8ea] focus:ring-2 focus:ring-[#4493bf] focus:border-[#4493bf] transition-all duration-200 appearance-none"
              >
                <option value="all">All Types</option>
                <option value="video">Video</option>
                <option value="ppt">PPT</option>
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 size-2.5 pointer-events-none" fill="none" viewBox="0 0 10 5">
                <path d="M5 5L0 0H10L5 5V5" fill="#74777E" />
              </svg>
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#f0f0f2] border border-[#c4c6ce] rounded-lg px-4 pr-10 py-2.5 font-['Inter'] font-medium text-sm text-[#1a1c1d] cursor-pointer hover:bg-[#e8e8ea] focus:ring-2 focus:ring-[#4493bf] focus:border-[#4493bf] transition-all duration-200 appearance-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 size-2.5 pointer-events-none" fill="none" viewBox="0 0 10 5">
                <path d="M5 5L0 0H10L5 5V5" fill="#74777E" />
              </svg>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e2e2e4]">
                  <th className="text-left font-['Inter'] font-semibold text-sm text-[#44474e] tracking-[0.14px] px-2 py-4">Course Structure</th>
                  <th className="text-left font-['Inter'] font-semibold text-sm text-[#44474e] tracking-[0.14px] px-2 py-4">Type</th>
                  <th className="text-left font-['Inter'] font-semibold text-sm text-[#44474e] tracking-[0.14px] px-2 py-4">Assigned Trainer</th>
                  <th className="text-left font-['Inter'] font-semibold text-sm text-[#44474e] tracking-[0.14px] px-2 py-4">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {/* Course Row */}
                <tr className="border-b border-[#e2e2e4] bg-white hover:bg-[#fafafa] transition-colors duration-150 group">
                  <td className="px-2 py-4">
                    <button
                      onClick={() => toggleCourse("cyber")}
                      className="flex items-center gap-2 font-['Inter'] font-medium text-base text-[#1a1c1d] hover:text-[#00658d] transition-colors duration-200"
                    >
                      <svg
                        className={`size-2.5 transition-transform duration-200 ${expandedCourses.has("cyber") ? "rotate-0" : "-rotate-90"}`}
                        fill="none"
                        viewBox="0 0 9 5.55"
                      >
                        <path d={svgPaths1.p4ab6c80} fill="#74777E" />
                      </svg>
                      Cyber Security Program
                    </button>
                  </td>
                  <td className="px-2 py-4 font-['Inter'] text-base text-[#1a1c1d]">--</td>
                  <td className="px-2 py-4 font-['Inter'] text-base text-[#44474e]">--</td>
                  <td className="px-2 py-4 font-['Inter'] text-base text-[#44474e]">2 days ago</td>
                </tr>

                {/* Subject Row */}
                {expandedCourses.has("cyber") && (
                  <>
                    <tr className="border-b border-[#e2e2e4] hover:bg-[#fafafa] transition-colors duration-150">
                      <td className="px-2 py-4 pl-10">
                        <button className="flex items-center gap-2 font-['Inter'] font-medium text-base text-[#1a1c1d] hover:text-[#00658d] transition-colors duration-200">
                          <svg className="size-2.5" fill="none" viewBox="0 0 9 5.55">
                            <path d={svgPaths1.p4ab6c80} fill="#74777E" />
                          </svg>
                          Network Security
                        </button>
                      </td>
                      <td className="px-2 py-4 font-['Inter'] text-base text-[#1a1c1d]">--</td>
                      <td className="px-2 py-4 font-['Inter'] text-base text-[#44474e]">--</td>
                      <td className="px-2 py-4 font-['Inter'] text-base text-[#44474e]">2 days ago</td>
                    </tr>

                    {/* Module Row */}
                    <tr className="border-b border-l-4 border-[#e2e2e4] bg-[#f3f3f5] hover:bg-[#eeeef0] transition-colors duration-150">
                      <td className="px-2 py-4 pl-16">
                        <div className="font-['Inter'] font-medium text-base text-[#001026]">
                          Advanced Risk<br />Mitigation
                        </div>
                      </td>
                      <td className="px-2 py-7">
                        <span className="bg-[#84cffe] text-[#00587c] px-2.5 py-1 rounded-full font-['Inter'] font-semibold text-xs tracking-[0.6px] uppercase inline-flex items-center gap-1">
                          <svg className="size-[11.667px]" fill="none" viewBox="0 0 11.6667 11.6667">
                            <path d={svgPaths1.p2c97e1f0} fill="#00587C" />
                          </svg>
                          VIDEO
                        </span>
                      </td>
                      <td className="px-2 py-7 font-['Inter'] text-base text-[#44474e]">John Doe</td>
                      <td className="px-2 py-7 font-['Inter'] text-base text-[#44474e]">2 days ago</td>
                    </tr>

                    {/* Another Module */}
                    <tr className="border-b border-[#e2e2e4] hover:bg-[#fafafa] transition-colors duration-150">
                      <td className="px-2 py-5 pl-16 font-['Inter'] font-medium text-base text-[#44474e]">
                        Threat Assessment
                      </td>
                      <td className="px-2 py-5">
                        <span className="bg-[#e2e2e4] text-[#1a1c1d] px-2.5 py-1 rounded-full font-['Inter'] font-semibold text-xs tracking-[0.6px] uppercase inline-flex items-center gap-1">
                          <svg className="size-[9.333px] h-[11.667px]" fill="none" viewBox="0 0 9.33333 11.6667">
                            <path d={svgPaths1.p1cf54bc0} fill="#1A1C1D" />
                          </svg>
                          PPT
                        </span>
                      </td>
                      <td className="px-2 py-5 font-['Inter'] text-base text-[#44474e]">Sarah Smith</td>
                      <td className="px-2 py-5 font-['Inter'] text-base text-[#44474e]">5 days ago</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Panel - Module Details */}
        <div className="col-span-5 bg-white rounded-xl shadow-[0px_1px_1px_rgba(0,0,0,0.05)] p-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-['Inter'] font-semibold text-[#0d2543]">Advanced Risk Mitigation</h3>
            <button className="bg-[#f3f3f5] hover:bg-[#e8e8ea] active:bg-[#dddde0] text-[#4493bf] px-4 py-2.5 rounded-xl font-['Inter'] font-bold text-sm tracking-[0.14px] flex items-center gap-1 transition-all duration-200 focus:ring-2 focus:ring-[#4493bf] focus:ring-offset-2">
              <svg className="size-[11.667px]" fill="none" viewBox="0 0 11.6667 11.6667">
                <path d={svgPaths1.p20803d40} fill="#4493BF" />
              </svg>
              New Revision
            </button>
          </div>

          {/* Assignment Logic */}
          <div className="bg-[#f3f3f5] rounded-lg p-4 mb-6">
            <p className="font-['Inter'] font-medium text-sm text-[#44474e] tracking-[0.14px] mb-2">
              Uploads and chooses which trainer this content is<br />assigned to.
            </p>
            <div className="mt-4">
              <label className="font-['Inter'] font-medium text-base text-[#1a1c1d] mb-2 block">
                Assigned Trainers:
              </label>
              <div className="bg-white border border-[#c4c6ce] rounded-lg px-4 py-3 font-['Inter'] font-medium text-sm text-[#1a1c1d] flex items-center justify-between cursor-pointer hover:bg-[#fafafa] transition-colors duration-200">
                <span>John Doe, Sarah Smith</span>
                <svg className="size-2.5" fill="none" viewBox="0 0 10 5">
                  <path d="M5 5L0 0H10L5 5V5" fill="#74777E" />
                </svg>
              </div>
            </div>
          </div>

          {/* Version History */}
          <div className="border-t border-[#e2e2e4] pt-4">
            <h4 className="font-['Inter'] font-bold text-sm text-[#1a1c1d] tracking-[0.14px] mb-6">Version History</h4>

            <div className="relative pl-6 space-y-8">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#e2e2e4]" />

              {/* Current Version */}
              <div className="relative">
                <div className="absolute -left-[27px] top-1 size-6 bg-white border-2 border-[#00658d] rounded-full flex items-center justify-center shadow-[0px_1px_1px_rgba(0,0,0,0.05)]">
                  <div className="size-2 bg-[#00658d] rounded-full" />
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <h5 className="font-['Inter'] font-bold text-sm text-[#1a1c1d] tracking-[0.14px]">v3 (Current)</h5>
                    <p className="font-['Inter'] text-sm text-[#44474e] mt-1">Published Oct 24, 2024</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button className="px-2 py-1 rounded font-['Inter'] font-semibold text-xs text-[#4493bf] tracking-[0.6px] uppercase hover:bg-[#f3f3f5] active:bg-[#e8e8ea] transition-colors duration-200">
                      VIEW
                    </button>
                    <button className="size-4 flex items-center justify-center hover:bg-[#f3f3f5] rounded transition-colors duration-200">
                      <svg className="size-[16.667px]" fill="none" viewBox="0 0 16.6667 16.6667">
                        <path d={svgPaths1.p6e98980} fill="#1E5631" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Previous Version */}
              <div className="relative opacity-70">
                <div className="absolute -left-[27px] top-1 size-6 bg-white border-2 border-[#c4c6ce] rounded-full shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]" />
                <div className="flex items-start justify-between">
                  <div>
                    <h5 className="font-['Inter'] font-semibold text-sm text-[#44474e] tracking-[0.14px]">v2</h5>
                    <p className="font-['Inter'] text-sm text-[#44474e] mt-1">Archived Sep 12, 2024</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button className="px-2 py-1 rounded font-['Inter'] font-semibold text-xs text-[#4493bf] tracking-[0.6px] uppercase hover:bg-[#f3f3f5] active:bg-[#e8e8ea] transition-colors duration-200">
                      VIEW
                    </button>
                    <button className="px-2 py-1 rounded font-['Inter'] font-semibold text-xs text-[#4493bf] tracking-[0.6px] uppercase hover:bg-[#f3f3f5] active:bg-[#e8e8ea] transition-colors duration-200">
                      RESTORE
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserManagementView({
  selectedTrainer,
  setSelectedTrainer,
  selectedStudents,
  toggleStudent,
}: {
  selectedTrainer: string;
  setSelectedTrainer: (trainer: string) => void;
  selectedStudents: Set<string>;
  toggleStudent: (id: string) => void;
}) {
  const trainers = [
    { id: "john", name: "John Doe", role: "Senior Trainer", students: 14 },
    { id: "sarah", name: "Sarah Smith", role: "Lead Mentor", students: 8 },
    { id: "michael", name: "Michael Brown", role: "Trainer", students: 22 },
  ];

  const students = [
    { id: "alex", name: "Alex Johnson", enrolled: "Oct 24, 2024" },
    { id: "maria", name: "Maria Garcia", enrolled: "Oct 23, 2024" },
    { id: "david", name: "David Chen", enrolled: "Oct 22, 2024" },
    { id: "sarah", name: "Sarah Williams", enrolled: "Oct 21, 2024" },
  ];

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Mentor Roster */}
      <div className="bg-white rounded-xl shadow-[0px_1px_1px_rgba(0,0,0,0.05)] border border-[rgba(196,198,206,0.3)] p-8">
        <h2 className="text-xl font-['Inter'] font-semibold text-[#0d2543] mb-6">Mentor Roster</h2>

        <div className="grid grid-cols-3 gap-4">
          {trainers.map((trainer) => (
            <div key={trainer.id} className="bg-white border border-[#c4c6ce] rounded-xl p-5 shadow-[0px_1px_1px_rgba(0,0,0,0.05)] hover:shadow-[0px_2px_4px_rgba(0,0,0,0.1)] transition-all duration-200">
              <div className="mb-4">
                <h3 className="font-['Inter'] font-bold text-sm text-[#1a1c1d] tracking-[0.14px]">{trainer.name}</h3>
                <p className="font-['Inter'] text-sm text-[#44474e]">{trainer.role}</p>
              </div>

              <div className="bg-[#f3f3f5] rounded-lg p-3 mb-4">
                <p className="font-['Inter'] font-bold text-sm text-[#0d2543] tracking-[0.14px]">
                  Assigned: {trainer.students} Students
                </p>
              </div>

              <div className="border-t border-[rgba(196,198,206,0.3)] pt-2">
                <button className="w-full py-2 font-['Inter'] font-bold text-sm text-[#0d2543] tracking-[0.14px] flex items-center justify-center gap-2 hover:bg-[#f3f3f5] active:bg-[#e8e8ea] rounded-lg transition-all duration-200 focus:ring-2 focus:ring-[#4493bf] focus:ring-offset-2">
                  View Assigned Students
                  <svg className="size-2.5" fill="none" viewBox="0 0 10 6.16667">
                    <path d={svgPaths2.p3b35c180} fill="#0D2543" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Unassigned Students */}
      <div className="bg-white rounded-xl shadow-[0px_1px_1px_rgba(0,0,0,0.05)] border border-[rgba(196,198,206,0.3)] p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-['Inter'] font-semibold text-[#0d2543]">Unassigned Students</h2>
          <div className="bg-[#e8e8ea] px-3 py-1 rounded-full">
            <span className="font-['Inter'] font-bold text-xs text-[#44474e] tracking-[0.6px]">12 Total</span>
          </div>
        </div>

        {/* Assignment Controls */}
        <div className="bg-[#f3f3f5] border border-[rgba(196,198,206,0.3)] rounded-xl p-4 mb-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="font-['Inter'] font-bold text-xs text-[#44474e] tracking-[0.6px] uppercase mb-1.5 block">
                SELECT MENTOR
              </label>
              <div className="relative">
                <select
                  value={selectedTrainer}
                  onChange={(e) => setSelectedTrainer(e.target.value)}
                  className="w-full bg-white border border-[#c4c6ce] rounded-lg px-4 pr-10 py-3 font-['Inter'] font-medium text-sm text-[#1a1c1d] cursor-pointer hover:bg-[#fafafa] focus:ring-2 focus:ring-[#4493bf] focus:border-[#4493bf] transition-all duration-200 appearance-none shadow-[0px_1px_1px_rgba(0,0,0,0.05)]"
                >
                  <option value="">Choose a trainer...</option>
                  {trainers.map((trainer) => (
                    <option key={trainer.id} value={trainer.id}>
                      {trainer.name}
                    </option>
                  ))}
                </select>
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 size-3 pointer-events-none" fill="none" viewBox="0 0 12 7.4">
                  <path d={svgPaths2.p1adfde00} fill="#44474E" />
                </svg>
              </div>
            </div>
            <button
              disabled={!selectedTrainer || selectedStudents.size === 0}
              className="bg-[#0d2543] hover:bg-[#0a1d33] active:bg-[#071628] disabled:bg-[#c4c6ce] disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-['Inter'] font-bold text-base shadow-[0px_1px_1px_rgba(0,0,0,0.05)] transition-all duration-200 focus:ring-2 focus:ring-[#0d2543] focus:ring-offset-2"
            >
              Assign
            </button>
          </div>
        </div>

        {/* Student List */}
        <div className="space-y-4">
          {students.map((student) => (
            <div
              key={student.id}
              className="bg-white border border-[#c4c6ce] rounded-xl p-4 shadow-[0px_1px_1px_rgba(0,0,0,0.05)] hover:shadow-[0px_2px_4px_rgba(0,0,0,0.1)] transition-all duration-200 cursor-pointer"
              onClick={() => toggleStudent(student.id)}
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={selectedStudents.has(student.id)}
                    onChange={() => toggleStudent(student.id)}
                    className="size-5 rounded border-[#c4c6ce] text-[#0d2543] cursor-pointer focus:ring-2 focus:ring-[#4493bf] focus:ring-offset-2 transition-all duration-200 hover:border-[#4493bf]"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="flex-1">
                  <h4 className="font-['Inter'] font-bold text-sm text-[#1a1c1d] tracking-[0.14px]">{student.name}</h4>
                  <p className="font-['Inter'] text-sm text-[#44474e]">Enrolled: {student.enrolled}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
