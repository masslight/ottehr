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
import { CAPABILITIES, capabilitiesForSurface, Capability } from './registry';

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
- A remove-* step may ONLY target an item explicitly listed in the ALREADY ON THE CHART block below,
  and its "display" must be that line's wording, COPIED. If the chart is empty or the item is not
  listed, there is nothing to remove and no remove-* step is valid.
  A REPLACEMENT IS NOT ONE MOVE. Charting the right item and removing a wrong one are separate steps
  and each stands on its own: when the thing you would replace is not on the chart, emit the add ALONE
  and no removal. Naming what you are correcting rather than what is listed is the single most common
  way a remove-* step ends up pointing at nothing — measured across a corpus, most misses shared not
  one word with any line actually on the chart.
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
/**
 * The E&M level tiebreak, for the surfaces that AUTHOR a code.
 *
 * Deliberately not in `set-em-code`'s registry `promptDoc`, which is shared with the review surface —
 * review's check 4 exists to catch a level that came out too low, and a rule to round down turns that
 * check against itself. See the comment on `set-em-code` in registry.ts for the measured trade-off this
 * tiebreak represents; it is a billing-policy choice, and it applies to the first pass, not the audit.
 */
const EM_LEVEL_TIEBREAK = `- When torn between two E&M levels choose the LOWER — the goal is that a defensible level is always
  present and the provider can adjust.`;

const PLAN_RULES = `RULES:
- Steps must be in the canonical order above.
${SHARED_TRANSCRIPT_RULES}
${EM_LEVEL_TIEBREAK}`;

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
- RECONCILE THE TEMPLATE'S NORMALS. A template charts a screenful of default normal exam findings from
  its own title, having never seen this narrative. Where the narrative directly CONTRADICTS one — the
  chart says "Oropharynx clear" and the provider described an injected oropharynx — emit
  remove-exam-finding for the normal as well as add-exam-finding for what they described. A narrative
  that merely does not mention a normal does not contradict it: leave those alone.
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
- ALWAYS emit exactly one set-em-code. Every visit is coded; there is no visit that gets none, and
  there is no visit that gets two.
- add-cpt for anything else PERFORMED. A code for a procedure or point-of-care test that did not happen
  is a billing claim nobody can support.
${EM_LEVEL_TIEBREAK}`;

const TEMPLATE_PREAMBLE = `You are deciding whether one of this practice's saved TEMPLATES fits this visit, from the provider's
free-text NARRATIVE at the END of this message.

${STAGE_SCOPE_NOTE}

This is the FIRST call of the visit and the only one that may apply a template. THE CHART IS EMPTY and
the narrative is all you have — there is no diagnosis to match against yet, because nothing has charted
one. Match on the PRESENTATION the provider describes, in their words.

Everything a template brings — its default exam findings, its diagnosis, its MDM scaffolding — lands on
the chart before any other call runs, and every later call sees it and reconciles against it. That is
why a wrong template here is expensive and a missing one is cheap: a later call can add what a missing
template would have brought, but it cannot reliably tell a wrong template's defaults from the truth.

Emit ONE apply-template, or NOTHING. Never two.

Return a JSON object with an "actions" array.`;

const TEMPLATE_RULES = `RULES:
${SHARED_TRANSCRIPT_RULES}
- IMPORTANT: When no template clearly corresponds to this visit's primary presentation, return an EMPTY actions
  array. No template is a good outcome; the wrong one is not.`;

const DIAGNOSES_PREAMBLE = `You are assigning this visit's DIAGNOSES from the provider's free-text NARRATIVE at the END of this
message, and from what is already on the chart below.

${STAGE_SCOPE_NOTE}

STATED DIAGNOSIS WINS. When the provider explicitly names the diagnosis ("this is a urinary tract
infection"), chart THAT as the primary — never substitute a more severe or more specific condition
INFERRED FROM THE FINDINGS. Flank tenderness does not upgrade a stated UTI to pyelonephritis. An
escalated condition may appear as a SECONDARY only when the provider actually voiced it as suspected,
never because the findings could support it. The exam, the ROS and the vitals are below so you can see
what was examined — not so you can diagnose from them.

ANY DIAGNOSIS ALREADY ON THE CHART WAS PUT THERE BY THE TEMPLATE. No other call charts a diagnosis
before this one, so there is nothing to work out: whatever is listed is the template's default, chosen
from the template's own title without ever seeing this narrative. When it matches what the provider
said, leave it. When it does not, emit remove-diagnosis for it AND add-diagnosis for the one the visit
supports — never a bare removal that leaves the note with no diagnosis.

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
   ("frequent ear infections", "recurrent", repeated prior episodes), a laterality, or an acuity the
   code does not capture. E.g. the chart shows non-recurrent bilateral AOM (H66.003) while the child
   has frequent recurrent infections → suggest recurrent bilateral AOM (H66.006).
   ACTION: remove-diagnosis for the charted text, then add-diagnosis for the more specific one, with
   searchTerms and your best ICD-10 code. Set the add's "isPrimary" BOOLEAN to whatever the removed item
   was — the chart marks a primary diagnosis "(primary)", so read it from there and answer true/false.
   Never write that marker into any text field; the boolean is the only place it belongs. Swapping the
   primary without isPrimary:true leaves the note with no primary diagnosis, which is billing-invalid.

3) "pertinent-negative" — a negative the provider EXPLICITLY voiced in this dictation is not charted.
   ACTION: one or more add-ros-finding. Only ROS negatives are chartable here — NEVER add-exam-finding
   for a negative: exam findings are positive/abnormal checkboxes, so charting "no tragus tenderness"
   would check the abnormal box and assert the OPPOSITE of what the provider said.
   The display MUST begin with "Denies" or "Reports". Exam normals the provider voiced are the first
   pass's job, not this check's.
   HARD LIMITS, because this check fabricates findings if used loosely:
   - Quote, don't infer. Only propose a negative whose words appear in the narrative — the dictation
     literally says "denies fever" or "no photophobia". Do NOT pull the "classic" negatives for the
     complaint from memory: do not suggest "no tragus tenderness", "canals normal" or "no neck
     stiffness" just because they are typical for the visit type. If the provider didn't say it, it is
     not a finding.
   - Never deny the chief complaint or a symptom the patient is PRESENTING WITH — a visit for ear pain
     must never get "Denies ear pain"; the patient HAS it.

4) "em-level" — assess the charted E&M against the documented complexity, WITHIN the correct family
   for the patient's status: NEW patient (no professional services in the past 3 years) → 99202-99205;
   ESTABLISHED patient → 99212-99215. Read the status from the PATIENT STATUS line below; when no such
   line is present the status is unknown — assume established and stay in 99212-99215. If the charted
   code is in the WRONG family for the stated status, suggest the same-level code in the correct one.
   THE LEVEL, not just the family: the MDM-complexity logic is identical in both families and the last
   digit is the level. E.g. if a NEW prescription was given (prescription drug management = moderate
   risk) and the charted code is the family's level-3 code (99203 new / 99213 established), suggest the
   SAME family's level-4 code (99204 / 99214); if the documentation clearly supports a different level,
   suggest that instead. Level 3 is right for a straightforward, low-complexity visit — a single
   self-limited problem with simple management — and level 5 (99205 / 99215) for high complexity or high
   risk. JUDGE THE LEVEL, do not default to one: this check's job is to match the code to the
   documentation, in whichever direction that points, and a level the note genuinely supports needs no
   suggestion at all. Emit nothing here when the charted code is already right.
   ACTION: one set-em-code. REQUIRED: a one-line "rationale" explaining the level by MDM elements
   (problems / data / risk).

5) "secondary-dx" — a DISTINCT, active problem the provider actually evaluated or treated this visit
   is not charted. ACTION: one add-diagnosis with isPrimary:false. BE CONSERVATIVE: a single minor
   incidental exam finding is part of the exam, not a diagnosis; antecedent history is not an active
   problem. When in doubt, omit.

6) "med-reconcile" — the MDM states a dose/strength/form that does not match the actual ORDER on the
   chart. The ORDER is the source of truth (the provider often has to pick the nearest available
   formulary strength). ACTION: one edit-note-text on medicalDecision changing ONLY that medication's
   dose/strength/form and nothing else; set "highlight" to the corrected value. Ignore pure formatting
   differences ("5 mg" vs "5 MG"), and never flag a medication that is not actually on the chart.

7) "disposition" — the narrative clearly STATES where the patient goes next or a follow-up plan
   ("follow up with your PCP in a week", "go to the ER if it worsens", "referral to ortho", "come back
   here in 3 days if no better"), but no disposition is charted. A stated follow-up is a patient-safety
   item and must never silently vanish.
   ACTION: one set-disposition with { dispositionType, text, followUpInDays }. Pick dispositionType:
   "pcp" (follow up with their own PCP / "see your doctor"), "specialty" (referral or follow-up with a
   named specialist — use this even when offered as "<specialist> or PCP"), "ed" (go to the ER / call
   911), "another" (return to THIS clinic, or any other follow-up), "ip" (admitted to hospital).
   "text" is the disposition as one clinical sentence. Set followUpInDays ONLY when an interval is
   stated, converted to DAYS: "in 1 week" → 7, "in 3 days" → 3, "in 2 weeks" → 14.
   A CONDITIONAL follow-up ("if not improving") still counts — keep the condition in "text". STRICT:
   only a disposition the narrative actually voices, never one inferred from the visit type.

8) "cpt" — a procedure or point-of-care test the narrative says was PERFORMED this visit has no
   billing code: splinting, laceration repair, ear lavage / cerumen removal, foreign-body removal,
   I&D, burn dressing, a rapid strep/flu/COVID/RSV or urinalysis run in the office ("the rapid strep
   came back positive"), a nebuliser treatment given in clinic.
   ACTION: one or more add-cpt — one card may carry several. Give your best CPT; it is validated
   downstream and dropped if it is not real, so be confident even when unsure of the exact digits.
   Bill only what was actually DONE this visit: not send-out labs (they bill through the lab order),
   not imaging orders, not prescriptions, not planned/conditional procedures ("we'll splint it next
   week if it's still swollen"), not procedures merely discussed or declined, and not a code already
   charted — nor one carried by a procedure entry already in ALREADY ON THE CHART.

9) "coherence" — a charted structured item the note's own content does not support. Cross-check every
   charted diagnosis first and foremost, then medications and CPTs, against the HPI/MDM and the
   narrative. Flag an item ONLY when it names a condition, body system or clinical scenario the note
   clearly does not describe — e.g. the sole charted diagnosis is "Personal history of pneumonia" while
   the MDM and HPI describe folliculitis of the nasal vestibule.
   ACTION for a wrong DIAGNOSIS: the same two-action swap as check 2 — remove-diagnosis
   then add-diagnosis for what the note DOES support, never a bare removal, and never one that would
   leave the chart with zero diagnoses while the note documents a diagnosable condition. E.g. the chart
   codes acute vaginitis (N76.0) but the note describes a candidal yeast infection → swap to candidal
   vulvovaginitis (B37.3); do NOT merely remove N76.0.
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
  with marginal ones.
- Be economical with the ROS. You need not re-list a chief-complaint symptom the note already
  carries, and a symptom the planner already charted is not a gap. Propose a ROS finding only for a
  symptom the provider clearly stated that the chart does NOT have.`;

function actionShapesBlock(surface: Surface): string {
  // `authoringDoc` is for the surfaces that COMPOSE a note. Review corrects one that is already
  // written, so it gets the action's shape and the rules about what may be charted, and none of the
  // guidance about writing content from scratch — see the field's doc comment in registry.ts.
  const authoring = surface !== 'review';
  const docs = capabilitiesForSurface(surface).map((kind) => {
    // `CAPABILITIES` is `as const`, so an entry without `authoringDoc` has no such property in its
    // literal type. Read through the interface, the same way `surfaces` is read elsewhere.
    const capability: Capability = CAPABILITIES[kind];
    const extra = authoring ? capability.authoringDoc : undefined;
    return extra ? `${capability.promptDoc}\n${extra}` : capability.promptDoc;
  });
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

/**
 * A file whose contents REPLACE the static instructions, for A/B-testing a prompt end to end.
 *
 * Local experiment hook, in the same spirit as EASY_CHART_LOG_RESPONSE: the only way to answer "is the
 * difference the prompt or something else" is to run one implementation's prose through the other's
 * everything else. Comparing the two texts by eye cannot settle it — it did not, three times.
 *
 * Unset in every deployed environment, and it must stay that way: the prose here is version-controlled
 * beside the registry that generates half of it, and a prompt loaded from a path on someone's disk is a
 * prompt nobody can review. Applies to the PLAN surface only, so a stage or the review pass cannot be
 * silently swapped out from under its own vocabulary.
 */
function promptOverride(): string | undefined {
  const path = process.env.EASY_CHART_PROMPT_FILE;
  if (!path) return undefined;
  try {
    // Required lazily: this module is imported by the browser bundle, which has no fs.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    return readFileSync(path, 'utf8');
  } catch (error) {
    console.error(`[easy-chart] EASY_CHART_PROMPT_FILE could not be read: ${String(error)}`);
    return undefined;
  }
}

export function buildStaticInstructions(surface: Surface): string {
  if (surface === 'plan') {
    const override = promptOverride();
    if (override) return override;
  }
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
export function buildVariableTail(surface: Surface, input: PromptTailInput): string {
  const parts: string[] = [];

  // ONLY where apply-template exists. The block used to render on every surface, so the review pass
  // was handed the practice's whole template list and a rule about an action it cannot emit — and when
  // no titles were passed, the words "Do NOT emit apply-template" for an action that was never on
  // offer. Keyed off the vocabulary rather than a hardcoded surface list so a new surface gets this
  // right by construction.
  if (capabilitiesForSurface(surface).includes('apply-template')) {
    const titles = input.templateTitles ?? [];
    parts.push(
      titles.length
        ? `AVAILABLE TEMPLATES in this practice (exact titles — match these when you apply-template; do NOT invent template names):\n${titles
            .map((t) => `- ${t}`)
            .join('\n')}`
        : 'AVAILABLE TEMPLATES in this practice: none. Do NOT emit apply-template.'
    );
  }

  if (input.patientLine) {
    parts.push(`PATIENT (authoritative — take age and sex from here, never from the narrative):\n${input.patientLine}`);
  }

  // Name the E&M FAMILY, not just the status.
  //
  // The two branches were asymmetric in the worst direction: the one with NO information spelled out
  // which family to use, and the one that actually knew the answer stated a bare fact and left the model
  // to derive the family from it. Measured on the harvested corpus, where 30 of 40 gold codes are 99204:
  // in the 23 cases the status was supplied at all, E&M came out exact 11 times. `set-em-code` is scored
  // on the code, and the family is half the code — so the line that carries the status has to say what
  // the status IMPLIES.
  //
  // The unknown branch keeps directing to the established family on purpose: it is the conservative
  // billing choice when the chart cannot say. Note what that costs in an eval — a case whose status
  // never reached the prompt is not measuring the model's coding, it is measuring this fallback.
  parts.push(
    input.patientStatus === 'new'
      ? 'PATIENT STATUS (authoritative — from the chart): NEW patient — no professional services in the past 3 years. Use the NEW-patient E&M family (99202-99205) for set-em-code.'
      : input.patientStatus === 'established'
      ? 'PATIENT STATUS (authoritative — from the chart): ESTABLISHED patient. Use the established-patient E&M family (99212-99215) for set-em-code.'
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
  return `${buildStaticInstructions(surface)}\n\n${FIXED_INSTRUCTIONS_END}\n\n${buildVariableTail(surface, tail)}`;
}
