/**
 * harvest-prod-cases.ts — headless harvester that grows the easy-chart eval corpus from a
 * production Ottehr environment.
 *
 * For each recent ambient-scribe encounter it writes ONE self-contained `caseNNN.json`
 * (source of truth: transcript + a deterministic flat `renderedNote` + fully-structured `gold`),
 * plus the legacy flat pair `caseNNNa.txt` (transcript) / `caseNNN.txt` (renderedNote) so the
 * existing `eval-case.ts` / `eval-whole-note.ts` harnesses keep working. A `manifest.json` index
 * tracks harvested cases for cross-run dedup and filtering.
 *
 * It does NOT provision M2M credentials — it uses a live USER access token extracted from a
 * logged-in EHR browser session.
 *
 * PHI safety: no patient demographics (name/DOB/address/MRN/phone), no raw FHIR ids, and no
 * transcript/note text are ever written to stdout/stderr. Encounters are identified in output
 * only by an opaque sha256 `encounterHash` and a sequential `caseId`.
 *
 * Required env vars:
 *   OYSTEHR_ACCESS_TOKEN    live user access token (from the logged-in EHR session)
 *   OYSTEHR_PROJECT_ID      Oystehr project id
 *   OYSTEHR_ZAMBDA_API_URL  = the EHR's VITE_APP_PROJECT_API_ZAMBDA_URL
 *   OYSTEHR_FHIR_API_URL    = the EHR's VITE_APP_FHIR_API_URL
 * Optional env vars:
 *   HARVEST_OUT_DIR         default: scripts/easy-chart-eval/harvested-cases
 *   HARVEST_DAYS            default: 7  (window size; always excludes today)
 *   HARVEST_CHUNK_DAYS      default: 2  (report-zambda window per call; deployed zambda 500s on wide windows)
 *   HARVEST_LOCATION_IDS    comma-separated Location ids to filter the report
 *
 * Example:
 *   OYSTEHR_ACCESS_TOKEN="$TOKEN" \
 *   OYSTEHR_PROJECT_ID="$PROJECT_ID" \
 *   OYSTEHR_ZAMBDA_API_URL="https://project-api.zapehr.com/v1" \
 *   OYSTEHR_FHIR_API_URL="https://fhir-api.zapehr.com/r4" \
 *   HARVEST_DAYS=7 \
 *   npx tsx scripts/easy-chart-eval/harvest-prod-cases.ts
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import Oystehr from '@oystehr/sdk';
import { DocumentReference, Encounter, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AiAssistedEncounterItem,
  AiAssistedEncountersReportZambdaOutput,
  AllergyDTO,
  ClinicalImpressionDTO,
  CommunicationDTO,
  CPTCodeDTO,
  DiagnosisDTO,
  DispositionDTO,
  DOCUMENT_REFERENCE_SUMMARY_FROM_AUDIO,
  EncounterExternalLabResult,
  EncounterInHouseLabResult,
  ExamObservationDTO,
  FreeTextNoteDTO,
  GetChartDataResponse,
  GetMedicationOrdersResponse,
  HospitalizationDTO,
  ImmunizationOrder,
  MedicalConditionDTO,
  MedicationDTO,
  NOTHING_TO_EAT_OR_DRINK_FIELD,
  PrescribedMedicationDTO,
  ProcedureDTO,
  progressNoteChartDataRequestedFields,
  RadiologyDTO,
  REFUSAL_OF_EMS_TRANSPORT_FIELD,
  VitalsObservationDTO,
} from 'utils';
import {
  BillingCode,
  CodeItem,
  DiagnosisItem,
  ExamItem,
  GoldData,
  InstructionItem,
  renderNote,
  serializeExternalLabs,
  serializeInHouseLabs,
} from './harvest-shared';

// v2 is ADDITIVE over v1 (all 38 v1 cases still load): adds meta.patientStatus,
// gold.instructionItems, and the full disposition field set (reason/specialty/specialtyOther/
// labService/virusTest/nothingToEatOrDrink/refusalOfEmsTransport). Readers must accept both.
const SCHEMA_VERSION = 2;
export const AMBIENT_SCRIBE_MARKER = 'ambient scribe';

// Report-zambda pacing (deployed zambda 500s on wide windows / rapid successive calls)
const REPORT_ATTEMPTS = 3;
const REPORT_RETRY_BACKOFF_MS = [5_000, 15_000]; // between attempts 1->2 and 2->3
const CHUNK_PAUSE_MS = 3_000; // between successive chunk calls

export interface ManifestRecord {
  caseId: string;
  encounterHash: string;
  appointmentDate?: string;
  providerProfession?: string;
  visitType?: string;
  aiType?: string;
  dxCodes: string[];
  cptCodes: string[];
  emCode?: string;
  hasLabs: boolean;
  hasErx: boolean;
  hasImmunizations: boolean;
}

interface CaseFile {
  schemaVersion: number;
  caseId: string;
  meta: {
    encounterHash: string;
    appointmentDate?: string;
    providerProfession?: string;
    visitType?: string;
    aiType?: string;
    hasLabs: boolean;
    hasErx: boolean;
    hasImmunizations: boolean;
    // FHIR-derived chart context: any finished Encounter for the patient ending before this
    // encounter's start (3y lookback) => 'established'. Best-effort — absent on lookup failure.
    patientStatus?: 'new' | 'established';
  };
  transcript: string;
  renderedNote: string;
  gold: GoldData;
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------
export class UnauthorizedError extends Error {}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

function normalizeCode(code: string | undefined): string {
  return (code ?? '').toUpperCase().replace(/\s+/g, '').replace(/\./g, '');
}

export function hashEncounterId(id: string): string {
  return createHash('sha256').update(id).digest('hex').slice(0, 16);
}

function isUnauthorized(err: unknown): boolean {
  const e = err as { status?: number; statusCode?: number; code?: number; message?: string };
  const status = e?.status ?? e?.statusCode ?? e?.code;
  if (status === 401) return true;
  const msg = (e?.message ?? '').toLowerCase();
  return /\b401\b|unauthorized|expired token|invalid token|token has expired/.test(msg);
}

function dedupeBy<T>(arr: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function decodeBase64Utf8(data: string): string {
  return Buffer.from(data, 'base64').toString('utf-8');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Best human-readable summary of an unknown thrown value. The Oystehr SDK often throws plain
 * objects (not Errors), which `${err.message}` renders as "[object Object]". Exported for tests.
 */
export function describeError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  const e = err as { message?: unknown; code?: unknown; status?: unknown; statusCode?: unknown };
  const parts = [e?.message, e?.code, e?.status ?? e?.statusCode].filter(
    (p) => (typeof p === 'string' && p.length > 0) || typeof p === 'number'
  );
  if (parts.length > 0) return parts.join(' | ');
  try {
    const json = JSON.stringify(err);
    if (json && json !== '{}') return json.length > 300 ? `${json.slice(0, 300)}…` : json;
  } catch {
    // non-serializable (circular) — fall through to String()
  }
  return String(err);
}

/**
 * Split an inclusive [start..end] day window into non-overlapping chunks of at most `chunkDays`
 * days (final chunk short when the window doesn't divide evenly). Exported for the chunk-math test.
 */
export function buildReportChunks(start: DateTime, end: DateTime, chunkDays: number): { start: string; end: string }[] {
  const chunks: { start: string; end: string }[] = [];
  const size = Math.max(1, Math.floor(chunkDays));
  let cur = start.startOf('day');
  const last = end.startOf('day');
  while (cur <= last) {
    const chunkEnd = DateTime.min(cur.plus({ days: size - 1 }), last);
    chunks.push({ start: cur.toFormat('yyyy-LL-dd'), end: chunkEnd.toFormat('yyyy-LL-dd') });
    cur = chunkEnd.plus({ days: 1 });
  }
  return chunks;
}

/** Unwrap the JSON payload from an Oystehr zambda.execute() result (mirrors chooseJson). */
function chooseOutput<T = any>(res: unknown): T {
  return (res as { output?: T })?.output as T;
}

// ---------------------------------------------------------------------------
// Serializers (DTO -> structured gold). Defensive: never throw on a missing field.
// ---------------------------------------------------------------------------
function toDiagnosisItem(dx: DiagnosisDTO): DiagnosisItem {
  return {
    system: 'ICD-10-CM',
    code: dx.code,
    codeNormalized: normalizeCode(dx.code),
    display: dx.display,
    primary: !!dx.isPrimary,
    fromLabOrder: !!dx.addedViaLabOrder,
  };
}

function toBillingCode(cpt: CPTCodeDTO): BillingCode {
  return {
    system: 'CPT',
    code: cpt.code,
    codeNormalized: normalizeCode(cpt.code),
    display: cpt.display,
    ...(cpt.modifier?.length ? { modifiers: cpt.modifier } : {}),
    ...(cpt.billableUnits != null ? { units: cpt.billableUnits } : {}),
  };
}

function toExamItem(o: ExamObservationDTO): ExamItem {
  return {
    field: o.field,
    ...(o.label != null ? { label: o.label } : {}),
    ...(o.value != null ? { present: o.value } : {}),
    ...(o.note ? { note: o.note } : {}),
    ...(o.components?.length
      ? {
          components: o.components.map((c) => ({
            code: c.code,
            label: c.label,
            value: c.value,
            ...(c.abnormal != null ? { abnormal: c.abnormal } : {}),
          })),
        }
      : {}),
    // exam DTOs flag abnormal at the component level; surface any abnormal component up top
    ...(o.components?.some((c) => c.abnormal) ? { abnormal: true } : {}),
  };
}

function serializeVital(v: VitalsObservationDTO): Record<string, unknown> {
  const anyV = v as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { field: anyV.field, context: true };
  if (typeof anyV.value === 'number' || typeof anyV.value === 'string') out.value = anyV.value;
  if (anyV.systolicPressure != null) out.systolic = anyV.systolicPressure;
  if (anyV.diastolicPressure != null) out.diastolic = anyV.diastolicPressure;
  if (anyV.leftEyeVisionText) out.leftEye = anyV.leftEyeVisionText;
  if (anyV.rightEyeVisionText) out.rightEye = anyV.rightEyeVisionText;
  if (anyV.observationMethod) out.method = anyV.observationMethod;
  return out;
}

function labsHaveContent(
  ext: EncounterExternalLabResult | undefined,
  inh: EncounterInHouseLabResult | undefined
): boolean {
  const extCount = (ext?.labOrderResults?.length ?? 0) + (ext?.resultsPending?.length ?? 0);
  const inhCount = (inh?.labOrderResults?.length ?? 0) + (inh?.resultsPending?.length ?? 0);
  return extCount + inhCount > 0;
}

function deriveProviderProfession(practitioners: Practitioner[] | undefined): string | undefined {
  for (const p of practitioners ?? []) {
    const q = p.qualification?.[0]?.code;
    const label = q?.coding?.[0]?.display ?? q?.coding?.[0]?.code ?? q?.text;
    if (label) return label;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Build structured gold from merged chart data + order lookups
// ---------------------------------------------------------------------------
export function buildGold(
  chart: GetChartDataResponse,
  medOrders: GetMedicationOrdersResponse | undefined,
  immunizations: ImmunizationOrder[] | undefined
): GoldData {
  const freeText = (n?: FreeTextNoteDTO): string | undefined => (n?.text?.trim() ? n.text.trim() : undefined);

  const diagnoses = dedupeBy((chart.diagnosis ?? []).map(toDiagnosisItem), (d) => `${d.system}|${d.codeNormalized}`);
  const cptCodes = dedupeBy((chart.cptCodes ?? []).map(toBillingCode), (c) => c.codeNormalized);
  const exam = dedupeBy((chart.examObservations ?? []).map(toExamItem), (e) => e.field);
  const ros = dedupeBy((chart.rosObservations ?? []).map(toExamItem), (e) => e.field);

  const inHouseAdministered = (medOrders?.orders ?? [])
    .filter((o) => o.status !== 'cancelled')
    .map((o) => ({
      name: o.medicationName,
      ndc: o.ndc,
      cptCodes: o.cptCodes?.map((c) => ({ code: c.code, display: c.display })),
      dose: o.dose,
      units: o.units,
      route: o.route,
      status: o.status,
    }));

  const immunizationItems = (immunizations ?? []).map((imm) => ({
    name: imm.details?.medication?.name,
    cvx: imm.administrationDetails?.cvx,
    ndc: imm.administrationDetails?.ndc,
    cptCodes: imm.administrationDetails?.cptCodes,
    status: imm.status,
  }));

  const prescribed = (chart.prescribedMedications ?? []).map((m: PrescribedMedicationDTO) => ({
    name: m.name,
    sig: m.instructions,
    status: m.status,
  }));

  const currentReconciled = dedupeBy(
    (chart.medications ?? []).map((m: MedicationDTO) => ({
      name: m.name,
      dose: m.intakeInfo?.dose,
      type: m.type,
      status: m.status,
      context: true as const,
    })),
    (m) => `${(m.name ?? '').toLowerCase()}|${m.type ?? ''}`
  );

  const allergies = dedupeBy(
    (chart.allergies ?? []).map((a: AllergyDTO) => ({ name: a.name, note: a.note, context: true as const })),
    (a) => (a.name ?? '').toLowerCase()
  );

  const medicalHistory = dedupeBy(
    (chart.conditions ?? []).map((c: MedicalConditionDTO) => ({
      system: c.code ? null : null, // MedicalConditionDTO does not carry a system; pin on first live run
      code: c.code,
      codeNormalized: c.code ? normalizeCode(c.code) : undefined,
      display: c.display,
      note: c.note,
      current: c.current,
      context: true as const,
    })),
    (c) => `${c.codeNormalized ?? ''}|${(c.display ?? '').toLowerCase()}`
  );

  const surgicalHistory = dedupeBy(
    (chart.surgicalHistory ?? []).map(
      (s: CPTCodeDTO): CodeItem => ({
        system: 'CPT',
        code: s.code,
        codeNormalized: normalizeCode(s.code),
        display: s.display,
      })
    ),
    (s) => s.codeNormalized
  );

  const hospitalizations = dedupeBy(
    (chart.episodeOfCare ?? []).map((h: HospitalizationDTO) => ({
      code: h.code,
      codeNormalized: normalizeCode(h.code),
      display: h.display,
    })),
    (h) => `${h.codeNormalized}|${(h.display ?? '').toLowerCase()}`
  );

  const procedures = (chart.procedures ?? []).map((p: ProcedureDTO) => ({
    procedureType: p.procedureType,
    cptCodes: p.cptCodes?.map(toBillingCode),
    diagnoses: p.diagnoses?.map(toDiagnosisItem),
    bodySite: p.bodySite,
    bodySide: p.bodySide,
    technique: p.technique,
    details: p.procedureDetails,
  }));

  const radiology = (chart.radiologyOrders ?? []).map((r: RadiologyDTO) => ({
    studyType: r.studyType,
    studyName: r.studyName,
    cptCodeDisplay: r.cptCodeDisplay,
    diagnosis: r.diagnosis,
    clinicalHistory: r.clinicalHistory,
    preliminaryReport: r.preliminaryReport,
    finalReport: r.finalReport,
  }));

  // Education-doc instructions carry only {title, educationDocRefId} (no text) — keep them
  // instead of filtering on text alone, which silently dropped every such instruction.
  const instructionItems: InstructionItem[] = (chart.instructions ?? [])
    .map((c: CommunicationDTO): InstructionItem => {
      const title = c.title?.trim();
      const text = c.text?.trim();
      return {
        ...(title ? { title } : {}),
        ...(text ? { text } : {}),
        ...(c.educationDocRefId ? { hasEducationDoc: true } : {}),
      };
    })
    .filter((i) => i.title || i.text || i.hasEducationDoc);
  // legacy flat strings, kept in sync with instructionItems
  const instructions = instructionItems.map((i) => i.text ?? i.title ?? '').filter((t) => t.length > 0);

  const mdm = (chart.medicalDecision as ClinicalImpressionDTO | undefined)?.text?.trim();
  const emCode = chart.emCode ? toBillingCode(chart.emCode) : undefined;

  const dispositionDTO: DispositionDTO | undefined = chart.disposition;
  const disposition: GoldData['disposition'] = dispositionDTO
    ? {
        type: dispositionDTO.type,
        note: dispositionDTO.note,
        followUp: dispositionDTO.followUp,
        followUpIn: dispositionDTO.followUpIn,
        ...(dispositionDTO.reason ? { reason: dispositionDTO.reason } : {}),
        ...(dispositionDTO.specialty ? { specialty: dispositionDTO.specialty } : {}),
        ...(dispositionDTO.specialtyOther ? { specialtyOther: dispositionDTO.specialtyOther } : {}),
        ...(dispositionDTO.labService?.length ? { labService: dispositionDTO.labService } : {}),
        ...(dispositionDTO.virusTest?.length ? { virusTest: dispositionDTO.virusTest } : {}),
        ...(dispositionDTO[NOTHING_TO_EAT_OR_DRINK_FIELD] ? { nothingToEatOrDrink: true } : {}),
        ...(dispositionDTO[REFUSAL_OF_EMS_TRANSPORT_FIELD] ? { refusalOfEmsTransport: true } : {}),
      }
    : undefined;

  return {
    // CC/HPI are cross-wired in chart-data relative to the signed note. Mirror the authoritative
    // signed-note PDF composers exactly (do not "fix" back):
    //   packages/zambdas/src/shared/pdf/sections/visit-note/historyOfPresentIllness.ts:10
    //     -> "History of Present Illness" section renders from chartData.chiefComplaint.text
    //   packages/zambdas/src/shared/pdf/sections/visit-note/chiefComplaint.ts:12
    //     -> "Additional information" section renders from chartData.historyOfPresentIllness.text
    historyOfPresentIllness: freeText(chart.chiefComplaint), // the real charted HPI
    additionalInformation: freeText(chart.historyOfPresentIllness), // the "Additional information" section
    reviewOfSystems: { observations: ros, freeText: freeText(chart.ros) },
    exam,
    assessment: { diagnoses },
    billing: { emCode, cptCodes },
    medications: { prescribed, inHouseAdministered, immunizations: immunizationItems, currentReconciled },
    allergies,
    medicalHistory,
    surgicalHistory,
    hospitalizations,
    procedures,
    labs: {
      external: serializeExternalLabs(chart.externalLabResults),
      inHouse: serializeInHouseLabs(chart.inHouseLabResults),
    },
    radiology,
    vitals: (chart.vitalsObservations ?? []).map(serializeVital),
    medicalDecisionMaking: mdm || undefined,
    disposition,
    instructions,
    ...(instructionItems.length ? { instructionItems } : {}),
    addendum: freeText(chart.addendumNote),
  };
}

// ---------------------------------------------------------------------------
// Manifest helpers
// ---------------------------------------------------------------------------
export function loadManifest(outDir: string): ManifestRecord[] {
  const path = join(outDir, 'manifest.json');
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8'));
    return Array.isArray(parsed) ? (parsed as ManifestRecord[]) : [];
  } catch {
    return [];
  }
}

function nextCaseNumber(manifest: ManifestRecord[], outDir: string): number {
  let max = 0;
  const consider = (id: string | undefined): void => {
    const m = /case(\d+)/.exec(id ?? '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  };
  for (const rec of manifest) consider(rec.caseId);
  // also scan any loose files so numbering never collides with an existing case
  if (existsSync(outDir)) {
    for (const f of readdirSync(outDir)) consider(f);
  }
  return max + 1;
}

// ---------------------------------------------------------------------------
// Oystehr calls
// ---------------------------------------------------------------------------
export async function guarded<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isUnauthorized(err)) throw new UnauthorizedError();
    throw err;
  }
}

async function getChart(
  oystehr: Oystehr,
  encounterId: string,
  requestedFields?: unknown
): Promise<GetChartDataResponse> {
  const res = await guarded(() =>
    oystehr.zambda.execute({ id: 'get-chart-data', encounterId, ...(requestedFields ? { requestedFields } : {}) })
  );
  return chooseOutput<GetChartDataResponse>(res);
}

const PATIENT_STATUS_LOOKBACK_YEARS = 3;

/**
 * Chart-context ground truth: 'established' if the patient has any finished Encounter ending
 * before this encounter's start within the lookback window, else 'new'. Best-effort — returns
 * undefined on any lookup failure (except auth, which must abort the run). Exported for the
 * backfill script and tests.
 *
 * `appointmentStart` (the report row's appointment start) is the anchor fallback: some production
 * practices never populate Encounter.period, which previously left patientStatus unset on every case.
 */
export async function derivePatientStatus(
  oystehr: Oystehr,
  encounter: Encounter,
  appointmentStart?: string
): Promise<'new' | 'established' | undefined> {
  try {
    const patientRef = encounter.subject?.reference;
    const startIso = encounter.period?.start ?? appointmentStart;
    if (!patientRef?.startsWith('Patient/') || !startIso) return undefined;
    const encounterStart = DateTime.fromISO(startIso);
    if (!encounterStart.isValid) return undefined;
    const lookbackStart = encounterStart.minus({ years: PATIENT_STATUS_LOOKBACK_YEARS });

    const bundle = await guarded(() =>
      oystehr.fhir.search<Encounter>({
        resourceType: 'Encounter',
        params: [
          { name: 'patient', value: patientRef },
          { name: 'status', value: 'finished' },
          // NO `date` param: verified on production Oystehr that adding date=ge... returns 0
          // entries even when matching finished encounters exist — window client-side instead.
          { name: '_count', value: '100' },
        ],
      })
    );

    const hasPriorFinished = bundle.unbundle().some((e) => {
      if (!e.id || e.id === encounter.id || e.status !== 'finished') return false;
      // Candidates may also lack period; meta.lastUpdated is a lossy proxy (a resource updated
      // AFTER the current visit can misclassify a true prior as not-prior — acceptable for a
      // best-effort flag).
      const endIso = e.period?.end ?? e.period?.start ?? e.meta?.lastUpdated;
      if (!endIso) return false;
      const end = DateTime.fromISO(endIso);
      return end.isValid && end < encounterStart && end >= lookbackStart;
    });
    return hasPriorFinished ? 'established' : 'new';
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    return undefined; // best-effort: meta.patientStatus is optional
  }
}

/** Merge two chart-data responses; the second's DEFINED values win (undefined never clobbers). */
function mergeChartData(a: GetChartDataResponse, b: GetChartDataResponse): GetChartDataResponse {
  const merged: any = { ...a };
  for (const [k, v] of Object.entries(b ?? {})) {
    if (v !== undefined) merged[k] = v;
  }
  return merged as GetChartDataResponse;
}

// ---------------------------------------------------------------------------
// Shared setup + report fetching (also used by backfill-patient-status.ts)
// ---------------------------------------------------------------------------
export interface HarvestEnv {
  oystehr: Oystehr;
  outDir: string;
  days: number;
  chunkDays: number;
  locationIds: string[];
}

/** Shared env parsing + SDK construction for the harvester and backfill tooling. */
export function initFromEnv(): HarvestEnv {
  const accessToken = requireEnv('OYSTEHR_ACCESS_TOKEN');
  const projectId = requireEnv('OYSTEHR_PROJECT_ID');
  const zambdaApiUrl = requireEnv('OYSTEHR_ZAMBDA_API_URL');
  const fhirApiUrl = requireEnv('OYSTEHR_FHIR_API_URL');

  const outDir = process.env.HARVEST_OUT_DIR?.trim() || join('scripts', 'easy-chart-eval', 'harvested-cases');
  const days = Math.max(1, parseInt(process.env.HARVEST_DAYS ?? '7', 10) || 7);
  const chunkDays = Math.max(1, parseInt(process.env.HARVEST_CHUNK_DAYS ?? '2', 10) || 2);
  const locationIds = (process.env.HARVEST_LOCATION_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Build the SDK exactly like apps/ehr/src/hooks/useAppClients.tsx so both zambda.execute
  // and fhir.search resolve against the right hosts.
  const oystehr = new Oystehr({
    accessToken,
    fhirApiUrl,
    projectApiUrl: zambdaApiUrl,
    projectId,
    services: { zambdaApiUrl },
  });

  return { oystehr, outDir, days, chunkDays, locationIds };
}

/** "Last N days excluding today": end = yesterday, start = end - (N-1) days (local). */
export function resolveHarvestWindow(days: number): { start: DateTime; end: DateTime } {
  const end = DateTime.local().minus({ days: 1 });
  const start = end.minus({ days: days - 1 });
  return { start, end };
}

export interface ReportFetchResult {
  items: AiAssistedEncounterItem[]; // deduped by appointmentId within the run
  failedChunks: number;
  totalChunks: number;
}

/**
 * Fetch the ai-assisted-encounters report over [start..end] in small sequential chunks: the
 * deployed report zambda 500s on windows >= ~4 days and is flaky when called in rapid
 * succession, so pace the calls and retry per chunk. A chunk that fails all attempts is
 * skipped (partial harvest beats none) — callers decide what to do when ALL chunks fail.
 * Stdout: dates/counts/attempts only.
 */
export async function fetchReportChunked(
  oystehr: Oystehr,
  opts: { start: DateTime; end: DateTime; chunkDays: number; locationIds: string[] }
): Promise<ReportFetchResult> {
  const chunks = buildReportChunks(opts.start, opts.end, opts.chunkDays);

  async function fetchChunk(range: { start: string; end: string }): Promise<AiAssistedEncounterItem[] | undefined> {
    for (let attempt = 1; attempt <= REPORT_ATTEMPTS; attempt++) {
      try {
        const res = await guarded(() =>
          oystehr.zambda.execute({
            id: 'ai-assisted-encounters-report',
            dateRange: range,
            ...(opts.locationIds.length ? { locationIds: opts.locationIds } : {}),
          })
        );
        return chooseOutput<AiAssistedEncountersReportZambdaOutput>(res)?.encounters ?? [];
      } catch (err) {
        if (err instanceof UnauthorizedError) throw err;
        console.log(
          `chunk ${range.start}..${range.end} attempt ${attempt}/${REPORT_ATTEMPTS} failed: ${describeError(err)}`
        );
        if (attempt < REPORT_ATTEMPTS)
          await sleep(
            REPORT_RETRY_BACKOFF_MS[attempt - 1] ?? REPORT_RETRY_BACKOFF_MS[REPORT_RETRY_BACKOFF_MS.length - 1]
          );
      }
    }
    return undefined;
  }

  const collected: AiAssistedEncounterItem[] = [];
  let failedChunks = 0;
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await sleep(CHUNK_PAUSE_MS);
    const chunk = chunks[i];
    const rows = await fetchChunk(chunk);
    if (rows == null) {
      failedChunks += 1;
      console.log(`chunk ${chunk.start}..${chunk.end} FAILED after ${REPORT_ATTEMPTS} attempts`);
      continue;
    }
    console.log(`chunk ${chunk.start}..${chunk.end}: ${rows.length} encounters`);
    collected.push(...rows);
  }

  // within-run dedupe (chunks are non-overlapping, but the report may return an appointment in
  // adjacent chunks when its encounter spans a chunk boundary); cross-run dedup stays manifest-based
  return { items: dedupeBy(collected, (e) => String(e.appointmentId)), failedChunks, totalChunks: chunks.length };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const { oystehr, outDir, days, chunkDays, locationIds } = initFromEnv();

  const { start, end } = resolveHarvestWindow(days);
  const dateRange = { start: start.toFormat('yyyy-LL-dd'), end: end.toFormat('yyyy-LL-dd') };

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const manifest = loadManifest(outDir);
  const harvestedHashes = new Set(manifest.map((r) => r.encounterHash));
  let caseNum = nextCaseNumber(manifest, outDir);

  // 1. Report (chunked + retried; see fetchReportChunked)
  console.log(
    `Harvest window: ${dateRange.start} .. ${dateRange.end} ` +
      `(${buildReportChunks(start, end, chunkDays).length} chunk(s) of <=${chunkDays}d)` +
      `${locationIds.length ? ` (locations: ${locationIds.length})` : ''}`
  );

  const {
    items: allEncounters,
    failedChunks,
    totalChunks,
  } = await fetchReportChunked(oystehr, {
    start,
    end,
    chunkDays,
    locationIds,
  });
  if (totalChunks > 0 && failedChunks === totalChunks) {
    console.error(`All ${totalChunks} report chunks failed — aborting`);
    process.exit(1);
  }
  if (failedChunks > 0) {
    console.log(`Continuing with a PARTIAL harvest: ${failedChunks}/${totalChunks} chunks failed`);
  }

  const ambient = allEncounters.filter((e) => (e.aiType ?? '').toLowerCase().includes(AMBIENT_SCRIBE_MARKER));
  console.log(`Report returned ${allEncounters.length} encounters, ${ambient.length} with ambient scribe`);

  const tally = { written: 0, alreadyHarvested: 0, noTranscript: 0, noChartData: 0, error: 0 };

  for (const item of ambient) {
    try {
      await harvestOne(item);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        console.error('Access token expired or unauthorized — re-extract the token and re-run');
        process.exit(1);
      }
      tally.error += 1;
      console.log('skipped: error (unexpected failure)');
    }
  }

  console.log(
    `Done. written=${tally.written} alreadyHarvested=${tally.alreadyHarvested} ` +
      `noTranscript=${tally.noTranscript} noChartData=${tally.noChartData} error=${tally.error}`
  );

  // --- per-encounter worker (closure over shared state) ---
  async function harvestOne(item: AiAssistedEncounterItem): Promise<void> {
    // a. Resolve the Encounter from the appointment
    const encBundle = await guarded(() =>
      oystehr.fhir.search<Encounter>({
        resourceType: 'Encounter',
        params: [{ name: 'appointment', value: `Appointment/${item.appointmentId}` }],
      })
    );
    const encounter = encBundle.unbundle()[0];
    const encounterId = encounter?.id;
    if (!encounterId) {
      tally.noChartData += 1;
      console.log('skipped: no chart data (encounter not found)');
      return;
    }

    const encounterHash = hashEncounterId(encounterId);
    if (harvestedHashes.has(encounterHash)) {
      tally.alreadyHarvested += 1;
      console.log('skipped: already harvested');
      return;
    }

    // b/c/d. Transcript from the ambient-scribe DocumentReference
    const docBundle = await guarded(() =>
      oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [{ name: 'encounter', value: `Encounter/${encounterId}` }],
      })
    );
    const audioDoc = docBundle.unbundle().find((d) => d.description === DOCUMENT_REFERENCE_SUMMARY_FROM_AUDIO);
    const transcriptData = audioDoc?.content?.find((c) => c.attachment?.title === 'Transcript')?.attachment?.data;
    if (!transcriptData) {
      tally.noTranscript += 1;
      console.log('skipped: no transcript');
      return;
    }
    const transcript = decodeBase64Utf8(transcriptData);
    if (!transcript.trim()) {
      tally.noTranscript += 1;
      console.log('skipped: no transcript');
      return;
    }

    // Chart data: defaults + progress-note requested fields, merged. `instructions` must be named
    // explicitly in the second call: when requestedFields is present, get-chart-data only adds the
    // Communication search for fields whose key exists (get-chart-data/index.ts addRequestIfNeeded).
    // The key is absent from the RequestedFields TS union but the zambda validates requestedFields
    // as a plain record, so it is honored at runtime; { _sort: '-sent' } mirrors the zambda's
    // defaultChartDataFieldsSearchParams.instructions.
    const baseChart = await getChart(oystehr, encounterId);
    const extraChart = await getChart(oystehr, encounterId, {
      ...progressNoteChartDataRequestedFields,
      instructions: { _sort: '-sent' },
    });
    const chart = mergeChartData(baseChart, extraChart);
    if (!chart) {
      tally.noChartData += 1;
      console.log('skipped: no chart data');
      return;
    }

    // Order lookups (code-scorable NDC/CPT/CVX). Degrade gracefully.
    let medOrders: GetMedicationOrdersResponse | undefined;
    try {
      const res = await guarded(() =>
        oystehr.zambda.execute({ id: 'get-medication-orders', searchBy: { field: 'encounterId', value: encounterId } })
      );
      medOrders = chooseOutput<GetMedicationOrdersResponse>(res);
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      medOrders = undefined; // non-fatal
    }

    let immunizations: ImmunizationOrder[] | undefined;
    try {
      const res = await guarded(() =>
        oystehr.zambda.execute({ id: 'get-immunization-orders', encounterIds: [encounterId] })
      );
      immunizations = chooseOutput<{ orders: ImmunizationOrder[] }>(res)?.orders;
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      immunizations = undefined; // non-fatal
    }

    // Chart context: new vs established patient (best-effort; undefined on lookup failure).
    // appointmentStart is the anchor fallback for practices whose Encounters lack period.
    const patientStatus = await derivePatientStatus(oystehr, encounter, item.appointmentStart);

    // Assemble gold + rendered note
    const gold = buildGold(chart, medOrders, immunizations);
    const renderedNote = renderNote(gold);

    const appointmentDate = item.appointmentStart
      ? DateTime.fromISO(item.appointmentStart).toFormat('yyyy-LL-dd')
      : undefined;
    const providerProfession = deriveProviderProfession(chart.practitioners);
    const hasLabs = labsHaveContent(chart.externalLabResults, chart.inHouseLabResults);
    const hasErx = gold.medications.prescribed.length > 0;
    const hasImmunizations = gold.medications.immunizations.length > 0;

    const caseId = `case${String(caseNum).padStart(3, '0')}`;
    caseNum += 1;

    const caseFile: CaseFile = {
      schemaVersion: SCHEMA_VERSION,
      caseId,
      meta: {
        encounterHash,
        appointmentDate,
        providerProfession,
        visitType: item.visitType,
        aiType: item.aiType,
        hasLabs,
        hasErx,
        hasImmunizations,
        ...(patientStatus ? { patientStatus } : {}),
      },
      transcript,
      renderedNote,
      gold,
    };

    // Write source-of-truth JSON + legacy flat pair (both from the same rendered text)
    writeFileSync(join(outDir, `${caseId}.json`), JSON.stringify(caseFile, null, 2));
    writeFileSync(join(outDir, `${caseId}a.txt`), transcript);
    writeFileSync(join(outDir, `${caseId}.txt`), renderedNote);

    const manifestRecord: ManifestRecord = {
      caseId,
      encounterHash,
      appointmentDate,
      providerProfession,
      visitType: item.visitType,
      aiType: item.aiType,
      dxCodes: gold.assessment.diagnoses.map((d) => d.code),
      cptCodes: gold.billing.cptCodes.map((c) => c.code),
      emCode: gold.billing.emCode?.code,
      hasLabs,
      hasErx,
      hasImmunizations,
    };
    manifest.push(manifestRecord);
    harvestedHashes.add(encounterHash);
    writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    tally.written += 1;
    console.log(`${caseId}: written`);
  }
}

// Run only when executed directly, so tooling/tests can import buildGold without side effects.
const isDirectRun = process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((err) => {
    if (err instanceof UnauthorizedError) {
      console.error('Access token expired or unauthorized — re-extract the token and re-run');
      process.exit(1);
    }
    // Keep top-level failures free of patient content.
    console.error(`Fatal: ${describeError(err)}`);
    process.exit(1);
  });
}
