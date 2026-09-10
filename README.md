# Vibrant School

A premium landing page for an educational learning center, built around a pinned
scrollytelling hero with a real 3D camera, plus a no-code admin panel so staff
can edit every word, price and image without touching the code.

```bash
npm install
npm run dev          # http://localhost:3000
```

Admin panel: [http://localhost:3000/admin](http://localhost:3000/admin) — default
development password `admin123` (set `ADMIN_PASSWORD` before deploying).

---

## What's in here

| Area | Notes |
| --- | --- |
| Framework | Next.js 15 (App Router) + React 19 + TypeScript (strict) |
| Styling | Tailwind CSS 3.4, shadcn-style component layer (`cva` + `tailwind-merge`), Lucide icons |
| Animation | GSAP + ScrollTrigger, Lenis inertia scroll, custom Canvas 3D renderer |
| Content | File-backed JSON store (`data/site.json`), edited live from `/admin` |
| Auth | HMAC-signed httpOnly session cookie, verified in Edge middleware **and** every route handler |
| i18n | Every editable string is bilingual (`{ ru, en }`); RU/EN switcher in the header |
| Themes | Dark (default) and light, no flash on first paint |

---

## The scrollytelling hero

The hero is the piece worth reading the code for: `src/lib/scene3d.ts` and
`src/components/site/hero-scene.tsx`.

**It does not use three.js.** The scene is a few hundred flat-shaded faces driven
by a scroll timeline, so it ships as a hand-written perspective renderer on a 2D
canvas instead:

- a real orbit camera (yaw / pitch / distance / look-at target / FOV / roll),
- per-face world-space normals feeding diffuse + rim lighting,
- backface culling and painter's-algorithm depth sorting,
- additive passes for orbit rings, screen glows and dust motes,
- a per-cluster "focus" channel that brightens whatever the camera is looking at
  and fogs out the rest.

The result renders at 60fps on a phone, adds ~0 KB of dependencies, and needs no
WebGL context — which is the thing that usually fails first on low-end Android.

**How the scroll drives it.** The section is `stages × 100dvh` tall and the
viewport inside it is held by CSS `position: sticky` (not ScrollTrigger's `pin`,
which would inject a spacer and need re-measuring). ScrollTrigger scrubs a GSAP
timeline that tweens a single flat `CameraState` object; a separate render loop
on `gsap.ticker` paints whatever the latest values are. Decoupling the tween from
the paint is what keeps the camera smooth when the main thread hiccups.

Each stage crossfades its own headline, badge and CTAs, with the inner elements
settling at slightly different rates for parallax.

**Adaptivity.** `detectQuality()` reads `hardwareConcurrency`, `deviceMemory` and
viewport width to pick a render budget (desk count, sphere subdivision, particle
count, DPR cap). Under `prefers-reduced-motion` the pin and the scrub are dropped
entirely — the scene renders one static frame and the stage rail on the right
becomes clickable navigation, so all four stages stay reachable.

---

## Admin panel (`/admin`)

Eight tabs, all editing one draft in memory with a single **Save** (⌘/Ctrl+S
works, and unsaved changes warn on tab close):

- **Обзор** — counts, recent leads, a short "what to change before a cohort" list.
- **Главная** — brand, announcement bar, nav links, and the hero stages. Each
  stage exposes its **camera keyframe** as plain number fields (yaw, pitch,
  distance, FOV, roll, light direction, look-at target, exposure, per-cluster
  focus), so staff can re-aim the 3D scene without code.
- **Курсы / Менторы / Отзывы** — full CRUD with reorder, publish toggles, image
  upload (stored as data URLs, so no storage bucket is required), gradient
  picker, and a mentor multi-select on each course.
- **Методика** — stats, feature cards and process steps.
- **Заявки** — sortable/filterable table, inline status changes (optimistic, with
  rollback on failure), internal notes, and **CSV export** (UTF-8 BOM so Excel
  opens Cyrillic correctly).
- **Настройки** — form copy, footer/contacts, socials, notification channels.

Every editable string is rendered as a **RU + EN pair side by side**, so a
missing translation is impossible to overlook.

---

## Data & persistence

`src/lib/store.ts` is the only seam between the app and storage. It writes
`data/site.json` and `data/leads.json` with:

- a promise-chain mutex, so two concurrent admin saves cannot interleave,
- temp-file + rename writes, so a crash mid-write cannot truncate the file,
- a shallow merge against the shipped seed, so adding a field to the schema never
  breaks an existing file.

`data/` is gitignored and seeded from `src/lib/seed.ts` on first boot.

> **Deploying to serverless?** Serverless filesystems are ephemeral. Either point
> `VIBRANT_DATA_DIR` at a mounted volume, or reimplement the ~8 exported
> functions in `store.ts` against Supabase/Prisma — nothing else in the app knows
> where the data lives.

---

## Configuration

Copy `.env.example` to `.env.local`:

| Variable | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | Password for `/admin` (default `admin123` in dev) |
| `ADMIN_SECRET` | HMAC key for session cookies; **required** in production, ≥16 chars |
| `VIBRANT_DATA_DIR` | Where the JSON store lives (default `./data`) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Telegram lead notifications (enable the channel in Admin → Настройки) |
| `LEAD_WEBHOOK_URL` | Any endpoint receiving `{ type: "lead.created", lead }` |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for metadata |

Notifications are best-effort: a failing webhook is logged and swallowed, never
turning a successful application into an error for the student.

---

## Security

- Session cookie is httpOnly, `SameSite=Lax`, `Secure` in production, 12h TTL.
- The same Web Crypto HMAC verification runs in Edge middleware and in Node route
  handlers — one implementation, no drift. The middleware is a redirect
  convenience; **every mutating route re-checks independently.**
- Constant-time password comparison, plus in-memory login throttling (8 attempts
  / 10 min per IP).
- `ADMIN_SECRET` throws at startup in production if unset or too short.
- Admin pages are `noindex, nofollow`; `/admin` is reachable from a deliberately
  understated link in the footer.

---

## Accessibility

- Full keyboard support: focus-trapped modals with Escape and focus restoration,
  skip link, visible focus rings, `aria-current` on the hero stage rail.
- The mentors carousel is a plain scroll container — trackpad, touch, keyboard
  and screen readers all work without custom handlers.
- Live regions on toasts and the course result count; `aria-invalid` +
  `role="alert"` on form errors.
- `prefers-reduced-motion` is honoured globally and specifically in the hero.

## Responsiveness

Tested 360px → 4K. The hero's type scale is clamped against **both** `vw` and
`vh`, because a landscape phone or a short desktop window is where a width-only
scale overflows; below 520px of height the scroll hint hides and the subtitle
clamps, below 420px the hero reduces to headline plus CTAs.

---

## Project layout

```
src/
  app/
    page.tsx                  server component → reads store, hands content down
    admin/                    login + dashboard (middleware-protected)
    api/                      auth, content, leads, CSV export
  components/
    site/                     header, hero-scene, courses, methodology,
                              mentors, reviews, lead-form, footer
    admin/                    dashboard shell + per-tab editors + primitives
    ui/                       button, field, modal, icon registry
    providers/                site context, smooth scroll, toasts
  hooks/use-animations.ts     reveal, count-up, pointer tilt, media query
  lib/
    scene3d.ts                the 3D renderer
    store.ts                  JSON persistence (the storage seam)
    auth.ts                   HMAC sessions
    seed.ts                   default content
    types.ts                  content model
  middleware.ts               /admin gate
```

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm start          # serve the build
npm run typecheck  # tsc --noEmit
```

---

## The authored 3D geometry

The campus in the hero is modelled in Blender (via the Higgsfield 3D scene
builder), not generated procedurally — 180 objects, 2,976 triangles, 16
builder), not generated procedurally — 218 objects, 4,052 triangles, 20
materials: desks with laptops, chairs, mugs and notebooks; an illustrated whiteboard; a
knowledge core on a finned column with a book stack; a graduation plinth ringed
by six alumni figures; benches, shelving, planters, beacon pillars and a framed
practice zone. The repeatable Blender refinement is kept in `tools/refine-campus.py`.

**Pipeline**

```
Blender scene  ──►  GLB export  ──►  tools/glb-to-scene.mjs  ──►  public/scene/campus.json
```

```bash
node tools/glb-to-scene.mjs tools/campus.glb public/scene/campus.json
```

The scene is built in Blender through a `P(x, y, z)` mapping that accounts for
the glTF Y-up conversion, so exported node translations land **exactly** in the
app's coordinate space — the hero camera keyframes needed no retuning.

The converter drops normals, UVs and tangents (the renderer shades per face from
world-space normals it computes itself), welds vertices at 1 mm, and merges every
primitive sharing a `(cluster, material, motion)` tuple. Coplanar triangle pairs
become convex panels so screens and whiteboards sort cleanly at close range. The
433 KB GLB becomes a 115 KB JSON payload of 48 batches, so no glTF parser ships
to the browser. Each batch keeps its cluster and object-level motion metadata,
so focus highlighting and the animated knowledge core remain independent.

Loading is progressive: `createScene(quality)` paints the procedural fallback
immediately, then `loadCampus()` swaps in the authored geometry. If the fetch
fails the procedural scene simply stays — the upgrade is never a dependency.

Blender source project: `https://higgsfield.ai/3d-jutsu/343fc8b4-54b5-45b5-9163-5a883e5fa8b7`

---

## Deploying to Vercel

The app runs fully on Vercel — content edits, leads and image uploads all
persist — once a Postgres database is attached. Without one it still deploys and
serves the landing page, but nothing can be saved.

### 1. Import the repo

Vercel → **Add New → Project → Import**. The framework preset is detected; no
build-command overrides are needed.

### 2. Attach a database

Project → **Storage → Create Database → Neon (Postgres) → Connect**.

That injects `DATABASE_URL` / `POSTGRES_URL` automatically. Nothing else to do:
the schema (`site_content`, `leads`, `assets`) is created on first request with
`CREATE TABLE IF NOT EXISTS`, so there is no migration step.

Any Postgres works — Supabase, Railway, a self-hosted instance — as long as one
of `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL` or
`DATABASE_POSTGRES_URL` is set.

### 3. Environment variables

| Variable | Required | Value |
| --- | --- | --- |
| `DATABASE_URL` | for persistence | injected by the Neon integration |
| `ADMIN_SECRET` | **yes** | ≥16 random characters — the app throws without it in production |
| `ADMIN_PASSWORD` | **yes** | your admin password (never ship the default) |
| `NEXT_PUBLIC_SITE_URL` | recommended | `https://<your-domain>` |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | recommended | instant lead notifications |

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Confirm it worked

Open `/admin` and look at the banner on the Обзор tab:

- **«База данных подключена»** (green) — everything persists.
- **«Локальное файловое хранилище»** — no `DATABASE_URL`; fine locally, broken on Vercel.
- **«Хранилище недоступно»** (red) — read-only filesystem and no database.

Then change something, hit Save, and reload the public page.

### How persistence degrades

The storage layer never takes the public site down:

- **Reads never throw.** If the database is unreachable, content falls back to
  the built-in seed and the landing page still renders.
- **Writes fail loudly.** Admin saves return `503` with an explanatory toast
  rather than silently doing nothing.
- **A lead is never lost to a storage outage.** If the archive write fails, the
  submission is still delivered to Telegram/webhook and the student gets a
  success response (`{"ok":true,"stored":false}`).

---

## Storage architecture

`src/lib/store/` is the only place that knows where data lives.

```
store/
  index.ts       picks the adapter, exposes the public API
  shared.ts      StoreAdapter contract, StorageUnavailableError, buildLead
  fs-store.ts    JSON files — zero-config local development
  sql-store.ts   Postgres — used whenever a connection string is present
  schema.ts      CREATE TABLE IF NOT EXISTS, applied on first use
```

Selection is automatic: Postgres when `DATABASE_URL`/`POSTGRES_URL` is set, the
filesystem otherwise, so `npm run dev` needs no setup at all.

Leads are a single `INSERT` rather than a read-modify-write, so two students
submitting from separate serverless invocations at the same instant cannot
overwrite each other — something the JSON store could not promise.

Admin-uploaded images live in an `assets` table and are referenced by URL
(`/api/assets/<id>`, served `immutable`). They used to be inlined into the
content document as base64 data URLs, which meant every page render parsed
megabytes of it.

### Testing the SQL

```bash
npm run test:sql
```

Runs the shipped SQL against **PGlite** — real Postgres compiled to WASM — so
schema, parameter placeholders, jsonb round-trips, `bytea` encoding, `RETURNING`
clauses and concurrent inserts are all covered without provisioning a database.
Only the network driver differs in production, and that layer is two lines.

It caught two real bugs when it was written: the content version failing to
increment on the very first save, and `bytea` parameters being rejected because
every driver serializes binary differently. Binary now crosses the wire as hex
text and is converted inside Postgres with `encode`/`decode`, which is correct
on every driver.
