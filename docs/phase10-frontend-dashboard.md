frontend/src/
├── app/
│   ├── layout.tsx              — Root layout with Providers
│   ├── page.tsx                — Redirects to /dashboard
│   ├── login/page.tsx          — Login page
│   ├── register/page.tsx       — Registration page
│   └── dashboard/
│       ├── layout.tsx          — Sidebar + AuthGuard wrapper
│       ├── page.tsx            — Overview with stats cards, bot list, recent tweets
│       ├── bots/
│       │   ├── page.tsx        — Bot grid with toggle, delete, dropdown actions
│       │   ├── new/page.tsx    — Create bot form (topics, event subscriptions, tone, etc.)
│       │   └── [id]/page.tsx   — Bot detail/edit with activity log tab
│       ├── tweets/page.tsx     — Tweet table with status/bot filters, approve action, detail dialog
│       ├── analytics/page.tsx  — Bot analytics with pie + bar charts (Recharts), metric cards
│       └── settings/page.tsx   — Profile editing, account info display
├── components/
│   ├── providers.tsx           — QueryClient + TooltipProvider + Toaster
│   ├── auth-guard.tsx          — Route protection with auto-redirect
│   ├── app-sidebar.tsx         — Collapsible sidebar with nav, user footer, logout
│   └── ui/                     — shadcn/ui components (19 components)
├── hooks/
│   ├── use-bots.ts             — CRUD + toggle mutations with cache invalidation
│   ├── use-tweets.ts           — List/approve with filters
│   └── use-analytics.ts       — Bot summary + activity queries
├── stores/
│   └── auth-store.ts           — Zustand store for auth state
├── lib/
│   ├── api.ts                  — HTTP client with JWT refresh, typed API methods
│   └── utils.ts                — shadcn cn() utility
└── types/
    └── index.ts                — Full TypeScript types matching Prisma schema