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
import { resolveCptHcpcs, resolveIcd, STRICT_ICD10 } from '../../shared/easy-chart/codes';
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

// Ambient-scribe transcripts tag every line with a speaker label ("DOCTOR X31", "PATIENT X31",
// "Speaker 1"). When that label happens to match the ICD-10 shape (X31 → [A-TV-Z][0-9][A-Z0-9])
// the code sniffer grabs it as a diagnosis code — the single most embarrassing class of bug in
// the planner audit. Any code-shaped token that RECURS across the narrative is structural noise
// (a speaker tag), never a one-off diagnosis code: a real ICD-10 code is spelled once or twice.
// Collect those tokens (uppercased) so the sniffer and the post-parse validation both refuse them.
function detectSpeakerLabels(narrative: string): Set<string> {
  const labels = new Set<string>();
  // 1. Token that follows a speaker role at the start of a line ("DOCTOR X31", "PATIENT X31").
  const roleRe = /^[ \t]*(?:DOCTOR|PATIENT|NURSE|PROVIDER|CLINICIAN|MA|RN|SPEAKER)\b[ \t]*([A-Za-z0-9]+)/gim;
  let m: RegExpExecArray | null;
  while ((m = roleRe.exec(narrative)) !== null) {
    if (m[1]) labels.add(m[1].toUpperCase());
  }
  // 2. Any code-shaped token recurring >= 3 times is a label/noise, not a real one-off code.
  const counts = new Map<string, number>();
  const all = narrative.match(ICD10_REGEX);
  if (all) {
    for (const t of all) {
      const u = t.toUpperCase();
      counts.set(u, (counts.get(u) ?? 0) + 1);
    }
    for (const [t, n] of counts) {
      if (n >= 3) labels.add(t);
    }
  }
  return labels;
}

function sniffIcdCodeScoped(
  narrative: string,
  display: string,
  searchTerms: string[],
  speakerLabels: Set<string>
): string | undefined {
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
    if (matches && matches.length > 0) {
      // Skip any candidate that is actually a recurring speaker label (e.g. "X31").
      const good = matches.find((c) => !speakerLabels.has(c.toUpperCase()));
      if (good) return good;
    }
    return undefined;
  }
  return undefined;
}

// Normalize a problem label for cross-step duplicate detection (PMH add-condition vs encounter
// add-diagnosis). Conservative: case-fold, strip punctuation, collapse whitespace. Only exact
// normalized matches are treated as duplicates so a genuinely distinct pre-existing condition
// ("type 2 diabetes" in PMH) is never collapsed into a differently-worded encounter diagnosis.
function normProblem(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  'add-ros-finding',
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
          finding: { type: 'string', enum: ['reports', 'denies'] },
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
  templateTitles?: string[],
  chartState?: string,
  patientContext?: string
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

  // Anchor the note on the verified patient. The transcript is an ambient recording that often
  // contains cross-talk about OTHER patients, staff, and hallway conversation — the model must
  // document only THIS patient and never infer age/sex from the transcript.
  const patientBlock = patientContext
    ? `\nPATIENT (authoritative — from the chart, not the transcript): ${patientContext}.\n` +
      `Use exactly this age and sex in the note (e.g. the HPI one-liner). Do NOT infer the ` +
      `patient's age or sex from the transcript.\n`
    : '';

  const templatesBlock =
    templateTitles && templateTitles.length > 0
      ? `\nAVAILABLE TEMPLATES in this practice (exact titles — match these when you apply-template; do NOT invent template names):\n${templateTitles
          .map((t) => `- ${t}`)
          .join('\n')}\n`
      : '';

  // When the caller is refreshing the plan after a template applied, they pass a summary of
  // chart state so the LLM omits add-* steps for items already documented.
  const chartStateBlock = chartState
    ? `\nALREADY ON THE CHART (do NOT emit add-* steps for these — they're already documented; also do NOT emit apply-template again):\n${chartState}\n`
    : '';

  return `
You are an assistant helping a provider chart a clinical encounter. The provider just typed a
free-text NARRATIVE describing everything they want done on the chart:

"""
${narrative}
"""
${patientBlock}${contextBlock}${templatesBlock}${chartStateBlock}
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
     LATERALITY = the side(s) actually DIAGNOSED, not the sides examined. "Pulling on the right
     ear; I'll check both" with an exam finding only on the right is a RIGHT-side diagnosis →
     "AOM Right", NOT "AOM Bilateral". Choose Bilateral ONLY when the disease/finding is present
     on BOTH sides (e.g. "both TMs bulging and erythematous"). Examining both ears, or symptoms
     that started on one side and moved, does not make it bilateral.
     CURRENT problem, not a PAST one: anchor the side/site on the body part that is abnormal or
     being treated AT THIS VISIT. A problem the patient previously HAD on the other side, an
     already-resolved finding, or a side that is normal on today's exam is HISTORY and must never
     set the laterality of the current diagnosis — even when that other side is named prominently.
     When one side is described as normal/clear now and the other as the problem, the diagnosis is
     the PROBLEM side: e.g. "the right looks fine, it's the left that's infected; she'd had a right
     one a while back that cleared" → code the LEFT (the side affected now), not the right.
     APPLY A TEMPLATE ONLY ON A STRONG, SPECIFIC MATCH. A template is appropriate only when one of
     the AVAILABLE TEMPLATES clearly corresponds to THIS visit's primary diagnosis or presentation
     (e.g. "Croup" for croup, "AOM Right" for right otitis media, "Ankle Sprain" for an ankle sprain).
     If the closest available template is for a DIFFERENT or only loosely-related condition, do NOT
     apply it — a mismatched template pollutes the note with the wrong exam/MDM scaffolding. Concrete
     do-NOTs: "Asthma" for a COPD exacerbation, "Bug Bite" for a cutaneous abscess, "Sprain/strain"
     for a fracture, a generic procedure template for a specific laceration. In all those cases OMIT
     apply-template and build the note directly with add-diagnosis, add-exam-finding, and the note
     fields. It is better to have NO template than the wrong one; when in doubt, omit it.
     Match a template by the DIAGNOSIS/condition, NOT by whether an x-ray or procedure happened: a
     template titled "Sprain/strain with xray" is for a SPRAIN that got an x-ray, not for any injury
     that got imaging. A FRACTURE is NOT a sprain — never apply a sprain/strain template to a
     fracture, even when an x-ray was done; if there is no fracture template, omit apply-template.
     The ONE allowed exception: a template that is genuinely the right CATEGORY but more GENERIC than
     the specific diagnosis (e.g. a "Headache" template when the diagnosis is migraine) MAY be
     applied for structure — and when you do, ALSO emit an add-diagnosis for the specific diagnosis
     (e.g. add-diagnosis "Migraine", isPrimary=true) so the precise primary code lands on the chart.
  2. Patient history (add/remove-allergy, condition, medication, surgical-history, hospitalization)
  3. Free-text fields, in note order: edit-note-text for chiefComplaint, historyOfPresentIllness,
     mechanismOfInjury, medicalDecision. (Review of Systems is NOT free text — it is structured
     checkboxes; use add-ros-finding, NOT edit-note-text, for ROS.)
     ALWAYS emit edit-note-text for historyOfPresentIllness AND medicalDecision (MDM) on EVERY
     visit, even when a template was applied. These are patient-specific and REQUIRED for a signable
     note, and a template cannot supply the patient's actual history or the visit's reasoning — its
     defaults are generic boilerplate that the patient-specific text must supersede. Write HPI as the
     narrative's history of the presenting problem, and MDM as the assessment + plan + medications +
     counseling + return precautions. chiefComplaint and mechanismOfInjury are conditional: emit
     chiefComplaint when the visit reason is clear, and mechanismOfInjury only for injury visits.
  4. Exam findings (add-exam-finding / remove-exam-finding). When a template was applied, ONLY
     emit add-exam-finding for ABNORMAL findings (or normal findings the narrative specifically
     calls out that the template doesn't cover by default). Templates already check the default
     normal findings for that section — don't re-add them.
  4b. ROS findings (add-ros-finding) — with finding="reports" or "denies". These are structured
     (rosObservations), separate from the exam. Focus the ROS on the pertinent NEGATIVES the provider
     stated and on ASSOCIATED symptoms in OTHER systems than the chief complaint; you need not
     mechanically re-list every chief-complaint phrase from the HPI as its own ROS finding (a couple
     of the key presenting symptoms is plenty — the HPI already carries the full story). Record each
     pertinent negative the provider explicitly denied.
  5. Diagnoses (add-diagnosis — mark isPrimary=true for exactly ONE primary; all other diagnoses
     are secondary with isPrimary=false). Emit a SEPARATE add-diagnosis for EVERY distinct
     diagnosis the provider made this visit — many encounters have 2-3 (e.g. "otitis media AND
     otitis externa", "ear infection, an insect bite, and conjunctivitis", "bug bite that has
     become cellulitis"). Do not collapse a multi-problem visit to a single diagnosis.
     When a template was applied in step 1 and its title matches the PRIMARY diagnosis (e.g.
     AOM Right + acute otitis media right ear), OMIT the add-diagnosis for that primary one — the
     template already added it — but STILL emit add-diagnosis for every OTHER diagnosis the
     template does not cover (the secondary conditions). A template carries only its own
     diagnosis; it never supplies the secondaries.
  6. Procedures (add-procedure, then update-procedure for any field changes referencing the
     same procedure by procedureMatch — match by procedure name)
  7. Billing: ALWAYS emit exactly one set-em-code — templates never carry an E&M code, so you must
     always supply it (see set-em-code for level selection). Plus add-cpt for any extra CPTs —
     including the 96372 administration code + drug HCPCS J-code whenever a medication was
     injected/infused in clinic (see add-cpt).

ACTION SHAPES (use these intent kinds and the same fields the single-shot agent uses):

- add-allergy / add-condition / add-medication / add-surgical-history / add-hospitalization /
  add-diagnosis: { kind, display, searchTerms[1-3] }; add-diagnosis also takes isPrimary.
- add-condition and add-diagnosis ALSO take a "code" field for the ICD-10 code. PROVIDE YOUR BEST
  ICD-10 code for EVERY diagnosis — your best clinical judgment, even when the narrative did not
  state one ("herniated disc at L4-L5" → "M51.16", "acute otitis media right ear" → "H66.91",
  "migraine" → "G43.909", "PMH hypertension" → "I10"). Format: just the code, no parentheses.
  Every code is VALIDATED against the official ICD-10 set before anything is charted: if your code
  is a real billable code it is used; if it is not, the system automatically falls back to searching
  your "display"/"searchTerms" — so a wrong guess is safely corrected and a hallucinated code can
  NEVER be charted. Propose confidently; do not leave the code blank just because the narrative
  didn't spell it out. Still set an accurate, SPECIFIC "display" — it is the fallback search query
  and the picker label (without it the search returns wrong subtypes, e.g. "Acute otitis media" →
  serous H65.x instead of suppurative H66.x).
  INCLUDE ANATOMIC LOCATION + LATERALITY for INJURY / EXTERNAL-CAUSE diagnoses (ICD-10 S- and
  T-codes: bites, sprains, fractures, lacerations, burns, contusions). For these, the code is
  organized by body region, so the "display" and "searchTerms" MUST carry the site/side the
  provider documented or the search picks an arbitrary region. E.g. "insect bite on the right
  lower leg" → display "Insect bite, right lower leg", searchTerms ["insect bite lower leg"]; NOT
  bare "Insect bite". Do NOT do this for chronic/medical disease codes (gout, otitis, diabetes,
  conjunctivitis, etc.) — providers frequently chart the unspecified-site code for those even when
  a site is mentioned, so leave the site OUT of the display unless the provider explicitly named a
  site-specific diagnosis. Adding a site to "gout" wrongly forces a site-specific M10.0x over the
  commonly-used M10.9 "gout, unspecified".
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
- set-em-code: { kind, code, display } — ALWAYS emit exactly one (templates do not carry an E&M
  code, so you must estimate the level from the documented complexity). Default to established-patient
  office-visit codes: 99213 for a straightforward, low-complexity visit (a single self-limited
  problem with simple management); 99214 for moderate complexity — which prescription drug
  management, an acute illness needing a procedure, an injury needing imaging, or multiple problems
  commonly support (i.e. most visits where you start an antibiotic, give an injection, do a
  procedure, or order an x-ray lean 99214). Reserve 99215 for high-complexity/high-risk. When torn
  between two levels choose the lower — the goal is that a defensible level is always present and the
  provider can adjust.
- add-cpt: { kind, code, display }       (additional CPT codes)
    INJECTION ADMINISTRATION BILLING — the one case where you SHOULD supply codes yourself:
    ONLY when a medication is GIVEN IN CLINIC by an INJECTED/INFUSED route — IM, SC, or IV (a
    "shot", "injection", "IM", "IV push", "infusion"). This does NOT apply to oral meds, topical
    creams, otic/ophthalmic drops, inhalers/nebulizers, or any prescription sent to a pharmacy —
    for those, emit only the add-medication, NO administration CPT. When the route IS injection,
    emit BOTH (a) the add-medication for the drug AND (b) an add-cpt for the
    administration code, AND (c) an add-cpt for the drug's HCPCS supply code when the drug is in
    the table below. These are deterministic, standard codes — supplying them here is NOT
    "making up a code".
    Administration codes (pick ONE, the most specific that fits):
      96372 — therapeutic/prophylactic/diagnostic injection, SC or IM (the usual default for an
              IM/SC shot like Toradol/ketorolac, dexamethasone, Rocephin)
      96374 — IV push, single drug, initial
      96365 — IV infusion, initial up to 1 hour
    Common in-clinic drug HCPCS supply codes (emit alongside 96372 when the drug matches):
      J1885 — ketorolac tromethamine, per 15 mg (Toradol)
      J1100 — dexamethasone sodium phosphate, per 1 mg (Decadron)
      J0696 — ceftriaxone sodium, per 250 mg (Rocephin)
      J2550 — promethazine HCl, per 25 mg (Phenergan)
      J2405 — ondansetron HCl, per 1 mg (Zofran)
      J1200 — diphenhydramine HCl, per 50 mg (Benadryl)
      J3420 — vitamin B-12, per 1000 mcg
    Example: narrative "gave a Toradol shot / 60 of Toradol IM" → emit add-medication (Ketorolac,
    Injection, 60 mg) AND add-cpt {code:"96372", display:"Therapeutic injection, SC/IM"} AND
    add-cpt {code:"J1885", display:"Injection, ketorolac tromethamine, per 15 mg"}.
    If the drug is given in clinic but is NOT in the table, still emit the 96372 administration
    add-cpt; omit the J-code rather than guess it.
- remove-em-code: { kind } or { kind, code }
- remove-cpt: { kind, code }
- apply-template: { kind, display, searchTerms } — match against the practice's saved templates.
- add-procedure: { kind, display, searchTerms } — match against the practice's procedure quick picks.
  IMPORTANT: an in-clinic medication administration (e.g. "Acetaminophen 1g IV in clinic",
  "Ketorolac IM", "ondansetron 4 mg IV given") is NOT a procedure — emit it as add-medication
  with the strength/doseForm fields, even if the narrative groups it under "plan" or
  "procedures". Only emit add-procedure for things like suturing, splinting, lavage, I&D,
  imaging (X-ray, ultrasound), foreign body removal, etc.
  NOTE: an in-clinic injection still has BILLING consequences — in addition to the
  add-medication, emit the administration add-cpt (96372) and the drug's HCPCS J-code per the
  add-cpt rules below.
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

    VOICE for newText — write as a treating clinician would document, NOT as a layperson summary:
      * Third person, no patient first name in the body ("the patient", "an 8mo female").
      * Concise clinical phrasing with standard abbreviations (HPI, PMH, NKDA, RLQ, OM, URI, w/,
        s/p, c/o, p/w, +/-, ROS, prn, etc.) where they reduce wordiness without losing meaning.
      * Standard clinical structure: HPI starts with a brief one-liner identifier
        ("8mo F p/w fever and right otalgia x1 day"), then a chronological narrative of the
        complaint, associated symptoms (pertinent positives AND pertinent negatives),
        pertinent ROS, relevant context (recent exposures, prior episodes). Drop demographic
        details that already live on the Patient resource (full name, DOB, address, phone,
        insurance, race, ethnicity, language, PCP, emergency contacts) — those go via intake,
        not the note.
      * Convert lay phrasing to clinical: "pulling at her ear" → "tugging at right ear /
        right otalgia", "fussy" → "irritable", "sleeping poorly" → "decreased sleep",
        "no vomiting or diarrhea" → "no N/V/D", "throwing up" → "vomiting", "lung sounds
        good" → "CTAB", "tummy soft" → "abdomen soft", etc.
      * CC: 2-6 words ("Right ear pain", "Cough x3 days", "Auto accident"). Not a sentence.
      * MDM: clinical reasoning + plan rationale, not patient instructions. Use "consistent
        with…", "differential includes…", "no red flags for…", "treated with…".
      * Skip pleasantries, marketing language, and obvious safety-net statements that the
        chart template already provides — focus on what's specific to THIS encounter.
- add-exam-finding: { kind, display, searchTerms } — match against the practice's exam-template
  leaf labels. Use specific wording the provider used.
- add-ros-finding: { kind, display, searchTerms } — a structured Review-of-Systems finding. The
  display MUST begin with the word "Denies" or "Reports" followed by the symptom name, e.g.
  "Denies fever", "Reports insomnia". UNLIKE exam findings and allergies, ROS records NEGATIVES too:
  when the narrative says the patient "denies fevers, nausea, vomiting" emit a SEPARATE
  add-ros-finding for EACH symptom with a "Denies …" display; when the patient reports a symptom in
  the history ("left leg pain", "couldn't sleep") use a "Reports …" display. searchTerms are 1-3
  synonyms for the symptom (do NOT include the word Denies/Reports). Example of the FORMAT — for a
  narrative "denies chest pain and shortness of breath; reports a headache" the steps are EXACTLY:
    {"kind":"add-ros-finding","display":"Denies chest pain","searchTerms":["chest pain"]}
    {"kind":"add-ros-finding","display":"Denies shortness of breath","searchTerms":["shortness of breath","dyspnea"]}
    {"kind":"add-ros-finding","display":"Reports headache","searchTerms":["headache","cephalgia"]}
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
- PROPOSE your best ICD-10 code for every diagnosis (see add-diagnosis). Every code you emit is
  validated against the canonical code set and replaced via search if it is not real, so propose
  confidently — you cannot chart a hallucinated diagnosis code. For CPT/HCPCS, supply a code ONLY
  when you are confident it is a real, performed procedure/supply or the standard
  injection-administration set (96372/96374/96365) and curated drug HCPCS J-codes under add-cpt;
  these are likewise validated against the CPT service and dropped if not real. Do NOT invent
  RxNorm codes — medications resolve by name.
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
    "No vomiting", "no rash", "no fever" as EXAM observations → DO NOT emit add-exam-finding (the
      chart defaults already capture the absence of these). Emit add-exam-finding ONLY for findings
      the provider explicitly observed as ABNORMAL (e.g. "TM erythematous", "throat injected").
  These statements ARE clinically important, but they belong in the HPI/MDM free text (which
  the planner emits as edit-note-text), not as add-* actions whose pickers would match nothing
  or, worse, the wrong thing.
  EXCEPTION — REVIEW OF SYSTEMS: a patient DENYING a symptom in the history (e.g. "denies cough,
  congestion, or sore throat") IS a chartable ROS finding — emit a "Denies …" add-ros-finding for
  each. This is the opposite of the exam/allergy rule above: ROS records both reported AND denied
  symptoms.
- DISPOSITION IS NEVER OPTIONAL — this is a patient-safety rule. If the provider directs the
  patient to a higher level of care or emergency services — "go to the ER / emergency department",
  "call 911", "I'm sending you to the hospital", "we're admitting you", "go straight to urgent
  care", "activate EMS", or an urgent specialist referral for a red-flag finding — you MUST
  capture that disposition. There is no structured disposition step yet, so fold it into the
  medicalDecision (MDM) via edit-note-text as an explicit clinical sentence (e.g. "Patient
  directed to the ED for evaluation of <concern>; EMS activated."). NEVER silently drop a
  disposition just because there is no dedicated field for it.
- DEMOGRAPHIC + INSURANCE + CONTACT details (address, phone, email, race, ethnicity, language,
  insurance carrier/member ID, PCP info, responsible party, emergency contact) are NOT chart
  actions — OMIT them entirely. They live on the Patient/Coverage resources via the intake
  flow, not the easy-chart conversational interface.
- SAME-PATIENT ONLY. The transcript is a raw ambient recording and frequently contains content
  that is NOT about this patient: chatter about OTHER patients ("Amon just brought her son in,
  he's 2 and got bit by a spider"), staff/student conversation, scheduling, personal asides.
  Document ONLY the patient identified in the PATIENT block above. IGNORE any symptoms, ages,
  sexes, diagnoses, fevers, or medications that the transcript attributes to a different person.
  If a detail can't be confidently tied to THIS patient's visit, leave it out.
`;
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { narrative, noteContext, chartState, secrets } = validateRequestParameters(input);

  // Fetch available templates so the planner can suggest a real one. Best-effort — if the
  // lookup fails (network, M2M auth, missing holder list), proceed without templates so the
  // planner still produces a useful decomposition without apply-template suggestions.
  let templateTitles: string[] = [];
  let oystehr: Oystehr | undefined;
  try {
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    oystehr = createOystehrClient(m2mToken, secrets);
    templateTitles = await fetchTemplateTitles(oystehr);
  } catch (e) {
    console.warn('Planner: template-list fetch failed, proceeding without:', e);
  }

  const raw = await invokeChatbotVertexAI(
    [{ text: buildPrompt(narrative, noteContext, templateTitles, chartState) }],
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

  // Recurring speaker labels (e.g. "X31") computed once per request — used to keep transcript
  // speaker tags from ever surviving as a diagnosis "code".
  const speakerLabels = detectSpeakerLabels(narrative);

  // Light validation per step — pass through anything that has a recognized kind; let the
  // client-side per-intent handlers do the deep validation since they do it for the single-shot
  // path too.
  const records: Record<string, unknown>[] = [];
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
    if (i.kind === 'add-diagnosis' || i.kind === 'add-condition') {
      // `strength` is a medication-only field; the model sometimes leaks it onto a diagnosis
      // (often "strength":"true") to fake primacy. Strip it — isPrimary is the only primacy signal.
      if ('strength' in i) delete i.strength;

      if (typeof i.code !== 'string' || !i.code.trim()) {
        const display = typeof i.display === 'string' ? i.display : '';
        const searchTerms = Array.isArray(i.searchTerms)
          ? (i.searchTerms.filter((t) => typeof t === 'string' && !!t.trim()) as string[])
          : [];
        const sniffed = sniffIcdCodeScoped(narrative, display, searchTerms, speakerLabels);
        if (sniffed) i.code = sniffed;
      }
      // Drop a code that is a speaker label or not a well-formed ICD-10 — better to let the
      // client text-search by display than to commit a bogus code (the X31 / wrong-field bug).
      if (typeof i.code === 'string' && i.code.trim()) {
        const c = i.code.trim().toUpperCase();
        if (speakerLabels.has(c) || !STRICT_ICD10.test(c)) delete i.code;
      }
    }
    records.push(i);
  }

  // Cross-step normalization (needs the whole plan in hand):

  // (B) Exactly one primary diagnosis. If diagnoses exist but none is marked, the first is
  // primary; if several are marked, keep only the first; force the rest explicitly secondary.
  const dxRecords = records.filter((r) => r.kind === 'add-diagnosis');
  if (dxRecords.length > 0) {
    let primarySeen = false;
    for (const r of dxRecords) {
      if (r.isPrimary === true && !primarySeen) {
        primarySeen = true;
      } else {
        r.isPrimary = false;
      }
    }
    if (!primarySeen) dxRecords[0].isPrimary = true;
  }

  // (C) Dedupe PMH vs encounter: a problem emitted as BOTH add-condition (history) and
  // add-diagnosis (this visit) is the same problem documented twice — drop the add-condition.
  const dxNorms = new Set<string>();
  const dxCodes = new Set<string>();
  for (const r of dxRecords) {
    if (typeof r.display === 'string' && r.display.trim()) dxNorms.add(normProblem(r.display));
    if (typeof r.code === 'string' && r.code.trim()) dxCodes.add(r.code.trim().toUpperCase());
  }
  const deduped = records.filter((r) => {
    if (r.kind !== 'add-condition') return true;
    const displayDup = typeof r.display === 'string' && r.display.trim() && dxNorms.has(normProblem(r.display));
    const codeDup = typeof r.code === 'string' && r.code.trim() && dxCodes.has(r.code.trim().toUpperCase());
    return !(displayDup || codeDup);
  });

  // (D) Code validation — the invariant: the model's codes are only hints; every code that
  // survives is one the canonical ICD search / CPT service actually returned, so a hallucinated
  // code can never reach the note.
  await Promise.all(
    deduped.map(async (r) => {
      if (r.kind === 'add-diagnosis' || r.kind === 'add-condition') {
        const display = typeof r.display === 'string' ? r.display : '';
        const searchTerms = Array.isArray(r.searchTerms)
          ? (r.searchTerms.filter((t) => typeof t === 'string' && !!t.trim()) as string[])
          : [];
        const resolved = await resolveIcd(typeof r.code === 'string' ? r.code : undefined, display, searchTerms);
        if (resolved) r.code = resolved.code;
        else delete r.code; // nothing valid → let the client picker resolve by display
      } else if ((r.kind === 'set-em-code' || r.kind === 'add-cpt') && typeof r.code === 'string' && r.code.trim()) {
        if (!oystehr) return; // no client (template fetch failed) → can't validate; leave as-is (degraded)
        const resolved = await resolveCptHcpcs(oystehr, r.code, typeof r.display === 'string' ? r.display : '');
        if (resolved === null) {
          (r as Record<string, unknown>).__drop = true; // reachable + invalid → drop the step
        } else {
          r.code = resolved.code;
          if (resolved.display) r.display = resolved.display;
        }
      }
    })
  );

  const steps = deduped.filter((r) => !(r as Record<string, unknown>).__drop) as unknown as EasyChartAgentIntent[];

  const output: EasyChartPlannerOutput = { steps };
  return { statusCode: 200, body: JSON.stringify(output) };
});
