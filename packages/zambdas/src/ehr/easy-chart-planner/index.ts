import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import {
  chunkThings,
  EasyChartAgentIntent,
  EasyChartPlannerOutput,
  GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM,
  INVALID_INPUT_ERROR,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { invokeChatbotVertexAI } from '../../shared/ai';
import { createOystehrClient } from '../../shared/helpers';
import { findHolderList } from '../shared/template-helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

// Fetch the practice's saved template titles so the LLM can name a real template when
// suggesting apply-template. Without this the LLM has no idea what's available and
// either invents names or skips apply-template entirely. Lightweight version of
// list-templates that returns just titles (no version data, no contained resources).
async function fetchTemplateTitles(oystehr: Oystehr): Promise<string[]> {
  const holder = await findHolderList(oystehr);
  if (!holder?.entry?.length) return [];
  const templateIds = [
    ...new Set(holder.entry.map((e) => e.item.reference?.replace('List/', '')).filter((id): id is string => !!id)),
  ];
  if (templateIds.length === 0) return [];
  const idChunks = chunkThings(templateIds, 50);
  const chunkResults = await Promise.all(
    idChunks.map((chunk) =>
      oystehr.fhir
        .search<List>({
          resourceType: 'List',
          params: [
            { name: '_id', value: chunk.join(',') },
            { name: '_count', value: '50' },
          ],
        })
        .then((r) => r.unbundle())
    )
  );
  const titles = chunkResults
    .flat()
    .filter((t) => t.code?.coding?.some((c) => c.system === GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM))
    .map((t) => t.title?.trim())
    .filter((t): t is string => !!t);
  // Stable order so prompt cache hits are consistent across runs.
  return titles.sort();
}

const ZAMBDA_NAME = 'easy-chart-planner';

// Dosage-form keywords ordered most-specific first so "Oral Suspension" wins over "Suspension".
// Kept in sync with the equivalent list in easy-chart-agent.
const DOSE_FORM_KEYWORDS = [
  'oral suspension',
  'oral solution',
  'oral tablet',
  'extended release tablet',
  'chewable tablet',
  'suspension',
  'solution',
  'tablet',
  'capsule',
  'liquid',
  'cream',
  'ointment',
  'drops',
  'spray',
  'injection',
  'patch',
  'inhaler',
];

function sniffDoseForm(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const kw of DOSE_FORM_KEYWORDS) {
    if (lower.includes(kw)) {
      return kw.charAt(0).toUpperCase() + kw.slice(1);
    }
  }
  return undefined;
}

// Scope the sniff to the RIGHT side of the medication name only, since dose forms in clinical
// prose conventionally follow the ingredient ("amoxicillin SUSPENSION 400 mg/5 mL"). A tight
// 40-char forward window avoids bleeding into the next medication's form. Looking before the
// name (e.g. amoxicillin's "suspension" landing in acetaminophen's intent) was the bug.
function sniffDoseFormScoped(narrative: string, display: string, searchTerms: string[]): string | undefined {
  const needles = [...searchTerms, display].map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
  const narrativeLower = narrative.toLowerCase();
  for (const needle of needles) {
    const idx = narrativeLower.indexOf(needle.toLowerCase());
    if (idx === -1) continue;
    const start = idx + needle.length;
    const end = Math.min(narrative.length, start + 40);
    const window = narrative.slice(start, end);
    const sniffed = sniffDoseForm(window);
    if (sniffed) return sniffed;
    // First hit decides — don't bleed into the next med's window.
    return undefined;
  }
  return undefined;
}

// ICD-10 codes follow a strict pattern: letter, 2 digits, optional ".digits", optional trailing
// alpha. Examples that should match: I10, H66.91, S93.421A, S72.142A, L23.7, M40.12, S13.4XXA.
// Used as a fallback when the LLM omits the `code` field but the narrative clearly carries one
// (most synth narratives spell the code in parentheses after the diagnosis name).
const ICD10_REGEX = /\b([A-TV-Z][0-9][A-Z0-9](?:\.[A-Z0-9]{1,4})?[A-Z]?)\b/g;

function sniffIcdCodeScoped(narrative: string, display: string, searchTerms: string[]): string | undefined {
  const needles = [display, ...searchTerms].map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
  const narrativeLower = narrative.toLowerCase();
  for (const needle of needles) {
    const idx = narrativeLower.indexOf(needle.toLowerCase());
    if (idx === -1) continue;
    // Look in a ~80-char window around the diagnosis name — narrative usually says
    // "Acute otitis media, right ear (H66.91)" with the code immediately following.
    const start = Math.max(0, idx - 20);
    const end = Math.min(narrative.length, idx + needle.length + 60);
    const window = narrative.slice(start, end);
    const matches = window.match(ICD10_REGEX);
    if (matches && matches.length > 0) return matches[0];
    return undefined;
  }
  return undefined;
}

// Mirror the agent's intent kinds — the planner emits the same shape, just as a list.
const KIND_VALUES = [
  'unknown',
  'add-allergy',
  'add-condition',
  'add-medication',
  'add-surgical-history',
  'add-hospitalization',
  'add-diagnosis',
  'remove-allergy',
  'remove-condition',
  'remove-medication',
  'remove-surgical-history',
  'remove-hospitalization',
  'remove-diagnosis',
  'set-em-code',
  'add-cpt',
  'remove-em-code',
  'remove-cpt',
  'apply-template',
  'add-procedure',
  'update-procedure',
  'edit-note-text',
  'add-exam-finding',
  'remove-exam-finding',
] as const;

const NOTE_TEXT_FIELDS = [
  'chiefComplaint',
  'historyOfPresentIllness',
  'mechanismOfInjury',
  'ros',
  'medicalDecision',
] as const;
type NoteTextField = (typeof NOTE_TEXT_FIELDS)[number];

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: KIND_VALUES as unknown as string[] },
          display: { type: 'string' },
          searchTerms: { type: 'array', items: { type: 'string' } },
          strength: { type: 'string' },
          doseForm: { type: 'string' },
          isPrimary: { type: 'boolean' },
          code: { type: 'string' },
          message: { type: 'string' },
          procedureMatch: { type: 'string' },
          updates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                value: { type: 'string' },
              },
              required: ['field', 'value'],
            },
          },
          field: { type: 'string' },
          newText: { type: 'string' },
        },
        required: ['kind'],
      },
    },
  },
  required: ['steps'],
};

const buildPrompt = (
  narrative: string,
  noteContext?: Partial<Record<NoteTextField, string>>,
  templateTitles?: string[]
): string => {
  const labels: Record<NoteTextField, string> = {
    chiefComplaint: 'Chief Complaint',
    historyOfPresentIllness: 'History of Present Illness (HPI)',
    mechanismOfInjury: 'Mechanism of Injury',
    ros: 'Review of Systems',
    medicalDecision: 'Medical Decision Making (MDM)',
  };
  const contextLines: string[] = [];
  if (noteContext) {
    for (const field of NOTE_TEXT_FIELDS) {
      const v = noteContext[field];
      contextLines.push(
        v && v.trim()
          ? `- ${labels[field]} (field="${field}"): """${v}"""`
          : `- ${labels[field]} (field="${field}"): <empty>`
      );
    }
  }
  const contextBlock =
    contextLines.length > 0 ? `\nCurrent free-text fields on this encounter:\n${contextLines.join('\n')}\n` : '';

  const templatesBlock =
    templateTitles && templateTitles.length > 0
      ? `\nAVAILABLE TEMPLATES in this practice (exact titles — match these when you apply-template; do NOT invent template names):\n${templateTitles
          .map((t) => `- ${t}`)
          .join('\n')}\n`
      : '';

  return `
You are an assistant helping a provider chart a clinical encounter. The provider just typed a
free-text NARRATIVE describing everything they want done on the chart:

"""
${narrative}
"""
${contextBlock}${templatesBlock}
Decompose the narrative into an ordered sequence of charting ACTIONS. Each action is one of
the kinds below; the client will execute them one at a time and ask the provider to disambiguate
when needed. Emit a JSON array of "steps".

ORDERING (follow this canonical note order — don't emit an action for things the narrative
doesn't mention):
  1. Apply chart template (apply-template) — FIRST step when one of the AVAILABLE TEMPLATES
     above matches the narrative's primary presentation. Templates pre-fill CC/HPI structure,
     default normal exam findings, default-diagnosis, default-MDM and patient instructions.
     Examples: "Acute otitis media right ear" narrative → apply-template "AOM Right";
     "asthma exacerbation" → "Asthma"; "ankle sprain" → "Ankle Sprain" (if present).
     Match against the listed titles by primary diagnosis or chief complaint. Match by laterality
     when the templates differ by side (AOM Right vs Left vs Bilateral). If no template matches
     plausibly, OMIT apply-template — don't force a wrong template.
  2. Patient history (add/remove-allergy, condition, medication, surgical-history, hospitalization)
  3. Free-text fields, in note order: edit-note-text for chiefComplaint, historyOfPresentIllness,
     mechanismOfInjury, ros, medicalDecision. When a template was applied in step 1, ONLY emit
     edit-note-text for fields where the narrative has content that meaningfully DIFFERS from
     what the template would default. The template typically fills CC, HPI structure, MDM and
     patient instructions — don't re-emit those if the narrative content is what the template
     already provides.
  4. Exam findings (add-exam-finding / remove-exam-finding). When a template was applied, ONLY
     emit add-exam-finding for ABNORMAL findings (or normal findings the narrative specifically
     calls out that the template doesn't cover by default). Templates already check the default
     normal findings for that section — don't re-add them.
  5. Diagnoses (add-diagnosis — mark isPrimary=true for the primary; emit ONE primary). When the
     template's title matches the diagnosis (e.g. AOM Right + Acute otitis media right ear),
     OMIT this step — the template already adds the diagnosis.
  6. Procedures (add-procedure, then update-procedure for any field changes referencing the
     same procedure by procedureMatch — match by procedure name)
  7. Billing: set-em-code (one), add-cpt (any extra CPTs)

ACTION SHAPES (use these intent kinds and the same fields the single-shot agent uses):

- add-allergy / add-condition / add-medication / add-surgical-history / add-hospitalization /
  add-diagnosis: { kind, display, searchTerms[1-3] }; add-diagnosis also takes isPrimary.
- add-condition and add-diagnosis ALSO take an OPTIONAL "code" field for the ICD-10 code when
  the narrative explicitly states one ("acute otitis media (H66.91)", "PMH hypertension I10",
  "S93.421A ankle sprain"). Format: just the code, no parentheses. Omit if not stated. This is
  critical for picker accuracy — without the code the client search often returns wrong subtypes
  (e.g. "Acute otitis media" → serous H65.x instead of suppurative H66.x).
- add-medication takes two extra fields beyond display/searchTerms:
    { kind: "add-medication", display, searchTerms, strength, doseForm }
    Keep searchTerms focused on the ingredient/brand name ("Amoxicillin") — DO NOT pack
    strength/form into searchTerms; they go in their own fields so the client can rank results.
    strength: the exact dose+concentration as written in the narrative ("400 mg/5 mL", "500 mg",
      "10 mg/mL"). Include WHENEVER the narrative gives a strength. Omit ONLY if no strength was
      mentioned (e.g. "start metoprolol" with no dose).
    doseForm: the dosage-form word ("Suspension", "Tablet", "Capsule", "Liquid", "Solution",
      "Cream", "Drops", "Spray", "Ointment", "Injection"). Include WHENEVER the narrative names
      a form — even when the word appears next to the ingredient ("amoxicillin SUSPENSION",
      "ibuprofen TABLET"). Omit ONLY if no form was mentioned.
    Example: narrative "amoxicillin suspension 400 mg/5 mL, 9 mL TID for 10 days" →
      { kind: "add-medication", display: "Amoxicillin 400 mg/5 mL suspension",
        searchTerms: ["Amoxicillin"], strength: "400 mg/5 mL", doseForm: "Suspension" }
- remove-allergy / remove-condition / remove-medication / remove-surgical-history /
  remove-hospitalization / remove-diagnosis / remove-exam-finding: { kind, display, searchTerms }.
- set-em-code: { kind, code, display }   (provider gave a CPT like "99214")
- add-cpt: { kind, code, display }       (additional CPT codes)
- remove-em-code: { kind } or { kind, code }
- remove-cpt: { kind, code }
- apply-template: { kind, display, searchTerms } — match against the practice's saved templates.
- add-procedure: { kind, display, searchTerms } — match against the practice's procedure quick picks.
  IMPORTANT: an in-clinic medication administration (e.g. "Acetaminophen 1g IV in clinic",
  "Ketorolac IM", "ondansetron 4 mg IV given") is NOT a procedure — emit it as add-medication
  with the strength/doseForm fields, even if the narrative groups it under "plan" or
  "procedures". Only emit add-procedure for things like suturing, splinting, lavage, I&D,
  imaging (X-ray, ultrasound), foreign body removal, etc.
- update-procedure: { kind, updates: [{field, value}, ...], procedureMatch? }
    Field names: bodySite, bodySide, technique, suppliesUsed, procedureDetails,
    medicationUsed, complications, patientResponse, postInstructions, timeSpent,
    performerType, documentedBy, specimenSent, consentObtained.
    bodySide values: left | right | bilateral | not-applicable.
    specimenSent / consentObtained values: "true" | "false".
    Common pitfall: words like "site", "side", "body", "to" are field-name synonyms in the
    narrative, NOT values. Don't emit a bodySide="side" update.
- edit-note-text: { kind, field, newText }
    Fields: chiefComplaint | historyOfPresentIllness | mechanismOfInjury | ros | medicalDecision.
    newText is the FULL new content for that field. If existing context is shown above and the
    narrative implies an edit-in-place (e.g. filling in a "______" placeholder, appending a clause),
    return the entire updated paragraph reflecting the edit, not just the change.
- add-exam-finding: { kind, display, searchTerms } — match against the practice's exam-template
  leaf labels. Use specific wording the provider used.
- unknown: { kind, message } — use sparingly; prefer omitting an action you can't classify.

RULES:
- Steps must be in the canonical order above.
- Each step should be one self-contained action. If the narrative says "add diagnoses X and Y",
  emit TWO add-diagnosis steps.
- For EXAM FINDINGS specifically, a single anatomic observation with multiple modifiers is ONE
  step, not several. Phrases like "X with Y and Z", "X, Y, and Z" describing one anatomic site
  should produce ONE add-exam-finding whose display retains the modifiers.
    "Right TM erythematous and bulging with loss of light reflex" → ONE step, display
    "Right TM erythematous and bulging with loss of light reflex" (NOT three).
    "Tender lateral malleolus with anterior talofibular tenderness" → ONE step.
  Emit SEPARATE steps only when the narrative describes findings on distinctly different
  anatomic sites or systems ("Right TM bulging. Throat injected." → two steps).
- Do NOT make up codes (ICD-10, RxNorm, CPT). The client searches canonical sources.
- For ambiguous picks (e.g. multiple matching procedures or exam findings), still emit the step
  with the provider's wording — the client will present a picker.
- Don't emit duplicate or redundant steps. If the narrative implies several edits to the same
  note field, fold them into a single edit-note-text with the combined final text.
- Steps that have no plausible classification or that the narrative doesn't justify should be
  omitted, not emitted as "unknown" — return an empty steps array if nothing applies.
- NEGATIVE-CONFIRMATION statements are NOT chartable items — OMIT them entirely. Examples:
    "No known drug allergies" / "NKDA" / "no allergies" → DO NOT emit add-allergy or add-condition.
    "No current medications" / "no meds" → DO NOT emit add-medication.
    "PMH unremarkable" / "no past medical history" → DO NOT emit add-condition.
    "No prior surgeries" / "no surgical history" → DO NOT emit add-surgical-history.
    "No hospitalizations" → DO NOT emit add-hospitalization.
    "No vomiting", "no rash", "no fever", etc. → DO NOT emit add-exam-finding (the chart
      defaults already capture the absence of these). Emit add-exam-finding ONLY for findings
      the provider explicitly observed as ABNORMAL (e.g. "TM erythematous", "throat injected").
  These statements ARE clinically important, but they belong in the HPI/MDM free text (which
  the planner emits as edit-note-text), not as add-* actions whose pickers would match nothing
  or, worse, the wrong thing.
- DEMOGRAPHIC + INSURANCE + CONTACT details (address, phone, email, race, ethnicity, language,
  insurance carrier/member ID, PCP info, responsible party, emergency contact) are NOT chart
  actions — OMIT them entirely. They live on the Patient/Coverage resources via the intake
  flow, not the easy-chart conversational interface.
`;
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { narrative, noteContext, secrets } = validateRequestParameters(input);

  // Fetch available templates so the planner can suggest a real one. Best-effort — if the
  // lookup fails (network, M2M auth, missing holder list), proceed without templates so the
  // planner still produces a useful decomposition without apply-template suggestions.
  let templateTitles: string[] = [];
  try {
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    templateTitles = await fetchTemplateTitles(oystehr);
  } catch (e) {
    console.warn('Planner: template-list fetch failed, proceeding without:', e);
  }

  const raw = await invokeChatbotVertexAI(
    [{ text: buildPrompt(narrative, noteContext, templateTitles) }],
    secrets,
    RESPONSE_SCHEMA
  );

  let parsed: { steps?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw INVALID_INPUT_ERROR('Model returned non-JSON output');
  }
  if (!parsed || !Array.isArray(parsed.steps)) {
    throw INVALID_INPUT_ERROR('Model returned a malformed plan');
  }

  // Light validation per step — pass through anything that has a recognized kind; let the
  // client-side per-intent handlers do the deep validation since they do it for the single-shot
  // path too.
  const steps: EasyChartAgentIntent[] = [];
  for (const item of parsed.steps) {
    if (!item || typeof item !== 'object') continue;
    const i = item as Record<string, unknown>;
    if (typeof i.kind !== 'string' || !(KIND_VALUES as readonly string[]).includes(i.kind)) continue;
    // Same fallback as the single-shot agent — sniff the narrative for a dose-form keyword if
    // the LLM omitted it. The narrative is the only place the form might appear since the
    // planner emits searchTerms focused on the ingredient name.
    if (i.kind === 'add-medication' && (typeof i.doseForm !== 'string' || !i.doseForm.trim())) {
      const display = typeof i.display === 'string' ? i.display : '';
      const searchTerms = Array.isArray(i.searchTerms)
        ? (i.searchTerms.filter((t) => typeof t === 'string' && !!t.trim()) as string[])
        : [];
      const sniffed = sniffDoseFormScoped(narrative, display, searchTerms);
      if (sniffed) i.doseForm = sniffed;
    }
    if ((i.kind === 'add-diagnosis' || i.kind === 'add-condition') && (typeof i.code !== 'string' || !i.code.trim())) {
      const display = typeof i.display === 'string' ? i.display : '';
      const searchTerms = Array.isArray(i.searchTerms)
        ? (i.searchTerms.filter((t) => typeof t === 'string' && !!t.trim()) as string[])
        : [];
      const sniffed = sniffIcdCodeScoped(narrative, display, searchTerms);
      if (sniffed) i.code = sniffed;
    }
    steps.push(i as unknown as EasyChartAgentIntent);
  }

  const output: EasyChartPlannerOutput = { steps };
  return { statusCode: 200, body: JSON.stringify(output) };
});
