// The contracts the Easy Chart executor runs against.
//
// Everything the executor touches the outside world through is an INTERFACE — the catalogue, the
// chart writer, the "ask the provider" callback. That is what makes the step machine testable
// without a model, a network, or a rendered page: given an action list, its behaviour is
// deterministic.

import { Action, ActionKind, ActionOfKind } from 'utils/lib/easy-chart/actions';
import { PlannedAction } from 'utils/lib/easy-chart/api';

/**
 * How a step ended. EVERY step must end in one of these — silent no-ops are the single worst failure
 * mode in this product, because a provider reads "nothing happened" as "there was nothing to chart".
 */
export type StepStatus = 'applied' | 'skipped' | 'failed';

export interface StepOutcome {
  status: StepStatus;
  /** Required for skipped and failed, and written to be read by a provider, not a developer. */
  reason?: string;
  /** Ids of the rows this step created, so provenance can be attached to them. */
  createdResourceIds?: string[];
  /**
   * Set when the step wrote something the model INFERRED rather than heard, or when a bulk run
   * auto-picked from several near-equal matches. Drives the amber tint and the "inferred" badge.
   */
  lowConfidence?: boolean;
  /** Extra note for the provenance record ("template default, verify", "auto-picked from 3 matches"). */
  note?: string;
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

/** One row from a searchable catalogue: exam leaves, ROS symptoms, medications, templates, … */
export interface CatalogueMatch {
  /** Stable identifier in the catalogue this came from. */
  id: string;
  display: string;
  /** Relative score; only the ordering and the ratio between the top two are meaningful. */
  score: number;
  /** Whatever the write path needs to file this row. Opaque to the executor. */
  payload?: unknown;
}

export interface CatalogueQuery {
  display: string;
  searchTerms?: string[];
}

/**
 * A catalogue that could not be consulted, with the reason a provider reads.
 *
 * Distinct from an empty result on purpose: "no lab-enabled ordering office for this visit" and "no
 * send-out lab matches 'CBC'" are different problems and a provider acts differently on each.
 */
export interface CatalogueUnavailable {
  /** Written for a provider, and it must NAME the item so a voiced order is visible, not lost. */
  reason?: string;
}

/**
 * A catalogue lookup's result.
 *
 * An array and an unavailable marker mean DIFFERENT things, and the difference reaches the provider:
 *   - `[]`          — the catalogue was searched and holds nothing matching. "No exam finding matches
 *                     'throat injected'" tells the provider to reword or chart it by hand.
 *   - unavailable   — the catalogue could not be consulted at all: a precondition is unmet, or it is
 *                     not wired up here. Saying "no allergy matches penicillin" in that case is a
 *                     lie — it implies the allergy database was consulted and came back empty, which
 *                     would send a provider looking for the wrong problem. `undefined` is shorthand
 *                     for an unavailable with no specific reason.
 */
export type CatalogueResult = CatalogueMatch[] | CatalogueUnavailable | undefined;

/** Narrowing helper: did this lookup produce a searchable list? */
export const isCatalogueList = (result: CatalogueResult): result is CatalogueMatch[] => Array.isArray(result);

/** Mark a catalogue as unconsultable, with the reason the provider reads. */
export const catalogueUnavailable = (reason?: string): CatalogueUnavailable => ({ reason });

/**
 * The catalogues the assistant resolves against. Injected so the executor can be tested against a
 * fake, and so the real matchers can be developed and unit-tested on their own.
 */
export interface Catalogue {
  examFindings(query: CatalogueQuery): Promise<CatalogueResult>;
  rosFindings(query: CatalogueQuery): Promise<CatalogueResult>;
  medications(query: CatalogueQuery): Promise<CatalogueResult>;
  allergies(query: CatalogueQuery): Promise<CatalogueResult>;
  conditions(query: CatalogueQuery): Promise<CatalogueResult>;
  surgicalHistory(query: CatalogueQuery): Promise<CatalogueResult>;
  hospitalizations(query: CatalogueQuery): Promise<CatalogueResult>;
  templates(query: CatalogueQuery): Promise<CatalogueResult>;
  procedures(query: CatalogueQuery): Promise<CatalogueResult>;
  labs(query: CatalogueQuery & { inHouse: boolean }): Promise<CatalogueResult>;
  radiology(query: CatalogueQuery): Promise<CatalogueResult>;
}

/**
 * Everything a send-out lab order needs beyond the test itself, resolved by the catalogue from the
 * encounter, its ordering office and the patient's coverage — not from the dictation. Carried in the
 * match's `payload` so the write path does not re-resolve it and cannot resolve it differently.
 */
export interface ExternalLabOrderContext {
  item: OrderableItemSearchResult;
  encounter: Encounter;
  office: ModifiedOrderingLocation;
  paymentMethod: CreateLabPaymentMethod;
}

/** A row already on the chart, in the shape the executor needs to remove or reconcile it. */
export interface ChartedItem {
  resourceId: string;
  display: string;
}

/**
 * The thin, feature-owned write layer. Everything here goes through the SHARED save mutation, so the
 * read-only rule for a signed visit applies for free — the previous implementation called the API
 * client directly and therefore bypassed that guard entirely, letting the assistant write to a
 * signed visit while the regular chart refused.
 */
export interface ChartWriter {
  /** Save chart-data fields; returns the ids of the rows the save created. */
  save(fields: Record<string, unknown>): Promise<string[]>;
  /** Delete one charted row. */
  remove(field: string, item: ChartedItem): Promise<void>;
  /**
   * Which of the non-chart-data write paths this writer can actually reach. Checked BEFORE the
   * corresponding action runs, so an unsupported one settles as `skipped` with a reason naming where
   * to do it instead — rather than throwing, which would settle it as `failed` and read to the
   * provider as "something broke". "Not supported here" and "it broke" are different facts and the
   * provider acts differently on each.
   */
  supports: {
    labOrders: boolean;
    radiologyOrders: boolean;
    nursingOrders: boolean;
    templates: boolean;
  };
  /** Endpoints that are not chart data at all. Only called when the matching `supports` flag is set. */
  orderLab(match: CatalogueMatch, inHouse: boolean): Promise<string[]>;
  /**
   * `dictatedStudyName` is what the PROVIDER said, which is what goes on the order — the catalogue
   * match supplies the CPT, and its own display is the coding system's wording, not the visit's.
   */
  orderRadiology(match: CatalogueMatch, request: { dictatedStudyName: string }): Promise<string[]>;
  createNursingOrder(text: string): Promise<string[]>;
  applyTemplate(match: CatalogueMatch): Promise<string[]>;
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
  procedures: ChartedItem[];
  cptCodes: (ChartedItem & { code?: string })[];
  hasEmCode: boolean;
}

export interface PickerRequest {
  /** What the provider is choosing between, best first. */
  options: CatalogueMatch[];
  /** The wording the assistant was trying to chart. */
  query: string;
  /** Rendered on the picker so the provider knows what accepting it does. */
  prompt: string;
  /** True for a removal: the provider is confirming a destructive action, not picking an addition. */
  destructive?: boolean;
}

/** Undefined means the provider skipped rather than picked. */
export type PickerResponse = CatalogueMatch | undefined;

/**
 * `bulk` — a whole plan is running. Several near-equal matches AUTO-PICK the top one and mark it
 * low-confidence, because a provider will not click through dozens of pickers.
 * `interactive` — the provider typed one request and is watching. Ambiguity asks.
 */
export type ExecutionMode = 'bulk' | 'interactive';

export interface HandlerContext {
  mode: ExecutionMode;
  encounterId: string;
  catalogue: Catalogue;
  writer: ChartWriter;
  chart: ChartSnapshot;
  ask(request: PickerRequest): Promise<PickerResponse>;
  /** Emitted for the chat thread: a `reply` or `provider-note` the provider reads. */
  say(text: string, kind: 'reply' | 'provider-note' | 'unknown'): void;
}

export type Handler<K extends ActionKind = ActionKind> = (
  action: ActionOfKind<K>,
  context: HandlerContext
) => Promise<StepOutcome>;

export type HandlerTable = { [K in ActionKind]: Handler<K> };

/** One entry in the plan the provider watches run. */
export interface PlanStep {
  index: number;
  action: PlannedAction;
  /** Short human label for the step card ("Adding diagnosis: Acute sinusitis"). */
  label: string;
  outcome?: StepOutcome;
}

export type TypedAction = Action;
