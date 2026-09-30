// Prompt assembly for the planner.
//
// The static instructions come first and everything per-call (patient, chart, narrative) goes in the
// variable tail, so the provider can cache the prefix. The per-action text comes from the registry;
// the surrounding instructions are hand-tuned against eval runs.

import { ACTION_KINDS } from './actions';
import { PatientStatus } from './api';
import { promptBlockFor } from './registry';

const FIXED_INSTRUCTIONS_END = '═══ END OF FIXED INSTRUCTIONS — act on the narrative + context below ═══';

const PLAN_PREAMBLE = `You are an assistant helping a provider chart a clinical encounter. The provider's free-text
NARRATIVE (everything they want done on the chart) appears at the END of this message, after the
instructions, along with the per-visit context: the patient, the practice's available templates, and what is ALREADY ON THE CHART.

Decompose that narrative into an ordered sequence of charting ACTIONS drawn from the vocabulary
below. Deterministic code executes them one at a time and asks the provider to disambiguate when
needed — you never write to the chart yourself. Return a JSON object with an "actions" array.

THE NARRATIVE IS A REAL-TIME RECORD — reasoning unfolds as it goes, and a LATER statement that
revises or reverses an earlier impression GOVERNS the chart. Never chart a walked-back impression
("seems like constipation" → later "no reason to think he's constipated" = do NOT chart it); when a
result replaces a working theory ("probably viral" → "rapid strep positive" = chart strep), chart
the FINAL version. This applies to diagnoses, exam findings, and medications alike.`;

const PLAN_ORDERING = `ORDERING — follow this canonical note order, and emit nothing for things the narrative does not
mention:

  1. apply-template — a SUGGESTION, listed first, when one of the AVAILABLE TEMPLATES, judged by the
     diagnoses listed with it, fits this visit's presentation. Nothing in this plan applies it: the
     provider applies a template by hand, later, at their discretion. So NOTHING a template would bring — its default exam normals, its
     diagnosis, its MDM scaffolding, its instructions — is on the chart, and the rest of this plan must
     chart the visit COMPLETELY on its own. Never omit anything because a template "would carry it".
  2. Patient history — add-allergy, add-condition, add-medication, add-surgical-history,
     add-hospitalization. This is the patient's BACKGROUND, distinct from today's diagnoses and
     treatment. It is frequently stated and just as frequently forgotten, so extract it deliberately,
     one step per item.
  3. Free-text fields, in note order: edit-note-text for chiefComplaint, historyOfPresentIllness,
     mechanismOfInjury, medicalDecision.
  4. Vitals — one set-vital per reading stated.
  5. Exam findings — add-exam-finding for each finding the provider describes
  6. ROS findings — add-ros-finding, both denied and reported symptoms.
  7. Diagnoses — add-diagnosis, exactly one isPrimary=true.
     STATED DIAGNOSIS WINS: when the provider explicitly names the diagnosis ("this is a urinary
     tract infection"), chart THAT as the primary — never substitute a more severe or more specific
     condition inferred from the findings. Flank tenderness does not upgrade a stated UTI to
     pyelonephritis. An escalated condition may appear as a SECONDARY only when the provider actually
     voiced it as suspected, never because the findings could support it.
  8. Disposition and patient-facing plan — set-disposition, add-patient-instruction.
  9. Billing — ALWAYS exactly one set-em-code.`;

const TRANSCRIPT_RULES = `- Each step is one self-contained action. "add diagnoses X and Y" is TWO add-diagnosis steps.
- Do not emit duplicate or redundant steps. Several edits to the same note field fold into a single
  edit-note-text carrying the combined final text.
- Omit anything you cannot classify or that the narrative does not justify. If nothing applies,
  return an empty actions array — say so rather than guessing.
- NEGATIVE-CONFIRMATION statements are not chartable items; omit them entirely. "No known drug
  allergies"/"NKDA" → no add-allergy. "No current medications" → no add-medication. "PMH
  unremarkable" → no add-condition. "No prior surgeries" → no add-surgical-history. "No
  hospitalizations" → no add-hospitalization. These statements are clinically important and belong
  in the HPI/MDM free text, not as add-* actions whose pickers would match nothing or, worse, the
  wrong thing.
  EXCEPTION — REVIEW OF SYSTEMS: a patient DENYING a symptom in the history ("no vomiting", "no
  fever") IS a chartable ROS finding. See add-ros-finding.
  EXCEPTION — EXAM: a normal the provider VOICED on examination ("no rash", "lungs clear",
  "non-tender") IS a chartable exam finding, emitted as the normal it asserts. See add-exam-finding.
- NEVER INVENT NEGATIVES. Do not pad the exam or the ROS with findings nobody addressed.
- DEMOGRAPHIC, INSURANCE and CONTACT details (address, phone, email, race, ethnicity, language,
  carrier/member ID, PCP info, responsible party, emergency contacts) are NOT chart actions — omit
  them. They live on the Patient/Coverage resources via intake.
- SAME-PATIENT ONLY. A transcript is a raw ambient recording and frequently contains content that is
  NOT about this patient: chatter about other patients, staff and student conversation, scheduling,
  personal asides. Document ONLY the patient identified in the PATIENT block below, and take that
  block — not the transcript — as authoritative for age and sex. Ignore any symptom, age, sex,
  diagnosis or medication the recording attributes to someone else. If a detail cannot be confidently
  tied to THIS patient's visit, leave it out.
- PROVENANCE — for EVERY action, set "sourceText" to the SHORT verbatim snippet from the narrative
  that justifies it: a few words to one sentence, copied EXACTLY, not paraphrased. If the action is
  something you INFERRED rather than something the provider stated — an E&M level you deduced, a code you filled in — set "sourceText" to an EMPTY
  STRING. Never fabricate one. Each quote is checked against the narrative and, when the provider's
  corrections are given, against their edited text, and dropped if it is not really there, and an
  empty sourceText is the signal that tells the provider to look closely, so guessing defeats the
  purpose.
  When the CHART, not the narrative, is the reason for an action — a resulted test behind a diagnosis —
  "sourceText" may instead be ONE line of the ALREADY ON THE CHART block, copied exactly. It is checked
  against that block the same way.`;

// A billing-policy choice, deliberately kept as is.
const EM_LEVEL_TIEBREAK = `- When torn between two E&M levels choose the LOWER — the goal is that a defensible level is always
  present and the provider can adjust.`;

const PREFER_SPECIFIC_CODE = `- Prefer the most specific ICD-10 code the evidence supports: when a result, a finding or the
  provider's stated diagnosis pins the cause, do not fall back to an unspecified code (a positive
  strep test → streptococcal pharyngitis, not "acute pharyngitis, unspecified").`;

const PLAN_RULES = `RULES:
- Steps must be in the canonical order above.
${TRANSCRIPT_RULES}
${PREFER_SPECIFIC_CODE}
${EM_LEVEL_TIEBREAK}`;

function actionShapesBlock(): string {
  const docs = ACTION_KINDS.map((kind) => promptBlockFor(kind));
  return `ACTION SHAPES — these are the ONLY action kinds that exist. Anything not listed here cannot be
charted through this interface.\n\n${docs.join('\n\n')}`;
}

/** The cacheable prefix: same registry in, same bytes out. */
export function buildStaticInstructions(): string {
  return [PLAN_PREAMBLE, PLAN_ORDERING, actionShapesBlock(), PLAN_RULES].join('\n\n');
}

export interface PromptTailInput {
  narrative: string;
  /** The provider's corrections to the generated narrative; rendered only when the two texts differ. */
  providerEdits?: { draft: string; edited: string };
  /** The practice's templates the planner may suggest one of, each with the diagnoses it charts. */
  templates?: PromptTemplate[];
  /** Age and sex read from the chart, never inferred from the narrative. */
  patientLine?: string;
  /** Decides the E&M code family; unknown falls back to the established family. */
  patientStatus?: PatientStatus;
  chartStateSummary?: string;
  noteContext?: string;
}

const CHART_RESULTS_NOTE = `Resulted tests ("… lab resulted: …") and radiology reports ("Radiology reported: …") above are FINDINGS
of THIS visit. Use them for the ASSESSMENT (diagnoses) and the MEDICAL DECISION MAKING. Do NOT derive
orders, medications or patient instructions from them — those come only from what the provider said.`;

export interface PromptTemplate {
  title: string;
  /** ICD-10 code and name, primary first. */
  diagnoses: { code: string; display: string }[];
}

/** Enough of a template to judge the fit; the whole template is far too long for the prompt. */
const MAX_TEMPLATE_DIAGNOSES = 3;

const templateLine = (template: PromptTemplate): string => {
  const diagnoses = template.diagnoses
    .slice(0, MAX_TEMPLATE_DIAGNOSES)
    .map((dx) => `${dx.display} (${dx.code})`)
    .join('; ');
  return `- ${template.title} — diagnoses: ${diagnoses || 'none listed'}`;
};

/** Everything that varies per call, appended after the static instructions. */
function buildVariableTail(input: PromptTailInput): string {
  const parts: string[] = [];

  const templates = input.templates ?? [];
  parts.push(
    templates.length
      ? `AVAILABLE TEMPLATES in this practice (exact title, then the diagnoses the template charts — name the title alone in apply-template to SUGGEST it; nothing here applies it; do NOT invent template names):\n${templates
          .map(templateLine)
          .join('\n')}`
      : 'AVAILABLE TEMPLATES in this practice: none. Do NOT emit apply-template.'
  );

  if (input.patientLine) {
    parts.push(`PATIENT (authoritative — take age and sex from here, never from the narrative):\n${input.patientLine}`);
  }

  parts.push(
    input.patientStatus === 'new'
      ? 'PATIENT STATUS (authoritative — from the chart): NEW patient — no professional services in the past 3 years. Use the NEW-patient E&M family (99202-99205) for set-em-code.'
      : input.patientStatus === 'established'
      ? 'PATIENT STATUS (authoritative — from the chart): ESTABLISHED patient. Use the established-patient E&M family (99212-99215) for set-em-code.'
      : 'PATIENT STATUS: unknown — do not guess; use the established-patient E&M family (99212-99215).'
  );

  if (input.noteContext) parts.push(`CURRENT NOTE TEXT:\n${input.noteContext}`);

  parts.push(
    input.chartStateSummary?.trim()
      ? `ALREADY ON THE CHART:\n${input.chartStateSummary.trim()}\n\n${CHART_RESULTS_NOTE}`
      : 'ALREADY ON THE CHART: nothing. The chart is currently EMPTY — there are no diagnoses, medications, allergies or other items on it.'
  );

  const draft = input.providerEdits?.draft.trim();
  const edited = input.providerEdits?.edited.trim();
  if (draft && edited && draft !== edited) {
    parts.push(
      `THE PROVIDER'S CORRECTIONS. The provider reviewed an AI-written narrative of this transcript and edited it. Where the edited version differs from the draft, that is the provider's correction: follow it over the transcript. Where they are the same, it adds nothing.\nDraft:\n"""\n${draft}\n"""\nEdited by the provider:\n"""\n${edited}\n"""`
    );
  }

  parts.push(`The provider's free-text NARRATIVE:\n"""\n${input.narrative}\n"""`);

  return parts.join('\n\n');
}

/** Static prefix + variable tail: the only supported way to build a prompt. */
export function buildPrompt(tail: PromptTailInput): string {
  return `${buildStaticInstructions()}\n\n${FIXED_INSTRUCTIONS_END}\n\n${buildVariableTail(tail)}`;
}
