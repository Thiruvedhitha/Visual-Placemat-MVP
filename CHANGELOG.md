# Changelog

## [0.1.0] — 2026-04-20

### Landing Page — Full Implementation

#### What was built

A professional, interactive landing page for **Visual Placemat** — a tool to upload capability catalogs (Excel/CSV with L0–L3 hierarchical columns) and generate visual capability maps. The page is the first screen users see and provides three entry points into the application.

---

#### Files Created / Modified

| File | Purpose |
|------|---------|
| `.gitignore` | Ignores `node_modules/`, `.next/`, env files, build artifacts |
| `package.json` | Project manifest — Next.js 14, React 18, TypeScript, Tailwind CSS |
| `tsconfig.json` | TypeScript configuration with `@/*` path alias |
| `next.config.js` | Next.js configuration |
| `tailwind.config.ts` | Tailwind theme with custom brand & navy color palettes |
| `postcss.config.js` | PostCSS pipeline for Tailwind |
| `src/app/globals.css` | Global styles — Tailwind directives, Inter font, focus-visible rings, smooth scroll |
| `src/app/layout.tsx` | Root layout — wraps all pages with `<Navbar />`, sets metadata |
| `src/app/page.tsx` | Landing page — Hero, Entry Cards, Recent Maps, How It Works, Bottom CTA, Footer |
| `src/components/layout/Navbar.tsx` | Top navigation bar with capability-map logo |
| `src/components/layout/Footer.tsx` | Page footer with links and copyright |
| `src/components/ui/EntryCards.tsx` | Three "how to start" entry-point cards |
| `src/components/ui/HowItWorks.tsx` | Four-step "How it works" section with gradient badges and connector line |
| `src/components/ui/RecentDiagrams.tsx` | Recent maps quick-access section |
| `src/types/globals.d.ts` | TypeScript declaration for `.css` module imports |
| `src/app/api/*/route.ts` | Placeholder API route handlers (auth, documents, embeddings, export, graph, transform) |

---

#### Page Flow (top → bottom)

1. **Hero** — Dark gradient background, "Capability Visual Mapping" badge, headline "Turn your data into Visual Capability Maps", "See how it works" anchor link
2. **Entry Cards** — Three interactive cards: Upload Excel/CSV, Use a template, Start with AI prompt
3. **Recent Maps** — Quick-access buttons for recently created maps with color-coded dots
4. **How It Works** — Four-step guide with gradient step badges, connector line, and hover effects
5. **Bottom CTA** — "Ready to build your first diagram?" section
6. **Footer** — Copyright, Home, My Works, Privacy, Terms links

---

#### Component Breakdown

##### 1. Navbar (`src/components/layout/Navbar.tsx`)
- Sticky dark navbar with custom **hierarchical capability map logo** (SVG showing L0 header → L1 columns → L2 nested blocks with blue-to-cyan gradient and glow effect)
- **Left side**: Visual Placemat brand + logo, "Home" (active pill), "My Works" link
- **Right side**: "Sign in" button
- Fully responsive — collapses into a hamburger menu on mobile
- Accessible: `aria-label`, `aria-expanded`, focus-visible outlines

##### 2. Entry Cards (`src/components/ui/EntryCards.tsx`)
- Three cards in a responsive grid (`1 col mobile → 3 cols desktop`)
- **Upload Excel / CSV** — dashed border, light-blue accent (primary action)
- **Use a template** — clean white card with document icon
- **Start with AI prompt** — sparkle icon, white card
- Hover effects: scale-up + lift, shadow, directional arrow reveal

##### 3. How It Works (`src/components/ui/HowItWorks.tsx`)
- Four steps: Upload or describe → AI builds the map → Edit via prompts → Export & share
- Each step has a unique gradient badge (blue, violet, emerald, amber)
- Horizontal gradient connector line on desktop
- Cards lift on hover with colored accent bar at bottom
- Section header with pill badge and subtitle

##### 4. Recent Maps (`src/components/ui/RecentDiagrams.tsx`)
- Horizontal list of recent map buttons with color-coded dots
- Shows map name + relative timestamp
- Hover: border highlight, arrow slide, shadow lift

##### 5. Footer (`src/components/layout/Footer.tsx`)
- Copyright line with current year
- Navigation links: Home, My Works, Privacy, Terms

---

#### Branding

| Item | Value |
|------|-------|
| App name | **Visual Placemat** |
| Tagline | Capability Visual Mapping |
| Hero headline | Turn your data into Visual Capability Maps |
| Logo | Custom SVG — hierarchical capability map (L0/L1/L2 blocks with gradient + glow) |

---

#### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Tailwind CSS | Utility-first, zero-runtime, consistent with architecture doc |
| Custom color palette (`brand-*`, `navy-*`) | Matches the dark navbar + blue accent from the wireframe |
| Inter font | Clean professional typeface, industry standard for SaaS |
| CSS transitions over JS animation libs | Lightweight, no extra dependencies for simple hover effects |
| `"use client"` on interactive components | Required by Next.js App Router for `useState` / event handlers |
| SVG inline icons | No external icon library dependency, tree-shakeable |
| Anchor link for "See how it works" | Smooth scrolls to `#how-it-works` section with `scroll-mt-20` offset for sticky navbar |
| `.gitkeep` placeholder files retained | Keep folder structure visible in git for team onboarding |

---

#### How to Run

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).
