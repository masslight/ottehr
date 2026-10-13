// One zustand store for the studio: settings (localStorage), the open report, the last run, the
// chat transcript and the inspector log. Everything the UI, the runner and the Claude tools share.
import type { FhirResource } from 'fhir/r4b';
import type { FetchStepStats, RunFetchPlanOutput } from 'utils/lib/types/adhoc/plan/fetch-plan';
import type { DateRange } from 'utils/lib/types/adhoc/query/date-range';
import { create } from 'zustand';
import type { RenderProfile } from '../../runtime/profiler';
import { DEFAULT_MODEL, Effort, ModelId } from '../llm/models';
import { emptyReport, ReportSnapshot, StudioReport } from '../report/types';

export interface Settings {
  apiKey: string;
  model: ModelId;
  effort: Effort;
  /** relay: SDK baseURL points at scripts/claude-relay.mjs (needed for this org); direct: api.anthropic.com. */
  connection: 'relay' | 'direct';
  relayUrl: string;
  /** e.g. http://localhost:3005/local — zambdas are called at {base}/zambda/{name}/execute. */
  zambdaBaseUrl: string;
  /** Bearer token for the zambdas (an EHR session's access token or an M2M token). */
  accessToken: string;
  muiLicenseKey: string;
  /** Send unredacted sample resources to Claude (synthetic data only). */
  allowUnredactedSamples: boolean;
}

const SETTINGS_KEY = 'reportStudio.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: DEFAULT_MODEL,
  effort: 'high',
  connection: 'relay',
  relayUrl: 'http://127.0.0.1:8787',
  zambdaBaseUrl: 'http://localhost:3005/local',
  accessToken: '',
  muiLicenseKey: '',
  allowUnredactedSamples: false,
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
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

export type RightTab = 'report' | 'plan' | 'code' | 'data';

interface StudioState {
  settings: Settings;
  setSettings: (patch: Partial<Settings>) => void;

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
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  openDialog: boolean;
  setOpenDialog: (open: boolean) => void;
}

let eventSeq = 0;
const MAX_EVENTS = 400;

export const useStudio = create<StudioState>((set) => ({
  settings: loadSettings(),
  setSettings: (patch) =>
    set((state) => {
      const settings = { ...state.settings, ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch (error) {
        console.error('could not persist settings', error);
      }
      return { settings };
    }),

  report: emptyReport(),
  setReport: (patch, opts) =>
    set((state) => ({
      report: { ...state.report, ...patch },
      file: { ...state.file, dirty: opts?.dirty ?? true },
    })),
  replaceReport: (report, opts) =>
    set((state) => ({
      report,
      run: { status: 'idle' },
      file: {
        ...state.file,
        fileName: opts?.fileName ?? state.file.fileName,
        dirty: opts?.dirty ?? false,
        changedOnDisk: false,
      },
    })),
  restoreSnapshot: (snapshot) =>
    set((state) => ({
      report: { ...state.report, ...structuredClone(snapshot) },
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
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  openDialog: false,
  setOpenDialog: (openDialog) => set({ openDialog }),
}));

/** Step stats of the last run keyed by step id (Plan tab, trim). */
export const statsById = (run: RunState): Record<string, FetchStepStats> =>
  Object.fromEntries((run.fetch?.stats ?? []).map((s) => [s.id, s]));
