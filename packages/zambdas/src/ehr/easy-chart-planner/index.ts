import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import {
  chunkThings,
  EASY_CHART_INTENT_KINDS as KIND_VALUES,
  EASY_CHART_NOTE_TEXT_FIELD_LABELS as LABELS,
  EASY_CHART_NOTE_TEXT_FIELDS as NOTE_TEXT_FIELDS,
  EasyChartNoteTextField as NoteTextField,
  EasyChartPlannerOutput,
  EasyChartPlannerStep,
  EasyChartTokenUsage,
  GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { invokeChatbotStructured, parseStructuredModelOutput } from '../../shared/ai';
import { STRICT_ICD10, validateIntentCode } from '../../shared/easy-chart/codes';
import { derivePatientStatus, fetchPatientContext } from '../../shared/easy-chart/patient-context';
import {
  detectSpeakerLabels,
  recoverSourceText,
  sniffDoseFormScoped,
  sniffIcdCodeScoped,
} from '../../shared/easy-chart/sniffers';
import { normalizeVitalIntent, sniffVitalsFromNarrative } from '../../shared/easy-chart/vitals';
import { createClinicalOystehrClient } from '../../shared/helpers';
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

// Recover the follow-up interval (in days) the provider stated, for set-disposition steps where the
// model omitted followUpInDays — common with flash-lite on CONDITIONAL follow-ups ("follow up in a
// week if not improving"). Parse the disposition's OWN text/sourceText (the follow-up sentence), not
// the whole narrative — that contains unrelated time phrases ("started two days ago"). For a range
// ("48–72 hours", "1–2 weeks") take the lower bound (the earlier date). Returns null if none found.
function parseFollowUpDays(text: string): number | null {
  const t = text.toLowerCase();
  const word: Record<string, number> = {
    a: 1,
    an: 1,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    ten: 10,
    fourteen: 14,
  };
  const num = (s: string): number => (/^\d+$/.test(s) ? parseInt(s, 10) : word[s] ?? NaN);
  const tok = '(\\d+|a|an|one|two|three|four|five|six|seven|ten|fourteen)';
  const hours = t.match(new RegExp(`${tok}\\s*(?:[–-]|to)?\\s*\\d*\\s*hours?`));
  if (hours) {
    const n = num(hours[1]);
    if (!isNaN(n)) return Math.max(1, Math.round(n / 24));
  }
  const weeks = t.match(new RegExp(`${tok}\\s*(?:[–-]|to)?\\s*\\d*\\s*weeks?`));
  if (weeks) {
    const n = num(weeks[1]);
    if (!isNaN(n)) return n * 7;
  }
  const days = t.match(new RegExp(`${tok}\\s*(?:[–-]|to)?\\s*\\d*\\s*days?`));
  if (days) {
    const n = num(days[1]);
    if (!isNaN(n)) return n;
  }
  return null;
}

export const RESPONSE_SCHEMA = {
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
          text: { type: 'string' }, // add-patient-instruction / set-disposition note text
          dispositionType: { type: 'string' }, // set-disposition: pcp | ed | specialty | another | ip
          followUpInDays: { type: 'number' }, // set-disposition: "follow up in N days"
          finding: { type: 'string', enum: ['reports', 'denies'] },
          // set-vital: numeric vitals use `value` (+ `unit` for temp/weight/height); BP uses systolic/diastolic.
          value: { type: 'number' },
          unit: { type: 'string' },
          systolic: { type: 'number' },
          diastolic: { type: 'number' },
          // PROVENANCE: the verbatim snippet from the narrative that justifies this step. Empty
          // string for steps INFERRED rather than spoken (default-normal exam, template defaults,
          // codes deduced from context). The client marks items sourced-vs-inferred from this.
          sourceText: { type: 'string' },
        },
        required: ['kind'],
      },
    },
  },
  required: ['steps'],
};

export const buildPrompt = (
  narrative: string,
  noteContext?: Partial<Record<NoteTextField, string>>,
  templateTitles?: string[],
  chartState?: string,
  patientContext?: string,
  incremental?: boolean,
  patientStatus?: 'new' | 'established'
): string => {
  const contextLines: string[] = [];
  if (noteContext) {
    for (const field of NOTE_TEXT_FIELDS) {
      const v = noteContext[field];
      contextLines.push(
        v && v.trim()
          ? `- ${LABELS[field]} (field="${field}"): """${v}"""`
          : `- ${LABELS[field]} (field="${field}"): <empty>`
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

  // Per-call E&M family selector (see set-em-code in the fixed instructions). Rendered in the
  // per-visit tail — not the static prefix — so prompt caching is unaffected. When unknown, no
  // line is emitted and the fixed instructions direct the model to the established family.
  const patientStatusBlock =
    patientStatus === 'new'
      ? `\nPATIENT STATUS (authoritative — from the chart): NEW patient — no professional services in the past 3 years. Use the NEW-patient E&M family (99202-99205) for set-em-code.\n`
      : patientStatus === 'established'
      ? `\nPATIENT STATUS (authoritative — from the chart): ESTABLISHED patient. Use the ESTABLISHED-patient E&M family (99212-99215) for set-em-code.\n`
      : '';

  const templatesBlock =
    templateTitles && templateTitles.length > 0
      ? `\nAVAILABLE TEMPLATES in this practice (exact titles — match these when you apply-template; do NOT invent template names):\n${templateTitles
          .map((t) => `- ${t}`)
          .join('\n')}\n`
      : '';

  // Two flavors of "what's already on the chart":
  //  - incremental (a post-template re-plan, or a follow-up message charted onto an already-written
  //    note): the NARRATIVE is an INCREMENTAL addition, NOT a fresh full note — the LLM must chart
  //    only what's NEW and never re-document what's already there. Without this guard a short "also
  //    send a script for X" snippet gets re-expanded into a whole note (re-editing the chief
  //    complaint, re-setting the E&M, re-deriving symptom diagnoses).
  //  - NOT incremental but chartState present (the FIRST full dictation for a patient whose chart
  //    already carries intake-harvested history — paperwork allergies/meds/conditions): plan the
  //    full note as normal, INCLUDING apply-template; just don't duplicate the listed items.
  //    Treating this case as incremental was a bug — every patient with intake history silently
  //    lost the template/exam/MDM scaffolding on their first dictation.
  const chartStateBlock = chartState
    ? incremental
      ? `\nALREADY ON THE CHART — the note has already been charted and the NARRATIVE above is an INCREMENTAL addition. Emit steps ONLY for information the narrative NEWLY introduces; do NOT re-document anything already present. Specifically: no add-* step for an item listed below; no set-em-code when an E&M is already listed below; and no edit-note-text for a free-text field (Chief Complaint / HPI / Mechanism of Injury / MDM) that the "Current free-text fields" block shows is already non-empty, UNLESS this narrative supplies new wording for that exact field. Do NOT emit apply-template again.\n${chartState}\n`
      : `\nALREADY ON THE CHART — the items below already exist (typically history harvested from intake paperwork), but the note itself has NOT been written yet: the NARRATIVE above is the FIRST full dictation for this visit. Plan the full note as normal — apply-template when one fits, exam findings, E&M, and free-text fields. Do NOT emit an add-* step that duplicates an item listed below, and do NOT re-set an E&M code if one is already listed below.\n${chartState}\n`
    : '';

  // PROMPT ORDER MATTERS: keep the static instructions (and the per-practice template list) as a
  // STABLE PREFIX, and append the per-call NARRATIVE + patient/context/chart-state at the very END —
  // so the provider can cache the fixed prefix instead of re-billing it on every plan.
  return `You are an assistant helping a provider chart a clinical encounter. The provider's free-text
NARRATIVE (everything they want done on the chart) appears at the END of this message, after the
instructions.
${templatesBlock}
Decompose that narrative into an ordered sequence of charting ACTIONS. Each action is one of
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
  2. Patient history (add-allergy, add-condition, add-medication, add-surgical-history,
     add-hospitalization). This is the patient's BACKGROUND, distinct from today's diagnoses and
     treatment — it is frequently stated in the narrative and just as frequently forgotten, so
     extract it deliberately. Emit a SEPARATE step for each item:
       a. ALLERGIES — any allergy the provider states the patient HAS, or directs to be added to the
          allergy list, MUST become an add-allergy on the structured allergy list. This is REQUIRED
          and is SEPARATE from any "allergic reaction" diagnosis: a new drug reaction this visit
          produces BOTH an add-diagnosis for the reaction AND an add-allergy for the culprit drug.
          BE SPECIFIC about the allergen — the allergy database is matched by name, and a vague root
          word resolves to the WRONG entry. Name the specific drug if stated; if only a drug CLASS is
          stated, use the PRECISE class allergen, not an ambiguous stem. In particular "sulfa"/
          "sulfonamide" alone collides with sulfonamide DIURETICS (e.g. "Loop Diuretics
          (Sulfonamide)") and with the salt word "sulfate" — so for a sulfa ANTIBIOTIC reaction emit
          the antibiotic class explicitly. "Allergic reaction to the sulfa antibiotic … add sulfa to
          her allergy list" → add-diagnosis "Allergic reaction" AND add-allergy {display:"Sulfonamide
          Antibiotics", searchTerms:["sulfonamide antibiotic","sulfamethoxazole","sulfa antibiotic"]}
          — NOT display "Sulfa"/searchTerms ["sulfa"]. Likewise prefer the specific agent or class for
          other drug allergies ("penicillin" → Penicillins; "codeine" → Codeine). Do NOT bury a
          stated allergy only in the MDM/HPI text. (The NEGATIVE-CONFIRMATION rule still applies:
          "NKDA"/"no known allergies" → emit NOTHING.)
       b. PAST MEDICAL HISTORY — a chronic or pre-existing condition the patient is stated to carry
          ("known history of asthma", "h/o COPD", "PMH includes diabetes/hypertension") MUST become
          an add-condition with that condition's code, SEPARATE from today's visit diagnosis. E.g.
          "9yo with a known history of asthma here with an asthma exacerbation" → add-condition
          "Asthma" (the background) in ADDITION to the exacerbation diagnosis/template. A condition
          that has fully RESOLVED or is in the PAST uses a personal-history Z-code, not the active
          code: "history of a kidney stone two years ago that passed" → add-condition
          {display:"Personal history of urinary calculus", code:"Z87.442"}, NOT N20.0.
       c. SOCIAL HISTORY — "former smoker" / "current smoker" / "tobacco use" → add-condition with
          the appropriate code ("former smoker" → Z87.891 personal history of nicotine dependence;
          "current smoker" → F17.210). Capture it when stated; it is often billing-relevant.
       d. HOME / CURRENT MEDICATIONS — medications the patient ALREADY TAKES at home (as opposed to
          what you prescribe/administer today) → add-medication. "using her albuterol at home",
          "takes lisinopril daily" → add-medication for each. (Meds you start/give this visit are
          also add-medication — both are fine; do not drop the home meds just because a treatment
          med is also present.)
     Do NOT invent history that the narrative does not state, and do NOT chart negatives ("no
     diabetes", "no prior surgeries") as history items — those rules from below still hold.
  3. Free-text fields, in note order: edit-note-text for chiefComplaint, historyOfPresentIllness,
     mechanismOfInjury, medicalDecision. (Review of Systems is NOT free text — it is structured
     checkboxes; use add-ros-finding, NOT edit-note-text, for ROS.)
     ALWAYS emit edit-note-text for historyOfPresentIllness AND medicalDecision (MDM) on EVERY
     visit, even when a template was applied — both are required for a complete, signable note.
     They are patient-specific and a template cannot supply them; its defaults are generic
     boilerplate that the patient-specific text must supersede. Write HPI as the narrative's
     history of the presenting problem (opening with the brief one-liner identifier), and MDM as
     the assessment + plan the provider ACTUALLY dictated — the charted diagnosis's reasoning, the
     treatment with drug/dose when stated, the stated follow-up. Never pad the MDM with generic
     boilerplate the provider didn't say (see the MDM rules under VOICE below).
     chiefComplaint is CONDITIONAL — most providers leave it blank because the HPI's opening
     one-liner already states the reason for the visit. Emit a chiefComplaint edit-note-text ONLY
     when it adds information the HPI's first line does not already carry (e.g. the provider
     explicitly dictates a chief complaint distinct from the HPI opener); when it would merely
     restate the HPI's first line, SKIP the chiefComplaint step entirely. When you do emit it, it
     is a brief 2–6 word label (NOT a sentence — e.g. "Low back pain", "Right ear pain", "Cough
     x3 days"), as its OWN edit-note-text step, never merged into the HPI. mechanismOfInjury is
     conditional: emit it only for injury visits.
  3b. Vitals (set-vital) — emit ONE set-vital for EACH vital sign the narrative states (temperature,
     heart rate, respiration rate, blood pressure, oxygen saturation, weight, height). Pass the value
     and its unit exactly as stated (e.g. Temp "98.9" unit "F"); the client converts to the stored
     unit. Do not invent vitals the narrative doesn't give. If the SAME vital was measured more than
     once (an initial reading and a recheck), emit a separate set-vital for EACH reading in order —
     serial measurements all belong on the chart. Every set-vital must carry its number in "display".
  4. Exam findings (add-exam-finding / remove-exam-finding). When a template was applied, ONLY
     emit add-exam-finding for ABNORMAL findings (or normal findings the narrative specifically
     calls out that the template doesn't cover by default). Templates already check the default
     normal findings for that section — don't re-add them.
     WHEN NO TEMPLATE MATCHES the visit, the exam section starts EMPTY: emit an add-exam-finding for
     EVERY dictated exam finding, including the pertinent NORMALS ("regular rate and rhythm without
     murmurs", "lungs clear bilaterally", "neuro intact", "5/5 strength", "normal gait") — anything
     you do not emit is simply absent from the note. Emit each finding as its own step.
     RECONCILE CONTRADICTIONS: an applied template fills in a FULL normal physical exam. When the
     narrative states an ABNORMAL finding, the template's matching NORMAL finding is now wrong and
     must be removed so the note is not self-contradictory. For each normal finding in the
     "Exam findings already checked" list that the narrative DIRECTLY contradicts, emit a
     remove-exam-finding whose display is that charted finding's exact wording.
     NEGATION GUARD (read FIRST): only the POSITIVE PRESENCE of a finding triggers the cases below.
     A finding the narrative explicitly NEGATES is NOT abnormal — it CONFIRMS the template's normal.
     When the narrative says a finding is ABSENT ("no wheezing", "without crackles", "lungs clear",
     "no respiratory distress", "no exudate", "non-tender", "no rash"), do BOTH: do NOT emit
     add-exam-finding for it (exam findings are positive observations only — there is no "negative"
     exam observation), and do NOT remove the matching normal (keep it — the narrative agrees with it).
     Match on POLARITY, not on the keyword: "no wheezing" must never produce a "Wheezing" finding nor
     remove the respiratory normals; reconcile below ONLY when the finding is actually present
     ("wheezing heard", "crackles at the right base", "tonsillar exudate present"). Common cases:
       • narrative describes ANY distress (e.g. "moderate respiratory distress", accessory muscle
         use, intercostal retractions, speaking in short sentences) → remove "In no acute distress".
       • narrative describes wheezing, rales/crackles, rhonchi, decreased/diminished air entry, a
         prolonged expiratory phase, or respiratory distress → remove "No signs of respiratory
         distress" AND "Good air movement throughout lung fields".
       • narrative describes pharyngeal erythema/injection or tonsillar exudate → remove
         "Oropharynx clear with no erythema, lesions, or exudate".
       • narrative describes conjunctival injection or discharge → remove the matching
         "conjunctiva non-injected, no discharge" finding.
       • narrative describes abdominal tenderness, distension, or guarding → remove "Soft" /
         "Nontender" / "Nondistended" as applicable.
     STRICT LIMITS: only remove a normal the narrative DIRECTLY contradicts. KEEP every normal the
     narrative is silent about or consistent with — e.g. keep "Regular rate and rhythm with no
     murmur" even when the patient is tachycardic (tachycardia is a vital, not a murmur), and KEEP
     the ear / eye / abdomen / neuro normals when the narrative never describes an abnormality in
     that system. Do NOT remove a normal merely because its body system was examined or mentioned.
     MATCH STRUCTURE TO STRUCTURE: a finding about ONE structure does not contradict a normal about a
     DIFFERENT structure within the same system. An abnormal tympanic membrane ("TM bulging,
     erythematous") does NOT contradict "Normal canals" or "Normal external ear" — those are
     different ear structures the narrative said nothing abnormal about, so keep them. Only remove
     "Normal canals" if the narrative actually describes the CANAL as abnormal (debris, swelling,
     erythema of the canal).
  4b. ROS findings (add-ros-finding) — with finding="reports" or "denies". These are structured
     (rosObservations), separate from the exam. Focus the ROS on the pertinent NEGATIVES the provider
     stated and on ASSOCIATED symptoms in OTHER systems than the chief complaint; you need not
     mechanically re-list every chief-complaint phrase from the HPI as its own ROS finding (a couple
     of the key presenting symptoms is plenty — the HPI already carries the full story). Record each
     pertinent negative the provider explicitly denied. ALSO record dictated pertinent POSITIVES in
     other systems as finding="reports" ("She has a mild headache" → {kind:"add-ros-finding",
     display:"Reports headache", ...}) — positives outside the chief complaint are easy to lose.
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
  5b. Labs ordered this visit:
     • IN-OFFICE / point-of-care tests (rapid strep, rapid flu/COVID/RSV, urinalysis or urine dip,
       mono spot, fingerstick glucose, urine hCG, wet prep) → add-in-house-lab.
     • SEND-OUT / reference-lab tests (CBC, CMP/BMP, lipid panel, TSH, A1c, cultures, anything drawn
       and sent to the lab) → add-external-lab.
     Use the lab's common name as display (e.g. "CBC", "Rapid Strep A"). Do NOT also emit add-cpt for
     a test you order with add-external-lab/add-in-house-lab — the lab order carries its own billing.
  6. Procedures (add-procedure, then update-procedure for any field changes referencing the
     same procedure by procedureMatch — match by procedure name)
  7. Billing: ALWAYS emit exactly one set-em-code — templates never carry an E&M code, so you must
     always supply it (see set-em-code for level selection). Plus add-cpt for any extra CPTs —
     including the 96372 administration code + drug HCPCS J-code whenever a medication was
     injected/infused in clinic (see add-cpt).

ACTION SHAPES (use these intent kinds and the same fields the single-shot agent uses):

- add-external-lab / add-in-house-lab: { kind, display, searchTerms[1-3] } — the test's common name,
  e.g. {kind:"add-external-lab", display:"CBC", searchTerms:["complete blood count","CBC"]}.
  ONLY for tests the provider is ORDERING (to be performed). When the narrative reports a test that
  was ALREADY performed with its results ("urinalysis showed positive nitrites"), do NOT order it —
  emit a provider-note instead (see below) telling the provider to enter the result through the
  regular labs flow, quoting the dictated result values.

- provider-note: { kind, text } — a message for the PROVIDER (rendered in the chat, never written to
  the chart) for anything dictated that these actions CANNOT chart. Use it for: results of tests
  already performed ("Enter the urinalysis result in the In-House Labs flow: positive nitrites, 2+
  leukocyte esterase, trace blood"), prescriptions to transmit ("Send the Erythromycin prescription
  by eRx — I charted the medication but cannot transmit prescriptions"), and any other dictated
  instruction that requires the provider to act in the regular chart. Keep each note to one or two
  sentences; emit at most a few per plan; never use it to duplicate something another action charts.

- set-vital: { kind, field, display }. field is one of vital-temperature, vital-heartbeat,
  vital-respiration-rate, vital-oxygen-sat, vital-blood-pressure, vital-weight, vital-height.
  ALWAYS include "display" with the FULL reading exactly as stated (the client parses the numbers and
  units from "display"; never omit it). Examples — emit one step per vital:
    {"kind":"set-vital","field":"vital-blood-pressure","display":"122/78"}
    {"kind":"set-vital","field":"vital-temperature","display":"98.9 F"}
    {"kind":"set-vital","field":"vital-heartbeat","display":"76"}
    {"kind":"set-vital","field":"vital-respiration-rate","display":"16"}
    {"kind":"set-vital","field":"vital-oxygen-sat","display":"98%"}
  For blood pressure keep BOTH numbers in display as "systolic/diastolic" (e.g. "122/78"). For
  temperature include the unit letter (F or C) in display.

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
  EMIT A BILLABLE, FULLY-SPECIFIED CODE — never a 3-character category that has children (e.g. use
  M54.50/M54.51, NOT bare "M54.5"; use S06.0X0A, NOT "S06.0"). A non-billable parent is rejected and
  falls back to a text search that often lands on the wrong code.
  REGION CONSISTENCY (the code's body region MUST match your "display"): spinal / back muscle strains
  are coded by SPINE level, never by limb — cervical/neck strain → S16.1XXA; thoracic/mid-back →
  S29.012A; lumbar / low-back strain → S39.012A (or M54.50/M54.51 for low back pain). NEVER code a
  back strain to a lower-extremity site (S76 is thigh/quadriceps) or to "other injury of unspecified
  body region" (T14.8). If unsure of the exact code for the documented region, prefer a
  region-correct less-specific code over a precise code for the WRONG region — a wrong-region code is
  a billing/compliance error.
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
  code, so you must estimate the level from the documented complexity). Pick the code FAMILY from
  the PATIENT STATUS line in the per-visit context at the end of this message: NEW patient (no
  professional services in the past 3 years) → 99202-99205; ESTABLISHED patient → 99212-99215.
  When NO patient-status line is present the status is UNKNOWN — do not guess; default to the
  established-patient family (99212-99215). The MDM-complexity logic is IDENTICAL in both families
  (the last digit is the level): level 3 (99203 new / 99213 established) for a straightforward,
  low-complexity visit (a single self-limited problem with simple management); level 4 (99204 /
  99214) for moderate complexity — which prescription drug management, an acute illness needing a
  procedure, an injury needing imaging, or multiple problems commonly support (i.e. most visits
  where you start an antibiotic, give an injection, do a procedure, or order an x-ray lean level 4).
  Reserve level 5 (99205 / 99215) for high-complexity/high-risk. When torn between two levels choose
  the lower — the goal is that a defensible level is always present and the provider can adjust.
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
      * CC: 2-6 words ("Right ear pain", "Cough x3 days", "Auto accident"). Not a sentence. Emit
        the CC step at all only per step 3's rule (when it adds something the HPI opener doesn't).
      * MDM: clinical reasoning + plan rationale, not patient instructions — and EVERY statement
        in it must be anchored in what the provider actually dictated. Build it from:
          (a) the pertinent positives / exam findings the provider voiced ("bulging erythematous
              right TM with loss of light reflex") — the actual findings, not generic restatements;
          (b) the assessment for the diagnosis THIS PLAN is charting: the MDM's assessment must
              restate the plan's add-diagnosis / template diagnosis ("consistent with acute otitis
              media, right ear"), NEVER a hedged alternative differential that contradicts it — if
              the plan charts AOM and starts an antibiotic, an MDM saying "likely viral URI,
              supportive care" is a charting error;
          (c) the treatment actually ordered, with drug + dose/duration when the provider stated
              them ("started amoxicillin 400 mg/5 mL, 9 mL BID x10 days") — never "appropriate
              antibiotics", "conservative management", or an unnamed "therapy";
          (d) the follow-up interval and return conditions ONLY as the provider stated them.
        FORBIDDEN unless the provider actually said it: "supportive care", "conservative
        management", "monitor for worsening", "follow up as needed", "return precautions
        discussed", stock red-flag lists, or any differential the provider never voiced. A SHORT
        MDM made only of dictated specifics is correct; padding it with unvoiced clinical-sounding
        filler is fabrication. Aim for a provider-quality paragraph (roughly 2-6 sentences), not an
        essay. Shorthand like "consistent with…" and "treated with…" is good; write "differential
        includes…" or "no red flags for…" ONLY when the provider reasoned through that aloud. The
        MDM may state the plan in shorthand, but every patient-FACING part of that plan (how to
        take meds incl. any taper, OTC care, return precautions, follow-up) STILL needs its own
        add-patient-instruction — mentioning it in the MDM does NOT relieve you of that step.
      * Skip pleasantries, marketing language, and obvious safety-net statements that the
        chart template already provides — focus on what's specific to THIS encounter.
- add-exam-finding: { kind, display, searchTerms } — match against the practice's exam-template
  leaf labels. Use specific wording the provider used. State the ABNORMALITY as the display and do
  NOT bundle a pertinent negative ("without exudate", "no discharge", "non-tender") into an abnormal
  finding — that part describes what's NORMAL and drags the match onto the wrong (normal) leaf.
  "Oropharynx mildly injected without exudate" → display "Erythematous pharynx" (searchTerms
  ["injected oropharynx","pharyngeal erythema"]); drop the "without exudate". Keep genuinely ABNORMAL
  modifiers (erythematous, bulging, loss of light reflex) — only strip the negated/normal clauses.
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
- remove-ros-finding: { kind, display, searchTerms } — remove a ROS symptom already on the chart.
  KEEP the leading "Denies"/"Reports" verb in display ("Denies eye pain") so the right polarity is
  removed. Use this for ROS symptoms, never remove-exam-finding (that one is for physical-exam
  findings only).
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
- PROVENANCE — for EVERY step, set "sourceText" to the SHORT verbatim snippet from the NARRATIVE
  that justifies it (a few words to one sentence, copied exactly — not paraphrased). This lets the
  provider trace each charted item back to what they said. If the step is something you INFERRED
  rather than something the provider actually stated — a default-normal exam finding a template
  implies, a default diagnosis/MDM, an E&M level you deduced from overall complexity, a code you
  filled in — set "sourceText" to an EMPTY STRING "". Never fabricate a sourceText: if you cannot
  point to specific words in the narrative, it is inferred, so leave it empty. Be honest here — an
  empty sourceText is the signal that tells the provider to look closely, so guessing defeats it.
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
- DISPOSITION (set-disposition) — where the patient goes after this visit. Emit ONE set-disposition
  with dispositionType = one of:
    "pcp"       → follow up with their primary care provider / "see your doctor"
    "specialty" → referral to a specialist (ortho, cardiology, ENT, etc.)
    "ed"        → directed to the Emergency Department / "go to the ER", "call 911", "activate EMS"
    "another"   → follow up with this clinic / return here / another provider not above
    "ip"        → admitted to the hospital / inpatient
  text = the disposition note as a clinical sentence (e.g. "Follow up with orthopedic surgery for
  definitive fracture management."). followUpInDays = the follow-up interval in DAYS when stated
  ("in 48–72 hours" → 3; "in 1 week" → 7; "in 2 weeks" → 14). Example:
    {"kind":"set-disposition","dispositionType":"specialty","text":"Refer to orthopedic surgery for definitive management of the ankle fracture.","followUpInDays":3}
  DISPOSITION IS NEVER OPTIONAL when the provider states one — this is a patient-safety rule; never
  silently drop it. This holds even when the follow-up is CONDITIONAL ("follow up with PCP if not
  improving in a week", "return if it worsens") and even when it offers a CHOICE ("dermatology or his
  PCP") — STILL emit set-disposition, and STILL set followUpInDays from the stated interval ("in one
  week" → 7, even when framed as "if not improving in a week"). Pick the type from who is named: a specialist named (even as
  "<specialist> or PCP") → "specialty"; plain PCP / "your doctor" → "pcp"; "come back here / return to
  the clinic" → "another". A stated follow-up is ALWAYS structured disposition data — writing it as an
  add-patient-instruction does NOT replace the set-disposition; emit BOTH (the structured disposition
  AND the take-home text), exactly as a red-flag ED disposition ("go to the ER now") goes in the
  disposition AND as an add-patient-instruction. Example for "follow up with dermatology or his PCP if
  the rash isn't improving in one week":
    {"kind":"set-disposition","dispositionType":"specialty","text":"Follow up with dermatology or your PCP if the rash spreads or is not improving in 1 week.","followUpInDays":7}
- RADIOLOGY / IMAGING (add-radiology) — order an imaging study (X-ray, ultrasound). Triggered by
  "get a chest X-ray", "3-view ankle film", "order a right wrist X-ray". Fields: kind, display (the
  study name including view count and body site, e.g. "3-view right ankle X-ray"), searchTerms (1-3
  alternates the client matches against the radiology catalog, e.g. ["ankle x-ray","ankle 3 views"]).
  The client links the primary diagnosis automatically. Do NOT also emit add-cpt for the imaging.
- NURSING ORDER (add-nursing-order) — a task for nursing staff. Triggered by "nursing order for
  wound care", "have nursing do a straight cath", "nursing to apply a splint". Field: kind, text
  (the nursing task as a directive, e.g. "Apply a posterior short-leg splint to the right ankle.").
- PATIENT INSTRUCTIONS (add-patient-instruction) — patient-FACING guidance for the care plan. This is
  REQUIRED, not optional: anything the patient must DO or WATCH FOR after the visit gets its own
  add-patient-instruction, written as a clear directive TO THE PATIENT. The plan almost always ALSO
  gets summarized in the MDM as clinician shorthand — that does NOT cover the patient. So emit the
  patient-facing version SEPARATELY for EACH of these whenever the narrative states one:
    • HOW TO TAKE EACH MEDICATION — the regimen the patient actually follows: dose, route, frequency,
      duration, AND any taper / step-down schedule or "take with food" caveat. The add-medication step
      records WHAT was prescribed; it does NOT tell the patient how to take it — so a dosing or taper
      plan ALWAYS also needs an add-patient-instruction spelling it out in plain language.
    • SUPPORTIVE / OTC CARE — over-the-counter or home measures the provider advised (creams, lotions,
      OTC analgesics, rest, ice/heat, fluids, etc.).
    • WOUND / SPLINT / ACTIVITY care and restrictions.
    • RETURN PRECAUTIONS — "come back / go to the ED if …".
    • FOLLOW-UP logistics — "follow up with dermatology or your PCP in 1 week".
  Emit ONE add-patient-instruction per distinct instruction. Example — for a plan of "Prednisone 40 mg
  daily x3 days then 20 mg daily x3 days then stop; OTC hydrocortisone 1% and calamine for itch; return
  for throat tightness or trouble breathing; follow up in 1 week", emit ALL of:
    {"kind":"add-patient-instruction","text":"Take prednisone 40 mg by mouth once daily for 3 days, then 20 mg once daily for 3 days, then stop."}
    {"kind":"add-patient-instruction","text":"You may use over-the-counter hydrocortisone 1% cream and calamine lotion as needed for the itching."}
    {"kind":"add-patient-instruction","text":"Return to the ED or call 911 for throat tightness, facial swelling, or trouble breathing."}
    {"kind":"add-patient-instruction","text":"Follow up with dermatology or your primary care provider if the rash spreads or is not improving in 1 week."}
  Do NOT settle for putting these only in the MDM — MDM is the clinician's reasoning in shorthand;
  patient instructions are what the patient takes home, and BOTH are needed. (A red-flag DISPOSITION to
  a higher level of care goes in the MDM AND as a patient instruction.)
- DEMOGRAPHIC + INSURANCE + CONTACT details (address, phone, email, race, ethnicity, language,
  insurance carrier/member ID, PCP info, responsible party, emergency contact) are NOT chart
  actions — OMIT them entirely. They live on the Patient/Coverage resources via the intake
  flow, not the easy-chart conversational interface.
- SAME-PATIENT ONLY. The transcript is a raw ambient recording and frequently contains content
  that is NOT about this patient: chatter about OTHER patients ("Amon just brought her son in,
  he's 2 and got bit by a spider"), staff/student conversation, scheduling, personal asides.
  Document ONLY the patient identified in the PATIENT block below. IGNORE any symptoms, ages,
  sexes, diagnoses, fevers, or medications that the transcript attributes to a different person.
  If a detail can't be confidently tied to THIS patient's visit, leave it out.

═══ END OF FIXED INSTRUCTIONS — act on the narrative + context below ═══

The provider's free-text NARRATIVE:
"""
${narrative}
"""
${patientBlock}${patientStatusBlock}${contextBlock}${chartStateBlock}`;
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { narrative, noteContext, chartState, encounterId, incremental, secrets } = validateRequestParameters(input);

  // Fetch available templates (so the planner can suggest a real one) and the encounter's Patient
  // (the authoritative PATIENT block that anchors the note's demographics against transcript
  // cross-talk). Both best-effort — the planner still produces a useful decomposition without
  // them — but every failure is captured: these silently degrading for days IS the incident.
  let templateTitles: string[] = [];
  let patientContext: string | undefined;
  let derivedPatientStatus: 'new' | 'established' | undefined;
  let oystehr: Oystehr | undefined;
  try {
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    oystehr = createClinicalOystehrClient(m2mToken, secrets);
  } catch (e) {
    console.warn('Planner: Oystehr client init failed, proceeding without templates/patient:', e);
    captureException(e);
  }
  if (oystehr) {
    const [titlesRes, patientRes, statusRes] = await Promise.allSettled([
      fetchTemplateTitles(oystehr),
      encounterId ? fetchPatientContext(oystehr, encounterId) : Promise.resolve(undefined),
      // Skip derivation when the caller supplied the status explicitly (it wins) — derivation is
      // itself best-effort and resolves undefined on any failure.
      encounterId && !noteContext?.patientStatus
        ? derivePatientStatus(oystehr, encounterId)
        : Promise.resolve(undefined),
    ]);
    if (titlesRes.status === 'fulfilled') {
      templateTitles = titlesRes.value;
    } else {
      console.warn('Planner: template-list fetch failed, proceeding without:', titlesRes.reason);
      captureException(titlesRes.reason);
    }
    if (patientRes.status === 'fulfilled') {
      patientContext = patientRes.value;
    } else {
      console.warn('Planner: patient-context fetch failed, proceeding without:', patientRes.reason);
      captureException(patientRes.reason);
    }
    if (statusRes.status === 'fulfilled') derivedPatientStatus = statusRes.value;
  }
  // Explicit noteContext.patientStatus (e.g. from a headless eval harness with no encounterId)
  // takes precedence over the server-side derivation.
  const patientStatus = noteContext?.patientStatus ?? derivedPatientStatus;

  let usage: EasyChartTokenUsage | undefined;
  const raw = await invokeChatbotStructured(
    [
      {
        text: buildPrompt(
          narrative,
          noteContext,
          templateTitles,
          chartState,
          patientContext,
          incremental,
          patientStatus
        ),
      },
    ],
    secrets,
    RESPONSE_SCHEMA,
    undefined,
    (u) => {
      usage = u;
    }
  );

  // Unparseable/malformed model output is an upstream failure, not a user-input problem — raw
  // throws (they page). Wrapping these in INVALID_INPUT_ERROR blamed the provider's narrative and
  // hid model outages from Sentry.
  const parsed = parseStructuredModelOutput(raw, 'chart plan') as { steps?: unknown };
  if (!parsed || !Array.isArray(parsed.steps)) {
    throw new Error('Model returned a malformed plan');
  }

  // Recurring speaker labels (e.g. "X31") computed once per request — used to keep transcript
  // speaker tags from ever surviving as a diagnosis "code".
  const speakerLabels = detectSpeakerLabels(narrative);

  // Light validation per step — pass through anything that has a recognized kind; let the
  // client-side per-intent handlers do the deep validation since they do it for the single-shot
  // path too.
  const records: Record<string, unknown>[] = [];
  // Per-field vitals seen so far, keyed by field → set of value signatures. Identical repeats are
  // model noise and dropped; DISTINCT readings are legitimate serial measurements (an initial BP
  // and a post-rest recheck both belong on the chart — the vitals record is a time series).
  const seenVitalValues = new Map<string, Set<string>>();
  // Medications seen so far (normalized name+strength) — the narrative often mentions the same
  // drug twice (an in-clinic dose AND the take-home script); charting it twice duplicates the row.
  const seenMeds = new Set<string>();
  for (const item of parsed.steps) {
    if (!item || typeof item !== 'object') continue;
    const i = item as Record<string, unknown>;
    if (typeof i.kind !== 'string' || !(KIND_VALUES as readonly string[]).includes(i.kind)) continue;
    // Same fallback as the single-shot agent — sniff the narrative for a dose-form keyword if
    // the LLM omitted it. The narrative is the only place the form might appear since the
    // planner emits searchTerms focused on the ingredient name.
    // Quote-fidelity guard: the provenance hover presents sourceText as a QUOTE of the dictation,
    // but the model sometimes paraphrases ("known history of asthma") or stitches list items with
    // ellipses ("denies any... chills"). If the claimed quote isn't actually in the narrative,
    // discard it — the recovery below finds the real sentence, or the item stays honestly inferred.
    let claimedQuote: string | undefined;
    if (typeof i.sourceText === 'string' && i.sourceText.trim()) {
      const normText = (t: string): string =>
        t
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, ' ')
          .trim();
      if (!normText(narrative).includes(normText(i.sourceText))) {
        claimedQuote = i.sourceText; // keep its words as recovery needles — they point at the right sentence
        delete i.sourceText;
      }
    }
    // Missing sourceText → recover the quoting sentence from the narrative (the model omits it
    // most often on medications; without it the provenance hover downgrades to "inferred").
    if (typeof i.sourceText !== 'string' || !i.sourceText.trim()) {
      const recovered = recoverSourceText(narrative, [
        claimedQuote,
        typeof i.display === 'string' ? i.display : undefined,
        typeof i.text === 'string' ? i.text : undefined,
        ...(Array.isArray(i.searchTerms) ? (i.searchTerms.filter((t) => typeof t === 'string') as string[]) : []),
      ]);
      if (recovered) i.sourceText = recovered;
    }
    if (i.kind === 'add-medication' && (typeof i.doseForm !== 'string' || !i.doseForm.trim())) {
      const display = typeof i.display === 'string' ? i.display : '';
      const searchTerms = Array.isArray(i.searchTerms)
        ? (i.searchTerms.filter((t) => typeof t === 'string' && !!t.trim()) as string[])
        : [];
      const sniffed = sniffDoseFormScoped(narrative, display, searchTerms);
      if (sniffed) i.doseForm = sniffed;
    }
    if (i.kind === 'set-vital') {
      // flash-lite is inconsistent on vitals (drops a BP number, omits the temp unit, omits display).
      // The narrative is ground truth, so recover the numbers/unit/display via the shared normalizer.
      normalizeVitalIntent(i, narrative);
      // A vital that STILL has no numeric content after recovery can't be charted — drop it here
      // rather than erroring the plan step client-side.
      const hasValue =
        typeof i.value === 'number' || (typeof i.systolic === 'number' && typeof i.diastolic === 'number');
      if (!hasValue) {
        (i as Record<string, unknown>).__drop = true;
      } else if (typeof i.field === 'string') {
        // Dedupe IDENTICAL readings only — distinct values per field are serial measurements.
        const signature = `${i.systolic ?? ''}/${i.diastolic ?? ''}|${i.value ?? ''}`;
        const seen = seenVitalValues.get(i.field) ?? new Set<string>();
        if (seen.has(signature)) (i as Record<string, unknown>).__drop = true;
        else {
          seen.add(signature);
          seenVitalValues.set(i.field, seen);
        }
      }
    }
    if (i.kind === 'add-medication' && typeof i.display === 'string') {
      const medKey = `${i.display}|${typeof i.strength === 'string' ? i.strength : ''}`
        .toLowerCase()
        .replace(/[^a-z0-9|]/g, '');
      if (seenMeds.has(medKey)) (i as Record<string, unknown>).__drop = true;
      else seenMeds.add(medKey);
    }
    if (i.kind === 'set-disposition' && (typeof i.followUpInDays !== 'number' || !(i.followUpInDays as number))) {
      // flash-lite frequently omits the interval, especially on a conditional follow-up. Recover it
      // from the disposition's own text/sourceText (the follow-up sentence) so it isn't left undated.
      const hay = `${typeof i.text === 'string' ? i.text : ''} ${typeof i.sourceText === 'string' ? i.sourceText : ''}`;
      const days = parseFollowUpDays(hay);
      if (days != null) i.followUpInDays = days;
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
  // INCREMENTAL guard: when the chart already carries a [PRIMARY] diagnosis, an addendum's new
  // diagnoses are additions, never usurpers — "allergic reaction to amoxicillin" charted from a
  // phone-call addendum must not demote the visit's actual primary (strep). The provider can
  // still change the primary explicitly in the note.
  const dxRecords = records.filter((r) => r.kind === 'add-diagnosis');
  const chartHasPrimary = incremental && typeof chartState === 'string' && /\[PRIMARY\]|\(primary\)/i.test(chartState);
  if (chartHasPrimary) {
    for (const r of dxRecords) r.isPrimary = false;
  }
  if (dxRecords.length > 0 && !chartHasPrimary) {
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
      if ((await validateIntentCode(r, oystehr)) === 'invalid-billing') {
        (r as Record<string, unknown>).__drop = true; // reachable + invalid → drop the step
      }
    })
  );

  // (E) Deterministic backstops — chart + flag beats silently missing.
  // 1) Vitals sweep: append any dictated reading the model failed to emit — most commonly the
  //    SECOND of two serial BPs ("repeat blood pressure dropped to 176 over 92") or a vital phrased
  //    indirectly ("slightly tachycardic at 115"). Each appended step carries its quoting sentence,
  //    so the provider sees exactly where it came from when reviewing the flagged item.
  for (const sniffed of sniffVitalsFromNarrative(narrative)) {
    const sig = `${sniffed.systolic ?? ''}/${sniffed.diastolic ?? ''}|${sniffed.value ?? ''}`;
    const seen = seenVitalValues.get(sniffed.field) ?? new Set<string>();
    if (seen.has(sig)) continue;
    seen.add(sig);
    seenVitalValues.set(sniffed.field, seen);
    const step: Record<string, unknown> = { kind: 'set-vital', ...sniffed };
    normalizeVitalIntent(step, narrative);
    deduped.push(step);
  }
  // 1b) Performed-lab conversion: the prompt tells the model not to ORDER tests the narrative
  //     reports as already performed with results, but it re-orders them anyway (~2 of 3 cases:
  //     rapid strep, rapid flu). Deterministic backstop: if the narrative sentence naming the
  //     test also carries a result marker, convert the order into a provider-note that quotes it.
  const RESULT_MARKERS =
    /\b(?:was performed|were performed|came back|returned|resulted|is positive|is negative|was positive|was negative|positive for|negative for|show(?:s|ed|ing)?|reveal(?:s|ed|ing)?)\b/i;
  // The sentence must actually be about a TEST being run (not epidemiology like "coworkers have
  // confirmed influenza", and not a future order like "send the urine out for culture").
  const TEST_CONTEXT =
    /\b(?:test|tests|tested|performed|rapid|in[- ]?house|in[- ]?clinic|specimen|swab|urinalysis|x[- ]?ray|ecg|ekg)\b/i;
  for (const r of deduped) {
    if (r.kind !== 'add-in-house-lab' && r.kind !== 'add-external-lab') continue;
    const needles = [
      typeof r.display === 'string' ? r.display : '',
      ...(Array.isArray(r.searchTerms) ? (r.searchTerms.filter((t) => typeof t === 'string') as string[]) : []),
    ]
      .flatMap((n) => n.toLowerCase().split(/[^a-z0-9]+/))
      .filter((w) => w.length >= 4);
    const sentence = narrative
      .split(/(?<=[.!?])\s+/)
      .find(
        (sent) =>
          RESULT_MARKERS.test(sent) && TEST_CONTEXT.test(sent) && needles.some((n) => sent.toLowerCase().includes(n))
      );
    if (sentence) {
      const label = typeof r.display === 'string' ? r.display : 'test';
      r.kind = 'provider-note';
      r.text = `The ${label} was already performed — enter its result through the labs flow. Dictated: ${sentence.trim()}`;
      r.sourceText = sentence.trim();
      delete r.display;
      delete r.searchTerms;
    }
  }
  // 2) eRx reminder: the narrative says a prescription is being SENT but no provider-note says so —
  //    remind the provider that easy-chart charts medications without transmitting scripts.
  const mentionsSending =
    /\b(?:send(?:ing)?|sent)\b[^.;]{0,60}\b(?:pharmacy|prescription|script)\b|\bsend that over\b/i.exec(narrative);
  const hasMedStep = deduped.some((r) => r.kind === 'add-medication' && !(r as Record<string, unknown>).__drop);
  const hasErxNote = deduped.some(
    (r) => r.kind === 'provider-note' && typeof r.text === 'string' && /erx|prescription|pharmacy/i.test(r.text)
  );
  if (mentionsSending && hasMedStep && !hasErxNote) {
    deduped.push({
      kind: 'provider-note',
      text: 'Send the prescription via eRx — the medication was charted, but easy-chart does not transmit prescriptions.',
      sourceText: mentionsSending[0],
    });
  }
  // 3) Strip meaningless numeric junk the model attaches to non-vital, non-medication steps
  //    (e.g. value=0.0012… on patient instructions) so it never leaks into payloads or logs.
  for (const r of deduped) {
    if (r.kind !== 'set-vital' && r.kind !== 'add-medication') {
      delete (r as Record<string, unknown>).value;
      delete (r as Record<string, unknown>).unit;
    }
  }

  const steps = deduped.filter((r) => !(r as Record<string, unknown>).__drop) as unknown as EasyChartPlannerStep[];

  const output: EasyChartPlannerOutput = { steps, usage };
  return { statusCode: 200, body: JSON.stringify(output) };
});
