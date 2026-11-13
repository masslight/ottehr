# Dialog gallery

Dev-only harness that mounts every EHR modal dialog in isolation (mock auth, mock network) and
screenshots it, so the dialogs can be compared side by side.

```bash
cd apps/ehr
npx vite --config dialog-gallery/vite.config.ts          # serves http://127.0.0.1:4555/dialog-gallery/index.html
node dialog-gallery/capture.mjs [id-prefix ...]          # writes shots/<id>.png, .full.png, .json
```

`capture.mjs` uses Playwright's Chromium; set `CHROMIUM_PATH` to use a preinstalled binary.

## Writing a story

One file per dialog: `stories/<group>/<Name>.story.tsx`, default-exporting `defineStory({...})`
(see `harness/story.ts` for every field, and `stories/base/` + `stories/components/` for examples).
The story id is the path under `stories/` without `.story.tsx`.

Rules:

- **Render the real component from `src/`.** Never re-create a dialog's JSX in a story — the point
  is to photograph what ships. When the dialog is inline in a larger component, render the smallest
  real exported component that contains it and open it from `play` by clicking its real trigger.
- A file with several distinct dialogs gets one story per dialog (`Foo.delete`, `Foo.edit`, ...).
- Show the dialog as a user normally meets it: populated with believable mock data, not a spinner,
  not an error state, and with no validation errors triggered.
- Never edit anything outside `dialog-gallery/stories/`.

Supplying state without `vi.mock` (this runs in a real browser):

- `mocks` — answers for non-same-origin `fetch` calls, matched by URL substring/RegExp. The Oystehr
  SDK clients are real and point at `https://mock.invalid/{fhir,project,zambda}`; a zambda call is
  answered with `{ status: 200, output: <payload> }`. Unmatched requests get an empty FHIR bundle /
  empty output and are listed in the capture output and in `window.__unmatched`.
- `setup({ queryClient })` — seed zustand stores (`useXStore.setState(...)`) and the react-query
  cache (`queryClient.setQueryData(...)`) before first render.
- `route` / `routePath` — for components that read `useParams` / `useLocation`.
- `@auth0/auth0-react` is aliased to `harness/auth0-mock.tsx` (signed-in user, token `mock-token`).
