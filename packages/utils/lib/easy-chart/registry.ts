// The Easy Chart action registry: the single source for the LLM response schema, the per-action prompt
// text and the runtime validation of every action kind. Pinned by registry.test.ts.

import { z } from 'zod';
import {
  Action,
  ACTION_KINDS,
  ActionField,
  ActionKind,
  FOLLOW_UP_DAYS,
  NOTE_TEXT_FIELDS,
  PLANNABLE_DISPOSITION_TYPES,
  PLANNABLE_VITAL_FIELDS,
  RawAction,
} from './actions';

export interface Capability {
  /**
   * The action's fields as one Zod object: required means not `.optional()`, and `.describe()` is the
   * text the model reads about the field. The wire schema, the prompt shape line and the required-field
   * gate are all derived from it.
   */
  shape: z.ZodObject<z.ZodRawShape>;
  /** Action-level rules, shown after the field lines. */
  promptDoc: string;
}

/**
 * String caps, roughly 4x the longest real value, so a cap only ever stops a repetition loop under
 * constrained decoding (schema.ts, trap 2), never a legitimate value.
 */
export const CAP = {
  display: 300,
  token: 60,
  sentence: 800,
  noteField: 8000,
} as const;

/** A required string: blank counts as absent, exactly as `hasRequiredFields` treats it. */
const requiredText = (max: number): z.ZodString => z.string().trim().min(1).max(max);
const optionalText = (max: number): z.ZodOptional<z.ZodString> => z.string().max(max).optional();

const GUARDED_NUMERICS = new WeakSet<z.ZodTypeAny>();

/**
 * A numeric field that travels as a capped string (schema.ts, trap 1) and is parsed back into a number
 * by the shape's transform. Every numeric field in the registry must be declared with this.
 */
export function guardedNumber(doc: string): z.ZodOptional<z.ZodEffects<z.ZodString, number | undefined, string>> {
  const schema = z
    .string()
    .max(CAP.token)
    .transform((v) => {
      const n = v.trim() === '' ? NaN : Number(v);
      return Number.isFinite(n) ? n : undefined;
    })
    .describe(doc)
    .optional();
  GUARDED_NUMERICS.add(schema);
  return schema;
}

function isGuardedNumber(schema: z.ZodTypeAny): boolean {
  return GUARDED_NUMERICS.has(schema);
}

const F = {
  display: (doc: string) => requiredText(CAP.display).describe(doc),
  optionalDisplay: (doc: string) => optionalText(CAP.display).describe(doc),
  searchTerms: (doc = 'Synonyms or alternate phrasings for the catalogue search (1–3).') =>
    z.array(z.string().max(CAP.display)).optional().describe(doc),
  code: (doc: string) => requiredText(CAP.token).describe(doc),
  optionalCode: (doc: string) => optionalText(CAP.token).describe(doc),
  sentence: (doc: string) => requiredText(CAP.sentence).describe(doc),
  optionalSentence: (doc: string) => optionalText(CAP.sentence).describe(doc),
  noteField: (doc: string) => requiredText(CAP.noteField).describe(doc),
  /** ROS polarity; the server derives it from the display verb when omitted. */
  polarity: () =>
    z.enum(['reports', 'denies']).optional().describe('Polarity; derived from the display verb when omitted.'),
};

const NOTE_FIELD_LIST = NOTE_TEXT_FIELDS.join(' | ');
const VITAL_FIELD_LIST = PLANNABLE_VITAL_FIELDS.join(', ');
const DISPOSITION_TYPE_LIST = PLANNABLE_DISPOSITION_TYPES.map((t) => `"${t}"`).join(', ');

export const CAPABILITIES = {
  'apply-template': {
    shape: z.object({
      display: F.display(
        'The template title, as listed under AVAILABLE TEMPLATES. A suggestion — the provider applies it.'
      ),
      searchTerms: F.searchTerms('Alternate words from the title, for a fuzzy match.'),
    }),
    promptDoc: `match against the practice's saved templates by
  their EXACT listed titles; never invent a template name.
  THIS IS A SUGGESTION, NOT A WRITE. Nothing in this plan applies the template — the provider applies it
  by hand, later, if they agree — so chart the visit completely whether or not you suggest one.
  SUGGEST A TEMPLATE ONLY ON A STRONG, SPECIFIC MATCH — one that clearly corresponds to THIS visit's
  primary diagnosis or presentation. A mismatched template pollutes the note with the wrong exam and
  MDM scaffolding, so it is better to have NO template than the wrong one; when in doubt, omit it.
  Concrete do-NOTs: "Asthma" for a COPD exacerbation, "Bug Bite" for a cutaneous abscess,
  "Sprain/strain" for a FRACTURE, a generic procedure template for a specific laceration.
  Match by the DIAGNOSIS/condition, NOT by whether an x-ray or procedure happened: a template titled
  "Sprain/strain with xray" is for a SPRAIN that got an x-ray, not for any injury that got imaging.
  LATERALITY = the side(s) actually DIAGNOSED, not the sides examined. "Pulling on the right ear;
  I'll check both" with an exam finding only on the right is a RIGHT-side diagnosis. Choose Bilateral
  ONLY when the finding is present on BOTH sides. A problem the patient previously had on the other
  side, an already-resolved finding, or a side that is normal on today's exam is HISTORY and must
  never set the laterality of the current diagnosis.
  The ONE allowed exception to the strong-match rule: a template that is genuinely the right CATEGORY
  but more GENERIC than the specific diagnosis (a "Headache" template for a migraine) MAY be suggested
  for structure; the specific diagnosis is charted by add-diagnosis as always.`,
  },

  'add-allergy': {
    shape: z.object({
      display: F.display('The allergen ("Penicillin", "Peanuts").'),
      searchTerms: F.searchTerms(),
    }),
    promptDoc: `an allergy the provider states the patient HAS, or
  directs to be added to the allergy list. REQUIRED whenever one is stated, and SEPARATE from any
  "allergic reaction" diagnosis: a new drug reaction this visit produces BOTH an add-diagnosis for the
  reaction AND an add-allergy for the culprit drug. Never bury a stated allergy in the MDM/HPI only.
  BE SPECIFIC — the allergy database is matched by name and a vague root word resolves to the WRONG
  entry. "sulfa"/"sulfonamide" alone collides with sulfonamide DIURETICS and with the salt word
  "sulfate", so a sulfa ANTIBIOTIC reaction is display "Sulfonamide Antibiotics", searchTerms
  ["sulfonamide antibiotic","sulfamethoxazole","sulfa antibiotic"] — NOT display "Sulfa".
  Prefer the specific agent or class for other drug allergies ("penicillin" → Penicillins).`,
  },

  'add-condition': {
    shape: z.object({
      display: F.display('The background condition ("Asthma", "Personal history of urinary calculus").'),
      searchTerms: F.searchTerms(),
      code: F.optionalCode(
        'Best ICD-10 code. Z-codes for resolved or past history; F17.210 / Z87.891 for smoking status.'
      ),
    }),
    promptDoc: `the patient's BACKGROUND history, distinct
  from today's diagnoses. A chronic or pre-existing condition the patient is stated to carry ("known
  history of asthma", "h/o COPD", "PMH includes diabetes") MUST become an add-condition SEPARATE from
  today's visit diagnosis: "9yo with a known history of asthma here with an asthma exacerbation" →
  add-condition "Asthma" IN ADDITION to the exacerbation diagnosis.
  A condition that has fully RESOLVED or is in the PAST uses a personal-history Z-code, not the active
  code: "history of a kidney stone two years ago that passed" → {display:"Personal history of urinary
  calculus", code:"Z87.442"}, NOT N20.0.
  SOCIAL HISTORY belongs here too and is often billing-relevant: "former smoker" → Z87.891,
  "current smoker" → F17.210.`,
  },

  'add-medication': {
    shape: z.object({
      display: F.display('Drug name with strength and form as stated ("Amoxicillin 400 mg/5 mL suspension").'),
      searchTerms: F.searchTerms('Ingredient or brand name ONLY ("Amoxicillin") — no strength or form.'),
      strength: F.optionalCode('Exact dose+concentration as written ("400 mg/5 mL"); omit when none was stated.'),
      doseForm: F.optionalCode(
        'Dosage-form word ("Suspension", "Tablet", "Cream", "Drops"); omit when none was stated.'
      ),
    }),
    promptDoc: `a medication the patient
  already takes at home ("using her albuterol at home", "takes lisinopril daily") OR one PRESCRIBED
  today. Both belong on the chart; do not drop the home meds just because a prescription is also
  present. A medication GIVEN in the clinic — an IM/IV/SC injection, a nebuliser treatment, a dose
  administered here, a vaccine — is an ORDER, not a chart medication: do NOT add it; if it must not be
  lost, mention it in a provider-note.
  Keep searchTerms focused on the ingredient/brand name ("Amoxicillin") — do NOT pack strength or form
  into them; they have their own fields so the client can rank catalogue results.
  strength: the exact dose+concentration as written ("400 mg/5 mL", "500 mg"). Include WHENEVER the
  narrative gives one; omit only when no strength was mentioned.
  doseForm: the dosage-form word ("Suspension", "Tablet", "Capsule", "Cream", "Drops", "Injection").
  Include WHENEVER the narrative names a form; omit only when none was mentioned.
  Example: "amoxicillin suspension 400 mg/5 mL, 9 mL TID for 10 days" → { display: "Amoxicillin
  400 mg/5 mL suspension", searchTerms: ["Amoxicillin"], strength: "400 mg/5 mL", doseForm:
  "Suspension" }.
  An in-clinic medication administration ("Ketorolac IM", "ondansetron 4 mg IV given") is a MEDICATION,
  not a procedure.`,
  },
  'add-surgical-history': {
    shape: z.object({
      display: F.display('The past operation ("Appendectomy").'),
      searchTerms: F.searchTerms(),
    }),
    promptDoc: `a past operation the narrative states.`,
  },

  'add-hospitalization': {
    shape: z.object({
      display: F.display('The past hospitalization, as stated.'),
      searchTerms: F.searchTerms(),
    }),
    promptDoc: `a past hospitalization the narrative states.`,
  },

  'edit-note-text': {
    shape: z.object({
      field: z.enum(NOTE_TEXT_FIELDS).describe('The note field to write.'),
      newText: F.noteField('The FULL new content of the field, not a fragment.'),
    }),
    promptDoc: `field is one of: ${NOTE_FIELD_LIST}.
  newText is the FULL new content for that field. When existing text is shown in the context below and
  the narrative implies an edit in place, return the entire updated paragraph, not just the change.
  Review of Systems is NOT free text here — it is structured; use add-ros-finding, not
  edit-note-text on "ros".
  ALWAYS emit edit-note-text for historyOfPresentIllness AND medicalDecision on EVERY visit,
    — all of them are required for a complete, signable note, they are patient-specific.
  chiefComplaint is CONDITIONAL: most providers leave it blank because the HPI's opening one-liner
  already states the reason for the visit. Emit it ONLY when it adds information that first line does
  not already carry, and then as a 2–6 word label ("Low back pain", "Cough x3 days"), never a
  sentence, and never merged into the HPI. mechanismOfInjury: injury visits only.

  VOICE for newText — write as a treating clinician documents, not as a layperson summarising:
    * Third person, no patient first name in the body ("the patient", "an 8mo female").
    * Concise clinical phrasing with standard abbreviations (PMH, NKDA, RLQ, URI, w/, s/p, c/o, p/w,
      prn) where they reduce wordiness without losing meaning.
    * HPI starts with a brief one-liner identifier ("8mo F p/w fever and right otalgia x1 day"), then
      a chronological narrative, associated symptoms (pertinent positives AND negatives), pertinent
      ROS, relevant context. Drop demographics that already live on the Patient resource.
    * Convert lay phrasing to clinical: "pulling at her ear" → "right otalgia", "fussy" → "irritable",
      "throwing up" → "vomiting", "lung sounds good" → "CTAB".
    * MDM: clinical reasoning + plan rationale, not patient instructions — and EVERY statement in it
      must be anchored in what the provider actually dictated. Build it from (a) the pertinent
      positives/exam findings they voiced, (b) an assessment that restates the diagnosis THIS PLAN is
      charting (an MDM saying "likely viral URI, supportive care" while the plan charts AOM and starts
      an antibiotic is a charting error), (c) the treatment actually ordered with drug + dose/duration
      when stated — never "appropriate antibiotics" or an unnamed "therapy", and (d) the follow-up
      interval and return conditions ONLY as stated.
      FORBIDDEN unless the provider actually said it: "supportive care", "conservative management",
      "monitor for worsening", "follow up as needed", "return precautions discussed", stock red-flag
      lists, or any differential they never voiced. A SHORT MDM made only of dictated specifics is
      correct; padding it with unvoiced clinical-sounding filler is fabrication. Aim for roughly
      2–6 sentences.
      The MDM may state the plan in shorthand, but every patient-FACING part of it still needs its own
      add-patient-instruction — mentioning it in the MDM does not relieve you of that step.`,
  },

  'set-vital': {
    shape: z.object({
      field: z.enum(PLANNABLE_VITAL_FIELDS).describe('Which vital the reading is.'),
      display: F.display(
        'The FULL reading exactly as stated, unit included ("98.9 F", "5\'8\\"", "130lb", "122/78", "98%").'
      ),
    }),
    promptDoc: `field is one of: ${VITAL_FIELD_LIST}.
  ALWAYS include "display" carrying the FULL reading exactly as stated, including its unit as written
  ("98.9 F", "1.73 m", "5'8\\"", "130lb", "122/78", "98%"). The server parses and converts it; a
  set-vital with no display cannot be charted.
  Emit ONE set-vital for EACH vital the narrative states — a message like \`patient is 5'8", weighs
  130lb\` is TWO actions, not one. If the SAME vital was measured more than once (an initial reading
  and a recheck), emit a separate set-vital for EACH reading, in order: serial measurements all belong
  on the chart and are not duplicates. Do not invent vitals the narrative does not give.
  For blood pressure keep BOTH numbers in display as "systolic/diastolic". For temperature include the
  unit letter (F or C).`,
  },

  'add-exam-finding': {
    shape: z.object({
      display: F.display(
        'The abnormal finding with its modifiers ("Right TM erythematous and bulging"), matched against the exam-template leaf labels.'
      ),
      searchTerms: F.searchTerms(),
    }),
    promptDoc: `matched against the practice's exam-template leaf
  labels. Emit an add-exam-finding for EVERY finding the provider VOICED — abnormal or normal
  ("Right TM erythematous and bulging", "abdomen soft", "Nontender", "lungs clear bilaterally", "5/5
  strength", "normal gait") — each with its verbatim "sourceText" quote. A normal finding with no
  quote is DROPPED by the server: a normal charts only when the provider said it. Never pad the exam
  with findings nobody addressed — a normal for a system the provider did not examine is not a
  finding, it is an invention.
  NEGATION GUARD — a finding the narrative explicitly negates ("no wheezing", "non-tender", "without
  crackles", "no rash") is a NORMAL finding, not an abnormal one. Emit it as the normal it asserts,
  displayed the way the normal leaf would be labelled ("No wheezing" / "Lungs clear", "Nontender", "No
  rash"), never as the abnormal it negates, and do NOT remove the matching normal either: the
  narrative AGREES with the normal. Match on POLARITY, not on the keyword.
  Do not bundle a pertinent negative into an abnormal finding — the negated clause drags the match onto
  the wrong (normal) leaf. "Oropharynx mildly injected without exudate" → display "Erythematous
  pharynx", searchTerms ["injected oropharynx","pharyngeal erythema"]; drop the "without exudate".
  Keep genuinely abnormal modifiers (erythematous, bulging, loss of light reflex).
  A single anatomic observation with several modifiers is ONE step, not several: "Right TM erythematous
  and bulging with loss of light reflex" is one add-exam-finding retaining all the modifiers. Emit
  separate steps only for distinctly different anatomic sites or systems.
  MATCH STRUCTURE TO STRUCTURE — a finding about ONE structure does not contradict a normal about a
  DIFFERENT structure in the same system. An abnormal tympanic membrane does NOT contradict "Normal
  canals"; remove that only if the narrative describes the CANAL as abnormal.
  Common genuine contradictions: any described distress → remove "In no acute distress"; wheezing,
  rales, rhonchi, decreased air entry or a prolonged expiratory phase → remove "No signs of respiratory
  distress" and "Good air movement throughout lung fields"; pharyngeal erythema or tonsillar exudate →
  remove "Oropharynx clear with no erythema, lesions, or exudate"; abdominal tenderness, distension or
  guarding → remove "Soft"/"Nontender"/"Nondistended" as applicable.`,
  },

  'add-ros-finding': {
    shape: z.object({
      display: F.display('"Denies <symptom>" or "Reports <symptom>".'),
      searchTerms: F.searchTerms('1–3 synonyms for the symptom, WITHOUT the word Denies/Reports.'),
      finding: F.polarity(),
    }),
    promptDoc: `a structured Review-of-Systems finding. The display
  MUST begin with "Denies" or "Reports" followed by the symptom name; searchTerms are 1–3 synonyms for
  the symptom and must NOT include the word Denies/Reports.
  UNLIKE exam findings, ROS records NEGATIVES too — this is the one place a denied symptom is a
  chartable item. "denies fevers, nausea, vomiting" → a separate "Denies …" finding for EACH symptom.
  Also record dictated pertinent POSITIVES in other systems ("she has a mild headache" → "Reports
  headache") — positives outside the chief complaint are easy to lose.
  Never invent a negative nobody addressed, and never deny the chief complaint itself.
  Format example — "denies chest pain and shortness of breath; reports a headache":
    {"kind":"add-ros-finding","display":"Denies chest pain","searchTerms":["chest pain"],"finding":"denies"}
    {"kind":"add-ros-finding","display":"Denies shortness of breath","searchTerms":["shortness of breath","dyspnea"],"finding":"denies"}
    {"kind":"add-ros-finding","display":"Reports headache","searchTerms":["headache","cephalgia"],"finding":"reports"}
  RECORD BOTH DIRECTIONS, and weight them by what the provider actually said. A symptom the
  patient REPORTS is as chartable as one they deny, and that INCLUDES the symptoms of the presenting
  complaint itself: "she's congested with a runny nose and a cough" → "Reports nasal congestion" AND
  "Reports rhinorrhea" AND "Reports cough". Do not skip a symptom because it also appears in the HPI —
  the ROS is a separate structured section, not a summary of the narrative, and a symptom left out here
  is simply absent from it.`,
  },

  'add-diagnosis': {
    shape: z.object({
      display: F.display('Accurate, SPECIFIC diagnosis label; for S-/T-code injuries include site and laterality.'),
      searchTerms: F.searchTerms(),
      code: F.optionalCode(
        'Best billable, fully specified ICD-10 code, ALWAYS supplied ("H66.91", "S39.012A"). Just the code.'
      ),
      isPrimary: z.boolean().optional().describe('true for exactly ONE diagnosis per visit, false for every other.'),
    }),
    promptDoc: `mark isPrimary=true for exactly ONE
  primary; every other diagnosis is isPrimary=false. Emit a SEPARATE add-diagnosis for EVERY distinct
  diagnosis made this visit — many encounters have two or three ("otitis media AND otitis externa") —
  and do not collapse a multi-problem visit into one
  STATED DIAGNOSIS WINS — when the provider explicitly names the diagnosis, chart THAT as primary.
  Never substitute a more severe or more specific condition inferred from the findings (flank
  tenderness does not upgrade a stated UTI to pyelonephritis). An escalated condition may appear as a
  SECONDARY only when the provider actually voiced it as suspected.
  PROVIDE YOUR BEST ICD-10 CODE for every diagnosis, even when the narrative did not state one
  ("acute otitis media right ear" → "H66.91", "migraine" → "G43.909"). Just the code, no parentheses.
  Every code is VALIDATED against the official ICD-10 set before anything is charted: a real billable
  code is used as-is, and anything else falls back to a search on your display/searchTerms — so a wrong
  guess is safely corrected and a hallucinated code can NEVER be charted. Propose confidently; do not
  leave the code blank. Still set an accurate, SPECIFIC display, because it is the fallback search
  query and the picker label.
  EMIT A BILLABLE, FULLY-SPECIFIED CODE — never a 3-character category that has children (use
  M54.50/M54.51, not bare "M54.5"; S06.0X0A, not "S06.0"). A non-billable parent is rejected.
  INCLUDE ANATOMIC LOCATION + LATERALITY for INJURY / EXTERNAL-CAUSE diagnoses (S- and T-codes: bites,
  sprains, fractures, lacerations, burns, contusions) — those codes are organised by body region, so
  display and searchTerms must carry the site/side ("Insect bite, right lower leg"), or the search
  picks an arbitrary region. Do NOT do this for chronic/medical disease codes (gout, otitis, diabetes,
  conjunctivitis): adding a site to "gout" wrongly forces a site-specific M10.0x over the commonly used
  M10.9.
  REGION CONSISTENCY — the code's body region MUST match your display. Spinal/back muscle strains are
  coded by SPINE level, never by limb: cervical → S16.1XXA; thoracic → S29.012A; lumbar/low back →
  S39.012A (or M54.50/M54.51 for low back pain). Never code a back strain to a lower-extremity site or
  to "other injury of unspecified body region" (T14.8). If unsure of the exact code, prefer a
  region-correct less-specific code over a precise code for the WRONG region.
  Do not chart the same diagnosis twice, and never more than one primary.`,
  },
  'set-em-code': {
    shape: z.object({
      code: F.code('The E&M code ("99213").'),
      display: F.optionalDisplay('The code description (optional).'),
    }),
    promptDoc: `ALWAYS emit exactly one.
  Pick the code FAMILY from the PATIENT STATUS line in the per-visit context below, never from the
  narrative: NEW patient (no professional services in the past 3 years) → 99202-99205; ESTABLISHED
  patient → 99212-99215. When no patient-status line is present the status is UNKNOWN — do not guess;
  default to the established family.
  The MDM-complexity logic is IDENTICAL in both families (the last digit is the level): level 3
  (99203/99213) for a straightforward, low-complexity visit — a single self-limited problem with simple
  management; level 4 (99204/99214) for moderate complexity, which prescription drug management, an
  acute illness needing a procedure, an injury needing imaging, or multiple problems commonly support.
  Reserve level 5 (99205/99215) for high complexity or high risk.`,
  },

  'set-disposition': {
    shape: z.object({
      dispositionType: z
        .enum(PLANNABLE_DISPOSITION_TYPES)
        .describe(`Where the patient goes: ${PLANNABLE_DISPOSITION_TYPES.join(' | ')} (see below).`),
      text: F.sentence('The disposition as one clinical sentence.'),
      followUpInDays: guardedNumber(
        `Follow-up interval in DAYS when stated, for pcp-no-type and specialty only: one of ${FOLLOW_UP_DAYS.join(
          ', '
        )}.`
      ),
    }),
    promptDoc: `where the patient goes after this
  visit. dispositionType is one of ${DISPOSITION_TYPE_LIST}, the tabs of the chart's Disposition card:
    "pcp-no-type" → follow up with their primary care provider / "see your doctor"
    "specialty"   → referral to a specialist (ortho, cardiology, ENT …), including "<specialist> or PCP"
    "ed"          → directed to the Emergency Department / "go to the ER" / "call 911"
    "another"     → transferred to another location or facility, including admission to a hospital
  A plan to come back to THIS clinic is not a disposition.
  text is the disposition as one clinical sentence. followUpInDays is the interval in DAYS when stated,
  for pcp-no-type and specialty only ("in 48–72 hours" → 3; "in 1 week" → 7; "in 2 weeks" → 14; "as
  needed" → 0). The card offers only ${FOLLOW_UP_DAYS.join(', ')}; any other interval stays in text.
  DISPOSITION IS NEVER OPTIONAL when the provider states one — this is a patient-safety rule. It holds
  when the follow-up is CONDITIONAL ("if not improving in a week" → still followUpInDays 7) and when it
  offers a CHOICE ("dermatology or his PCP" → "specialty"). Writing the follow-up as a patient
  instruction does NOT replace the structured disposition: emit BOTH.
  A plan to come back to THIS clinic ("return here in 3 days if no better") goes in an
  add-patient-instruction instead.`,
  },

  'add-patient-instruction': {
    shape: z.object({
      text: F.sentence('The instruction, written as a directive TO THE PATIENT.'),
    }),
    promptDoc: `patient-FACING guidance, written as a directive TO THE
  PATIENT. REQUIRED, not optional: anything the patient must DO or WATCH FOR after the visit gets its
  own instruction. The MDM summarises the plan in clinician shorthand; that does NOT cover the patient.
  Emit ONE per distinct instruction, for each of these the narrative states:
    • HOW TO TAKE EACH MEDICATION — dose, route, frequency, duration, and any taper/step-down or
      take-with-food caveat. add-medication records WHAT was prescribed; it does not tell the patient
      how to take it.
    • SUPPORTIVE / OTC CARE the provider advised (creams, OTC analgesics, rest, ice/heat, fluids).
    • WOUND / SPLINT / ACTIVITY care and restrictions.
    • RETURN PRECAUTIONS — "come back / go to the ED if …".
    • FOLLOW-UP logistics — "follow up with dermatology or your PCP in 1 week".`,
  },

  'provider-note': {
    shape: z.object({
      text: F.sentence('One or two sentences for the provider; never charted.'),
    }),
    // Order-sensitive: reflowing this text measurably moved commitments from provider-note to guessed
    // add-medication actions.
    promptDoc: `a message for the PROVIDER, rendered in the chat and never written to
  the chart, for something dictated that these actions CANNOT chart. Use it for results of tests
  already performed ("Enter the urinalysis result in the In-House Labs flow: positive nitrites, 2+
  leukocyte esterase"), prescriptions that must be transmitted by eRx, and any other dictated
  instruction requiring the provider to act in the regular chart.
  It is also how a VOICED TREATMENT COMMITMENT is preserved when no drug was named. A commitment
  ("I'll send you…", "let me get you on…", "we'll start…") must NEVER be silently dropped, and you must
  NEVER invent a drug, dose or strength that was not voiced. The ladder:
    • Drug NAMED → add-medication as usual.
    • Only a CLASS or brand FAMILY voiced ("start some Zyrtec, Claritin, something of that nature") →
      add-medication for the best catalogue term for that class, with sourceText quoting the exact
      words.
    • Only the INTENT voiced ("an antibiotic for the cellulitis") → provider-note capturing what was
      promised, for what indication, plus any pharmacy/logistics stated. Do NOT guess a drug.
  Keep each note to one or two sentences, emit at most a few per plan, and never use one to duplicate
  something another action already charts.`,
  },

  reply: {
    shape: z.object({
      text: F.sentence("The answer to the provider's question."),
    }),
    promptDoc: `the ANSWER to a question the provider asked. Writes nothing to the chart.
  Use it when the message is a question about the note or the visit ("what's still missing before I can
  sign?", "what did you code the ear infection as?") rather than an instruction to chart something.
  A turn that is purely a question returns exactly one reply and no other actions.
  This is distinct from provider-note, which means "this cannot be charted, you must do it yourself in
  the regular chart". reply means "here is the answer to what you asked".`,
  },

  unknown: {
    shape: z.object({
      message: F.optionalSentence('What was said that could not be classified.'),
    }),
    promptDoc: `use sparingly; prefer omitting an action you cannot classify. If the
  message contains nothing chartable at all, return an empty actions array rather than guessing.`,
  },
} as const satisfies Record<ActionKind, Capability>;

// ACTION_KINDS and Action['kind'] are the same set, proven in both directions.
type AssertTrue<T extends true> = T;
type Extends<A, B> = [A] extends [B] ? true : false;
export type KindsCoverUnion = AssertTrue<Extends<Action['kind'], ActionKind>>;
export type UnionCoversKinds = AssertTrue<Extends<ActionKind, Action['kind']>>;

/** Typed access to one entry: `as const` drops the optional properties an entry does not set. */
export function capabilityOf(kind: ActionKind): Capability {
  return CAPABILITIES[kind];
}

export function isActionKind(value: unknown): value is ActionKind {
  return typeof value === 'string' && (ACTION_KINDS as readonly string[]).includes(value);
}

/** The fields `kind` declares, in declaration order. */
export function declaredFields(kind: ActionKind): ActionField[] {
  return Object.keys(capabilityOf(kind).shape.shape) as ActionField[];
}

/** Fields without which the action cannot be executed: the shape's non-optional keys. */
export function requiredFields(kind: ActionKind): ActionField[] {
  const shape = capabilityOf(kind).shape.shape;
  return declaredFields(kind).filter((field) => !shape[field].isOptional());
}

/** The declared fields plus the two every action has. Anything else the model attached is stripped. */
export function allowedFields(kind: ActionKind): ActionField[] {
  return ['kind', 'sourceText', ...declaredFields(kind)];
}

/**
 * The runtime gate between a raw model action and a typed one. A blank string or an empty array counts
 * as missing: the model routinely emits `display: ""` and `searchTerms: []`.
 */
export function hasRequiredFields(kind: ActionKind, obj: Partial<RawAction>): boolean {
  return missingRequiredFields(kind, obj).length === 0;
}

export function missingRequiredFields(kind: ActionKind, obj: Partial<RawAction>): ActionField[] {
  return requiredFields(kind).filter((field) => !isPresent((obj as Record<string, unknown>)[field]));
}

function isPresent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Strip optional and transform wrappers, down to the type the wire and the prompt show. */
export function unwrapForWire(schema: z.ZodTypeAny): z.ZodTypeAny {
  let s = schema;
  for (;;) {
    if (s instanceof z.ZodOptional) s = s.unwrap();
    // A transform's wire type is its input, which is how guardedNumber stays a string on the wire.
    else if (s instanceof z.ZodEffects) s = s.innerType();
    else return s;
  }
}

function describeFieldType(schema: z.ZodTypeAny): string {
  if (isGuardedNumber(schema)) return 'number';
  const s = unwrapForWire(schema);
  if (s instanceof z.ZodEnum) return `one of ${(s._def.values as string[]).map((v) => `"${v}"`).join(' | ')}`;
  if (s instanceof z.ZodBoolean) return 'true | false';
  if (s instanceof z.ZodArray) return `[${describeFieldType(s.element)}, …]`;
  return 'string';
}

/** `- add-diagnosis: { kind, display, searchTerms, code, isPrimary }` */
export function shapeLine(kind: ActionKind): string {
  return `- ${kind}: { ${['kind', ...declaredFields(kind)].join(', ')} }`;
}

/** The prompt block for a kind: shape line, one line per field, then the action-level rules. */
export function promptBlockFor(kind: ActionKind): string {
  const capability = capabilityOf(kind);
  const required = new Set(requiredFields(kind));
  const fieldLines = Object.entries(capability.shape.shape).map(([field, schema]) => {
    const tag = required.has(field as ActionField) ? 'required' : 'optional';
    return `    ${field} (${describeFieldType(schema)}, ${tag}) — ${schema.description ?? ''}`.trimEnd();
  });
  return [shapeLine(kind), ...fieldLines, `  — ${capability.promptDoc}`].join('\n');
}
