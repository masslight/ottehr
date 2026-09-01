// Prompt assembly for the Easy Chart surfaces.
//
// TWO STRUCTURAL RULES, both load-bearing:
//
// 1. THE STATIC BLOCK COMES FIRST, the per-call narrative and context LAST. Providers cache a stable
//    prefix; a variable prefix re-bills the whole instruction block on every call. Everything that
//    varies per request — templates, patient, chart state, conversation history, the narrative —
//    lives in buildVariableTail() and nowhere else. Watch the cache-read figure in the token tally:
//    a cache-read of zero across a session means this ordering broke.
//
// 2. THE PER-ACTION PROSE COMES FROM THE REGISTRY. Each capability owns its own promptDoc, so an
//    action cannot exist in the schema while being described in no prompt — which is exactly how
//    five actions became unreachable in the first implementation. The surrounding instructions are
//    hand-tuned against eval runs and are deliberately NOT generated; generating the whole prompt
//    trades measured quality for tidiness.

import { Surface } from './actions';
import { CAPABILITIES, capabilitiesForSurface } from './registry';

export const FIXED_INSTRUCTIONS_END = '═══ END OF FIXED INSTRUCTIONS — act on the narrative + context below ═══';

const PLAN_PREAMBLE = `You are an assistant helping a provider chart a clinical encounter. The provider's free-text
NARRATIVE (everything they want done on the chart) appears at the END of this message, after the
instructions, along with the per-visit context: the patient, the templates available in this
practice, and what is ALREADY ON THE CHART.

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

  1. apply-template — FIRST step when one of the AVAILABLE TEMPLATES matches this visit's primary
     presentation. Templates pre-fill CC/HPI structure, default normal exam findings, a default
     diagnosis, default MDM and patient instructions.
  2. Patient history — add-allergy, add-condition, add-medication, add-surgical-history,
     add-hospitalization. This is the patient's BACKGROUND, distinct from today's diagnoses and
     treatment. It is frequently stated and just as frequently forgotten, so extract it deliberately,
     one step per item.
  3. Free-text fields, in note order: edit-note-text for chiefComplaint, historyOfPresentIllness,
     mechanismOfInjury, medicalDecision.
  4. Vitals — one set-vital per reading stated.
  5. Exam findings — add-exam-finding, and remove-exam-finding to reconcile a template's normals that
     the narrative directly contradicts.
  6. ROS findings — add-ros-finding, both denied and reported symptoms.
  7. Diagnoses — add-diagnosis, exactly one isPrimary=true.
     STATED DIAGNOSIS WINS: when the provider explicitly names the diagnosis ("this is a urinary
     tract infection"), chart THAT as the primary — never substitute a more severe or more specific
     condition inferred from the findings. Flank tenderness does not upgrade a stated UTI to
     pyelonephritis. An escalated condition may appear as a SECONDARY only when the provider actually
     voiced it as suspected, never because the findings could support it.
  8. Labs ordered this visit — add-in-house-lab / add-external-lab. Imaging — add-radiology.
  9. Procedures — add-procedure, then update-procedure for any field values.
 10. Disposition and patient-facing plan — set-disposition, add-patient-instruction,
     add-nursing-order.
 11. Billing — ALWAYS exactly one set-em-code, plus add-cpt for anything else performed.`;

/**
 * The rules that are about READING A TRANSCRIPT rather than about which section to fill.
 *
 * Split out so a per-section stage gets them without a copy. Eight of the eleven plan rules turned out
 * to be of this kind — same-patient, negative confirmations, provenance, never invent negatives — which
 * is why the prompt does NOT decompose cleanly by section and why duplicating it per stage would mean
 * eight hand-tuned rules in N places to keep in sync.
 */
const SHARED_TRANSCRIPT_RULES = `- Each step is one self-contained action. "add diagnoses X and Y" is TWO add-diagnosis steps.
- Do not emit duplicate or redundant steps. Several edits to the same note field fold into a single
  edit-note-text carrying the combined final text.
- Omit anything you cannot classify or that the narrative does not justify. If nothing applies,
  return an empty actions array — say so rather than guessing.
- NEGATIVE-CONFIRMATION statements are not chartable items; omit them entirely. "No known drug
  allergies"/"NKDA" → no add-allergy. "No current medications" → no add-medication. "PMH
  unremarkable" → no add-condition. "No prior surgeries" → no add-surgical-history. "No
  hospitalizations" → no add-hospitalization. "No vomiting", "no rash", "no fever" as EXAM
  observations → no add-exam-finding. These statements are clinically important and belong in the
  HPI/MDM free text, not as add-* actions whose pickers would match nothing or, worse, the wrong
  thing.
  EXCEPTION — REVIEW OF SYSTEMS: a patient DENYING a symptom in the history IS a chartable ROS
  finding. See add-ros-finding.
- NEVER INVENT NEGATIVES. Do not pad the exam or the ROS with findings nobody addressed.
- A remove-* step may ONLY target an item explicitly listed in the ALREADY ON THE CHART block below.
  If the chart is empty or the item is not listed, there is nothing to remove and no remove-* step is
  valid.
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
  something you INFERRED rather than something the provider stated — a default-normal exam finding a
  template implies, an E&M level you deduced, a code you filled in — set "sourceText" to an EMPTY
  STRING. Never fabricate one. Each quote is checked against the narrative and dropped if it is not
  really there, and an empty sourceText is the signal that tells the provider to look closely, so
  guessing defeats the purpose.`;

/** What the full planner adds on top: ordering, which only exists when a plan has several sections. */
const PLAN_RULES = `RULES:
- Steps must be in the canonical order above.
${SHARED_TRANSCRIPT_RULES}`;

const FINDINGS_PREAMBLE = `You are recording the OBJECTIVE FINDINGS of a clinical encounter from the provider's free-text
NARRATIVE, which appears at the END of this message after the instructions, along with the per-visit
context: the patient and what is ALREADY ON THE CHART.

Your ONLY job on this call is the physical exam, the review of systems, and the vitals. Diagnoses, the
note's free text, orders, codes and the disposition are charted by other calls and are NOT yours — do
not emit them, and do not let them distract from the one thing that is.

BE EXHAUSTIVE. Every exam finding the provider describes, every symptom the patient reports OR denies,
every reading spoken aloud. These sections are long by nature and are the ones a general pass leaves
half-finished; there is nothing else competing for your output here, so go through the narrative to the
end and chart all of it.

THE NARRATIVE IS A REAL-TIME RECORD — a LATER statement that revises an earlier one GOVERNS. If the
provider re-examines and finds something different, chart the FINAL version.

Return a JSON object with an "actions" array.`;

const FINDINGS_RULES = `RULES:
${SHARED_TRANSCRIPT_RULES}
- ORDER DOES NOT MATTER on this call — there is only one section group, so chart findings as you meet
  them in the narrative rather than sorting them.`;

/**
 * The remaining stages, in the order the graph runs them.
 *
 * Each is a PREAMBLE plus its own rules; the vocabulary, the response schema and the per-action prose all
 * come from the registry keyed on the surface, so a stage costs only the prose below. The shared
 * transcript rules are included by reference rather than copied — they were tuned against eval runs, and
 * eight of the eleven plan rules are of that kind.
 *
 * WHAT EACH STAGE MAY SEE is not expressed here but in WHEN it runs: every stage is handed the chart as
 * it stands after the previous ones, through the ALREADY ON THE CHART and CURRENT NOTE TEXT blocks. That
 * is why the later stages can be told to reason about what is already there without being told what it is.
 */
const STAGE_SCOPE_NOTE = `Other calls chart the rest of this visit. Emit ONLY the actions listed below —
anything else is not yours, and the vocabulary here does not contain it.`;

const HISTORY_PREAMBLE = `You are recording the patient's BACKGROUND from the provider's free-text NARRATIVE, which appears at
the END of this message: allergies, past medical history, home medications, past surgeries and past
hospitalizations.

${STAGE_SCOPE_NOTE}

This is history, NOT today's visit. Today's diagnoses, today's exam and today's orders belong to other
calls. A condition the patient is being diagnosed with now is not past medical history; a medication
being prescribed now is not a home medication.

Return a JSON object with an "actions" array.`;

const HISTORY_RULES = `RULES:
${SHARED_TRANSCRIPT_RULES}
- THE NEGATIVE-CONFIRMATION RULE MATTERS MOST HERE, because this is where those statements are made.
  "No known drug allergies"/"NKDA", "no current medications", "PMH unremarkable", "no prior surgeries",
  "no hospitalizations" are NOT chartable items — emit nothing for them. They belong in the note's free
  text, which another call writes.`;

const STORY_PREAMBLE = `You are writing the NARRATIVE FIELDS of a visit note from the provider's free-text NARRATIVE, which
appears at the END of this message.

${STAGE_SCOPE_NOTE}

Exactly three fields are yours: chiefComplaint, historyOfPresentIllness and mechanismOfInjury. The
medical decision making is written by a LATER call that can see the diagnoses and the orders — do NOT
write it here, and do not emit edit-note-text for "medicalDecision" or "ros".

This is also the call that SPEAKS to the provider. If the narrative asks a question, or contains
something they need told rather than charted, that is a reply or a provider-note and it belongs here —
the other calls chart and say nothing.

Return a JSON object with an "actions" array.`;

const STORY_RULES = `RULES:
${SHARED_TRANSCRIPT_RULES}
- Emit AT MOST ONE edit-note-text per field, carrying that field's complete final text.`;

const ORDERS_PREAMBLE = `You are recording what was ORDERED OR PERFORMED at this visit, from the provider's free-text
NARRATIVE at the END of this message: lab tests, imaging, procedures and nursing orders.

${STAGE_SCOPE_NOTE}

The diagnoses are already on the chart — see ALREADY ON THE CHART below. Orders are filed against them,
so read them before you decide what was ordered and why.

ONLY WHAT THIS VISIT ORDERED OR DID. A test whose RESULT is being discussed was ordered earlier and is
not a new order; a procedure the provider says they are NOT doing is not a procedure.

Return a JSON object with an "actions" array.`;

const ORDERS_RULES = `RULES:
${SHARED_TRANSCRIPT_RULES}`;

const PLAN_TEXT_PREAMBLE = `You are writing the PLAN of a visit note from the provider's free-text NARRATIVE at the END of this
message: the medical decision making, the patient instructions and the disposition.

${STAGE_SCOPE_NOTE}

Everything charted so far is below — the diagnoses, the exam, the orders. The MDM is the reasoning that
connects them: what was considered, what was ruled out, what was done and why. Write it against what is
actually on the chart, not against what you would have charted.

Your edit-note-text is for "medicalDecision" ONLY. The chief complaint, the HPI and the mechanism of
injury were written by an earlier call — do not rewrite them.

Return a JSON object with an "actions" array.`;

const PLAN_TEXT_RULES = `RULES:
${SHARED_TRANSCRIPT_RULES}
- Emit AT MOST ONE edit-note-text, for "medicalDecision", carrying its complete final text.`;

const CODING_PREAMBLE = `You are assigning the BILLING CODES for this visit from the chart as it now stands, shown below, and
the provider's free-text NARRATIVE at the END of this message.

${STAGE_SCOPE_NOTE}

You run LAST, and that is the point: the E&M level follows from the documented complexity — the history,
the exam, the diagnoses, the orders and the medical decision making, all of which are now on the chart
below. Read them before you choose. A CPT code follows from a procedure or a point-of-care test that was
actually PERFORMED at this visit; if none was, emit none.

Return a JSON object with an "actions" array.`;

const CODING_RULES = `RULES:
${SHARED_TRANSCRIPT_RULES}
- Exactly one set-em-code per visit. Never emit two.`;

const TEMPLATE_PREAMBLE = `You are deciding whether one of this practice's saved TEMPLATES fits this visit, from the provider's
free-text NARRATIVE at the END of this message.

${STAGE_SCOPE_NOTE}

This is the FIRST call of the visit and the only one that may apply a template. Everything a template
brings — its default exam findings, its diagnosis, its MDM scaffolding — lands on the chart before any
other call runs, and every later call sees it and reconciles against it. That is why a wrong template
here is expensive and a missing one is cheap.

Emit ONE apply-template, or NOTHING. Never two.

Return a JSON object with an "actions" array.`;

const TEMPLATE_RULES = `RULES:
${SHARED_TRANSCRIPT_RULES}
- IMPORTANT: When no template clearly corresponds to this visit's primary presentation, return an EMPTY actions
  array. No template is a good outcome; the wrong one is not.`;

const DIAGNOSES_PREAMBLE = `You are assigning this visit's DIAGNOSES from the provider's free-text NARRATIVE at the END of this
message, and from what is already on the chart below.

${STAGE_SCOPE_NOTE}

The history, the exam, the ROS and the vitals have already been charted — read them below before you
decide. If a template was applied it has charted a DEFAULT diagnosis, and that default was chosen from
the template's title without ever seeing this narrative: check it against what the provider actually
said, and when it is wrong, emit remove-diagnosis for it AND add-diagnosis for the one the visit
supports. Never a bare removal that leaves the note with no diagnosis.

Return a JSON object with an "actions" array.`;

const DIAGNOSES_RULES = `RULES:
${SHARED_TRANSCRIPT_RULES}
- Exactly ONE diagnosis carries isPrimary=true across the whole visit. When the chart already has a
  primary, an addition is secondary — do not usurp it.`;

const REVIEW_PREAMBLE = `You are a clinical documentation reviewer. A provider just charted a visit note from the NARRATIVE
that appears at the END of this message; the structured items now on the chart are in the ALREADY ON
THE CHART block beside it. Your job is to surface clarifications the provider can accept with ONE
CLICK to improve the note.

You are correcting a note, not charting a visit, so your vocabulary is deliberately narrow. Work
through all ten checks below and emit one suggestion for EACH check that finds a real gap (commonly
two to five in total). Do not invent low-value suggestions, and do not skip a check that genuinely
applies. If truly nothing warrants a prompt, return {"suggestions": []}.

Each suggestion carries its own actions[] — accepting a card just runs those actions — plus a short
"question" the provider reads on the card and, where required below, a "rationale".`;

const REVIEW_CHECKS = `THE TEN CHECKS:

1) "med-name" — a medication in the note looks misheard or garbled by speech-to-text, or is not a
   real drug, and you can identify the intended one ("Ciner" → "Cefdinir"; a 14 mg/kg once-daily dose
   and a red-stool side effect confirm cefdinir). ACTION: one edit-note-text on medicalDecision whose
   newText is the FULL current MDM with the garbled name replaced. We cannot create the eRx order
   programmatically, so set "partial": true and "partialNote": "Corrects the note text only — add the
   eRx order manually." Set "highlight" to the corrected drug name.

2) "diagnosis" — the charted diagnosis code is less specific than the narrative supports: recurrence
   ("frequent ear infections", "recurrent"), a laterality, or an acuity the code does not capture.
   ACTION: remove-diagnosis for the charted text, then add-diagnosis for the more specific one. The
   add MUST restate the removed item's isPrimary status (ALREADY ON THE CHART marks it "(primary)") —
   swapping the primary without isPrimary:true leaves the note with no primary diagnosis, which is
   billing-invalid.

3) "pertinent-negative" — a negative the provider EXPLICITLY voiced in this dictation is not charted.
   ACTION: one or more add-ros-finding. Only ROS negatives are chartable here — NEVER add-exam-finding
   for a negative: exam findings are positive/abnormal checkboxes, so charting "no tragus tenderness"
   would check the abnormal box and assert the OPPOSITE of what the provider said.
   HARD LIMITS, because this check fabricates findings if used loosely: quote, don't infer — only
   propose a negative whose words appear in the narrative, never a "classic" negative for the
   complaint pulled from memory; and never deny the chief complaint or a symptom the patient is
   presenting with.

4) "em-level" — assess the charted E&M against the documented complexity, WITHIN the correct family
   for the patient's status (see the PATIENT STATUS line below; absent = assume established,
   99212-99215). If the charted code is in the wrong family, suggest the same-level code in the right
   one. ACTION: one set-em-code. REQUIRED: a one-line "rationale" explaining the level by MDM
   elements (problems / data / risk).

5) "secondary-dx" — a DISTINCT, active problem the provider actually evaluated or treated this visit
   is not charted. ACTION: one add-diagnosis with isPrimary:false. BE CONSERVATIVE: a single minor
   incidental exam finding is part of the exam, not a diagnosis; antecedent history is not an active
   problem. When in doubt, omit.

6) "med-reconcile" — the MDM states a dose/strength/form that does not match the actual ORDER on the
   chart. The ORDER is the source of truth (the provider often has to pick the nearest available
   formulary strength). ACTION: one edit-note-text on medicalDecision changing ONLY that medication's
   dose/strength/form and nothing else; set "highlight" to the corrected value. Ignore pure formatting
   differences ("5 mg" vs "5 MG"), and never flag a medication that is not actually on the chart.

7) "disposition" — the narrative clearly states where the patient goes next or a follow-up plan, but
   no disposition is charted. A stated follow-up is a patient-safety item and must never silently
   vanish. ACTION: one set-disposition. A conditional follow-up still counts — keep the condition in
   the text. STRICT: only a disposition the narrative actually voices, never one inferred from the
   visit type.

8) "cpt" — a procedure or point-of-care test the narrative says was PERFORMED this visit has no
   billing code. ACTION: one or more add-cpt. Bill only what was actually done: not send-out labs,
   not imaging orders, not prescriptions, not planned/conditional/declined procedures, and not a code
   already charted.

9) "coherence" — a charted structured item the note's own content does not support. Cross-check every
   charted diagnosis first and foremost, then medications and CPTs, against the HPI/MDM and the
   narrative. ACTION for a wrong DIAGNOSIS: the same two-action swap as check 2 — remove-diagnosis
   then add-diagnosis for what the note DOES support, never a bare removal, and never one that would
   leave the chart with zero diagnoses while the note documents a diagnosable condition.
   The swap belongs to THIS check — do not defer it to check 2. A live failure, reproduced twice: the
   chart coded acute vaginitis while the narrative described a candidal infection, and the review
   emitted a BARE removal, leaving the chart with no diagnosis at all.
   For an unsupported medication: remove-medication. For an unsupported CPT: remove-cpt.
   REQUIRED: a "rationale" citing WHAT in the note contradicts the item.
   PRECISION OVER RECALL — a false alarm here erodes trust in every card. Flag only a clear mismatch a
   clinician would immediately object to. Do not flag plausible comorbidities, incidental findings, or
   items the narrative supports even when the note text omits them. A less-specific code of the RIGHT
   condition is check 2's job. When unsure, stay silent.

10) "dropped-commitment" — the provider clearly COMMITTED to a prescription, order or referral in the
   narrative, and the commitment is represented NOWHERE on the chart: no matching medication, no
   provider note, no patient instruction, no disposition covering it. Voiced commitments frequently
   omit the drug name — that does not excuse dropping them. ACTION: one provider-note capturing what
   was promised, for what indication, plus any pharmacy or logistics stated. NEVER invent a drug, dose
   or strength that was not voiced.
   Same precision bar as check 9: only clear commitments ("I'll send…", "let me get you on…", "we'll
   start…"), never musings ("we could try…") and never offers the patient declined. Skip anything
   ALREADY ON THE CHART covers in any form.`;

const REVIEW_RULES = `RULES:
- NEVER suggest adding something that already appears in ALREADY ON THE CHART.
- LATER STATEMENTS ARE GROUND TRUTH. The narrative is a real-time record; a provider's later
  statement overrides an earlier impression. Never propose a diagnosis the narrative walks back.
- NEVER ESCALATE A STATED DIAGNOSIS. A diagnosis the provider explicitly named and treated is
  coherent even when the findings could support something more severe — a stated UTI with flank
  tenderness stays a UTI, not pyelonephritis, unless the provider voiced the escalation themselves.
- Phrase "question" as a short question the provider reads on a card ("You wrote 'Ciner' — did you
  mean Cefdinir?", "Add the pertinent negatives you noted?").
- Provide your best ICD-10/CPT code; every code is validated downstream and corrected or dropped, so
  be confident even when unsure of the exact digits.
- One suggestion per check that applies. Do not merge unrelated gaps into one card and do not pad
  with marginal ones.`;

function actionShapesBlock(surface: Surface): string {
  const docs = capabilitiesForSurface(surface).map((kind) => CAPABILITIES[kind].promptDoc);
  return `ACTION SHAPES — these are the ONLY action kinds that exist. Anything not listed here cannot be
charted through this interface.\n\n${docs.join('\n\n')}`;
}

/**
 * The cacheable prefix for a surface. Deterministic: same registry in, same bytes out. Callers must
 * not interpolate anything into it.
 */
/** Per-stage prose. A surface absent here is not a stage and falls through to the full-plan branch. */
const STAGE_PROSE: Partial<Record<Surface, { preamble: string; rules: string }>> = {
  template: { preamble: TEMPLATE_PREAMBLE, rules: TEMPLATE_RULES },
  diagnoses: { preamble: DIAGNOSES_PREAMBLE, rules: DIAGNOSES_RULES },
  findings: { preamble: FINDINGS_PREAMBLE, rules: FINDINGS_RULES },
  history: { preamble: HISTORY_PREAMBLE, rules: HISTORY_RULES },
  story: { preamble: STORY_PREAMBLE, rules: STORY_RULES },
  orders: { preamble: ORDERS_PREAMBLE, rules: ORDERS_RULES },
  'plan-text': { preamble: PLAN_TEXT_PREAMBLE, rules: PLAN_TEXT_RULES },
  coding: { preamble: CODING_PREAMBLE, rules: CODING_RULES },
};

export function buildStaticInstructions(surface: Surface): string {
  if (surface === 'review') {
    return [REVIEW_PREAMBLE, REVIEW_CHECKS, actionShapesBlock('review'), REVIEW_RULES].join('\n\n');
  }
  // No ORDERING block for a stage: it has no canonical order of its own, and leaving the plan's in would
  // tell the model to sort by sections it cannot emit.
  const stage = STAGE_PROSE[surface];
  if (stage) return [stage.preamble, actionShapesBlock(surface), stage.rules].join('\n\n');
  return [PLAN_PREAMBLE, PLAN_ORDERING, actionShapesBlock('plan'), PLAN_RULES].join('\n\n');
}

export interface PromptTailInput {
  /** The provider's dictation, paste, or typed request. Always last. */
  narrative: string;
  /** Practice template titles. Empty list is stated explicitly rather than omitted. */
  templateTitles?: string[];
  /** Title of the template already applied to this visit, server-validated. See ChartPlanRequest. */
  appliedTemplate?: string;
  /**
   * Authoritative demographics, read from the chart — NEVER inferred from the narrative. Ambient
   * recordings contain cross-talk about other patients.
   */
  patientLine?: string;
  /**
   * "new" / "established" / undefined. Drives the E&M code family; undefined must read as unknown so
   * the model defaults to established rather than guessing.
   */
  patientStatus?: 'new' | 'established';
  /** A summary of what is already on the chart, so the model neither duplicates nor invents removals. */
  chartStateSummary?: string;
  /** Current free-text note fields, so the model can edit in place rather than overwrite. */
  noteContext?: string;
  /** Bounded conversation digest — provider turns verbatim, assistant turns one line per action. */
  historyDigest?: string;
  /**
   * True when the note is already written and this narrative only adds to it.
   * NOTE the distinction that bit a previous version: a non-empty chartState does NOT mean
   * incremental. A first dictation for a patient whose history came from intake paperwork has a
   * non-empty chart state and still needs the full pass. Getting this wrong silently dropped the
   * template/exam/E&M scaffolding for every patient with intake history.
   */
  incremental?: boolean;
  /**
   * A deterministic instruction the surface force-includes for THIS call. Used where leaving a check to
   * the model's discretion measured as unreliable: the disposition check's coverage swung 53% → 36% →
   * 35% across runs of the same corpus with no code change. Goes LAST so the stable prefix stays cacheable.
   */
  mustAddress?: string;
}

/** Everything that varies per call, in one block, appended after the static instructions. */
export function buildVariableTail(input: PromptTailInput): string {
  const parts: string[] = [];

  const titles = input.templateTitles ?? [];
  parts.push(
    titles.length
      ? `AVAILABLE TEMPLATES in this practice (exact titles — match these when you apply-template; do NOT invent template names):\n${titles
          .map((t) => `- ${t}`)
          .join('\n')}`
      : 'AVAILABLE TEMPLATES in this practice: none. Do NOT emit apply-template.'
  );

  if (input.patientLine) {
    parts.push(`PATIENT (authoritative — take age and sex from here, never from the narrative):\n${input.patientLine}`);
  }

  parts.push(
    input.patientStatus
      ? `PATIENT STATUS: ${input.patientStatus === 'new' ? 'NEW to the practice' : 'ESTABLISHED with the practice'}.`
      : 'PATIENT STATUS: unknown — do not guess; use the established-patient E&M family (99212-99215).'
  );

  // THE FACT ONLY, and deliberately nothing more.
  //
  // A first version added a paragraph here telling the stage to treat the template's contents as defaults
  // and confirm them against the narrative. That instruction cannot be followed: the chart state lists
  // rows and never says which came from a template, so the model was told to find something it has no way
  // to identify. It went looking anyway, and blind removals rose from 11 to 29. Stating the fact and
  // leaving the reasoning to the stage's own rules is what the tail is for.
  if (input.appliedTemplate?.trim()) {
    parts.push(`TEMPLATE APPLIED THIS VISIT: "${input.appliedTemplate.trim()}"`);
  }

  if (input.noteContext) parts.push(`CURRENT NOTE TEXT:\n${input.noteContext}`);

  parts.push(
    input.chartStateSummary?.trim()
      ? `ALREADY ON THE CHART:\n${input.chartStateSummary.trim()}`
      : 'ALREADY ON THE CHART: nothing. The chart is currently EMPTY — there are no diagnoses, medications, allergies or other items on it, so there is NOTHING to remove. Do NOT emit any remove-* step.'
  );

  if (input.incremental) {
    parts.push(
      `THIS IS AN INCREMENTAL TURN. The note is already written and this narrative only adds to it. Chart ONLY what is new. The ALREADY ON THE CHART block above is the truth about what exists; anything listed there is already done and must not be emitted again.`
    );
  }

  if (input.historyDigest) {
    parts.push(
      `CONVERSATION SO FAR (for reference only — the chart state above is the truth about what exists; chart only what is new):\n${input.historyDigest}`
    );
  }

  parts.push(`The provider's free-text NARRATIVE:\n"""\n${input.narrative}\n"""`);

  // LAST, and unconditional in position: a forced instruction is the only thing allowed to override the
  // model's own read of the checks, so it must not be buried above the narrative.
  if (input.mustAddress?.trim()) parts.push(`MUST ADDRESS THIS CALL:\n${input.mustAddress.trim()}`);

  return parts.join('\n\n');
}

/** Static prefix + variable tail, in that order. The only supported way to build a prompt. */
export function buildPrompt(surface: Surface, tail: PromptTailInput): string {
  return `${buildStaticInstructions(surface)}\n\n${FIXED_INSTRUCTIONS_END}\n\n${buildVariableTail(tail)}`;
}
