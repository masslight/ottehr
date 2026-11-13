import type userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

export interface FetchMock {
  /** Substring or RegExp tested against the full request URL. First match wins. */
  url: string | RegExp;
  method?: string;
  /** JSON body to answer with, or a function building it from the request. */
  response: unknown | ((req: { url: string; method: string; body: any }) => unknown);
  status?: number;
}

export interface PlayContext {
  user: ReturnType<typeof userEvent.setup>;
  screen: typeof import('@testing-library/dom').screen;
  waitFor: typeof import('@testing-library/dom').waitFor;
}

export interface DialogStory {
  /** Human title shown in the gallery, e.g. "Cancel visit". */
  title: string;
  /** Repo-relative path of the file that declares the dialog's JSX. */
  source: string;
  /** What the dialog is built on: 'MUI Dialog', 'CustomDialog', 'ConfirmationDialog', 'InnerStateDialog', 'DeleteDialog', 'MUI Modal', 'MUI Drawer', ... */
  base: string;
  /** Short note on where in the product it appears. */
  where?: string;
  /** Purpose bucket: 'confirm' | 'destructive-confirm' | 'form' | 'info' | 'picker' | 'viewer' | 'other'. */
  kind: string;
  /** Initial MemoryRouter entry (default '/'). */
  route?: string;
  /** Route pattern the story is mounted under, when the component reads useParams (default '*'). */
  routePath?: string;
  /** Capture at this window size instead of 1440×900 — for dialogs that only exist at phone width. */
  viewport?: { width: number; height: number };
  mocks?: FetchMock[];
  /** Runs before first render — seed zustand stores, react-query cache, etc. */
  setup?: (ctx: { queryClient: import('@tanstack/react-query').QueryClient }) => void | Promise<void>;
  render: () => ReactElement;
  /** Runs after render — click whatever opens the dialog when it can't be opened via props. */
  play?: (ctx: PlayContext) => Promise<void>;
  /** Caveats about fidelity (mocked data, a state that was forced, ...). */
  notes?: string;
}

export const defineStory = (story: DialogStory): DialogStory => story;
