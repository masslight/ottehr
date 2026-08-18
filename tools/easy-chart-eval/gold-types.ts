/**
 * harvest-shared.ts — types + deterministic renderer shared by the harvester
 * (`harvest-prod-cases.ts`) and any migration/tooling, so the flat `renderedNote` is
 * produced by ONE code path and can never drift from the structured `gold`.
 */
import { EncounterExternalLabResult, EncounterInHouseLabResult } from 'utils/lib/types/api/lab';

// ---------------------------------------------------------------------------
// Structured gold schema (source of truth). Scorable sections are always present
// (possibly empty arrays) so a downstream scorer can distinguish "clinician charted
// nothing" from "not evaluated". Free-text sections are omitted when empty.
// ---------------------------------------------------------------------------
export interface CodeItem {
  system: string | null; // explicit code system, recorded at serialize time
  code: string; // verbatim from FHIR
  codeNormalized: string; // uppercase, whitespace + decimal dot stripped — the comparison key
  display: string;
}
export interface DiagnosisItem extends CodeItem {
  primary: boolean;
  fromLabOrder: boolean; // planner-scope: lab-order-added dx are not transcript-derivable
}
export interface BillingCode extends CodeItem {
  modifiers?: { code: string; display: string }[];
  units?: number;
}
export interface ExamItem {
  field: string; // MATCH KEY (exam-observation-field code); stable, unlike label
  label?: string;
  present?: boolean;
  abnormal?: boolean;
  note?: string;
  components?: { code: string; label: string; value: boolean; abnormal?: boolean }[];
}
// Patient instruction (CommunicationDTO). Education-doc instructions carry only a title +
// DocumentReference (no text) — hasEducationDoc records that without leaking the FHIR id.
export interface InstructionItem {
  title?: string;
  text?: string;
  hasEducationDoc?: boolean;
}

export interface GoldData {
  // NOTE: the EHR's chart-data CC/HPI fields are cross-wired relative to the signed note.
  // The authoritative signed-note PDF composers prove it:
  //   - packages/zambdas/src/shared/pdf/sections/visit-note/historyOfPresentIllness.ts:10
  //       renders the "History of Present Illness" section from chartData.chiefComplaint.text
  //   - packages/zambdas/src/shared/pdf/sections/visit-note/chiefComplaint.ts:12
  //       renders the "Additional information" section from chartData.historyOfPresentIllness.text
  // So the harvester maps chart.chiefComplaint -> historyOfPresentIllness (the real HPI) and
  // chart.historyOfPresentIllness -> additionalInformation. Do not "fix" this back.
  historyOfPresentIllness?: string;
  additionalInformation?: string;
  reviewOfSystems: { observations: ExamItem[]; freeText?: string };
  exam: ExamItem[];
  assessment: { diagnoses: DiagnosisItem[] };
  billing: { emCode?: BillingCode; cptCodes: BillingCode[] };
  medications: {
    prescribed: { name?: string; sig?: string; status?: string }[]; // eRx — name-only, not code-scorable
    inHouseAdministered: {
      name?: string;
      ndc?: string;
      cptCodes?: { code: string; display: string }[];
      dose?: number;
      units?: string;
      route?: string;
      status?: string;
    }[];
    immunizations: {
      name?: string;
      cvx?: string;
      ndc?: string;
      cptCodes?: { code: string; display: string }[];
      status?: string;
    }[];
    currentReconciled: { name?: string; dose?: string; type?: string; status?: string; context: true }[]; // context, not planner-scored
  };
  allergies: { name?: string; note?: string; context: true }[]; // context (prior chart)
  medicalHistory: {
    system: string | null;
    code?: string;
    codeNormalized?: string;
    display?: string;
    note?: string;
    current?: boolean;
    context: true;
  }[]; // context (prior chart)
  surgicalHistory: CodeItem[];
  hospitalizations: { code: string; codeNormalized: string; display: string }[];
  procedures: {
    procedureType?: string;
    cptCodes?: BillingCode[];
    diagnoses?: DiagnosisItem[];
    bodySite?: string;
    bodySide?: string;
    technique?: string[];
    details?: string;
  }[];
  labs: { external: unknown; inHouse: unknown };
  radiology: {
    studyType?: string;
    studyName?: string;
    cptCodeDisplay?: string;
    diagnosis?: string;
    clinicalHistory?: string;
    preliminaryReport?: string;
    finalReport?: string;
  }[];
  vitals: Record<string, unknown>[]; // context only, not planner-scored
  medicalDecisionMaking?: string;
  // Full DispositionDTO capture (schema v2). Fields beyond type/note/followUp/followUpIn are
  // optional and absent in v1 cases; scorers should treat missing as "not charted".
  disposition?: {
    type?: string;
    note?: string;
    followUp?: { type?: string; note?: string }[];
    followUpIn?: number;
    reason?: string;
    specialty?: string;
    specialtyOther?: string;
    labService?: string[];
    virusTest?: string[];
    nothingToEatOrDrink?: boolean;
    refusalOfEmsTransport?: boolean;
  };
  instructions: string[]; // legacy flat text (v1); derived from instructionItems since v2
  instructionItems?: InstructionItem[]; // full-fidelity instructions (schema v2; absent in v1 cases)
  addendum?: string;
}

// ---------------------------------------------------------------------------
// Lab serializers (pure; defensive — never throw on a missing field). Shared so
// buildGold and the renderer agree on the on-disk lab shape.
// ---------------------------------------------------------------------------
export function serializeExternalLabs(ext: EncounterExternalLabResult | undefined): unknown {
  if (!ext) return { resultsPending: [], labOrderResults: [] };
  return {
    resultsPending: ext.resultsPending ?? [],
    labOrderResults: (ext.labOrderResults ?? []).map((r) => ({
      name: r.name,
      nonNormalResultContained: r.nonNormalResultContained,
      orderNumber: r.orderNumber,
      resultValues: r.resultValues,
      reflexResults: (r.reflexResults ?? []).map((rr) => ({
        name: rr.name,
        nonNormalResultContained: rr.nonNormalResultContained,
        orderNumber: rr.orderNumber,
        resultValues: rr.resultValues,
      })),
    })),
  };
}

export function serializeInHouseLabs(inh: EncounterInHouseLabResult | undefined): unknown {
  if (!inh) return { resultsPending: [], reflexTestsPending: [], labOrderResults: [] };
  return {
    resultsPending: inh.resultsPending ?? [],
    reflexTestsPending: inh.reflexTestsPending ?? [],
    labOrderResults: (inh.labOrderResults ?? []).map((r) => ({
      name: r.name,
      nonNormalResultContained: r.nonNormalResultContained,
      simpleResultValue: r.simpleResultValue,
      resultValues: r.resultValues,
    })),
  };
}

// ---------------------------------------------------------------------------
// Rendered note — deterministic flat text derived from the structured gold.
// Empty sections are omitted for readability. Codes are emitted inline so the
// legacy regex-scraping evals (eval-case.ts) still find ICD-10 / CPT.
// ---------------------------------------------------------------------------
export function renderNote(gold: GoldData): string {
  const lines: string[] = [];
  const section = (title: string, body: string[]): void => {
    if (body.length === 0) return;
    lines.push(title.toUpperCase(), ...body, '');
  };

  if (gold.historyOfPresentIllness) section('History of Present Illness', [gold.historyOfPresentIllness]);
  if (gold.additionalInformation) section('Additional Information', [gold.additionalInformation]);

  const rosBody: string[] = [];
  for (const o of gold.reviewOfSystems.observations)
    rosBody.push(`- ${o.label ?? o.field}${o.abnormal ? ' (abnormal)' : ''}`);
  if (gold.reviewOfSystems.freeText) rosBody.push(gold.reviewOfSystems.freeText);
  section('Review of Systems', rosBody);

  section(
    'Examination',
    gold.exam.map((o) => `- ${o.label ?? o.field}${o.abnormal ? ' (abnormal)' : ''}${o.note ? `: ${o.note}` : ''}`)
  );

  section(
    'Vitals',
    gold.vitals.map((v) => {
      const parts = Object.entries(v)
        .filter(([k]) => k !== 'field' && k !== 'context')
        .map(([k, val]) => `${k}=${val}`);
      return `- ${v.field}${parts.length ? ` ${parts.join(' ')}` : ''}`;
    })
  );

  section(
    'Allergies',
    gold.allergies.map((a) => `- ${a.name ?? 'Unknown'}${a.note ? ` (${a.note})` : ''}`)
  );

  const medBody: string[] = [];
  for (const m of gold.medications.currentReconciled)
    medBody.push(`- ${m.name ?? 'Unknown'}${m.dose ? ` ${m.dose}` : ''} [current]`);
  for (const m of gold.medications.inHouseAdministered)
    medBody.push(
      `- ${m.name ?? 'Unknown'}${m.dose ? ` ${m.dose}${m.units ? m.units : ''}` : ''}${
        m.ndc ? ` [NDC ${m.ndc}]` : ''
      }${(m.cptCodes ?? []).map((c) => ` [${c.code}]`).join('')} [in-house]`
    );
  for (const m of gold.medications.prescribed)
    medBody.push(`- ${m.name ?? 'Unknown'}${m.sig ? ` — ${m.sig}` : ''} [eRx]`);
  section('Medications', medBody);

  section(
    'Immunizations',
    gold.medications.immunizations.map(
      (i) => `- ${i.name ?? 'Unknown'}${i.cvx ? ` [CVX ${i.cvx}]` : ''}${i.ndc ? ` [NDC ${i.ndc}]` : ''}`
    )
  );

  section(
    'Medical History',
    gold.medicalHistory.map(
      (c) => `- ${c.display ?? 'Unknown'}${c.code ? ` [${c.code}]` : ''}${c.note ? ` (${c.note})` : ''}`
    )
  );
  section(
    'Surgical History',
    gold.surgicalHistory.map((s) => `- ${s.display} [${s.code}]`)
  );
  section(
    'Hospitalizations',
    gold.hospitalizations.map((h) => `- ${h.display} [${h.code}]`)
  );

  section(
    'Assessment / Diagnoses',
    gold.assessment.diagnoses.map(
      (d) => `- ${d.display} [${d.code}]${d.primary ? ' (primary)' : ''}${d.fromLabOrder ? ' (from lab order)' : ''}`
    )
  );

  const procBody: string[] = [];
  for (const p of gold.procedures) {
    const codes = (p.cptCodes ?? []).map((c) => ` [${c.code}]`).join('');
    procBody.push(`- ${p.procedureType ?? 'Procedure'}${codes}${p.bodySite ? ` — ${p.bodySite}` : ''}`);
    if (p.details) procBody.push(`  ${p.details}`);
  }
  section('Procedures', procBody);

  const labBody: string[] = [];
  const ext = gold.labs.external as any;
  const inh = gold.labs.inHouse as any;
  for (const r of ext?.labOrderResults ?? [])
    labBody.push(`- ${r.name}${r.resultValues?.length ? `: ${r.resultValues.join(', ')}` : ''} [external]`);
  for (const n of ext?.resultsPending ?? []) labBody.push(`- ${n}: pending [external]`);
  for (const r of inh?.labOrderResults ?? [])
    labBody.push(
      `- ${r.name}${
        r.simpleResultValue
          ? `: ${r.simpleResultValue}`
          : r.resultValues?.length
          ? `: ${r.resultValues.join(', ')}`
          : ''
      } [in-house]`
    );
  for (const n of inh?.resultsPending ?? []) labBody.push(`- ${n}: pending [in-house]`);
  section('Labs', labBody);

  const radBody: string[] = [];
  for (const r of gold.radiology) {
    radBody.push(`- ${r.studyName ?? r.studyType ?? 'Study'}${r.cptCodeDisplay ? ` (${r.cptCodeDisplay})` : ''}`);
    if (r.finalReport) radBody.push(`  Final: ${r.finalReport}`);
    else if (r.preliminaryReport) radBody.push(`  Preliminary: ${r.preliminaryReport}`);
  }
  section('Radiology', radBody);

  const emBody: string[] = [];
  if (gold.billing.emCode) emBody.push(`- E&M: ${gold.billing.emCode.display} [${gold.billing.emCode.code}]`);
  for (const c of gold.billing.cptCodes)
    emBody.push(`- ${c.display} [${c.code}]${(c.modifiers ?? []).map((m) => ` -${m.code}`).join('')}`);
  section('E&M / CPT', emBody);

  if (gold.medicalDecisionMaking) section('Medical Decision Making', [gold.medicalDecisionMaking]);

  if (gold.disposition) {
    const d = gold.disposition;
    const dispBody: string[] = [];
    if (d.type) dispBody.push(`Type: ${d.type}`);
    if (d.note) dispBody.push(d.note);
    if (d.specialty)
      dispBody.push(`Specialty transfer: ${d.specialty}${d.specialtyOther ? ` (${d.specialtyOther})` : ''}`);
    if (d.reason) dispBody.push(`Reason for transfer: ${d.reason}`);
    if (d.labService?.length) dispBody.push(`Lab services: ${d.labService.join(', ')}`);
    if (d.virusTest?.length) dispBody.push(`Virus tests: ${d.virusTest.join(', ')}`);
    for (const f of d.followUp ?? [])
      dispBody.push(`Subspecialty follow-up: ${f.type ?? 'unknown'}${f.note ? ` — ${f.note}` : ''}`);
    // followUpIn 0 is the EHR's untouched default; render only a real (>0 days) follow-up so
    // v1 cases (all followUpIn 0/absent) re-render byte-identically
    if (typeof d.followUpIn === 'number' && d.followUpIn > 0) dispBody.push(`Follow-up in: ${d.followUpIn} day(s)`);
    if (d.nothingToEatOrDrink) dispBody.push('Nothing to eat or drink');
    if (d.refusalOfEmsTransport) dispBody.push('Refusal of EMS transport');
    section('Disposition / Plan', dispBody);
  }

  // Prefer full-fidelity items (v2); fall back to the legacy flat strings (v1)
  const instructionsBody = gold.instructionItems?.length
    ? gold.instructionItems.map((i) => {
        const label = [i.title, i.text].filter(Boolean).join(': ');
        return `- ${label || 'Education document'}${i.hasEducationDoc ? ' [education doc]' : ''}`;
      })
    : gold.instructions.map((t) => `- ${t}`);
  section('Instructions', instructionsBody);
  if (gold.addendum) section('Addendum', [gold.addendum]);

  return lines.join('\n').trimEnd() + '\n';
}
