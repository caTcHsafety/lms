# SafetyCatch — Enterprise Learning Management System

A role-based learning management platform built for safety training organizations. Enables administrators to manage courses, trainers to deliver content, mentors to evaluate student work, and students to complete structured learning programs.

## Tech Stack

- **Frontend:** React 18 + TypeScript, Vite 6.3
- **Styling:** Tailwind CSS 4, shadcn/ui (Radix Primitives), Lucide Icons
- **Routing:** React Router 7 (role-based portals)
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions, RLS)
- **Object Storage:** Cloudflare R2 (SCORM packages, videos)
- **Offline:** IndexedDB, Cache API, Service Worker (PWA)
- **Charts:** Recharts

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
pnpm install
```

### Environment Variables

Create a `.env` file in the root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Development

```bash
pnpm dev
```

### Production Build

```bash
pnpm build
pnpm preview  # preview the build locally
```

## Project Structure

```
src/
├── app/
│   ├── admin/        # Admin portal (content, users, analytics)
│   ├── auth/         # Authentication (login, password reset)
│   ├── mentor/       # Mentor portal (evaluation, roster)
│   ├── student/      # Student portal (courses, assignments)
│   ├── trainer/      # Trainer portal (content delivery)
│   └── components/   # Shared UI primitives (shadcn/ui)
├── assets/           # Static assets (login brochure images)
├── components/       # Shared app components
├── hooks/            # Custom React hooks
├── imports/          # Figma-exported assets (logos, SVGs)
├── lib/              # Utilities (Supabase client, uploaders, offline)
├── styles/           # Global CSS, Tailwind, theme
└── types/            # TypeScript type definitions
```

## Roles

| Role | Access |
|------|--------|
| Admin | Full CRUD — courses, users, cohorts, broadcasts, analytics |
| Trainer | Content delivery, SCORM/iSpring presentations |
| Mentor | Grade submissions, monitor student progress |
| Student | Consume courses, submit assignments, offline learning |

## Key Features

- SCORM/iSpring content integration with fullscreen presentation
- Offline-first PWA for field/remote learning
- Cohort-based enrollment with granular access control
- Real-time compliance tracking via broadcast acknowledgements
- Mentor-student evaluation workflow
- Comprehensive analytics dashboard

## Deployment

This app builds to static files and can be deployed to any static hosting:
- Vercel
- Netlify
- Cloudflare Pages
- AWS S3 + CloudFront

The `dist/` folder after `pnpm build` contains the deployable output.

## License

Private — SafetyCatch Enterprise
