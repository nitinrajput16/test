# Codeplat styles: design references and reusable guidance

Reviewed 2026-10-01. Use this guide when designing or reviewing Codeplat's landing page, collaborative editor, auth, profile, dashboard, admin, AI/chat or whiteboard UI. These are recommendations for Codeplat, not instructions to change backend behavior or deploy the site.

## Research basis and chosen direction

Source collection: [Awwwards UI design](https://www.awwwards.com/websites/ui-design/).

Five Awwwards detail pages, their descriptions and visual previews were inspected. They were listed as nominees at review time. Selection below reflects suitability for Codeplat, not a claim that they won an award or are the gallery's highest-rated entries. Live-site interactions, accessibility and performance were not tested. Numerical design defaults in this guide are Codeplat recommendations, not measurements of the reference sites.

Recommended combination: technical precision from Checkpoint Research and clear platform communication from ParentSquare for application screens; spacious composition from Ezera and cinematic atmosphere from Crow for the landing. Use AI Garage's developer vocabulary selectively.

## Reference patterns

| Reference | Observed design | Apply to Codeplat | Limit |
| --- | --- | --- | --- |
| [Checkpoint Research](https://www.awwwards.com/sites/checkpoint-research) | Blue technical graphics, thin construction lines, a geometric target and blueprint-like composition; its description explicitly identifies technical blueprint language. | Align panel headers and controls; use fine dividers, structured metadata and simple technical diagrams. Add faint grids to empty-state illustrations or feature diagrams. | Keep decorative grids outside Monaco, output and whiteboard drawing surfaces. Retain Codeplat lime rather than adopting the reference's blue identity. |
| [ParentSquare](https://www.awwwards.com/sites/parentsquare) | A clear central platform headline, filled/outlined actions, rounded hero imagery and pastel category labels around it. The listing describes platform clarity, human storytelling and microinteractions. | Explain shared rooms with a clear primary action; group feature cards by collaboration, AI, execution and files. Use compact labeled badges and readable onboarding steps. | Labels should identify capabilities or status; do not float decorative chips over working controls. Do not add testimonials or product claims without supplied evidence. |
| [Ezera Technologies](https://www.awwwards.com/sites/ezera-technologies) | Spacious white composition, large editorial serif lettering, pastel organic forms and a central metallic sculptural figure. The listing includes 3D and Three.js. | Give the existing city a strong focal point and generous text spacing. Use one dominant headline, one supporting paragraph and a clear action. Pastel zone accents can distinguish journey chapters. | Keep Manrope/system sans for Codeplat's operational interface. Avoid introducing sculpture, oversized serif labels or competing decorative objects into the editor. |
| [Crow](https://www.awwwards.com/sites/crow) | Dark illustrated city streets with concentrated neon pink accents and large display lettering. The listing includes scrolling, storytelling and kinetic-type elements. | Strengthen the landing city's depth, controlled lighting and chapter progression; maintain a stable card location and visible journey progress. Adapt the concentrated accent principle to lime. | No neon glow on code text, scroll hijacking inside the editor, animated backgrounds behind controls or motion required to reach sign-in. |
| [AI Garage by Bryan Oh](https://www.awwwards.com/sites/ai-garage-by-bryan-oh) | A retro computer/terminal composition, monochrome interface, playful stickers and developer-oriented interaction. The listing describes a typed terminal and a 3D project timeline. | Use monospace file paths, command examples, execution metadata and compact keyboard hints. A clearly labeled optional demo can introduce collaboration on the landing page. | Keep standard Monaco behavior. Do not require terminal commands for navigation, add scanlines to code or reproduce a retro OS shell across account/admin pages. |

Adapt hierarchy, geometry and interaction principles. Create original Codeplat artwork and copy; do not copy reference assets, logos, screenshots, source code or exact page compositions.

## Codeplat design defaults

Reuse the existing shared tokens in `public/theme/tokens.css`; avoid a second palette or hard-coded page colors.

| Role | Dark | Light |
| --- | --- | --- |
| Page | #101419 | #f2f4ed |
| Panel | #151d23 | #ffffff |
| Raised control | #1d2830 | #e8eee5 |
| Main text | #f4f5ef | #17252d |
| Muted text | #afbdc5 | #4a5d68 |
| Border | #36444d | #b9c7c9 |
| Brand accent | #d8fa72 | #4a651d |

- Use semantic success, warning and danger tokens independently of brand lime. Collaborator cursor colors must remain distinguishable from syntax colors and each other. Keep drawing colors unchanged.
- Use Manrope with system fallbacks for UI; retain the editor's monospace stack for code and technical metadata. Suggested body size: 14-16px, compact metadata: 12-13px, code: 14-16px. Large display typography belongs to the landing.
- Use a 4px base spacing system with 8, 12, 16, 24, 32 and 48px increments. Align panel headings, fields and actions to consistent edges.
- Use 6-10px control/panel radii, 1px semantic borders and restrained shadows on floating dialogs. Reserve pill shapes for small badges and presence labels.
- Maintain 44px touch targets. Compact desktop icons may have a smaller visible glyph inside a larger interactive area. Every icon-only action needs a name and a visible keyboard focus state.
- Use one primary action per task group. Secondary actions use raised surfaces; destructive actions use danger colors and existing confirmations.

## Screen recipes

### Landing and feature journey

Keep the existing three-city journey and retained product claims. Make collaboration the opening value proposition. Each chapter has one heading, one concise explanation and one action or feature label. Use stable card placement, readable contrast over the city and reversible scroll travel. Follow the journey with a clear feature grid and product preview. Show expressive motion here; provide a skip link and readable static fallback.

### Editor and collaboration

Keep the editor visually dominant. File explorer, output and collaboration panels use quiet surfaces and clear boundaries. Separate file actions from room actions, and execution actions from theme/whiteboard controls. Use a stable room identifier, textual connection status, names with presence indicators and distinct ownership/read-only labels. Keep primary Run and secondary Save identifiable. Chat and AI use readable message grouping and explicit pending/error states.

Preserve Monaco content, selection, keyboard shortcuts, OT updates, resizing, element IDs and event hooks. Do not animate editing geometry, rerun code after reconnect or replace unsaved text on load failure. At narrow widths, use the existing panel navigation and avoid fixed desktop minimum widths; allow tablet panels to stack without overlap.

### Auth, profile, dashboard and admin

Auth uses a focused card, labeled fields, clear provider actions and existing validation messages. Profile groups identity, activity, files, friends and settings by task. Dashboard/admin uses aligned records, restrained role badges and clearly associated row actions. A missing record has a useful empty state; an unavailable request shows recovery guidance rather than fabricated data. Dangerous account/admin actions retain their existing confirmation requirements.

### Whiteboard

Use the shared shell and a clearly selected tool. Preserve the white drawing canvas, stored stroke colors and coordinate mapping. Text, color, size, undo/redo and clear remain accessible. Brand styling must not recolor existing drawings or obscure selection handles.

## State and motion rules

| State | Treatment |
| --- | --- |
| Loading/saving/running | Local busy indicator and a specific label on the initiating control or panel; keep unrelated work visible. |
| Empty | Brief explanation plus an action that is already supported, such as creating a file or joining a room. |
| Success | Low-noise saved/connected confirmation; do not obscure the editor with repeated background-task toasts. |
| Validation/permission | Associate the message with its field or action; retain input and explain the existing restriction. |
| Disconnected/session expired | Textual status and available recovery/sign-in path; do not imply data has been persisted. |
| Server/network failure | Distinguish failed retrieval from compilation/runtime output. Keep user-entered content and offer an explicit retry where supported. |

Use opacity/color and small transforms for deliberate UI transitions, generally 120-220ms. Honor reduced motion. Keep GSAP responsible for journey progress/camera and Anime.js for introductory/button/icon effects; never let both animate the same property. WebGL belongs only to marketing, with capped pixel density, simpler mobile geometry and static panorama fallback. Avoid custom cursors, autoplay sound, heavy blur behind text and animations that delay access to controls.

## Applying and reviewing this guide

1. Identify the screen's primary task and choose the matching recipe above. Read its existing controls, state handling and shared tokens before editing.
2. Select a relevant reference pattern and state how it improves that task. Do not import every reference into one screen.
3. Apply the pattern through shared tokens/components; preserve existing routes, API contracts, authentication and realtime behavior.
4. Check dark/light appearance, keyboard focus, labels, reduced motion, loading/empty/error states and layouts at 390, 768 and 1440px. Check intermediate widths when changing panel geometry.
5. Verify normal-text contrast of at least 4.5:1 and interface/focus contrast of at least 3:1 where applicable. Measure the resulting composition rather than assuming the palette guarantees contrast.
6. For editor changes, verify panel navigation/resizing and that unsaved content survives failed operations. For journey changes, verify forward/reverse navigation and static fallback. Report unavailable backend or device checks honestly.

Example decisions: a landing feature section can use ParentSquare's category hierarchy and Ezera's spacing; an AI panel uses quiet technical structure and terminal-style metadata; a save failure uses a semantic error beside Save, retains code and avoids cinematic animation.

## Scope and skill use

The companion skill is `.agents/skills/codeplat-ui-styles/SKILL.md`. Invoke it with `$codeplat-ui-styles` in a Codex session opened inside this repository. Automatic selection is appropriate for Codeplat UI design requests. The guide does not authorize changing branches, modifying backend behavior, committing, pushing or deploying. Work on the user's existing `theme` branch unless they explicitly choose another branch; do not switch to main/master for this work.
