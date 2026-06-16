export type Broadcast = {
  id: string;
  title: string;
  body: string;
  from: string;
  postedAt: string;
  priority: "critical" | "standard";
  read: boolean;
};

export type DeckVersion = {
  version: string;
  date: string;
  note: string;
};

export type Deck = {
  id: string;
  code: string;
  title: string;
  program: string;
  subject: string;
  subject_id?: string;
  subject_name?: string;
  slides: number;
  durationMin: number;
  versions: DeckVersion[];
  isIspring?: boolean;
  ispringUrl?: string;
};

export const initialBroadcasts: Broadcast[] = [
  {
    id: "b1",
    title: "Updated OSHA 2026 risk matrix references — mandatory review",
    body: "All trainers must review the revised hazard matrix before Monday's sessions. Deck v3 of Advanced Risk Mitigation now incorporates the new thresholds.",
    from: "Admin · Sarah Smith",
    postedAt: "2h ago",
    priority: "critical",
    read: false,
  },
  {
    id: "b2",
    title: "New deck published: Zero-Trust Architecture v2",
    body: "An updated revision of the Zero-Trust Architecture module is now in the Vault. Please familiarize yourself before scheduling delivery.",
    from: "Admin · John Doe",
    postedAt: "Yesterday",
    priority: "standard",
    read: false,
  },
  {
    id: "b3",
    title: "Quarterly trainer sync — Friday 3pm",
    body: "Agenda includes live-ink usage analytics, learner feedback themes, and the Q3 content roadmap. Calendar invite forthcoming.",
    from: "Admin · Sarah Smith",
    postedAt: "2d ago",
    priority: "standard",
    read: true,
  },
];

export type Video = {
  id: string;
  title: string;
  durationMin: number;
  presenter: string;
  description: string;
  url?: string;
};

export type Document = {
  id: string;
  title: string;
  format: "PDF" | "DOCX" | "XLSX";
  pages: number;
  sizeMB: number;
  updated: string;
  url?: string;
};

export type TrainerKit = {
  courseCode: string;
  courseTitle: string;
  subject: string;
  assignedBy: string;
  assignedAt: string;
  summary: string;
  totalLearners: number;
  videos: Video[];
  documents: Document[];
  deckIds: string[];
};

export const decks: Deck[] = [
  {
    id: "d1",
    code: "CYB-101-M1",
    title: "Advanced Risk Mitigation",
    program: "Cyber Security Program",
    subject: "Network Security",
    slides: 42,
    durationMin: 42,
    versions: [
      { version: "v3", date: "2026-05-21", note: "Updated OSHA 2026 risk matrix references." },
      { version: "v2", date: "2026-04-08", note: "Quiz rewrite + closed-caption pass." },
      { version: "v1", date: "2026-02-14", note: "Initial publication." },
    ],
  },
  {
    id: "d2",
    code: "CYB-101-M2",
    title: "Threat Assessment Framework",
    program: "Cyber Security Program",
    subject: "Network Security",
    slides: 28,
    durationMin: 35,
    versions: [
      { version: "v2", date: "2026-05-02", note: "Added MITRE ATT&CK appendix." },
      { version: "v1", date: "2026-01-10", note: "Initial publication." },
    ],
  },
  {
    id: "d3",
    code: "CYB-101-M3",
    title: "Firewall Hardening Lab",
    program: "Cyber Security Program",
    subject: "Network Security",
    slides: 31,
    durationMin: 50,
    versions: [
      { version: "v4", date: "2026-05-15", note: "Refreshed pfSense lab walkthrough." },
      { version: "v3", date: "2026-03-22", note: "Re-recorded demo screencasts." },
      { version: "v2", date: "2026-02-01", note: "Added stateful inspection module." },
      { version: "v1", date: "2025-11-08", note: "Initial publication." },
    ],
  },
  {
    id: "d4",
    code: "CYB-101-M4",
    title: "Zero-Trust Architecture",
    program: "Cyber Security Program",
    subject: "Network Security",
    slides: 38,
    durationMin: 45,
    versions: [
      { version: "v2", date: "2026-05-19", note: "Aligned with NIST SP 800-207 rev." },
      { version: "v1", date: "2026-02-28", note: "Initial publication." },
    ],
  },
  {
    id: "d5",
    code: "OSHA-204-M1",
    title: "Worksite Walk-Through Procedures",
    program: "OSHA Compliance Essentials",
    subject: "Hazard Identification",
    slides: 24,
    durationMin: 30,
    versions: [
      { version: "v3", date: "2026-05-20", note: "New checklist template." },
      { version: "v2", date: "2026-03-10", note: "Photo library refresh." },
      { version: "v1", date: "2025-12-04", note: "Initial publication." },
    ],
  },
  {
    id: "d6",
    code: "OSHA-204-M2",
    title: "Chemical Exposure Limits",
    program: "OSHA Compliance Essentials",
    subject: "Hazard Identification",
    slides: 33,
    durationMin: 40,
    versions: [
      { version: "v2", date: "2026-04-18", note: "PEL/REL table updates." },
      { version: "v1", date: "2026-01-22", note: "Initial publication." },
    ],
  },
  {
    id: "d7",
    code: "ELC-310-M1",
    title: "Lockout / Tagout Fundamentals",
    program: "Electrical Safety Standards",
    subject: "Energy Control",
    slides: 26,
    durationMin: 35,
    versions: [
      { version: "v1", date: "2026-04-02", note: "Initial publication." },
    ],
  },
  {
    id: "d8",
    code: "FIRE-118-M1",
    title: "Extinguisher Selection & Use",
    program: "Fire Prevention & Response",
    subject: "Suppression Equipment",
    slides: 22,
    durationMin: 25,
    versions: [
      { version: "v2", date: "2026-05-05", note: "Class K examples added." },
      { version: "v1", date: "2025-10-30", note: "Initial publication." },
    ],
  },
];

export const trainerKits: TrainerKit[] = [
  {
    courseCode: "CYB-101",
    courseTitle: "Cyber Security Program",
    subject: "Network Security",
    assignedBy: "Admin · Sarah Smith",
    assignedAt: "2026-02-14",
    summary:
      "Full delivery kit for the four-module Network Security track. Covers risk mitigation, threat modeling, firewall hardening, and zero-trust architecture.",
    totalLearners: 48,
    videos: [
      {
        id: "v-cyb-1",
        title: "Trainer briefing — How to run the Risk Mitigation module",
        durationMin: 12,
        presenter: "Sarah Smith",
        description: "Walkthrough of the v3 deck flow with talking points and timing.",
      },
      {
        id: "v-cyb-2",
        title: "Demo: pfSense firewall hardening lab",
        durationMin: 18,
        presenter: "John Doe",
        description: "Pre-recorded reference for the live lab in module 3.",
      },
      {
        id: "v-cyb-3",
        title: "Case study — 2025 Acme breach post-mortem",
        durationMin: 22,
        presenter: "Priya Sharma",
        description: "Optional discussion seed for the zero-trust module.",
      },
    ],
    documents: [
      {
        id: "doc-cyb-1",
        title: "Network Security Trainer Handbook",
        format: "PDF",
        pages: 64,
        sizeMB: 4.2,
        updated: "2026-05-12",
      },
      {
        id: "doc-cyb-2",
        title: "Lab setup checklist (pfSense + VLANs)",
        format: "DOCX",
        pages: 8,
        sizeMB: 0.6,
        updated: "2026-04-30",
      },
      {
        id: "doc-cyb-3",
        title: "OSHA 2026 risk matrix reference card",
        format: "PDF",
        pages: 2,
        sizeMB: 0.4,
        updated: "2026-05-21",
      },
    ],
    deckIds: ["d1", "d2", "d3", "d4"],
  },
  {
    courseCode: "OSHA-204",
    courseTitle: "OSHA Compliance Essentials",
    subject: "Hazard Identification",
    assignedBy: "Admin · John Doe",
    assignedAt: "2026-01-08",
    summary:
      "Mandatory compliance training kit. Use in conjunction with the workplace walk-through worksheets.",
    totalLearners: 96,
    videos: [
      {
        id: "v-osha-1",
        title: "Conducting an effective walk-through",
        durationMin: 14,
        presenter: "Marcus Lee",
        description: "Field footage from a manufacturing site inspection.",
      },
      {
        id: "v-osha-2",
        title: "Reading SDS sheets at a glance",
        durationMin: 9,
        presenter: "Sarah Smith",
        description: "Companion to the Chemical Exposure Limits deck.",
      },
    ],
    documents: [
      {
        id: "doc-osha-1",
        title: "Walk-through inspection worksheet",
        format: "DOCX",
        pages: 4,
        sizeMB: 0.3,
        updated: "2026-05-20",
      },
      {
        id: "doc-osha-2",
        title: "PEL / REL exposure table 2026",
        format: "XLSX",
        pages: 12,
        sizeMB: 0.9,
        updated: "2026-04-18",
      },
      {
        id: "doc-osha-3",
        title: "OSHA Compliance Trainer Handbook",
        format: "PDF",
        pages: 48,
        sizeMB: 3.1,
        updated: "2026-03-02",
      },
    ],
    deckIds: ["d5", "d6"],
  },
  {
    courseCode: "ELC-310",
    courseTitle: "Electrical Safety Standards",
    subject: "Energy Control",
    assignedBy: "Admin · Sarah Smith",
    assignedAt: "2026-04-02",
    summary:
      "Introductory kit for lockout/tagout fundamentals. Pair with floor demonstrations where possible.",
    totalLearners: 22,
    videos: [
      {
        id: "v-elc-1",
        title: "LOTO procedure walkthrough",
        durationMin: 11,
        presenter: "Marcus Lee",
        description: "Step-by-step demonstration on a panelboard.",
      },
    ],
    documents: [
      {
        id: "doc-elc-1",
        title: "LOTO trainer notes",
        format: "PDF",
        pages: 18,
        sizeMB: 1.2,
        updated: "2026-04-02",
      },
    ],
    deckIds: ["d7"],
  },
  {
    courseCode: "FIRE-118",
    courseTitle: "Fire Prevention & Response",
    subject: "Suppression Equipment",
    assignedBy: "Admin · John Doe",
    assignedAt: "2025-10-30",
    summary:
      "Practical kit covering extinguisher classes and selection. Includes Class K updates added in v2.",
    totalLearners: 34,
    videos: [
      {
        id: "v-fire-1",
        title: "Class K extinguisher live demo",
        durationMin: 7,
        presenter: "Priya Sharma",
        description: "Kitchen fire suppression demonstration.",
      },
      {
        id: "v-fire-2",
        title: "Inspection tag walkthrough",
        durationMin: 5,
        presenter: "John Doe",
        description: "How to read and validate extinguisher service tags.",
      },
    ],
    documents: [
      {
        id: "doc-fire-1",
        title: "Extinguisher selection matrix",
        format: "PDF",
        pages: 6,
        sizeMB: 0.5,
        updated: "2026-05-05",
      },
      {
        id: "doc-fire-2",
        title: "Trainer script — Class K module",
        format: "DOCX",
        pages: 5,
        sizeMB: 0.4,
        updated: "2026-05-05",
      },
    ],
    deckIds: ["d8"],
  },
];
