import { APIGatewayProxyResult } from 'aws-lambda';
import {
  EASY_CHART_INTENT_KINDS as KIND_VALUES,
  EASY_CHART_NOTE_TEXT_FIELD_LABELS as LABELS,
  EASY_CHART_NOTE_TEXT_FIELDS as NOTE_TEXT_FIELDS,
  EasyChartAgentIntent,
  EasyChartAgentOutput,
  EasyChartNoteTextField as NoteTextField,
  EasyChartTokenUsage,
} from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { invokeChatbotStructured, parseStructuredModelOutput } from '../../shared/ai';
import { coerceNumericStepFields } from '../../shared/easy-chart/planner-core';
import { detectSpeakerLabels, sniffDoseFormScoped, sniffIcdCodeScoped } from '../../shared/easy-chart/sniffers';
import { normalizeVitalIntent, VITAL_FIELDS } from '../../shared/easy-chart/vitals';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'easy-chart-agent';

// Exported for the digit-loop schema guard test.
export const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    intent: {
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
        text: { type: 'string' }, // add-patient-instruction / set-disposition note text
        dispositionType: { type: 'string' }, // set-disposition: pcp | ed | specialty | another | ip
        // DIGIT-LOOP GUARD: followUpInDays/value/systolic/diastolic are deliberately `string`, NOT
        // `number` — under Vertex constrained decoding a JSON number has no closing token, so a
        // flash-lite digit run self-reinforces to the token cap (see planner-core RESPONSE_SCHEMA).
        // coerceNumericStepFields() restores the numeric contract right after parse; do NOT change
        // these back to `number`.
        followUpInDays: { type: 'string' }, // set-disposition: "follow up in N days"
        finding: { type: 'string', enum: ['reports', 'denies'] },
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
        // set-vital: numeric vitals use `value` (+ `unit` for temp); BP uses systolic/diastolic. The
        // client/normalizer recovers these from `display` too, so the model only has to get `display` right.
        value: { type: 'string' }, // string, not number — digit-loop guard (see above)
        unit: { type: 'string' },
        systolic: { type: 'string' }, // string, not number — digit-loop guard (see above)
        diastolic: { type: 'string' }, // string, not number — digit-loop guard (see above)
      },
      required: ['kind'],
    },
  },
  required: ['intent'],
};

const buildPrompt = (message: string, noteContext?: Partial<Record<NoteTextField, string>>): string => {
  // Note: in this codebase the in-person Chief Complaint textarea is backed by the
  // historyOfPresentIllness chart-data key, and vice versa (CC <-> HPI swap). The labels
  // above describe what the provider sees, so the LLM should reason about "HPI" / "CC" by
  // those labels and emit the corresponding `field` value as documented in the prompt below.
  const contextLines: string[] = [];
  if (noteContext) {
    for (const field of NOTE_TEXT_FIELDS) {
      const v = noteContext[field];
      if (v && v.trim()) {
        const label = LABELS[field];
        contextLines.push(`- ${label} (field="${field}"): """${v}"""`);
      } else {
        contextLines.push(`- ${LABELS[field]} (field="${field}"): <empty>`);
      }
    }
  }
  const contextBlock =
    contextLines.length > 0 ? `\nCurrent free-text fields on this encounter:\n${contextLines.join('\n')}\n` : '';

  // PROMPT ORDER MATTERS: the static instructions below are a STABLE PREFIX (identical every call),
  // and the variable request/noteContext are appended at the very END. This lets the model provider
  // cache the fixed prefix so follow-up commands aren't re-billed the full instruction block.
  return `You are an assistant for a provider charting a clinical encounter. The provider's free-text
request — and the current note's free-text fields — appear at the END of this message, after the
action list. Decide which single charting action the provider wants. The action choices are:

ADD actions (search a canonical source and add the chosen record):
- "add-allergy": add an allergy to the patient's known allergies.
- "add-condition": add a past medical history condition (ICD-10).
- "add-medication": add a current/active medication.
- "add-surgical-history": add a past surgical procedure.
- "add-hospitalization": add a past hospitalization.
- "add-diagnosis": add a diagnosis for the current encounter (ICD-10). If the provider implies
  this is the primary diagnosis, set isPrimary=true; otherwise false.

CODE-BASED actions (the provider gives the code directly — emit it as the "code" field):
- "set-em-code": set the encounter's E&M (evaluation & management) CPT code. Triggered by phrases like
  "add E&M 99214", "set em code 99213", "E/M 99203". Required fields: kind, code (the E&M code as a
  string e.g. "99214"), display (a brief standard description for that code if you know it; otherwise
  echo the code).
- "add-cpt": add a CPT procedure/billing code to the encounter. Triggered by phrases like
  "add CPT 90471". Required fields: kind, code, display (brief standard description if known;
  otherwise echo the code).
- "remove-em-code": remove the encounter's E&M code. Triggered by phrases like "remove E&M",
  "remove E&M 99214". Required fields: kind. Optional: code (if the provider names a specific code
  to remove — used to confirm the right one is being deleted).
- "remove-cpt": remove a CPT code from the encounter. Triggered by phrases like "remove CPT 90471".
  Required fields: kind, code.
- "apply-template": apply a saved chart template by name. Triggered by phrases like
  "apply template laceration repair", "use AOM right template", "use template otitis media".
  Required fields: kind, display (the template name as the provider phrased it), searchTerms
  (1-3 alternate phrasings — the client fuzzy-matches these against the live list of templates).
- "add-procedure": add a procedure to the encounter, drawn from the practice's procedure quick
  picks. Triggered by phrases like "add lac repair procedure", "perform x-ray of knee",
  "procedure: laceration repair", "do a nail trephination". Required fields: kind, display
  (the procedure name as the provider phrased it), searchTerms (1-3 alternate phrasings — the
  client fuzzy-matches against the practice's procedure quick-pick names).
  IMPORTANT: an in-clinic medication administration (e.g. "Acetaminophen 1g IV in clinic",
  "Ketorolac IM", "ondansetron 4 mg IV given") is NOT a procedure — emit add-medication
  instead, with strength/doseForm. Reserve add-procedure for suturing, splinting, lavage,
  I&D, imaging, foreign body removal, and similar physical interventions.
  A LAB TEST IS NOT A PROCEDURE — order it with add-in-house-lab / add-external-lab (below), never
  add-procedure.

LAB ORDERS (order a diagnostic test — emit the test's common name as display + searchTerms):
- "add-in-house-lab": order an IN-OFFICE / point-of-care test run in the clinic. Triggered by phrases
  like "add a flu test", "rapid strep", "order a urinalysis / urine dip", "rapid COVID", "rapid RSV",
  "mono spot", "fingerstick glucose", "urine hCG", "wet prep". Required fields: kind, display (the
  test's common name e.g. "Flu A", "Rapid Strep A", "Urinalysis"), searchTerms (1-3 alternate
  phrasings — the client fuzzy-matches against the practice's in-house lab catalog).
- "add-external-lab": order a SEND-OUT / reference-lab test that is drawn and sent out. Triggered by
  phrases like "send a CBC", "order a CMP / BMP", "lipid panel", "TSH", "A1c", "blood culture",
  "send out a ...". Required fields: kind, display (the test's common name e.g. "CBC", "CMP"),
  searchTerms (1-3 alternate phrasings — the client fuzzy-matches against the connected lab catalog).
  Do NOT also emit add-cpt for a test ordered this way — the lab order carries its own billing.
- "add-patient-instruction": add a patient-FACING care-plan instruction (home care, activity
  restrictions, how to take a medication, wound/splint care, return precautions, or follow-up
  logistics). Triggered by phrases like "tell the patient to keep the splint dry", "add return
  precautions for fever", "instruct her to follow up with ortho in 2 days", "give instructions to
  elevate the leg". Required fields: kind, text (the instruction written as a clear directive TO THE
  PATIENT, second person — e.g. "Keep the splint clean and dry and elevate the leg above heart
  level."). This is the Plan tab's Patient Instructions — do NOT route patient instructions to
  edit-note-text/MDM.
- "set-disposition": set the visit Disposition (where the patient goes next). Triggered by phrases
  like "follow up with PCP in a week", "refer to ortho", "send her to the ER", "have them return
  here in 2 days". Required fields: kind, dispositionType (one of "pcp" | "specialty" | "ed" |
  "another" | "ip"), text (the disposition note). Optional: followUpInDays (number, e.g. "in 3
  days" -> 3, "in 2 weeks" -> 14).
- "add-radiology": order an imaging study (X-ray, ultrasound). Triggered by "get a chest x-ray",
  "3-view ankle film", "order a right wrist x-ray". Required fields: kind, display (study name with
  view count + body site, e.g. "3-view right ankle X-ray"), searchTerms (1-3 alternates the client
  matches against the radiology catalog). Do NOT also emit add-cpt for the imaging.
- "add-nursing-order": a task for nursing staff. Triggered by "nursing order for wound care",
  "have nursing apply a splint". Required fields: kind, text (the nursing task as a directive).
- "set-vital": record a vital sign. Triggered by "temp 102.2 F", "add a temperature of 100.4",
  "heart rate 88", "BP 122 over 78", "O2 sat 97%", "respiratory rate 18", "weight 30 kg". Required
  fields: kind, field, display. The "field" value is EXACTLY one of: vital-temperature,
  vital-heartbeat, vital-respiration-rate, vital-oxygen-sat, vital-blood-pressure, vital-weight,
  vital-height. ALWAYS include "display" with the reading exactly as stated, INCLUDING the unit for
  temperature ("102.2 F", "38 C") and BOTH numbers for blood pressure as "systolic/diastolic"
  ("122/78"). You may also fill value/unit (or systolic/diastolic for BP) but "display" alone is
  enough — the server parses the numbers from it. Do NOT refuse a vital — recording vitals IS supported.
- "update-procedure": update one or more fields on an EXISTING procedure already in the chart.
  Triggered by phrases like "adjust procedure site to arm right", "change procedure technique
  to sterile", "set procedure time spent to 30 minutes", "update the lac repair complications
  to none". Required fields: kind, updates (array of { field, value } pairs). Optional:
  procedureMatch (a phrase identifying which procedure to update — the client fuzzy-matches it
  against the procedureType or the procedure's CPT display; omit if there is clearly only one
  procedure on the chart).
  Recognized canonical field names (use these exact strings — split phrases like "site arm
  right" into multiple updates: { field: "bodySite", value: "arm" } and { field: "bodySide",
  value: "right" }):
    bodySite, bodySide, technique, suppliesUsed, procedureDetails, medicationUsed,
    complications, patientResponse, postInstructions, timeSpent, performerType,
    documentedBy, specimenSent (use "true"/"false"), consentObtained ("true"/"false").

  Most of these fields (bodySite, bodySide, technique, suppliesUsed, complications,
  patientResponse, postInstructions, timeSpent, medicationUsed) are constrained to specific
  codes from the practice's FHIR ValueSets — the client coerces the value you emit to the
  closest allowed code, OR skips the update if there is no plausible match. So: emit the
  value the provider actually said (e.g. "sterile", "chest", "right") — don't make up codes,
  but also don't emit updates for fields the provider didn't actually mention.
  specimenSent / consentObtained: "true" or "false".
  Common pitfall: words like "site", "side", "body", "to" are field-name synonyms in the
  provider's request, NOT values. Don't emit a bodySide="side" update from a phrase like
  "set body side to chest" — instead reason about what value the provider actually meant
  (here, "chest" applies to bodySite, and no bodySide value is supplied so omit bodySide).
  Clearing a field: to blank out / clear / remove / erase a field's value (e.g. "change
  procedure time spent to blank", "clear the complications", "remove the supplies"), emit that
  field with an empty-string value: { field: "timeSpent", value: "" }. Use an empty string ONLY
  for an explicit clear request — never as a stand-in for a value you're unsure about.

EXAM FINDING (check a specific structured exam item):
- "add-exam-finding": add (i.e. check the box for) a structured physical-exam observation.
  Triggered by phrases like "add scalp laceration to exam", "exam: TM bulging right",
  "patient has hematoma on head", "abnormal: scalp laceration". Required fields: kind,
  display (the finding as the provider phrased it), searchTerms (1-3 alternate phrasings
  including the most likely exact label). The client fuzzy-matches against the leaf checkbox
  labels in the practice's exam template (e.g. "Scalp laceration", "Right TM bulging") and
  presents the closest matches for the provider to pick.
- "remove-exam-finding": remove an exam finding that's currently on the chart. Triggered by
  phrases like "remove sinus tenderness from exam", "uncheck scalp laceration", "remove the
  TM bulging finding". Required fields: kind, display, searchTerms. The client matches
  against the items actually present on this encounter's exam (NOT the full catalog).

REVIEW OF SYSTEMS FINDING (check a structured ROS symptom — NOT free text):
- "add-ros-finding": add a structured Review-of-Systems finding. ROS is a set of structured
  checkboxes (like exam findings), NOT prose — so ANY request to add a symptom the patient
  reports or denies to the ROS uses THIS action, never edit-note-text. Triggered by phrases like
  "add denies chills to the ROS", "ROS: reports headache", "patient denies fever and cough",
  "add chest pain to review of systems". Required fields: kind, display, searchTerms, finding.
    * display MUST begin with "Denies" or "Reports" followed by the symptom, e.g. "Denies chills",
      "Reports headache". A symptom the patient DENIES → "Denies ..."; one the patient REPORTS/has
      → "Reports ...".
    * finding: "denies" or "reports" — match the verb in display.
    * searchTerms: 1-3 synonyms for the symptom WITHOUT the Denies/Reports verb (e.g. ["chills",
      "rigors"], ["headache","cephalgia"]). The client fuzzy-matches the symptom against the ROS
      checkbox catalog.
  If the request names several ROS symptoms at once, pick the single most salient one (the agent
  emits ONE action); the provider can add the rest with follow-up commands.
- "remove-ros-finding": remove a Review-of-Systems symptom currently on the chart. Use THIS (not
  remove-exam-finding) whenever the thing to remove is a ROS symptom — fatigue, fever, cough,
  chest pain, eye pain, sore throat, rhinorrhea, etc. — including when the phrase carries a
  "Denies"/"Reports" verb. Triggered by "remove Denies Eye pain", "remove fatigue from the ROS",
  "uncheck reports chest pain", "take denies hemoptysis off review of systems". Required fields:
  kind, display, searchTerms. KEEP the leading "Denies"/"Reports" verb in display when present so
  the client removes the right polarity; searchTerms are symptom synonyms without the verb.
  (remove-exam-finding is ONLY for physical-exam findings like "TM bulging" or "scalp laceration",
  never for ROS symptoms.)

NOTE-TEXT EDIT (edit the free-text content of a section of the note):
- "edit-note-text": edit the prose in Chief Complaint, HPI, MOI, ROS, or MDM. Triggered by
  phrases like "adjust HPI area affected to show left arm", "edit MOI to mention the patient
  fell on concrete", "change MDM to add: discussed return precautions", "set CC to chest pain".
  Required fields: kind, field (one of: "chiefComplaint", "historyOfPresentIllness",
  "mechanismOfInjury", "ros", "medicalDecision"), newText (the FULL new content for that
  field reflecting the provider's edit — if the provider asked to fill in a placeholder or
  append a clause, return the entire updated paragraph, not just the change).
  IMPORTANT: do NOT use field "ros" to ADD a symptom the patient reports or denies — that is a
  structured finding and MUST use "add-ros-finding" above. Only use field "ros" to edit existing
  free-text ROS prose, which is rare.
  Use the current free-text fields shown above as the starting point. If the current field
  is empty and the instruction implies adding new prose, just set newText to the new content.
  VOICE for newText — write as a treating clinician would document, NOT as a layperson summary:
    * Third person, no patient first name in the body ("the patient", "an 8mo female").
    * Concise clinical phrasing with standard abbreviations (HPI, PMH, NKDA, OM, URI, w/, s/p,
      c/o, p/w, +/-, prn, etc.) where they reduce wordiness without losing meaning.
    * Convert lay phrasing to clinical: "pulling at her ear" → "tugging at right ear / right
      otalgia", "fussy" → "irritable", "sleeping poorly" → "decreased sleep", "no vomiting or
      diarrhea" → "no N/V/D", "lungs sound good" → "CTAB", "tummy soft" → "abdomen soft".
    * Drop demographic details that live on Patient/Coverage (full name, DOB, address, phone,
      insurance, race, ethnicity, language, PCP, emergency contacts).
    * CC: 2-6 words ("Right ear pain"). Not a sentence.
    * MDM: clinical reasoning + plan rationale, not patient instructions.

REMOVE actions (match against items ALREADY in the chart and delete):
- "remove-allergy": remove an existing allergy.
- "remove-condition": remove an existing medical-history condition.
- "remove-medication": remove a current medication.
- "remove-surgical-history": remove a surgical-history entry.
- "remove-hospitalization": remove a hospitalization entry.
- "remove-diagnosis": remove a diagnosis from this encounter.

OTHER:
- "unknown": the request doesn't clearly match any of the above, or is too vague to act on.

Return JSON with a single "intent" object:

For action kinds (everything except "unknown"):
- kind: one of the above
- display: a short, natural-language phrase describing the item to add or remove
- searchTerms: 1-3 short alternative phrasings or canonical names. For add: improve search hit
  rate. For remove: improve fuzzy match against existing chart items. Always include the display
  phrase as one of the searchTerms. For add-medication: keep searchTerms focused on the active
  ingredient or brand name (e.g. "Amoxicillin"); don't pack strength/form into the searchTerms —
  use the strength/doseForm fields below for that.
- code (add-diagnosis / add-condition only, OPTIONAL): the ICD-10 code from the message when the
  provider explicitly stated it ("acute otitis media (H66.91)", "PMH hypertension I10",
  "S93.421A ankle sprain"). Format: just the code, no parentheses. Omit if the provider didn't
  state a code.
- strength (add-medication only): the exact dose+concentration as written by the provider,
  e.g. "400 mg/5 mL", "500 mg", "10 mg/mL". Include WHENEVER the provider gives a strength;
  omit ONLY if no strength was mentioned (e.g. "start metoprolol" with no dose).
- doseForm (add-medication only): the dosage-form word, e.g. "Suspension", "Tablet",
  "Capsule", "Liquid", "Solution", "Cream", "Drops", "Spray", "Ointment", "Injection".
  Include WHENEVER the provider names a form — even when it sits next to the ingredient
  ("amoxicillin SUSPENSION", "ibuprofen TABLET"). Omit ONLY if no form was mentioned.
- isPrimary (for add-diagnosis only): true if the provider implies this is the primary diagnosis,
  otherwise false. Default false if unspecified.

For "unknown":
- kind: "unknown"
- message: one short sentence explaining what you couldn't interpret and inviting the provider to
  rephrase (e.g. "I didn't understand 'foo'. Try 'add allergy ibuprofen' or 'remove diagnosis flu'.").

DO NOT emit codes (ICD-10, RxNorm, CPT) — codes come from the canonical search the client runs.

═══ END OF FIXED INSTRUCTIONS — the request to act on NOW follows ═══

The provider just typed this free-text request:

"""
${message}
"""
${contextBlock}`;
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { message, noteContext, secrets } = validateRequestParameters(input);

  let usage: EasyChartTokenUsage | undefined;
  const raw = await invokeChatbotStructured(
    [{ text: buildPrompt(message, noteContext) }],
    secrets,
    RESPONSE_SCHEMA,
    // The agent always runs on flash-lite as PRIMARY (cheap, fast for short commands). A tight 4k cap
    // means a flash-lite runaway loop (deterministic on some inputs, e.g. "set weight to 30 kg") fails
    // in ~1s, after which invokeChatbotStructured escalates to the reliable backup model automatically.
    'gemini:gemini-3.1-flash-lite',
    (u) => {
      usage = u;
    },
    4096
  );

  // Unparseable/malformed model output is an upstream failure, not a user-input problem — raw
  // throws (they page). INVALID_INPUT_ERROR here blamed the provider's command and hid outages.
  const parsed = parseStructuredModelOutput(raw, 'chart intent') as { intent?: unknown };

  const i = parsed.intent as Record<string, unknown> | undefined;
  if (!i || typeof i !== 'object' || typeof i.kind !== 'string') {
    throw new Error('Model returned a malformed intent');
  }
  // The schema declares value/systolic/diastolic/followUpInDays as strings (digit-loop guard) —
  // restore the numeric contract before the typed-intent checks below expect numbers.
  coerceNumericStepFields(i);

  let intent: EasyChartAgentIntent;
  if (i.kind === 'unknown') {
    intent = { kind: 'unknown', message: typeof i.message === 'string' ? i.message : "I'm not sure what to do." };
  } else if ((KIND_VALUES as readonly string[]).includes(i.kind)) {
    const display = typeof i.display === 'string' ? i.display : '';
    const searchTerms = Array.isArray(i.searchTerms)
      ? i.searchTerms.filter((t): t is string => typeof t === 'string' && !!t.trim())
      : [];
    if (i.kind === 'set-em-code' || i.kind === 'add-cpt') {
      const code = typeof i.code === 'string' ? i.code.trim() : '';
      if (!code) {
        intent = { kind: 'unknown', message: 'I need a code for that action. Try "add E&M 99214".' };
      } else {
        intent = { kind: i.kind, code, display: display || code };
      }
    } else if (i.kind === 'remove-em-code') {
      const code = typeof i.code === 'string' ? i.code.trim() : '';
      intent = code ? { kind: 'remove-em-code', code } : { kind: 'remove-em-code' };
    } else if (i.kind === 'remove-cpt') {
      const code = typeof i.code === 'string' ? i.code.trim() : '';
      if (!code) {
        intent = { kind: 'unknown', message: 'I need a CPT code to remove. Try "remove CPT 90471".' };
      } else {
        intent = { kind: 'remove-cpt', code };
      }
    } else if (i.kind === 'update-procedure') {
      const updates = Array.isArray(i.updates)
        ? i.updates
            .filter((u): u is { field: string; value: string } => {
              // An empty value is allowed — it signals a "clear this field" request (the client
              // unsets the field). We only require a field name; value just has to be a string.
              return (
                !!u &&
                typeof u === 'object' &&
                typeof (u as { field?: unknown }).field === 'string' &&
                typeof (u as { value?: unknown }).value === 'string' &&
                !!(u as { field: string }).field.trim()
              );
            })
            .map((u) => ({ field: u.field.trim(), value: u.value.trim() }))
        : [];
      if (updates.length === 0) {
        intent = {
          kind: 'unknown',
          message:
            'I need at least one field and value to update on the procedure. Try "adjust procedure site to arm".',
        };
      } else {
        const procedureMatch =
          typeof i.procedureMatch === 'string' && i.procedureMatch.trim() ? i.procedureMatch.trim() : undefined;
        intent = { kind: 'update-procedure', updates, procedureMatch };
      }
    } else if (i.kind === 'edit-note-text') {
      const field = typeof i.field === 'string' ? i.field.trim() : '';
      const newText = typeof i.newText === 'string' ? i.newText : '';
      if (!(NOTE_TEXT_FIELDS as readonly string[]).includes(field)) {
        intent = {
          kind: 'unknown',
          message: `I can't edit "${field}" — try referring to chief complaint, HPI, MOI, ROS, or MDM.`,
        };
      } else {
        intent = { kind: 'edit-note-text', field: field as NoteTextField, newText };
      }
    } else if (i.kind === 'add-patient-instruction') {
      const text = typeof i.text === 'string' ? i.text.trim() : '';
      if (!text) {
        intent = {
          kind: 'unknown',
          message: 'I need the instruction text. Try "tell the patient to keep the splint clean and dry".',
        };
      } else {
        intent = { kind: 'add-patient-instruction', text };
      }
    } else if (i.kind === 'set-disposition') {
      const dispositionType = typeof i.dispositionType === 'string' ? i.dispositionType.trim() : '';
      const text = typeof i.text === 'string' ? i.text.trim() : '';
      if (!dispositionType) {
        intent = {
          kind: 'unknown',
          message: 'I need a disposition type. Try "follow up with PCP in a week" or "refer to ortho".',
        };
      } else {
        const followUpInDays = typeof i.followUpInDays === 'number' ? i.followUpInDays : undefined;
        intent = { kind: 'set-disposition', dispositionType, text, followUpInDays };
      }
    } else if (i.kind === 'add-nursing-order') {
      const text = typeof i.text === 'string' ? i.text.trim() : '';
      intent = text
        ? { kind: 'add-nursing-order', text }
        : { kind: 'unknown', message: 'I need the nursing task. Try "nursing order for wound care".' };
    } else if (i.kind === 'set-vital') {
      // Recover value/unit/systolic/diastolic/display from what the model emitted via the shared
      // normalizer (same path the planner uses), then build the typed intent the client consumes.
      if (typeof i.field !== 'string' || !(VITAL_FIELDS as readonly string[]).includes(i.field)) {
        intent = { kind: 'unknown', message: 'Which vital? Try "set temp to 100.4 F" or "BP 120/80".' };
      } else {
        normalizeVitalIntent(i, message);
        const field = i.field as Extract<EasyChartAgentIntent, { kind: 'set-vital' }>['field'];
        const vitalDisplay = typeof i.display === 'string' && i.display.trim() ? i.display.trim() : '';
        if (i.field === 'vital-blood-pressure') {
          intent =
            i.systolic != null && i.diastolic != null
              ? {
                  kind: 'set-vital',
                  field,
                  display: vitalDisplay || `${i.systolic}/${i.diastolic}`,
                  systolic: Number(i.systolic),
                  diastolic: Number(i.diastolic),
                }
              : { kind: 'unknown', message: 'I need both blood pressure numbers, e.g. "BP 122/78".' };
        } else if (typeof i.value === 'number' && !Number.isNaN(i.value)) {
          intent = {
            kind: 'set-vital',
            field,
            display: vitalDisplay || String(i.value),
            value: i.value,
            ...(typeof i.unit === 'string' && i.unit.trim() ? { unit: i.unit.trim() } : {}),
          };
        } else {
          intent = { kind: 'unknown', message: 'I need a value for that vital, e.g. "set temp to 100.4 F".' };
        }
      }
    } else if (!display) {
      intent = { kind: 'unknown', message: "I couldn't extract what to add. Try rephrasing." };
    } else if (i.kind === 'add-diagnosis') {
      const llmCode = typeof i.code === 'string' && i.code.trim() ? i.code.trim() : undefined;
      const code = llmCode ?? sniffIcdCodeScoped(message, display, searchTerms, detectSpeakerLabels(message));
      intent = { kind: 'add-diagnosis', display, searchTerms, isPrimary: i.isPrimary === true, code };
    } else if (i.kind === 'add-condition') {
      const llmCode = typeof i.code === 'string' && i.code.trim() ? i.code.trim() : undefined;
      const code = llmCode ?? sniffIcdCodeScoped(message, display, searchTerms, detectSpeakerLabels(message));
      intent = { kind: 'add-condition', display, searchTerms, code };
    } else if (i.kind === 'add-medication') {
      const strength = typeof i.strength === 'string' && i.strength.trim() ? i.strength.trim() : undefined;
      const llmDoseForm = typeof i.doseForm === 'string' && i.doseForm.trim() ? i.doseForm.trim() : undefined;
      // Gemini's structured output is conservative with optional fields and frequently skips
      // doseForm even when the message says "amoxicillin SUSPENSION". Fall back to a keyword
      // sniff of the message text — scoped to a window near the medication name so a form
      // mentioned for a different drug in the same message doesn't contaminate this one.
      const doseForm = llmDoseForm ?? sniffDoseFormScoped(message, display, searchTerms);
      intent = { kind: 'add-medication', display, searchTerms, strength, doseForm };
    } else if (i.kind === 'add-ros-finding') {
      // ROS state is taken from the leading Denies/Reports word in display (the client also
      // derives it that way); fall back to the explicit `finding` field if present.
      const finding: 'reports' | 'denies' = /^denies\b/i.test(display) || i.finding === 'denies' ? 'denies' : 'reports';
      intent = { kind: 'add-ros-finding', display, searchTerms, finding };
    } else {
      // Add / remove kinds without extras
      intent = { kind: i.kind, display, searchTerms } as EasyChartAgentIntent;
    }
  } else {
    intent = { kind: 'unknown', message: `Unknown action kind "${i.kind}".` };
  }

  const output: EasyChartAgentOutput = { intent, usage };
  return { statusCode: 200, body: JSON.stringify(output) };
});
