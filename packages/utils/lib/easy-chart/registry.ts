// The Easy Chart action registry — ONE module from which the LLM response schema, the prompt
// sections, the runtime validation and the client dispatch table are all *derived*.
//
// Why it exists: in the first implementation this vocabulary was spelled out in six unconnected
// places (a kind array, a TS union, three hand-written JSON schemas, three hand-written post-parse
// normalisers, a separate allow-list in the review endpoint, and the client's if-chain). Adding one
// action meant editing ~15 sites and missing one failed SILENTLY. Retrofitting a registry
// immediately exposed five actions that existed in the schemas but were described in no prompt —
// the model could never emit them, and nothing anywhere said so.
//
// The second retrofit (this file's `shape`) removed the last hand-written duplication: each action's
// fields are ONE Zod object, in the style of ENCOUNTER_LAYERS. From it come the required list, the
// allowed list, the wire schema branch, the numeric-coercion list, and the prompt's shape line plus its
// per-field prose (`.describe()`). Before this, the shape line at the head of every promptDoc was typed
// by hand and nothing checked it: add-ros-finding offered `finding` in the schema and never told the
// model.
//
// Rules this file enforces (all pinned by registry.test.ts):
//   - ACTION_KINDS and Action['kind'] are the same set, proven by type assertion.
//   - Every kind has exactly one write target: a `chartField` on the save-chart-data contract, or
//     an entry in NON_CHART_TARGETS naming the endpoint it uses instead.
//   - Every field a kind declares is in ACTION_FIELDS (the wire property order).
//   - Every action a surface offers appears in that surface's prompt.

import { z } from 'zod';
import { AllChartValues } from '../types/api/chart-data/chart-data.types';
import {
  Action,
  ACTION_KINDS,
  ActionField,
  ActionKind,
  NOTE_TEXT_FIELDS,
  PLANNABLE_DISPOSITION_TYPES,
  PLANNABLE_VITAL_FIELDS,
  RawAction,
  Surface,
} from './actions';

/**
 * A property of the chart-write payload. Derived from the DTO, NOT re-typed as strings: renaming a
 * property on `SaveChartDataRequest` must break this file's build.
 */
export type ChartField = keyof AllChartValues;

export interface Capability {
  surfaces: readonly Surface[];
  /**
   * The fields this action carries, as ONE Zod object. Required ≡ not `.optional()`; the prose the
   * model reads about a field is its `.describe()`, so a field cannot exist without being described.
   * The wire schema branch for the kind is serialized from this (schema.ts), and the runtime gate reads
   * its required keys (`hasRequiredFields`).
   */
  shape: z.ZodObject<z.ZodRawShape>;
  /**
   * Which chart-write property this action lands in. Absent for actions that go through a different
   * endpoint (labs, imaging, nursing orders, templates) or write nothing — see NON_CHART_TARGETS.
   */
  chartField?: ChartField | readonly ChartField[];
  /**
   * The ACTION-LEVEL rules the model is shown for this action, assembled into the prompt per surface
   * after the generated shape line and the per-field lines (see `promptBlockFor`).
   */
  promptDoc: string;
  /**
   * Extra prose for the surfaces that AUTHOR a note, i.e. everything except `review`.
   *
   * `promptDoc` is shared by every surface offering the action, and that is right for the action's
   * SHAPE and for the rules about what may be charted. It is wrong for guidance about composing
   * content from scratch, because the review surface never composes: it makes one targeted correction
   * to a note somebody else already wrote.
   *
   * Leaving that guidance in `promptDoc` had review reading instructions it cannot act on, or must not:
   * `edit-note-text` told it to "ALWAYS emit … for historyOfPresentIllness AND medicalDecision on
   * EVERY visit" — so it proposed rewriting both on every call, 19-28 confirmation cards per 40 cases
   * against the dabrams implementation's 0 — and `add-cpt` told it to "emit the add-medication for the
   * drug", which is not in review's vocabulary at all.
   *
   * Same lesson as the E&M level tiebreak, which used to live in `set-em-code`'s `promptDoc` and was
   * worth +4 exact E&M once review stopped being told to round down.
   */
  authoringDoc?: string;
}

// ---------------------------------------------------------------------------------------------
// Field primitives. Every string is capped and every number travels as a string — see the three
// traps documented at the top of schema.ts; the serializer there refuses anything else.
// ---------------------------------------------------------------------------------------------

/**
 * Per-field string caps, deliberately generous — roughly 4x the longest real value seen — so a cap can
 * only ever bite a runaway repetition loop, never a legitimate value (schema.ts, trap 3).
 */
export const CAP = {
  /** Catalogue display / search text: a long one is "Allergic contact dermatitis due to drugs…". */
  display: 300,
  /** A code, a field name, a unit, a dose form — all short tokens. */
  token: 60,
  /** One clinical sentence: a disposition, a provider note, an exam comment. */
  sentence: 800,
  /** A whole rewritten note field. An MDM runs to a few thousand characters. */
  noteField: 8000,
} as const;

/** A required string: blank counts as absent, exactly as `hasRequiredFields` treats it. */
const requiredText = (max: number): z.ZodString => z.string().trim().min(1).max(max);
const optionalText = (max: number): z.ZodOptional<z.ZodString> => z.string().max(max).optional();

const GUARDED_NUMERICS = new WeakSet<z.ZodTypeAny>();

/**
 * The digit-loop guard as a type (schema.ts, trap 1): a capped string on the wire, a finite number
 * after `coerceNumericFields`. Every numeric field in the registry MUST be declared with this.
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

export function isGuardedNumber(schema: z.ZodTypeAny): boolean {
  return GUARDED_NUMERICS.has(schema);
}

const F = {
  display: (doc: string) => requiredText(CAP.display).describe(doc),
  optionalDisplay: (doc: string) => optionalText(CAP.display).describe(doc),
  searchTerms: (doc = 'Synonyms or alternate phrasings for the catalogue search (1–3).') =>
    z.array(z.string().max(CAP.display)).optional().describe(doc),
  code: (doc: string) => requiredText(CAP.token).describe(doc),
  optionalCode: (doc: string) => optionalText(CAP.token).describe(doc),
  token: (doc: string) => optionalText(CAP.token).describe(doc),
  sentence: (doc: string) => requiredText(CAP.sentence).describe(doc),
  optionalSentence: (doc: string) => optionalText(CAP.sentence).describe(doc),
  noteField: (doc: string) => requiredText(CAP.noteField).describe(doc),
  /** ROS polarity. Optional: the server derives it from the display verb when omitted. */
  polarity: () =>
    z.enum(['reports', 'denies']).optional().describe('Polarity; derived from the display verb when omitted.'),
};

const NOTE_FIELD_LIST = NOTE_TEXT_FIELDS.join(' | ');
const VITAL_FIELD_LIST = PLANNABLE_VITAL_FIELDS.join(', ');
const DISPOSITION_TYPE_LIST = PLANNABLE_DISPOSITION_TYPES.map((t) => `"${t}"`).join(', ');

export const CAPABILITIES = {
  'apply-template': {
    surfaces: ['plan', 'template'],
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
    surfaces: ['plan', 'history'],
    shape: z.object({
      display: F.display('The allergen ("Penicillin", "Peanuts").'),
      searchTerms: F.searchTerms(),
    }),
    chartField: 'allergies',
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
  // DISABLED for now: removals belong to the review pass, and review does not offer this one yet. Uncomment
  // and set surfaces: ['review'] to offer it there.
  // 'remove-allergy': {
  //   surfaces: ['plan', 'history'],
  //   shape: z.object({
  //     display: F.display('The charted item, EXACT wording from ALREADY ON THE CHART.'),
  //     searchTerms: F.searchTerms(),
  //   }),
  //   chartField: 'allergies',
  //   promptDoc: `remove an allergy already on the chart.`,
  // },

  'add-condition': {
    surfaces: ['plan', 'history'],
    shape: z.object({
      display: F.display('The background condition ("Asthma", "Personal history of urinary calculus").'),
      searchTerms: F.searchTerms(),
      code: F.optionalCode(
        'Best ICD-10 code. Z-codes for resolved or past history; F17.210 / Z87.891 for smoking status.'
      ),
    }),
    chartField: 'conditions',
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
  // DISABLED for now: removals belong to the review pass, and review does not offer this one yet. Uncomment
  // and set surfaces: ['review'] to offer it there.
  // 'remove-condition': {
  //   surfaces: ['plan', 'history'],
  //   shape: z.object({
  //     display: F.display('The charted item, EXACT wording from ALREADY ON THE CHART.'),
  //     searchTerms: F.searchTerms(),
  //   }),
  //   chartField: 'conditions',
  //   promptDoc: `remove a past-history condition already on the chart.`,
  // },

  'add-medication': {
    surfaces: ['plan', 'history'],
    shape: z.object({
      display: F.display('Drug name with strength and form as stated ("Amoxicillin 400 mg/5 mL suspension").'),
      searchTerms: F.searchTerms('Ingredient or brand name ONLY ("Amoxicillin") — no strength or form.'),
      strength: F.token('Exact dose+concentration as written ("400 mg/5 mL"); omit when none was stated.'),
      doseForm: F.token('Dosage-form word ("Suspension", "Tablet", "Cream", "Drops"); omit when none was stated.'),
    }),
    chartField: 'medications',
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
  'remove-medication': {
    // Removals are the REVIEW pass's tool: the planner writes a note, review corrects one.
    surfaces: ['review'],
    shape: z.object({
      display: F.display('The charted item, EXACT wording from ALREADY ON THE CHART.'),
      searchTerms: F.searchTerms(),
    }),
    chartField: 'medications',
    promptDoc: `remove a medication already on the chart.`,
  },

  'add-surgical-history': {
    surfaces: ['plan', 'history'],
    shape: z.object({
      display: F.display('The past operation ("Appendectomy").'),
      searchTerms: F.searchTerms(),
    }),
    chartField: 'surgicalHistory',
    promptDoc: `a past operation the narrative states.`,
  },
  // DISABLED for now: removals belong to the review pass, and review does not offer this one yet. Uncomment
  // and set surfaces: ['review'] to offer it there.
  // 'remove-surgical-history': {
  //   surfaces: ['plan', 'history'],
  //   shape: z.object({
  //     display: F.display('The charted item, EXACT wording from ALREADY ON THE CHART.'),
  //     searchTerms: F.searchTerms(),
  //   }),
  //   chartField: 'surgicalHistory',
  //   promptDoc: `remove a surgical-history item already on the chart.`,
  // },

  'add-hospitalization': {
    surfaces: ['plan', 'history'],
    shape: z.object({
      display: F.display('The past hospitalization, as stated.'),
      searchTerms: F.searchTerms(),
    }),
    chartField: 'episodeOfCare',
    promptDoc: `a past hospitalization the narrative states.`,
  },
  // DISABLED for now: removals belong to the review pass, and review does not offer this one yet. Uncomment
  // and set surfaces: ['review'] to offer it there.
  // 'remove-hospitalization': {
  //   surfaces: ['plan', 'history'],
  //   shape: z.object({
  //     display: F.display('The charted item, EXACT wording from ALREADY ON THE CHART.'),
  //     searchTerms: F.searchTerms(),
  //   }),
  //   chartField: 'episodeOfCare',
  //   promptDoc: `remove a hospitalization already on the chart.`,
  // },

  'edit-note-text': {
    surfaces: ['plan', 'review', 'story', 'plan-text'],
    shape: z.object({
      field: z.enum(NOTE_TEXT_FIELDS).describe('The note field to write.'),
      newText: F.noteField('The FULL new content of the field, not a fragment.'),
    }),
    chartField: ['chiefComplaint', 'historyOfPresentIllness', 'mechanismOfInjury', 'ros', 'medicalDecision'],
    promptDoc: `field is one of: ${NOTE_FIELD_LIST}.
  newText is the FULL new content for that field. When existing text is shown in the context below and
  the narrative implies an edit in place, return the entire updated paragraph, not just the change.
  Review of Systems is NOT free text here — it is structured; use add-ros-finding, not
  edit-note-text on "ros".`,
    authoringDoc: `  ALWAYS emit edit-note-text for historyOfPresentIllness AND medicalDecision on EVERY visit,
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
    surfaces: ['plan', 'findings'],
    shape: z.object({
      field: z.enum(PLANNABLE_VITAL_FIELDS).describe('Which vital the reading is.'),
      display: F.display(
        'The FULL reading exactly as stated, unit included ("98.9 F", "5\'8\\"", "130lb", "122/78", "98%").'
      ),
    }),
    chartField: 'vitalsObservations',
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
    surfaces: ['plan', 'findings'],
    shape: z.object({
      display: F.display(
        'The abnormal finding with its modifiers ("Right TM erythematous and bulging"), matched against the exam-template leaf labels.'
      ),
      searchTerms: F.searchTerms(),
    }),
    chartField: 'examObservations',
    promptDoc: `matched against the practice's exam-template leaf
  labels. Exam findings are POSITIVE observations only: there is no "negative" exam observation.
  NEGATION GUARD — a finding the narrative explicitly negates ("no wheezing", "lungs clear",
  "non-tender", "without crackles", "no rash") is NOT abnormal. Do NOT emit an add-exam-finding for it,
  and do NOT remove the matching normal either: the narrative AGREES with the normal. Match on
  POLARITY, not on the keyword.
  Do not bundle a pertinent negative into an abnormal finding — the negated clause drags the match onto
  the wrong (normal) leaf. "Oropharynx mildly injected without exudate" → display "Erythematous
  pharynx", searchTerms ["injected oropharynx","pharyngeal erythema"]; drop the "without exudate".
  Keep genuinely abnormal modifiers (erythematous, bulging, loss of light reflex).
  A single anatomic observation with several modifiers is ONE step, not several: "Right TM erythematous
  and bulging with loss of light reflex" is one add-exam-finding retaining all the modifiers. Emit
  separate steps only for distinctly different anatomic sites or systems.
  The exam section starts EMPTY, so emit an add-exam-finding for every
  dictated finding INCLUDING the pertinent normals ("lungs clear bilaterally", "5/5 strength", "normal
  gait") — anything you do not emit is simply absent from the note.
  Never pad the exam with findings nobody addressed.
  MATCH STRUCTURE TO STRUCTURE — a finding about ONE structure does not contradict a normal about a
  DIFFERENT structure in the same system. An abnormal tympanic membrane does NOT contradict "Normal
  canals"; remove that only if the narrative describes the CANAL as abnormal.
  Common genuine contradictions: any described distress → remove "In no acute distress"; wheezing,
  rales, rhonchi, decreased air entry or a prolonged expiratory phase → remove "No signs of respiratory
  distress" and "Good air movement throughout lung fields"; pharyngeal erythema or tonsillar exudate →
  remove "Oropharynx clear with no erythema, lesions, or exudate"; abdominal tenderness, distension or
  guarding → remove "Soft"/"Nontender"/"Nondistended" as applicable.`,
  },
  // 'remove-exam-finding': {
  //   surfaces: ['plan', 'findings'],
  //   shape: z.object({
  //     display: F.display('The charted normal, EXACT wording from the "already checked" list.'),
  //     searchTerms: F.searchTerms(),
  //   }),
  //   chartField: 'examObservations',
  //   promptDoc: `an applied template fills in a FULL normal
  // physical exam. When the narrative states an ABNORMAL finding, the template's matching NORMAL finding
  // is now wrong and must be removed so the note is not self-contradictory. The display must be the
  // charted finding's exact wording, taken from the "already checked" list in the context below.
  // STRICT LIMITS — only remove a normal the narrative DIRECTLY contradicts, and only when the finding is
  // actually PRESENT (see the negation guard on add-exam-finding). Keep every normal the narrative is
  // silent about or consistent with: keep "Regular rate and rhythm with no murmur" even when the patient
  // is tachycardic (tachycardia is a vital, not a murmur). Do not remove a normal merely because its body
  // system was examined or mentioned.
  // MATCH STRUCTURE TO STRUCTURE — a finding about ONE structure does not contradict a normal about a
  // DIFFERENT structure in the same system. An abnormal tympanic membrane does NOT contradict "Normal
  // canals"; remove that only if the narrative describes the CANAL as abnormal.
  // Common genuine contradictions: any described distress → remove "In no acute distress"; wheezing,
  // rales, rhonchi, decreased air entry or a prolonged expiratory phase → remove "No signs of respiratory
  // distress" and "Good air movement throughout lung fields"; pharyngeal erythema or tonsillar exudate →
  // remove "Oropharynx clear with no erythema, lesions, or exudate"; abdominal tenderness, distension or
  // guarding → remove "Soft"/"Nontender"/"Nondistended" as applicable.`,
  // },

  'add-ros-finding': {
    surfaces: ['plan', 'review', 'findings'],
    shape: z.object({
      display: F.display('"Denies <symptom>" or "Reports <symptom>".'),
      searchTerms: F.searchTerms('1–3 synonyms for the symptom, WITHOUT the word Denies/Reports.'),
      finding: F.polarity(),
    }),
    chartField: 'rosObservations',
    // The pertinent-positives line below stays in `promptDoc` — i.e. on EVERY surface, review
    // included — because review's uncharted-finding check IS "a symptom was stated and never reached
    // the chart". It was briefly deleted along with the volume guidance it sat next to, and on the
    // 191-case corpus review's ROS contribution fell from 12 matches to 7.
    promptDoc: `a structured Review-of-Systems finding. The display
  MUST begin with "Denies" or "Reports" followed by the symptom name; searchTerms are 1–3 synonyms for
  the symptom and must NOT include the word Denies/Reports.
  UNLIKE exam findings, ROS records NEGATIVES too — this is the one place a denied symptom is a
  chartable item. "denies fevers, nausea, vomiting" → a separate "Denies …" finding for EACH symptom.
  Also record dictated pertinent POSITIVES in other systems ("she has a mild headache" → "Reports
  headache") — positives outside the chief complaint are easy to lose.
  Never invent a negative nobody addressed, and never deny the chief complaint itself.
  Format example — "denies chest pain and shortness of breath; reports a headache":
    {"kind":"add-ros-finding","display":"Denies chest pain","searchTerms":["chest pain"],"polarity":"denies"}
    {"kind":"add-ros-finding","display":"Denies shortness of breath","searchTerms":["shortness of breath","dyspnea"],"polarity":"denies"}
    {"kind":"add-ros-finding","display":"Reports headache","searchTerms":["headache","cephalgia"],"polarity":"reports"}`,
    // How much ROS to WRITE, which is an authoring decision and must not reach the audit.
    //
    // An earlier version of this guidance lived in `promptDoc`, so review saw it too. Measured on 40
    // cases: every planner-scope metric improved (ROS matched +9, exam +8, E&M exact +4) while every
    // post-review metric fell (diagnoses matched -4 on +10 more predictions, E&M exact -4, primary dx
    // -2) — review read "a symptom left out here is simply absent" as licence to add, which is what an
    // authoring instruction does to an audit prompt. Third time this exact leak has cost a run; see
    // the E&M tiebreak on `set-em-code` and the HPI/MDM rule on `edit-note-text`.
    //
    // What it replaced told the model to "focus the ROS on the pertinent negatives … in systems OTHER
    // than the chief complaint; you need not mechanically re-list every chief-complaint phrase". That
    // inverted the polarity balance against the corpus: providers chart roughly twice as many reported
    // symptoms as denied ones, and the chief complaint's own symptoms are charted, not skipped.
    authoringDoc: `  RECORD BOTH DIRECTIONS, and weight them by what the provider actually said. A symptom the
  patient REPORTS is as chartable as one they deny, and that INCLUDES the symptoms of the presenting
  complaint itself: "she's congested with a runny nose and a cough" → "Reports nasal congestion" AND
  "Reports rhinorrhea" AND "Reports cough". Do not skip a symptom because it also appears in the HPI —
  the ROS is a separate structured section, not a summary of the narrative, and a symptom left out here
  is simply absent from it.`,
  },
  // DISABLED for now: removals belong to the review pass, and review does not offer this one yet. Uncomment
  // and set surfaces: ['review'] to offer it there.
  // 'remove-ros-finding': {
  //   surfaces: ['plan', 'findings'],
  //   shape: z.object({
  //     display: F.display('The charted ROS item with its Denies/Reports verb ("Denies eye pain").'),
  //     searchTerms: F.searchTerms(),
  //     finding: F.polarity(),
  //   }),
  //   chartField: 'rosObservations',
  //   promptDoc: `remove a ROS symptom already on the chart. KEEP
  // the leading "Denies"/"Reports" verb in display ("Denies eye pain") so the right polarity is removed.
  // Use this for ROS symptoms only.`,
  // },

  'add-diagnosis': {
    surfaces: ['plan', 'review', 'diagnoses'],
    shape: z.object({
      display: F.display('Accurate, SPECIFIC diagnosis label; for S-/T-code injuries include site and laterality.'),
      searchTerms: F.searchTerms(),
      code: F.optionalCode(
        'Best billable, fully specified ICD-10 code, ALWAYS supplied ("H66.91", "S39.012A"). Just the code.'
      ),
      isPrimary: z.boolean().optional().describe('true for exactly ONE diagnosis per visit, false for every other.'),
    }),
    chartField: 'diagnosis',
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
  'remove-diagnosis': {
    // Removals are the REVIEW pass's tool: the planner writes a note, review corrects one.
    surfaces: ['review'],
    shape: z.object({
      display: F.display('The charted item, EXACT wording from ALREADY ON THE CHART.'),
      searchTerms: F.searchTerms(),
    }),
    chartField: 'diagnosis',
    promptDoc: `remove a diagnosis already on the chart. When you
  remove a diagnosis because the note does not support it, pair it with an add-diagnosis for the
  diagnosis the note DOES support, restating the removed item's isPrimary status — swapping the primary
  without isPrimary:true leaves the note with no primary diagnosis, which is billing-invalid. Emit a
  bare removal only when the note supports no replacement at all.`,
  },

  // DISABLED for now (orders and CPT are off the assistant): uncomment to re-enable.
  // 'add-in-house-lab': {
  //   surfaces: ['plan', 'orders'],
  //   shape: z.object({
  //     display: F.display('Common name of the point-of-care test ("Rapid Strep A").'),
  //     searchTerms: F.searchTerms(),
  //   }),
  //   promptDoc: `an IN-OFFICE / point-of-care test ORDERED this
  // visit: rapid strep, rapid flu/COVID/RSV, urinalysis or urine dip, mono spot, fingerstick glucose,
  // urine hCG, wet prep. Use the test's common name as display ("Rapid Strep A").
  // Results already obtained are NOT orders: "urinalysis showed positive nitrites" is a result to enter
  // through the labs flow — emit a provider-note quoting the values instead.
  // Do NOT also emit add-cpt for a test you order this way; the lab order carries its own billing.`,
  // },
  // DISABLED for now (orders and CPT are off the assistant): uncomment to re-enable.
  // 'add-external-lab': {
  //   surfaces: ['plan', 'orders'],
  //   shape: z.object({
  //     display: F.display('Name of the send-out test ("CBC", "Lipid panel").'),
  //     searchTerms: F.searchTerms(),
  //   }),
  //   promptDoc: `a SEND-OUT / reference-lab test ORDERED this
  // visit: CBC, CMP/BMP, lipid panel, TSH, A1c, cultures, anything drawn and sent out. Same
  // results-are-not-orders and no-extra-CPT rules as add-in-house-lab.`,
  // },
  // DISABLED for now (orders and CPT are off the assistant): uncomment to re-enable.
  // 'add-radiology': {
  //   surfaces: ['plan', 'orders'],
  //   shape: z.object({
  //     display: F.display('Study name with view count and body site ("3-view right ankle X-ray").'),
  //     searchTerms: F.searchTerms('1–3 alternates matched against the radiology catalogue.'),
  //   }),
  //   promptDoc: `order an imaging study. display is the study name
  // including view count and body site ("3-view right ankle X-ray"); searchTerms are 1–3 alternates the
  // client matches against the radiology catalogue. The client links the primary diagnosis
  // automatically. Do NOT also emit add-cpt for imaging.`,
  // },

  // DISABLED for now (orders and CPT are off the assistant): uncomment to re-enable.
  // 'add-procedure': {
  //   surfaces: ['plan', 'orders'],
  //   shape: z.object({
  //     display: F.display('The procedure, as the quick-pick names it ("Laceration repair").'),
  //     searchTerms: F.searchTerms(),
  //   }),
  //   chartField: 'procedures',
  //   promptDoc: `matched against the practice's procedure quick picks.
  // Suturing, splinting, lavage, I&D, foreign-body removal, and the like.
  // An in-clinic medication administration is NOT a procedure — emit add-medication for it (plus the
  // administration CPT), even when the narrative groups it under "procedures".`,
  // },
  // 'update-procedure': {
  //   surfaces: ['plan', 'orders'],
  //   shape: z.object({
  //     updates: z
  //       .array(
  //         z.object({
  //           field: z.enum(PROCEDURE_UPDATE_FIELDS).describe('The procedure form field to set.'),
  //           value: requiredText(CAP.sentence).describe(
  //             'The value. bodySide: left | right | bilateral | not-applicable; specimenSent / consentObtained: "true" | "false".'
  //           ),
  //         })
  //       )
  //       .min(1)
  //       .describe('One entry per field to set.'),
  //     procedureMatch: F.optionalDisplay(
  //       'Name of the procedure emitted earlier in this plan that these updates apply to.'
  //     ),
  //   }),
  //   chartField: 'procedures',
  //   promptDoc: `set fields on a procedure
  // emitted earlier in this plan, referenced by name via procedureMatch.
  // Field names: ${PROCEDURE_UPDATE_FIELDS.join(', ')}.
  // bodySide values: left | right | bilateral | not-applicable. specimenSent / consentObtained: "true" |
  // "false". Common pitfall: words like "site", "side", "body", "to" are field-name synonyms in the
  // narrative, NOT values — never emit bodySide="side".`,
  // },

  // THE LEVEL TIEBREAK IS NOT HERE. "When torn between two levels choose the LOWER" lives in the plan
  // and coding RULES instead (see prompt.ts), because it is a policy for AUTHORING a code and this
  // string is shared with the REVIEW surface, whose check 4 exists to catch an E&M that came out too
  // low. Handing review a rule to round down and a check that asks it to round up leaves it arguing
  // with itself, and the corpus shows which side wins: 15 of the 16 E&M misses on the cases with a
  // known patient status are under-codes.
  //
  // MEASURED TRADE-OFF on that tiebreak, deliberately left as it stands for the PLANNER: replacing it
  // with "code the level the documentation supports; rounding down is as much an error as overreaching"
  // lifts E&M exact from 7-8 to 13 of the 23 cases whose patient status is knowable, and costs 3 primary
  // diagnoses (11/37 -> 8/38) and 4 gold items overall. Both halves reproduced across paired repeat
  // runs, and raising the thinking budget to 4096 does not recover the diagnoses, so it is a real trade
  // and not a budget artifact. Which side is worth more is a billing-policy call, not an engineering one.
  //
  // And note where that had to be written down: it spent one run INSIDE `promptDoc`, which is assembled
  // verbatim into all three prompts, so the model was reading a note about our eval scores — including a
  // restatement of the rule we had decided not to use — right after being given the rule we had.
  // `promptDoc` is prompt text. A note about the prompt goes above the string, never inside it.
  'set-em-code': {
    surfaces: ['plan', 'review', 'coding'],
    shape: z.object({
      code: F.code('The E&M code ("99213").'),
      display: F.optionalDisplay('The code description (optional).'),
    }),
    chartField: 'emCode',
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
  // DISABLED for now: removals belong to the review pass, and review does not offer this one yet. Uncomment
  // and set surfaces: ['review'] to offer it there.
  // 'remove-em-code': {
  //   surfaces: ['plan', 'coding'],
  //   shape: z.object({
  //     code: F.optionalCode('The charted E&M code being cleared (optional).'),
  //   }),
  //   chartField: 'emCode',
  //   promptDoc: `clear the charted E&M level.`,
  // },

  // DISABLED for now (orders and CPT are off the assistant): uncomment to re-enable.
  // 'add-cpt': {
  //   surfaces: ['plan', 'review', 'coding'],
  //   shape: z.object({
  //     code: F.code('The CPT/HCPCS code ("96372", "J1885").'),
  //     display: F.optionalDisplay('What the code is for (optional).'),
  //   }),
  //   chartField: 'cptCodes',
  //   promptDoc: `an additional CPT/HCPCS code for something actually PERFORMED
  // this visit. Not send-out labs (they bill through the lab order), not imaging orders, not
  // prescriptions, not planned or declined procedures, and not a code already charted.
  // Every CPT/HCPCS code is validated downstream and dropped if it is not real.`,
  //   authoringDoc: `  INJECTION ADMINISTRATION BILLING is the one case where you should supply codes yourself, and only
  // when a medication was GIVEN IN CLINIC by an INJECTED/INFUSED route (IM, SC, IV). It does NOT apply to
  // oral meds, topical creams, otic/ophthalmic drops, inhalers/nebulisers, or anything sent to a
  // pharmacy. When the route IS injection, emit the add-medication for the drug AND an add-cpt for the
  // administration code AND an add-cpt for the drug's HCPCS supply code when it is in the table below.
  // These are deterministic standard codes; supplying them is not "making up a code".
  //   Administration (pick the most specific that fits):
  //     96372 — therapeutic/prophylactic/diagnostic injection, SC or IM (the usual IM/SC default)
  //     96374 — IV push, single drug, initial
  //     96365 — IV infusion, initial up to 1 hour
  //   Common in-clinic drug HCPCS supply codes (emit alongside 96372 when the drug matches):
  //     J1885 ketorolac per 15 mg · J1100 dexamethasone per 1 mg · J0696 ceftriaxone per 250 mg
  //     J2550 promethazine per 25 mg · J2405 ondansetron per 1 mg · J1200 diphenhydramine per 50 mg
  //     J3420 vitamin B-12 per 1000 mcg
  // If the drug is given in clinic but is not in the table, still emit the 96372 administration code and
  // omit the J-code rather than guess it.`,
  // },
  // DISABLED for now (orders and CPT are off the assistant): uncomment to re-enable.
  // 'remove-cpt': {
  //   surfaces: ['plan', 'review', 'coding'],
  //   shape: z.object({
  //     code: F.code('The charted CPT code to remove.'),
  //   }),
  //   chartField: 'cptCodes',
  //   promptDoc: `remove a CPT code already on the chart.`,
  // },

  'set-disposition': {
    surfaces: ['plan', 'review', 'plan-text'],
    shape: z.object({
      dispositionType: z
        .enum(PLANNABLE_DISPOSITION_TYPES)
        .describe('Where the patient goes: pcp | specialty | ed | another | ip (see below).'),
      text: F.sentence('The disposition as one clinical sentence.'),
      followUpInDays: guardedNumber('Follow-up interval in DAYS when stated ("in 48–72 hours" → 3; "in 1 week" → 7).'),
    }),
    chartField: 'disposition',
    promptDoc: `where the patient goes after this
  visit. dispositionType is one of ${DISPOSITION_TYPE_LIST}:
    "pcp"       → follow up with their primary care provider / "see your doctor"
    "specialty" → referral to a specialist (ortho, cardiology, ENT …), including "<specialist> or PCP"
    "ed"        → directed to the Emergency Department / "go to the ER" / "call 911"
    "another"   → follow up with this clinic / return here / another provider not above
    "ip"        → admitted to hospital / inpatient
  text is the disposition as one clinical sentence. followUpInDays is the interval in DAYS when stated
  ("in 48–72 hours" → 3; "in 1 week" → 7; "in 2 weeks" → 14).
  DISPOSITION IS NEVER OPTIONAL when the provider states one — this is a patient-safety rule. It holds
  when the follow-up is CONDITIONAL ("if not improving in a week" → still followUpInDays 7) and when it
  offers a CHOICE ("dermatology or his PCP" → "specialty"). Writing the follow-up as a patient
  instruction does NOT replace the structured disposition: emit BOTH.`,
  },

  'add-patient-instruction': {
    surfaces: ['plan', 'plan-text'],
    shape: z.object({
      text: F.sentence('The instruction, written as a directive TO THE PATIENT.'),
    }),
    chartField: 'instructions',
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

  // DISABLED for now (orders and CPT are off the assistant): uncomment to re-enable.
  // 'add-nursing-order': {
  //   surfaces: ['plan', 'orders'],
  //   shape: z.object({
  //     text: F.sentence('The task, as a directive to nursing staff.'),
  //   }),
  //   promptDoc: `a task for nursing staff, phrased as a directive ("Apply a
  // posterior short-leg splint to the right ankle."). Triggered by "nursing order for wound care", "have
  // nursing do a straight cath".`,
  // },

  'provider-note': {
    surfaces: ['plan', 'review', 'story'],
    shape: z.object({
      text: F.sentence('One or two sentences for the provider; never charted.'),
    }),
    promptDoc: `a message for the PROVIDER, rendered in the chat and never written to
  the chart, for something dictated that these actions CANNOT chart. Use it for results of tests
  already performed ("Enter the urinalysis result in the In-House Labs flow: positive nitrites, 2+
  leukocyte esterase"), prescriptions that must be transmitted by eRx, and any other dictated
  instruction requiring the provider to act in the regular chart.`,
    // VERBATIM, IN THE ORIGINAL ORDER, and it has to stay that way. Splitting the commitment ladder out
    // of this doc and reflowing it around "Keep each note to one or two sentences" — same sentences, new
    // order — moved 8 commitments per 40 cases off `provider-note` and onto `add-medication`: medications
    // charted 17 → 25 while matched fell 4 → 3 (precision 0.235 → 0.120), provider notes 22 → 12, and
    // voiced-commitment coverage 10/12 → 8/12. The model started guessing a drug where it had previously
    // written a note. The ladder only makes sense read as one block with the paragraph that frames it.
    authoringDoc: `  It is also how a VOICED TREATMENT COMMITMENT is preserved when no drug was named. A commitment
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
    surfaces: ['plan', 'story'],
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
    surfaces: ['plan', 'story'],
    shape: z.object({
      message: F.optionalSentence('What was said that could not be classified.'),
    }),
    promptDoc: `use sparingly; prefer omitting an action you cannot classify. If the
  message contains nothing chartable at all, return an empty actions array rather than guessing.`,
  },
} as const satisfies Partial<Record<ActionKind, Capability>>;

/**
 * The kinds THIS BUILD offers: every ACTION_KIND with a live CAPABILITIES entry. A kind whose entry is
 * commented out is DISABLED — no schema branch, no prompt block, and `isActionKind` refuses it at the
 * guard — while ACTION_KINDS, the Action union, the executor's handlers and the eval simulator keep
 * knowing it, so re-enabling is uncommenting one entry. The disabled set is pinned by registry.test.ts
 * so that disabling stays a conscious act.
 */
export const ENABLED_KINDS: readonly ActionKind[] = ACTION_KINDS.filter((kind) => kind in CAPABILITIES);
export const DISABLED_KINDS: readonly ActionKind[] = ACTION_KINDS.filter((kind) => !(kind in CAPABILITIES));

function capabilityIfEnabled(kind: ActionKind): Capability | undefined {
  return (CAPABILITIES as Partial<Record<ActionKind, Capability>>)[kind];
}

/**
 * For every action with no `chartField`: which endpoint it uses instead, or that it writes nothing.
 * Every kind must have one or the other — enforced by registry.test.ts.
 */
export const NON_CHART_TARGETS: Partial<Record<ActionKind, string>> = {
  'apply-template':
    'none — a suggestion; the server resolves the title to a template id and the provider applies it by hand',
  'add-in-house-lab': 'in-house lab order endpoint',
  'add-external-lab': 'external lab order endpoint',
  'add-radiology': 'radiology create-order zambda',
  'add-nursing-order': 'create-nursing-order zambda',
  'provider-note': 'none — chat only, writes nothing',
  reply: 'none — chat only, writes nothing',
  unknown: 'none — reported to the provider, writes nothing',
};

// ---------------------------------------------------------------------------------------------
// ACTION_KINDS ≡ Action['kind'], proven both directions. Exported so they are not flagged unused.
// ---------------------------------------------------------------------------------------------

type AssertTrue<T extends true> = T;
type Extends<A, B> = [A] extends [B] ? true : false;
export type KindsCoverUnion = AssertTrue<Extends<Action['kind'], ActionKind>>;
export type UnionCoversKinds = AssertTrue<Extends<ActionKind, Action['kind']>>;

// ---------------------------------------------------------------------------------------------

/**
 * CAPABILITIES is `as const satisfies` so the exhaustiveness check and the literal surface tuples
 * survive — but that also means an entry without a `chartField` has no such property at all, which
 * every consumer that reads it generically trips over. Read through this accessor instead.
 */
export function capabilityOf(kind: ActionKind): Capability {
  const capability = capabilityIfEnabled(kind);
  if (!capability) throw new Error(`"${kind}" is disabled in this build — its CAPABILITIES entry is commented out`);
  return capability;
}

/** Where this action's data lands: a chart-write property, or the endpoint named in NON_CHART_TARGETS. */
export function writeTargetOf(kind: ActionKind): { chartFields: ChartField[] } | { endpoint: string } {
  const chartField = capabilityOf(kind).chartField;
  if (chartField != null) {
    return { chartFields: Array.isArray(chartField) ? [...chartField] : [chartField as ChartField] };
  }
  return { endpoint: NON_CHART_TARGETS[kind] ?? 'unknown' };
}

/** True for a kind this build OFFERS. A disabled kind is "not an action this build knows" at the guard. */
export function isActionKind(value: unknown): value is ActionKind {
  return typeof value === 'string' && (ENABLED_KINDS as readonly string[]).includes(value);
}

export function capabilitiesForSurface(surface: Surface): ActionKind[] {
  return ENABLED_KINDS.filter((kind) => (capabilityOf(kind).surfaces as readonly Surface[]).includes(surface));
}

// ---------------------------------------------------------------------------------------------
// Everything below is DERIVED from `shape`. Nothing here is a second copy of the field list.
// ---------------------------------------------------------------------------------------------

/** A disabled kind has no shape: it declares nothing, requires nothing, and allows only kind + sourceText. */
function shapeOf(kind: ActionKind): z.ZodRawShape {
  return capabilityIfEnabled(kind)?.shape.shape ?? {};
}

/** The fields `kind` declares, in declaration order. */
export function declaredFields(kind: ActionKind): ActionField[] {
  return Object.keys(shapeOf(kind)) as ActionField[];
}

/** Fields without which the action cannot be executed: the shape's non-optional keys. */
export function requiredFields(kind: ActionKind): ActionField[] {
  const shape = shapeOf(kind);
  return declaredFields(kind).filter((field) => !shape[field].isOptional());
}

/**
 * The fields `kind` is allowed to carry — its declared ones and the two every action has. Anything
 * else the model attached is a LEAK from another action's shape, and leaks are not harmless: `strength`
 * has arrived on a diagnosis (as `"true"`, apparently to fake primacy), and an `updates: [{field:'code',
 * …}]` array — `update-procedure`'s shape — has arrived on an add-diagnosis carrying the code the model
 * actually meant. Both silently change what gets charted.
 */
export function allowedFields(kind: ActionKind): ActionField[] {
  return ['kind', 'sourceText', ...declaredFields(kind)];
}

/**
 * Every field whose real contract is numeric but which travels as a string (schema.ts, trap 1).
 * Derived from the `guardedNumber` declarations; restored right after parse by coerceNumericFields.
 */
export const NUMERIC_FIELDS: readonly ActionField[] = [
  ...new Set(
    ENABLED_KINDS.flatMap((kind) => declaredFields(kind).filter((field) => isGuardedNumber(shapeOf(kind)[field])))
  ),
];

/**
 * THE single runtime gate between a raw model action and a typed one. A string counts only when
 * non-blank, an array only when non-empty — the model routinely emits `display: ""` and `searchTerms:
 * []`, and treating those as present is how an unexecutable action reaches the provider as a silent
 * no-op.
 */
export function hasRequiredFields(kind: ActionKind, obj: Partial<RawAction>): boolean {
  return missingRequiredFields(kind, obj).length === 0;
}

/** The required fields of `kind` that are absent or blank, for an honest "skipped because…" reason. */
export function missingRequiredFields(kind: ActionKind, obj: Partial<RawAction>): ActionField[] {
  return requiredFields(kind).filter((field) => !isPresent((obj as Record<string, unknown>)[field]));
}

function isPresent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

// ---------------------------------------------------------------------------------------------
// Prompt: the shape line and the per-field prose, generated from the same object the schema is.
// ---------------------------------------------------------------------------------------------

/** Strip optional/nullable/default and transform wrappers, to the type the wire and the prose show. */
export function unwrapForWire(schema: z.ZodTypeAny): z.ZodTypeAny {
  let s = schema;
  for (;;) {
    if (s instanceof z.ZodOptional || s instanceof z.ZodNullable) s = s.unwrap();
    else if (s instanceof z.ZodDefault) s = s._def.innerType;
    // A transform's WIRE type is its input — that is how guardedNumber stays a string on the wire.
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
  if (s instanceof z.ZodObject) return `{${Object.keys(s.shape).join(', ')}}`;
  return 'string';
}

/** `- add-diagnosis: { kind, display, searchTerms, code, isPrimary }` — generated, so it cannot omit a field. */
export function shapeLine(kind: ActionKind): string {
  return `- ${kind}: { ${['kind', ...declaredFields(kind)].join(', ')} }`;
}

/**
 * The whole block the prompt assembles for a kind: the shape line, one line per field (type,
 * required/optional, its `.describe()`), then the action-level rules — plus `authoringDoc` on the
 * surfaces that compose a note.
 */
export function promptBlockFor(kind: ActionKind, authoring: boolean): string {
  const capability = capabilityOf(kind);
  const required = new Set(requiredFields(kind));
  const fieldLines = Object.entries(shapeOf(kind)).map(([field, schema]) => {
    const tag = required.has(field as ActionField) ? 'required' : 'optional';
    return `    ${field} (${describeFieldType(schema)}, ${tag}) — ${schema.description ?? ''}`.trimEnd();
  });
  const extra = authoring ? capability.authoringDoc : undefined;
  return [shapeLine(kind), ...fieldLines, `  — ${capability.promptDoc}`, ...(extra ? [extra] : [])].join('\n');
}
