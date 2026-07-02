# Visual Placemat MVP

A web app that lets you upload Excel/CSV data and automatically generate visual capability diagrams (placemats) using AI. Built with Next.js, Supabase, and OpenAI.

**Live**: https://visual-placemat-mvp.vercel.app

---

## How It's Built

### Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React + Tailwind CSS | UI components, canvas, drag & drop |
| Backend API | Next.js API Routes | Server-side logic, AI calls |
| Database | Supabase (PostgreSQL) | Store documents and diagrams |
| AI | OpenAI / Gemini | Transform data into diagrams |
| Canvas | React Flow | Interactive node-based diagrams |
| State | Zustand | Client-side state management |
| Deployment | Vercel / Render | Hosting |

### Folder Structure

```
src/
├── app/
│   ├── page.tsx              # Home page (React component)
│   ├── layout.tsx            # Root layout, wraps all pages
│   ├── globals.css           # Global styles
│   ├── (routes)/             # All page routes
│   │   ├── dashboard/        # /dashboard page
│   │   ├── documents/        # /documents page
│   │   ├── transform/        # /transform page
│   │   └── view/             # /view page
│   └── api/                  # Backend API routes (run on server)
│       ├── documents/        # POST /api/documents — save uploads
│       ├── transform/        # POST /api/transform — call OpenAI
│       ├── chat/             # POST /api/chat — AI chat
│       └── export/           # POST /api/export — export diagrams
├── components/               # Reusable React components
│   ├── canvas/               # Diagram canvas components
│   ├── layout/               # Navbar, Footer
│   └── ui/                   # Cards, modals, buttons
├── lib/                      # Shared server utilities
│   ├── db/postgres/          # Supabase database client
│   └── ai/                   # AI provider wrappers
├── stores/                   # Zustand state stores
└── types/                    # TypeScript type definitions
```

---

## Next.js vs Plain React

Plain React is only a **frontend UI library** — it runs entirely in the browser. You still need a separate backend server (Express, FastAPI, etc.) to handle databases, API keys, and server logic.

Next.js gives you **both frontend and backend in one project**:

| Feature | Plain React | Next.js |
|---|---|---|
| UI components | ✅ | ✅ |
| Routing | Manual (React Router) | Built-in (file-based) |
| Backend API | ❌ Need separate server | ✅ API Routes (`/app/api/`) |
| Server-side rendering | ❌ | ✅ |
| API key security | ❌ Exposed in browser | ✅ Hidden on server |
| Deployment | Frontend only | Full-stack, single deploy |

### In this app specifically

- **React** handles: the canvas, drag & drop, sidebar, modals, buttons
- **Next.js API routes** handle: calling OpenAI (so the API key stays secret), reading/writing to Supabase, processing Excel files

Without Next.js, you'd need a separate Express or Python server deployed somewhere else, and you'd have to manage CORS, two deployment URLs, two sets of env vars, etc.

---

## Why You Don't Need to Change API URLs After Deployment

All API calls in this app use **relative paths**:

```js
// In the frontend code
fetch('/api/transform', { method: 'POST', body: data })
fetch('/api/documents', { method: 'POST', body: data })
```

There is no hardcoded domain like `http://localhost:3000` or `https://myapp.vercel.app`. The `/` at the start means "same origin as the current page."

When the browser sees `/api/transform`, it automatically uses whichever domain it's on:

```
Running locally    →  http://localhost:3000/api/transform
Deployed on Vercel →  https://visual-placemat-mvp.vercel.app/api/transform
Deployed on Render →  https://visual-placemat.onrender.com/api/transform
```

Same code. Zero URL changes. This is one of the biggest benefits of a full-stack Next.js app — the frontend and backend are always co-located.

---

## Environment Variables

These must be set in `.env.local` locally and in Vercel/Render dashboard for production:

```
NEXT_PUBLIC_SUPABASE_URL        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   # Supabase public key (safe to expose)
SUPABASE_SERVICE_ROLE_KEY       # Supabase admin key (server-only, keep secret)
OPENAI_API_KEY                  # OpenAI API key (server-only, keep secret)
GEMINI_API_KEY                  # Google Gemini API key (server-only, keep secret)
```

`NEXT_PUBLIC_` prefix = accessible in browser code.  
No prefix = server-only, never sent to browser.

---

## Local Development

```bash
npm install
cp .env.local.example .env.local   # fill in your keys
npm run dev                         # starts at http://localhost:3000
```

## Production Build

```bash
npm run build    # compiles TypeScript, optimizes assets
npm start        # runs the production server
```

Vercel and Render run these commands automatically on every push to `main`.