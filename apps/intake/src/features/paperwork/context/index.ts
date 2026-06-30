// PagedQuestionnaire and its render tree now live in `ui-components`. The PaperworkContext type and
// the `usePaperworkContext` hook are re-exported from there so intake's many consumers (and the
// providers in PaperworkPage/StandaloneFormPage/PatientInformation) keep importing from this path
// unchanged. The context is now backed by a React context (`PaperworkProvider`) instead of the
// router outlet — providers wrap their `<Outlet/>` in `<PaperworkProvider value={ctx}>`.
export type { PaperworkContext } from 'ui-components';
export { PaperworkProvider, usePaperworkContext } from 'ui-components';
