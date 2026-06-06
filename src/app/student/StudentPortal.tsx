import { useState } from "react";
import { TopBar, type View } from "./components/TopBar";
import { Dashboard } from "./components/Dashboard";
import { MyCourses } from "./components/MyCourses";
import { Assignments } from "./components/Assignments";

export default function App() {
  const [view, setView] = useState<View>("dashboard");

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f4f5f7] font-['Inter'] antialiased">
      <TopBar view={view} onChange={setView} />
      <main className="flex flex-col flex-1 overflow-y-auto min-h-0">
        {view === "dashboard" && <Dashboard onNavigate={setView} />}
        {view === "courses" && <MyCourses />}
        {view === "assignments" && <Assignments />}
      </main>
    </div>
  );
}
