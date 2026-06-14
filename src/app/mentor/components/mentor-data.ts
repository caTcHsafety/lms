export type EvalStatus = "pending" | "approved" | "needs-revision";
export type StudentStatus = "on-track" | "stalling" | "awaiting-eval";

export interface Student {
  id: string;
  name: string;
  initials: string;
  progress: number;
  lastActive: string;      // human-readable: "2h ago", "3d ago", "N/A"
  lastActiveMs: number;    // unix ms of last activity — 0 if never
  status: StudentStatus;
  daysSinceActive: number; // computed from lastActiveMs
}

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  from: string;
  postedAt: string;
  acknowledged: boolean;
  priority: "mandatory" | "info";
}

export interface Submission {
  id: string;
  studentId: string;
  studentName: string;
  studentInitials: string;
  assignment: string;
  assignmentId?: string;
  submittedAt: string;
  waitingDays: number;
  status: EvalStatus;
  fileType: "pdf" | "docx" | "google-form";
  fileName: string;
  content: string;
  answersJson?: Record<string, string> | null;
  blockJson?: any[] | null;
}

export interface ActivityEvent {
  id: string;
  studentId: string;
  timestamp: string;
  kind: "login" | "module" | "submission" | "inactivity";
  label: string;
  detail?: string;
}

export const students: Student[] = [
  { id: "s1", name: "Aarav Mehta", initials: "AM", progress: 82, lastActive: "2h ago", status: "awaiting-eval" },
  { id: "s2", name: "Priya Sharma", initials: "PS", progress: 64, lastActive: "1d ago", status: "on-track" },
  { id: "s3", name: "Diego Alvarez", initials: "DA", progress: 31, lastActive: "11d ago", status: "stalling" },
  { id: "s4", name: "Fatima Noor", initials: "FN", progress: 94, lastActive: "5h ago", status: "awaiting-eval" },
  { id: "s5", name: "Lukas Becker", initials: "LB", progress: 58, lastActive: "3d ago", status: "on-track" },
  { id: "s6", name: "Hana Suzuki", initials: "HS", progress: 22, lastActive: "14d ago", status: "stalling" },
  { id: "s7", name: "Noah Williams", initials: "NW", progress: 71, lastActive: "6h ago", status: "awaiting-eval" },
  { id: "s8", name: "Zara Khan", initials: "ZK", progress: 88, lastActive: "1d ago", status: "on-track" },
];

export const initialBroadcasts: Broadcast[] = [
  {
    id: "b1",
    title: "Updated rubric for Module 4 evaluations",
    body: "Effective immediately, the Module 4 rubric weights Hazard Identification at 35% (up from 25%). Re-read the rubric before grading any pending Module 4 submissions.",
    from: "Admin · Sandra Liu",
    postedAt: "Today, 09:14",
    acknowledged: false,
    priority: "mandatory",
  },
  {
    id: "b2",
    title: "Mandatory: Annual data-handling refresher",
    body: "All mentors must complete the data-handling refresher by Friday. Acknowledgment here does not replace the refresher itself — but you must confirm receipt.",
    from: "Admin · Compliance",
    postedAt: "Yesterday, 16:02",
    acknowledged: false,
    priority: "mandatory",
  },
  {
    id: "b3",
    title: "Holiday schedule for evaluation SLA",
    body: "Evaluation SLA pauses from May 26–28. Resume normal turnaround on May 29.",
    from: "Admin · Operations",
    postedAt: "May 18, 11:30",
    acknowledged: true,
    priority: "info",
  },
];

export const submissions: Submission[] = [
  {
    id: "sub1",
    studentId: "s1",
    studentName: "Aarav Mehta",
    studentInitials: "AM",
    assignment: "Module 4 · Hazard Assessment Report",
    submittedAt: "May 22, 14:08",
    waitingDays: 1,
    status: "pending",
    fileType: "pdf",
    fileName: "hazard-assessment-aarav.pdf",
    content:
      "Section 1 — Site Overview\n\nThe surveyed site is a mid-scale chemical storage warehouse spanning approximately 2,400 m². Storage racks reach 6.2m and house both flammable solvents and non-reactive inert materials. Operations run two shifts, with peak occupancy of 18 personnel.\n\nSection 2 — Identified Hazards\n\n1. Inadequate spacing between flammable storage zones and forklift travel paths.\n2. Eye-wash station signage occluded behind newly installed shelving.\n3. Fire suppression coverage gap above the south-east loading bay.\n\nSection 3 — Risk Ranking\n\nUsing a 5x5 likelihood-severity matrix, hazard (3) ranks highest at 20 (high-severity, moderate-likelihood). Hazards (1) and (2) rank 12 and 9 respectively.\n\nSection 4 — Recommended Controls\n\n- Re-stripe forklift paths with 1.2m buffer from flammable racking.\n- Relocate shelving away from eye-wash station; install overhead beacon.\n- Extend suppression coverage; commission within 30 days.",
  },
  {
    id: "sub2",
    studentId: "s4",
    studentName: "Fatima Noor",
    studentInitials: "FN",
    assignment: "Module 5 · Incident Response Plan",
    submittedAt: "May 22, 09:41",
    waitingDays: 1,
    status: "pending",
    fileType: "docx",
    fileName: "incident-response-fatima.docx",
    content:
      "Incident Response Plan — Draft v2\n\nPurpose: Establish a clear, repeatable response protocol for chemical-release incidents on site.\n\nScope: Applies to all warehouse personnel, contractors, and visitors. Excludes vehicular incidents outside the gated perimeter.\n\nRoles & Responsibilities:\n\n- Incident Commander (IC): on-shift supervisor.\n- Communications Lead: appointed daily.\n- Evacuation Wardens: one per zone (A–D).\n\nResponse Phases:\n\n1. Detect & Alert — sensors trigger the audible alarm; IC confirms within 60 seconds.\n2. Contain — wardens initiate zone-specific containment per Annex B.\n3. Evacuate — assembly at Point 2 (north perimeter).\n4. Notify — external authorities per the cascade in Annex C.\n5. Review — post-incident debrief within 48h.",
  },
  {
    id: "sub3",
    studentId: "s7",
    studentName: "Noah Williams",
    studentInitials: "NW",
    assignment: "Module 3 · PPE Selection Worksheet",
    submittedAt: "May 21, 18:22",
    waitingDays: 2,
    status: "pending",
    fileType: "google-form",
    fileName: "PPE Selection — Noah W. (Google Form)",
    content:
      "Q1. Identify the primary hazard category for the scenario shown.\n→ Chemical splash (correct)\n\nQ2. Select the minimum PPE set for entry into Zone B.\n→ Nitrile gloves, splash goggles, lab coat, closed-toe boots\n\nQ3. When must PPE be re-inspected during a shift?\n→ Before each entry into the controlled zone, after any visible contamination, and at shift handover.\n\nQ4. Justify your choice of glove material for Zone B.\n→ Nitrile resists the solvents catalogued in the Zone B inventory (SDS sheets 12–17), and is preferred over latex due to documented sensitivities among current staff.\n\nQ5. Open response — what would you change about the current PPE station layout?\n→ Move the glove dispenser to eye level near the airlock entrance to reduce the temptation of entering without gloves when in a rush.",
  },
];

export const activityByStudent: Record<string, ActivityEvent[]> = {
  s1: [
    { id: "a1", studentId: "s1", timestamp: "May 22, 14:08", kind: "submission", label: "Submitted Hazard Assessment Report", detail: "Module 4" },
    { id: "a2", studentId: "s1", timestamp: "May 22, 13:40", kind: "module", label: "Completed Module 4 · Lesson 6" },
    { id: "a3", studentId: "s1", timestamp: "May 22, 12:55", kind: "login", label: "Logged in" },
    { id: "a4", studentId: "s1", timestamp: "May 21, 09:12", kind: "module", label: "Completed Module 4 · Lesson 5" },
    { id: "a5", studentId: "s1", timestamp: "May 20, 17:30", kind: "login", label: "Logged in" },
  ],
  s2: [
    { id: "a6", studentId: "s2", timestamp: "May 22, 08:11", kind: "module", label: "Completed Module 3 · Lesson 4" },
    { id: "a7", studentId: "s2", timestamp: "May 21, 19:02", kind: "login", label: "Logged in" },
  ],
  s3: [
    { id: "a8", studentId: "s3", timestamp: "May 22, 10:00", kind: "inactivity", label: "Inactive for 11 days", detail: "No logins since May 11" },
    { id: "a9", studentId: "s3", timestamp: "May 11, 14:20", kind: "login", label: "Logged in" },
    { id: "a10", studentId: "s3", timestamp: "May 09, 11:05", kind: "module", label: "Completed Module 2 · Lesson 2" },
  ],
  s4: [
    { id: "a11", studentId: "s4", timestamp: "May 22, 09:41", kind: "submission", label: "Submitted Incident Response Plan", detail: "Module 5" },
    { id: "a12", studentId: "s4", timestamp: "May 22, 08:50", kind: "module", label: "Completed Module 5 · Lesson 3" },
  ],
  s5: [
    { id: "a13", studentId: "s5", timestamp: "May 20, 16:10", kind: "module", label: "Completed Module 3 · Lesson 1" },
  ],
  s6: [
    { id: "a14", studentId: "s6", timestamp: "May 22, 10:00", kind: "inactivity", label: "Inactive for 14 days", detail: "Last activity May 09" },
    { id: "a15", studentId: "s6", timestamp: "May 09, 09:00", kind: "module", label: "Completed Module 1 · Lesson 4" },
  ],
  s7: [
    { id: "a16", studentId: "s7", timestamp: "May 21, 18:22", kind: "submission", label: "Submitted PPE Selection Worksheet", detail: "Module 3" },
    { id: "a17", studentId: "s7", timestamp: "May 21, 17:40", kind: "module", label: "Completed Module 3 · Lesson 5" },
  ],
  s8: [
    { id: "a18", studentId: "s8", timestamp: "May 22, 06:30", kind: "login", label: "Logged in" },
    { id: "a19", studentId: "s8", timestamp: "May 21, 22:14", kind: "module", label: "Completed Module 5 · Lesson 7" },
  ],
};

export const submissionHistoryByStudent: Record<string, Submission[]> = {
  s1: [
    submissions[0],
    {
      ...submissions[0],
      id: "h-s1-1",
      assignment: "Module 3 · PPE Selection Worksheet",
      submittedAt: "May 14, 10:22",
      status: "approved",
      waitingDays: 0,
    },
  ],
  s4: [
    submissions[1],
    {
      ...submissions[1],
      id: "h-s4-1",
      assignment: "Module 4 · Hazard Assessment Report",
      submittedAt: "May 12, 15:08",
      status: "needs-revision",
      waitingDays: 0,
    },
  ],
  s7: [submissions[2]],
};
