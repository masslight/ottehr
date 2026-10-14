# Report Studio

A standalone tool for building and iterating on sophisticated ad hoc reports against an Ottehr instance, conversationally with Claude. It prototypes the ad hoc reporting redesign (`documents/adhoc-report-redesign-design.html`): an AI writes a **fetch plan** (which FHIR searches to run), a thin generic zambda runs it, and the **report code** runs in a sandboxed iframe directly on the fetched FHIR resources with helpers from a data map. The studio shows the plan with per-step timings, the code, the fetched data, and an inspector of everything that happens — and Claude runs its own work against the instance and fixes what it finds before reporting back.

Sibling of Form Studio (`apps/form-studio`): same packaging (one self-contained HTML file), same Claude setup, same file handling.

## Build and run

```bash
npm install                                  # from the repo root (adds @anthropic-ai/sdk 0.133, codemirror, diff, vite-plugin-singlefile)
cd apps/report-studio
npm run build                                # tsc + vite → dist/index.html (one ~4.7 MB file; double-click it)
npm run dev                                  # or a dev server on http://localhost:4124
node scripts/shot.mjs out.png                # headless screenshot of the built file (Playwright)
```

Data access is **zambdas only** (never FHIR from the browser). The studio needs:

1. **A zambda server for the instance.** Default target is synth through the local server, on a port of its own so it never collides with the interactive dev server on 3000:
   ```bash
   cd packages/zambdas && ENV=synth PORT=3005 npm run start
   ```
   (the gitignored `packages/zambdas/.env/synth.json` and `zambda-secrets-synth.json` must exist in this checkout — copy them from the main checkout).
2. **A bearer token** with the Administrator role: copy one from an EHR session (DevTools → Network → any zambda call → `Authorization`), or mint an M2M token. Paste it in Settings → Instance. It lives in this browser's localStorage only.
3. **Claude through the local relay.** The Masslight Anthropic org rejects browser (CORS) requests (401 "custom retention settings"), so the studio talks to a tiny zero-dependency relay that forwards to api.anthropic.com:
   ```bash
   ANTHROPIC_API_KEY=… node apps/report-studio/scripts/claude-relay.mjs 8787     # key stays in the relay's env; leave the key empty in Settings
   node apps/report-studio/scripts/claude-relay.mjs 8787                         # or paste the key in Settings and the relay forwards it
   ```
   Form Studio's relay speaks the same protocol; one relay serves both studios. "Direct from browser" remains available in Settings for orgs that allow it.

   **No API key — "Through my Claude login (this Mac)".** The third connection uses the Claude Code login on your own Mac: the relay runs each turn with the Claude Agent SDK (`scripts/claude-login.mjs`, imported lazily so the API-key modes stay dependency-free), the studio's tools are exposed to it as an in-process MCP server, and each call is forwarded to the page and executed there. Usage counts against that Claude subscription. Start the shared relay with
   ```bash
   sh ~/development/documents/form-studio/start-relay-login.sh        # installs the SDK next to the relay the first time
   ```
   (or, from this checkout, `npm install --no-save @anthropic-ai/claude-agent-sdk zod` in `apps/report-studio` and run `claude-relay.mjs` as above), then pick the mode in Settings and press **Test relay**. Works: streaming text and thinking, tool cards, model and effort, undo per turn, attachments; the conversation is resumed by SDK session id ("New conversation" forgets it). Limits: your own Mac only — anyone else still needs an API key (Anthropic's SDK docs say third-party products may not offer claude.ai login to their users without approval; this is for personal use with your own login); history lives in the SDK's session files, so switching connection mid-conversation starts a fresh context; there is no Stop in Report Studio in any mode. `scripts/e2e.mjs` runs this mode with `STUDIO_CONNECTION=login`.

Then open `dist/index.html`, press **Set up**, fill in the zambda base URL (`http://localhost:3005/local`), the token, the relay URL, pick a model and effort, and use **Test instance** / **Test relay**.

## What is real

- **`adhoc-fetch-plan` zambda** (`packages/zambdas/src/ehr/adhoc-fetch-plan/`, registered in `config/oystehr-core/zambdas.json`): runs a plan — plain searches (paged, auto-falling back to the existing async-bulk machinery), scoped searches fed by an earlier step's references (batched), `_elements` trimming, per-step timings / counts / bytes / mode / errors; independent steps run in parallel. Allowlist = the data map. Large results go to Z3 like today's reports (the local server answers inline).
- **Plan format and data map** (`packages/utils/lib/types/adhoc/plan/`): zod schema with the data-map allowlist check, template resolution (`{{start}}`, `{{end}}`), the map itself (30 resource types with Ottehr meaning, links, known search params and gaps) rendered into the prompt.
- **Sandboxed runtime** (`runtime/`): the EHR's own Report / MUI components (`apps/ehr/src/features/report-builder/runtime/scope.ts`), ECharts and Vega-Lite, the shared JSX transpiler; scope is `React, MUI, Report, resources, helpers, params`. Helpers wrap the utils helpers the EHR uses (`getInPersonVisitStatus`, `getAttendingPractitionerId`, …). A render is **profiled**: which fields the code read per resource type and per step (Plan tab "used / fetched", the Trim button sets `_elements`), and which read fields are blank on more than 80% of resources (warnings).
- **Claude loop** (`src/llm/`): `@anthropic-ai/sdk` 0.133, `client.beta.messages.stream`, adaptive thinking with summarized display, effort, top-level prompt caching, server-side refusal fallback (not for Haiku), append-only history, typed error handling, stop-reason handling before tools run. Tools: `get_report_state`, `update_report`, `run_report`, `run_fetch`, `inspect_data`, `list_saved_reports`, `get_saved_report`. Samples sent to Claude are redacted unless Settings allow otherwise.
- **UI**: chat (streaming text, thinking, tool cards with timings and expandable input/result, a "Changed: …" card per turn with diffs and **Undo**), live panel tabs Report / Plan / Code / Data, inspector strip, Settings, Open (folder, file, new, or the instance's legacy saved reports as starting points), attachments (PDF / image / text / CSV) by drop or clip.
- **Files**: reports are plain JSON (`*.report.json`, format `ottehr-report-studio/1`: name, prompt, title, dateRange, plan, code). Chrome/Edge: open a folder, save in place, the folder handle is remembered, files are polled every 2 s so edits by Claude Code show up ("changed on disk"). Other browsers: open file / download.

## What is stubbed or not done

- Report **links** (`Report.Link`, table links) only log to the inspector — there is no EHR to open.
- **Trim verification** (re-run after trimming and compare the output) is manual: press Trim, it re-runs; compare the rendered text yourself. Only single-type steps are trimmed (`_elements` applies to included resources too).
- No plan **variation timing** (e.g. `_include` vs separate step) — Claude can try alternatives with `run_fetch` and read the timings.
- No automated tests (deferred by design); `scripts/e2e.mjs` is a headless Playwright check that runs the default report against the instance and, with `STUDIO_CHAT`, one real Claude turn through the relay.
- The data map is a first pass written from today's dataset code; it has not been reviewed per feature area.
- Saving to the instance (as a FHIR Basic) is not wired — files only.
