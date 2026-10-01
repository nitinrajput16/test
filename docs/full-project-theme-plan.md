# Codeplat theme rollout across the full project

## Goal and boundaries
Apply the landing page's charcoal surfaces, lime accents, typography, architectural identity, and restrained motion to every application screen and the visible states driven by every existing HTTP endpoint and Socket.IO feature. Keep the Express/EJS architecture, API URLs, methods, request/response formats, OAuth callbacks, session rules, database models, and realtime protocols intact. APIs return data or redirects; their consuming UI receives the theme.

Source inspected: `test-main (1).zip`. Graphics implementation remains in the standalone landing project. This document plans the full-app integration; that integration has not been performed.

## 1. Shared design system and landing integration
- Create `public/theme/tokens.css`, `components.css`, and `theme.js`: charcoal #101419 page background, #151d23 panels, #d8fa72 primary accent, off-white text, muted text, subtle borders, 4–10px control/panel radii. Define semantic success, warning, danger, disabled, focus, and presence colors separately from brand color.
- Define a corresponding light palette and synchronize the existing editor theme toggle with the app shell. Store preference under `codeplat-theme`; retain the editor's current dark default when no saved preference exists. Catch storage access failures and fall back to dark. Early theme initialization prevents a flash; never tie theme preference to a backend write.
- Provide shared classes for buttons, fields, cards, tabs, badges, file rows, tables, empty states, inline errors, toasts, dialogs, skeletons, and focus outlines. Maintain readable text contrast, 44px touch targets, and keyboard focus. Dangerous actions use a distinct danger style.
- Introduce EJS head/header/footer partials for login, signup, profile, legacy dashboard, admin, whiteboard, 404, and server-error views. The static editor loads the same tokens/components without changing its current element IDs or event hooks. Migrate embedded page-specific styling incrementally; load shared components after legacy CSS during migration, using scoped page classes rather than broad overrides.
- Keep Three.js and the pinned story only on the marketing landing page. Auth/profile screens may use a static city illustration. Editor, admin, whiteboard, and data-heavy views use lightweight CSS surfaces without WebGL rendering behind their controls. Animate only explicit UI transitions for 120–220ms; honor reduced motion everywhere.
- Keep a separate Vite build for the landing: set base `/journey/`, build into an intermediate directory, copy its generated index to `public/landing.html`, and copy assets to `public/journey/assets/`. Do not overwrite `public/index.html`, which is the authenticated editor. `/` retains its authenticated redirect to `/editor`; `/landing` continues to display the marketing page for all visitors.
- Keep existing font fallback and icons available locally; do not replace functioning editor modules or move server startup into Vite.

## 2. Page and endpoint coverage
The root router mounts dashboard and admin routers, so these endpoints are active even though they are not separately mounted in app.js.

| Existing endpoints | Themed surface and states |
|---|---|
| GET `/`, `/landing` | Marketing journey, navigation, product features, reduced-motion and WebGL fallback. Preserve authenticated root redirect. |
| GET `/login`, `/signup`, `/auth/signup` | Shared auth card, Google/GitHub actions, labeled fields, validation/error/query-message banners, preserved safe return path. |
| POST `/auth/login`, `/auth/signup` | Submitting/disabled state, validation feedback, existing redirect errors and successful navigation. Keep native form payloads and validation semantics. |
| GET `/auth/google`, `/auth/google/callback`, `/auth/github`, `/auth/github/callback` | Style provider entry buttons and existing callback-failure destination. Leave OAuth handshakes, scopes, callback URLs, and sessions untouched. |
| GET `/auth/status`, `/auth/logout` | Session indicator and logout control; expired-session feedback and existing logged-out banner. |
| GET `/editor` | Navbar, file explorer, room toolbar, presence, Monaco, AI panel, output console, chat/voice, owner controls, resize handles, menus and dialogs. Preserve Monaco selection and panel resizing. |
| GET `/whiteboard` | Consistent toolbar, room status, colors, text/shape controls, sync/loading notices. Preserve drawing canvas and coordinate mapping. |
| GET `/dashboard` | Preserve redirect to profile; no replacement page. |
| GET `/dashboard-legacy`, `/api/dashboard` | Theme legacy statistics, tables, empty activity/file states and retrieval failures. Keep existing dashboard data calculations. |
| GET `/profile`, `/profile/:key` | Profile identity, editor activity/recent files, friends, settings, account controls, navigation, missing-data and permission states. Root `/profile` remains handled by the dashboard router before the profile API router. |
| GET `/profile/check-username` | Inline checking, available/unavailable, validation and request-failure states. Preserve response shape and existing form rules. |
| PUT `/profile/update`, `/profile/credentials` | Saving/saved/error field feedback; preserve password/email checks and existing credential workflow. |
| DELETE `/profile/account` | Distinct danger card and existing confirmation/password requirements; submitting, failure and successful redirect. Do not weaken or prefill confirmation. |
| POST `/profile/friends/add`, DELETE `/profile/friends/remove` | Friend-list rows, pending action, empty list, validation/failure banner, refreshed count. |
| GET `/api/code/list`, `/api/code/load` | File/folder skeletons, empty tree, active file, load failure and retry. Avoid replacing unsaved editor content on a failed request. |
| POST `/api/code/save` | Existing autosave/manual-save indicator: saving, saved, failed, retry. Preserve beacon/background-save behavior and payloads. |
| POST `/api/code/create-folder`, `/api/code/rename`, DELETE `/api/code/delete` | Consistent dialogs and validation, pending item state, success feedback, failed action recovery. Keep existing deletion confirmation and room file-list synchronization. |
| POST `/api/code/run` | Running button, execution/output/error panels. Keep compile errors, runtime errors, stdout/stderr, and network failures distinct. Never automatically rerun code after reconnect. |
| POST `/api/ai/chat`, `/api/ai/inline` | AI panel input/loading/error/retry, completion hint style, accept/dismiss keyboard hints. Preserve streaming/completion behavior used by the current clients; keep inline completion visually separate from entered code. |
| POST `/api/ai/debug-inline` | Development-only endpoint; retain conditional registration. No new production navigation or exposure. Style diagnostics only in an existing development UI if present. |
| POST `/api/editor/activity`, GET `/api/editor/today` | Low-noise activity/time counters, loading and unavailable state. An activity-reporting error must not interrupt editing. |
| GET `/admin` | Shared admin shell, user/file/session tables, role badges, searches and empty/loading/error states. Preserve ensureAdmin gate. |
| POST `/admin/user/:id/role`, `/admin/user/:id/delete`, `/admin/file/:id/delete`, `/admin/session/:id/delete` | Pending buttons, existing confirmations, success/error feedback after server redirect. Preserve target identifiers and authorization. |
| Unknown routes and error middleware | Consistent 404 and error pages, return navigation, readable message, existing HTTP status. Do not add stack traces outside development. |

Use existing fetch/form call sites rather than introducing endpoint aliases. The shared presentation helper should display errors from current `error` or `message` fields, existing redirect messages, or a safe generic fallback. Handle non-JSON rate-limit text, network failure, and expired-session redirects without throwing an uncaught JSON parse error. Keep output and server messages as text, not injected markup. Local loading state belongs to the initiating control; do not hide unrelated panels.

## 3. Realtime coverage and implementation sequence
- Theme connection/reconnection status, create/join/leave-room feedback and ownership badges. Cover `create-room`, `join-room`, `leave-room`, `room-settings`, `room-grant-edit`, `room-revoke-edit`, `room-kick`, and `room-block` without changing event names or permission logic.
- Apply consistent presence colors and indicators for active files, cursor/caret/selection events, OT state sync/reset/operation, and file-list changes. Keep OT revision handling and Monaco decorations intact; never animate the actual editing surface or modify document state for a visual transition.
- Theme chat history/message/clear states, voice join/leave/mute and connection failures. Preserve WebRTC offer/answer/ICE handling and microphone authorization workflow.
- Theme all whiteboard tool and synchronization states, including stroke, shape, text, update, overwrite, clear, and sync-request events. Do not replace stored color values with brand colors or recolor existing drawings.
- Sequence: shared tokens/components → integrated marketing build → auth and error pages → profile/friends/settings → editor shell and API states → whiteboard/chat/voice/owner controls → legacy dashboard/admin → remove obsolete page-level overrides after visual parity.
- Implement page by page behind a presentation-only `CODEPLAT_THEME_V2` flag. Expose the flag as res.locals.themeV2 for EJS. For the static editor and marketing routes, retain legacy HTML copies and select the legacy or v2 HTML file in the existing route handlers based on the same flag. Do not add a configuration API or change response schemas. Default off until staging acceptance, then on after verification. Keep the legacy assets during rollout; rollback switches the presentation flag and restores the previous landing asset references.

## 4. Validation and delivery
- Use an isolated copy of the uploaded project with development MongoDB and test users. The server exits without MONGODB_URI; do not use the deployed production account/database for testing. OAuth and external AI/Judge0 integrations require configured test credentials; report unavailable integrations rather than fabricating results.
- Establish baseline request methods, payloads, status codes, redirect destinations, auth gates, and Socket.IO names before visual changes. Verify they remain identical afterwards.
- Validate every row in the endpoint table with success, empty and applicable failure states: validation errors, unauthenticated/unauthorized access, conflicts where supported, non-JSON 429 responses, server failure and network loss. Use seeded disposable test files/accounts for destructive operations.
- Test keyboard navigation, focus returning from dialogs, labels and aria-live status, contrast, reduced motion, dark/light persistence, responsive layouts at 390px/768px/1440px, and preserved editor/whiteboard resize behavior.
- Use two authenticated test clients for room joining, edits/OT, presence, files, ownership changes, chat, reconnect and whiteboard sync. Check no document loss or event regressions. Test voice with supported microphone devices when available.
- Verify landing production build, protected-page routing, static asset paths, unchanged OAuth callbacks, no browser console errors, no Three.js bundle loaded on editor/admin pages, and acceptable mobile performance.
- Deliver the integrated source and deployment instructions only after these gates. This planning phase delivers this endpoint inventory and implementation sequence; full-app theme changes and deployment require the subsequent implementation step.

