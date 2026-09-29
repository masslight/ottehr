// The contracts the Easy Chart executor runs against. Everything outside it (catalogues, the chart
// writer, the provider's picks) is an interface, so a plan can be executed against fakes in tests and in
// the eval harness.

import { ExamLeaf } from 'utils/lib/config-helpers/exam-leaves';
import { ActionKind, ActionOfKind } from 'utils/lib/easy-chart/actions';
import { PlannedAction } from 'utils/lib/easy-chart/api';
import { NoteChartKey } from 'utils/lib/easy-chart/note-fields';
import {
  AllChartValues,
  AllChartValuesKeys,
  CPTCodeDTO,
  ExamObservationDTO,
  FreeTextNoteDTO,
  SaveableDTO,
} from 'utils/lib/types/api/chart-data/chart-data.types';

/** Every step ends in one of these; a step that ends silently reads as "there was nothing to chart". */
export interface StepOutcome {
  status: 'applied' | 'skipped' | 'failed';
  /** Required for skipped and failed, and written for a provider to read. */
  reason?: string;
  /** Ids of the rows this step created. */
  createdResourceIds?: string[];
  /** The step wrote something inferred, or auto-picked from several near-equal matches. */
  lowConfidence?: boolean;
  /** Shown next to an applied row ("auto-picked from 3 matches — verify"). */
  note?: string;
  /** The catalogue entry the action resolved to, which can differ from what was said. */
  matchedId?: string;
}

export const applied = (createdResourceIds: string[] = [], extra: Partial<StepOutcome> = {}): StepOutcome => ({
  status: 'applied',
  createdResourceIds,
  ...extra,
});
export const skipped = (reason: string, extra: Partial<StepOutcome> = {}): StepOutcome => ({
  status: 'skipped',
  reason,
  ...extra,
});
export const failed = (reason: string): StepOutcome => ({ status: 'failed', reason });

export interface CatalogueMatch {
  id: string;
  display: string;
  /** Relative score: only the ordering and the ratio between the top two are meaningful. */
  score: number;
  /** Whatever the write needs to file this row. */
  payload?: unknown;
}

export interface CatalogueQuery {
  display: string;
  searchTerms?: string[];
  /** What the visit said, for catalogues that judge candidates against the visit (medications). */
  evidence?: string;
}

/**
 * A lookup result. `[]` means the catalogue was searched and nothing matched; an unavailable result means
 * it could not be consulted, and says why.
 */
export type CatalogueResult = CatalogueMatch[] | { reason?: string } | undefined;

export const isCatalogueList = (result: CatalogueResult): result is CatalogueMatch[] => Array.isArray(result);

export interface Catalogue {
  examFindings(query: CatalogueQuery): Promise<CatalogueResult>;
  rosFindings(query: CatalogueQuery): Promise<CatalogueResult>;
  medications(query: CatalogueQuery): Promise<CatalogueResult>;
  allergies(query: CatalogueQuery): Promise<CatalogueResult>;
  surgicalHistory(query: CatalogueQuery): Promise<CatalogueResult>;
  hospitalizations(query: CatalogueQuery): Promise<CatalogueResult>;
}

/** A row already on the chart, as the executor needs it to remove or deduplicate. */
export interface ChartedItem {
  resourceId: string;
  display: string;
}

/** The save-chart-data fields that hold a list of rows, which is what a removal deletes from. */
export type ChartListField = {
  [K in AllChartValuesKeys]: NonNullable<AllChartValues[K]> extends SaveableDTO[] ? K : never;
}[AllChartValuesKeys];

/**
 * The write layer. It goes through the shared save mutation, so a signed visit refuses writes exactly as
 * the regular chart does.
 */
export interface ChartWriter {
  /** Save save-chart-data fields; returns the ids of the rows the save created. */
  save(fields: AllChartValues): Promise<string[]>;
  remove(field: ChartListField, item: ChartedItem): Promise<void>;
}

/** What is already on the chart, as the executor needs to see it. */
export interface ChartSnapshot {
  diagnoses: (ChartedItem & { code?: string; isPrimary?: boolean })[];
  examFindings: ChartedItem[];
  rosFindings: ChartedItem[];
  medications: ChartedItem[];
  allergies: ChartedItem[];
  conditions: ChartedItem[];
  surgicalHistory: ChartedItem[];
  hospitalizations: ChartedItem[];
  /**
   * Exam rows by field, which a write updates in place as the Exam tab does: ticks, modal options and the
   * cards' free-text comments, where a finding with no matching checkbox goes.
   */
  examRows: Partial<Record<string, ExamObservationDTO>>;
  /** The visit's E&M row; a second one would be billed alongside it. */
  emCode?: CPTCodeDTO;
  /** The note paragraphs by storage key, with the row id a rewrite must update. */
  noteFields: Partial<Record<NoteChartKey, FreeTextNoteDTO>>;
}

export interface PickerRequest {
  /** What the provider is choosing between, best first. */
  options: CatalogueMatch[];
  /** The wording the assistant was trying to chart. */
  query: string;
  prompt: string;
  /** A removal: the provider confirms a destructive action rather than picking an addition. */
  destructive?: boolean;
}

/** Undefined means the provider skipped rather than picked. */
export type PickerResponse = CatalogueMatch | undefined;

/** `bulk` auto-picks among near-equal matches and marks the row; `interactive` asks the provider. */
export type ExecutionMode = 'bulk' | 'interactive';

/**
 * An `add-exam-finding` whose checkbox the panel already resolved and the provider confirmed. The
 * handler ticks that leaf instead of searching again. Client-side only; never on the wire.
 */
export interface ResolvedExamFindingAction {
  resolvedLeaf?: ExamLeaf;
}

export interface HandlerContext {
  mode: ExecutionMode;
  encounterId: string;
  catalogue: Catalogue;
  writer: ChartWriter;
  chart: ChartSnapshot;
  ask(request: PickerRequest): Promise<PickerResponse>;
  /** A message for the provider instead of a write: a reply, a note, something unclassified. */
  say(text: string, kind: 'reply' | 'provider-note' | 'unknown'): void;
}

export type Handler<K extends ActionKind = ActionKind> = (
  action: ActionOfKind<K>,
  context: HandlerContext
) => Promise<StepOutcome>;

export type HandlerTable = { [K in ActionKind]: Handler<K> };

export interface PlanStep {
  index: number;
  action: PlannedAction;
  label: string;
  outcome?: StepOutcome;
}
