// One zustand store for the studio: settings (localStorage), the open report, the last run, the
// chat transcript and the inspector log. Everything the UI, the runner and the Claude tools share.
import type { FhirResource } from 'fhir/r4b';
import type { FetchStepStats, RunFetchPlanOutput } from 'utils/lib/types/adhoc/plan/fetch-plan';
import type { DateRange } from 'utils/lib/types/adhoc/query/date-range';
import { create } from 'zustand';
import type { RenderProfile } from '../../runtime/profiler';
import { DEFAULT_MODEL, Effort, ModelId } from '../llm/models';
import { convertLegacyReport, ensureTestCase } from '../report/inputs';
import { emptyReport, ReportSnapshot, StudioReport } from '../report/types';

export interface Settings {
  apiKey: string;
  model: ModelId;
  effort: Effort;
  /**
   * relay: SDK baseURL points at scripts/claude-relay.mjs (needed for this org); direct: api.anthropic.com;
   * login: the relay runs the turn with the Claude Agent SDK and the Claude Code login on this Mac (no API key).
   */
  connection: 'relay' | 'direct' | 'login';
  relayUrl: string;
  muiLicenseKey: string;
  /** Send unredacted sample resources to Claude (synthetic data only). */
  allowUnredactedSamples: boolean;
  /** The instances the header's Environment menu lists (each a local zambda server for that project). */
  environments: Environment[];
  /** The environment chosen in the header, remembered; the first in the list when unset or gone. */
  environmentName?: string;
}

export interface Environment {
  name: string;
  /** e.g. http://localhost:3005/local — zambdas are called at {base}/zambda/{name}/execute. */
  zambdaBaseUrl: string;
  /** Bearer token for the zambdas (an EHR session's access token or an M2M token). */
  accessToken: string;
  /** Real patient data: the header says so, and Claude's tools return counts and errors only. */
  production: boolean;
  /** Client id of the project's "Report Studio" app: set, the studio signs in instead of using accessToken. */
  loginClientId?: string;
  /** Login domain and audience; empty = Oystehr's defaults (instance/login.ts). */
  loginDomain?: string;
  loginAudience?: string;
  /** The project's login connection, when its EHR uses one (VITE_APP_OYSTEHR_CONNECTION_NAME). */
  loginConnection?: string;
  /** Desktop app: the EHR's own sign-in return address (e.g. https://ehr.example.com); with it, loginClientId is
   *  the EHR app's client id and the app catches the code there. */
  loginRedirectUri?: string;
}

const SETTINGS_KEY = 'reportStudio.settings.v1';

// Inside the desktop app, Claude calls go through its built-in relay (desktop/main.cjs).
const desktopRelay = (globalThis as { reportStudioDesktop?: { relayUrl: string } }).reportStudioDesktop?.relayUrl;

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: DEFAULT_MODEL,
  effort: 'high',
  connection: 'relay',
  relayUrl: desktopRelay ?? 'http://127.0.0.1:8787',
  muiLicenseKey: '',
  allowUnredactedSamples: false,
  environments: [],
};

/** Settings as saved before the environments list was the only place: a top-level instance. */
type SavedSettings = Partial<Settings> & { zambdaBaseUrl?: string; accessToken?: string };

/**
 * Saved settings → today's: the old top-level instance becomes an environment named by its host (unless an
 * environment already has its address), and the old fields are dropped.
 */
export function migrateSettings(saved: SavedSettings): Settings {
  const { zambdaBaseUrl, accessToken, ...rest } = saved;
  const settings: Settings = { ...DEFAULT_SETTINGS, ...rest };
  if (zambdaBaseUrl && !settings.environments.some((env) => env.zambdaBaseUrl === zambdaBaseUrl)) {
    const name = zambdaBaseUrl.replace(/^https?:\/\//, '').replace(/\/local\/?$/, '');
    settings.environments = [
      ...settings.environments,
      { name, zambdaBaseUrl, accessToken: accessToken ?? '', production: false },
    ];
  }
  return settings;
}

export const selectedEnvironment = (settings: Settings): Environment | undefined =>
  settings.environments.find((env) => env.name === settings.environmentName) ?? settings.environments[0];

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const saved = JSON.parse(raw) as SavedSettings;
    const settings = migrateSettings(saved);
    if ('zambdaBaseUrl' in saved || 'accessToken' in saved) persistSettings(settings);
    return settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persistSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('could not persist settings', error);
  }
}

export interface RenderResult {
  ok: boolean;
  error?: string;
  text?: string;
  profile?: RenderProfile;
  ms: number;
}

export interface RunState {
  status: 'idle' | 'fetching' | 'rendering' | 'done' | 'error';
  startedAt?: number;
  dateRange?: DateRange;
  /** The patient parameter the last fetch ran with (a code-only re-render reuses the data only for the same one). */
  patientId?: string;
  fetch?: Omit<RunFetchPlanOutput, 'resources'>;
  resources?: Record<string, FhirResource[]>;
  render?: RenderResult;
  error?: string;
}

export type InspectorKind = 'info' | 'fetch' | 'render' | 'warn' | 'error' | 'llm' | 'file';

export interface InspectorEvent {
  id: number;
  time: number;
  kind: InspectorKind;
  message: string;
  detail?: string;
}

export interface ToolBlock {
  type: 'tool';
  id: string;
  name: string;
  input: unknown;
  status: 'running' | 'done' | 'error';
  result?: string;
  ms?: number;
}

export interface ChangesBlock {
  type: 'changes';
  summary: string[];
  diffs: { label: string; patch: string }[];
  /** The report before this turn — what Undo restores. */
  before: ReportSnapshot;
  undone: boolean;
}

export type AssistantBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | ToolBlock
  | ChangesBlock
  | { type: 'notice'; tone: 'info' | 'warn' | 'error'; text: string };

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export type ChatItem =
  | { id: string; role: 'user'; text: string; attachments: string[] }
  | { id: string; role: 'assistant'; blocks: AssistantBlock[]; streaming: boolean; usage?: Usage; model?: string };

export interface FileState {
  mode: 'none' | 'folder' | 'file';
  folderName?: string;
  /** Files in the folder that hold studio reports. */
  files: { name: string; reportName: string; lastModified: number }[];
  /** The open report's file name (within the folder, or the picked file). */
  fileName?: string;
  /** The on-disk copy changed since it was loaded and the editor has unsaved changes. */
  changedOnDisk: boolean;
  dirty: boolean;
}

/** The main window: which Under-the-hood drawer is open ('report' = none); the Test window: its tabs. */
export type RightTab = 'report' | 'inputs' | 'plan' | 'code' | 'data' | 'inspector';

/** How the main window frames the report: as the EHR's Reports page, inside a visit, or narrow with no frame. */
export type ShowAs = 'reports' | 'visit' | 'narrow';
const SHOW_AS_KEY = 'reportStudio.showAs';

function loadShowAs(): ShowAs {
  try {
    const raw = sessionStorage.getItem(SHOW_AS_KEY);
    return raw === 'visit' || raw === 'narrow' ? raw : 'reports';
  } catch {
    return 'reports';
  }
}

interface StudioState {
  settings: Settings;
  setSettings: (patch: Partial<Settings>) => void;
  /** The environment chosen in the header (its name is remembered in settings): where the zambda calls go. */
  environment?: Environment;
  setEnvironment: (environment: Environment | undefined) => void;

  report: StudioReport;
  setReport: (patch: Partial<StudioReport>, opts?: { dirty?: boolean }) => void;
  replaceReport: (report: StudioReport, opts?: { fileName?: string; dirty?: boolean }) => void;
  restoreSnapshot: (snapshot: ReportSnapshot) => void;

  run: RunState;
  setRun: (patch: Partial<RunState> | ((run: RunState) => RunState)) => void;

  events: InspectorEvent[];
  addEvent: (kind: InspectorKind, message: string, detail?: string) => void;
  clearEvents: () => void;

  chat: ChatItem[];
  pushChat: (item: ChatItem) => void;
  updateAssistant: (
    id: string,
    update: (item: Extract<ChatItem, { role: 'assistant' }>) => Extract<ChatItem, { role: 'assistant' }>
  ) => void;
  clearChat: () => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;

  file: FileState;
  setFile: (patch: Partial<FileState>) => void;

  tab: RightTab;
  setTab: (tab: RightTab) => void;
  /** The test case whose input values Run uses (name); the first one after a report opens. */
  testCase?: string;
  setTestCase: (name: string | undefined) => void;
  showAs: ShowAs;
  setShowAs: (showAs: ShowAs) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  openDialog: boolean;
  setOpenDialog: (open: boolean) => void;
}

/** The report with a test case whenever it has inputs, and the active case: the current one if it still exists, else the first. */
function withTestCase(next: StudioReport, current: string | undefined): { report: StudioReport; testCase?: string } {
  const report = ensureTestCase(next);
  const testCase = report.testCases?.some((t) => t.name === current) ? current : report.testCases?.[0]?.name;
  return { report, testCase };
}

let eventSeq = 0;
const MAX_EVENTS = 400;

const initialSettings = loadSettings();

export const useStudio = create<StudioState>((set) => ({
  settings: initialSettings,
  setSettings: (patch) =>
    set((state) => {
      const settings = { ...state.settings, ...patch };
      persistSettings(settings);
      // The chosen environment follows its (possibly edited) entry; a token signed in this session stays with it.
      const next = selectedEnvironment(settings);
      const environment =
        next && state.environment?.name === next.name && !next.accessToken
          ? { ...next, accessToken: state.environment.accessToken }
          : next;
      return { settings, environment };
    }),
  environment: selectedEnvironment(initialSettings),
  setEnvironment: (environment) =>
    set((state) => {
      const settings = { ...state.settings, environmentName: environment?.name };
      persistSettings(settings);
      return { settings, environment };
    }),

  report: emptyReport(),
  setReport: (patch, opts) =>
    set((state) => ({
      ...withTestCase({ ...state.report, ...patch }, state.testCase),
      file: { ...state.file, dirty: opts?.dirty ?? true },
    })),
  replaceReport: (legacy, opts) =>
    set((state) => {
      const report = convertLegacyReport(legacy);
      return {
        ...withTestCase(report, report.testCases?.[0]?.name),
        run: { status: 'idle' },
        file: {
          ...state.file,
          // the report's own file; none for a new report, so its Save never writes over the previous report's file
          fileName: opts ? opts.fileName : state.file.fileName,
          dirty: opts?.dirty ?? false,
          changedOnDisk: false,
        },
      };
    }),
  restoreSnapshot: (snapshot) =>
    set((state) => ({
      ...withTestCase({ ...state.report, ...structuredClone(snapshot) }, state.testCase),
      file: { ...state.file, dirty: true },
    })),

  run: { status: 'idle' },
  setRun: (patch) =>
    set((state) => ({ run: typeof patch === 'function' ? patch(state.run) : { ...state.run, ...patch } })),

  events: [],
  addEvent: (kind, message, detail) =>
    set((state) => ({
      events: [...state.events.slice(-(MAX_EVENTS - 1)), { id: ++eventSeq, time: Date.now(), kind, message, detail }],
    })),
  clearEvents: () => set({ events: [] }),

  chat: [],
  pushChat: (item) => set((state) => ({ chat: [...state.chat, item] })),
  updateAssistant: (id, update) =>
    set((state) => ({
      chat: state.chat.map((item) => (item.id === id && item.role === 'assistant' ? update(item) : item)),
    })),
  clearChat: () => set({ chat: [] }),
  busy: false,
  setBusy: (busy) => set({ busy }),

  file: { mode: 'none', files: [], changedOnDisk: false, dirty: false },
  setFile: (patch) => set((state) => ({ file: { ...state.file, ...patch } })),

  tab: 'report',
  setTab: (tab) => set({ tab }),
  setTestCase: (testCase) => set({ testCase }),
  showAs: loadShowAs(),
  setShowAs: (showAs) => {
    try {
      sessionStorage.setItem(SHOW_AS_KEY, showAs);
    } catch {
      // Only a convenience: the next session starts on the Reports page.
    }
    set({ showAs });
  },
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  openDialog: false,
  setOpenDialog: (openDialog) => set({ openDialog }),
}));

/** Step stats of the last run keyed by step id (Plan tab, trim). */
export const statsById = (run: RunState): Record<string, FetchStepStats> =>
  Object.fromEntries((run.fetch?.stats ?? []).map((s) => [s.id, s]));
