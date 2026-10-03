# Codeplat theme branch

The existing `theme` branch now contains the v3 city landing and a shared charcoal/lime application theme. Work is local and has not been pushed or deployed. Authentication, models, API handlers, HTTP contracts and Socket.IO server protocols retain their existing implementation.

## Run

Use Node.js 22.12 or newer. From this project directory:

```sh
npm ci
npm run build:theme
npm run test:theme
npm run preview:theme
```

Open http://127.0.0.1:5175. This preview uses clearly marked sample data, local Monaco and a minimal socket fixture. Mutation requests return an explanatory 503; they cannot save files, run code, change credentials or modify accounts. It is a presentation preview, not a backend acceptance test. Preview pages: `/landing`, `/login`, `/signup`, `/editor`, `/profile`, `/profile/alex_dev`, `/dashboard-legacy`, `/admin`, `/whiteboard`, `/404-preview`, `/error-preview`. Add `?legacy=1` to application preview pages to inspect the previous presentation.

## Enable with the development backend

Copy `.env.example` to `.env`, supply a disposable development MongoDB and session secret, and configure the project's existing OAuth, AI and code-execution settings as needed. Never use the production database for destructive tests.

```sh
npm start
```

`CODEPLAT_THEME_V2=1` enables the redesign. An absent value or `0` keeps the legacy presentation. Restart Express after changing this server-side setting. The example enables the theme for local development; production defaults off until staging acceptance. Rollback uses the same flag, legacy HTML copies, and original assets. Theme preference (`codeplat-theme`) is stored only in the browser and does not write to an account endpoint.

The landing build copies generated files only to `public/landing.html` and `public/journey/assets`. Keep build dependencies installed in the build stage; the Express runtime can use the included built assets. `public/index.html` is the authenticated editor. Vite is not the backend server.

## Implementation coverage

| Area | Presentation changes |
| --- | --- |
| Marketing | Three.js instanced architecture, windows, roofs, balconies, street details and cars; reversible GSAP camera journey; Anime.js control/icon motion; preserved feature content; static panorama and reduced-motion sections. |
| Auth and errors | Shared cards, labeled native fields, OAuth entry controls, existing validation/redirect messages, focus indicators, theme toggle and return links. |
| Profile and friends | Identity, recent files/activity, friend list, profile and credential settings, account danger zone, existing ownership distinctions and confirmations. |
| Editor | Navbar, explorer, room controls, output/input/errors, Monaco theme synchronization, collaboration/AI/chat/voice surfaces, owner/presence badges, menus and resizers. Fixed inherited mobile width and tablet overlap. |
| API states | Initiating controls expose busy state; file retrieval shows a loading label; shared aria-live feedback covers session expiry, rate limits, permission errors, network failures and save success. Existing consumers retain payloads, responses and control of their own output/error panels. Text and HTML error bodies are handled safely. Background activity and inline completions stay quiet. |
| Whiteboard | Toolbar, room connection, tool selection, danger action, keyboard focus and canvas shell. Stored stroke/color values and coordinate handling remain unchanged. |
| Dashboard/admin | Shared overview, statistics, searches, records, native action forms, permission gates and empty states. No API aliases or new admin privileges. |
| Rollout | Presentation-only server flag, conditional EJS partials and retained legacy editor/landing files. WebGL bundles load only on the marketing page. |

The original route/event inventory is in `docs/full-project-theme-plan.md`. All endpoint consumers use the existing URLs and handlers. The theme helper observes requests without changing methods, credentials, payloads or response identity; it does not retry execution or mutations.

## Validation record

- Production landing build passed with isolated `/journey/assets/` output.
- 25 automated checks passed: enabled/disabled EJS rendering and browser-script syntax, admin/public-profile distinctions, blocked storage fallback, JSON/text errors, session redirects, overlapping and aborted request cleanup, asset separation, real Express root redirects and protected-editor routing with both flag values.
- Browser inspected at 390, 768 and 1440 pixels. Checked editor file navigation, readable editor/output sizing, dark/light Monaco synchronization, profile, auth fields, admin and whiteboard layouts. A failed preview run appeared in the error panel and live status. Integrated chapter navigation traveled forward and backward with changing cards/progress.
- Preview Monaco loader/worker paths corrected; no new console errors observed after the corrections. Existing external production CDN/provider dependencies remain as before.
- Source review confirms no edits to auth/API/admin/dashboard route handlers, models, middleware or realtime server files. Root routing changes only select the presentation files; its authenticated redirect remains intact.

**Staging acceptance remains pending:** no development MongoDB, seeded authenticated users, OAuth callbacks, Gemini/Judge0 credentials or microphone devices were supplied. Database success/empty/conflict paths, destructive account/admin workflows, two-client OT/presence/file/ownership/chat/whiteboard synchronization, voice, full keyboard/dialog focus audits, contrast audits and performance measurements must be tested with those services. Static/reduced-motion and WebGL-loss paths are implemented; platform-level reduced-motion/WebGL-disabled acceptance should also be performed in staging. The fixture server does not establish these results.

## Files to maintain

- `landing/`: editable city/journey source and panorama.
- `public/theme/`: tokens, application adapters, preference and UI feedback helpers.
- `src/views/partials/`: conditional theme head/header/controls.
- `src/lib/theme.js`: server presentation selection.
- `scripts/build-theme.cjs`, `preview-theme.cjs`, `theme-fixtures.cjs`: build and local review tooling.
- `tests/theme.test.cjs`: rollout and presentation regression checks.

All source changes are in the existing local `theme` checkout. No merge into `main` or `master` has occurred.
