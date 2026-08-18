// The Easy Chart action registry — ONE module from which the LLM response schemas, the prompt
// sections, the runtime validation and the client dispatch table are all *derived*.
//
// Why it exists: in the first implementation this vocabulary was spelled out in six unconnected
// places (a kind array, a TS union, three hand-written JSON schemas, three hand-written post-parse
// normalisers, a separate allow-list in the review endpoint, and the client's if-chain). Adding one
// action meant editing ~15 sites and missing one failed SILENTLY. Retrofitting a registry
// immediately exposed five actions that existed in the schemas but were described in no prompt —
// the model could never emit them, and nothing anywhere said so.
//
// Rules this file enforces (all pinned by registry.test.ts):
//   - ACTION_KINDS and Action['kind'] are the same set, proven by type assertion.
//   - Every kind has exactly one write target: a `chartField` on the save-chart-data contract, or
//     an entry in NON_CHART_TARGETS naming the endpoint it uses instead.
//   - Every `required` field is one the surface's schema actually declares — otherwise the model
//     can never satisfy it and 100% of those actions are rejected at runtime.
//   - Every action a surface offers appears in that surface's prompt.

import { AllChartValues } from '../types/api/chart-data/chart-data.types';
import {
  Action,
  ACTION_KINDS,
  ActionField,
  ActionKind,
  NOTE_TEXT_FIELDS,
  PLANNABLE_DISPOSITION_TYPES,
  PLANNABLE_VITAL_FIELDS,
  PROCEDURE_UPDATE_FIELDS,
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
   * Fields without which the action cannot be executed. Checked at runtime on every surface by
   * `hasRequiredFields`.
   */
  required: readonly ActionField[];
  /**
   * Which chart-write property this action lands in. Absent for actions that go through a different
   * endpoint (labs, imaging, nursing orders, templates) or write nothing — see NON_CHART_TARGETS.
   */
  chartField?: ChartField | readonly ChartField[];
  /** The prose the model is shown for this action. Assembled into the prompt per surface. */
  promptDoc: string;
}

const NOTE_FIELD_LIST = NOTE_TEXT_FIELDS.join(' | ');
const VITAL_FIELD_LIST = PLANNABLE_VITAL_FIELDS.join(', ');
const DISPOSITION_TYPE_LIST = PLANNABLE_DISPOSITION_TYPES.map((t) => `"${t}"`).join(', ');

export const CAPABILITIES = {
  'apply-template': {
    surfaces: ['plan'],
    required: ['display'],
    promptDoc: `- apply-template: { kind, display, searchTerms } — match against the practice's saved templates by
  their EXACT listed titles; never invent a template name.
  APPLY A TEMPLATE ONLY ON A STRONG, SPECIFIC MATCH — one that clearly corresponds to THIS visit's
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
  but more GENERIC than the specific diagnosis (a "Headache" template for a migraine) MAY be applied
  for structure — and when you do, ALSO emit add-diagnosis for the specific diagnosis so the precise
  primary code lands on the chart.`,
  },

  'add-allergy': {
    surfaces: ['plan'],
    required: ['display'],
    chartField: 'allergies',
    promptDoc: `- add-allergy: { kind, display, searchTerms } — an allergy the provider states the patient HAS, or
  directs to be added to the allergy list. REQUIRED whenever one is stated, and SEPARATE from any
  "allergic reaction" diagnosis: a new drug reaction this visit produces BOTH an add-diagnosis for the
  reaction AND an add-allergy for the culprit drug. Never bury a stated allergy in the MDM/HPI only.
  BE SPECIFIC — the allergy database is matched by name and a vague root word resolves to the WRONG
  entry. "sulfa"/"sulfonamide" alone collides with sulfonamide DIURETICS and with the salt word
  "sulfate", so a sulfa ANTIBIOTIC reaction is display "Sulfonamide Antibiotics", searchTerms
  ["sulfonamide antibiotic","sulfamethoxazole","sulfa antibiotic"] — NOT display "Sulfa".
  Prefer the specific agent or class for other drug allergies ("penicillin" → Penicillins).`,
  },
  'remove-allergy': {
    surfaces: ['plan'],
    required: ['display'],
    chartField: 'allergies',
    promptDoc: `- remove-allergy: { kind, display, searchTerms } — remove an allergy already on the chart.`,
  },

  'add-condition': {
    surfaces: ['plan'],
    required: ['display'],
    chartField: 'conditions',
    promptDoc: `- add-condition: { kind, display, searchTerms, code } — the patient's BACKGROUND history, distinct
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
  'remove-condition': {
    surfaces: ['plan'],
    required: ['display'],
    chartField: 'conditions',
    promptDoc: `- remove-condition: { kind, display, searchTerms } — remove a past-history condition already on the chart.`,
  },

  'add-medication': {
    surfaces: ['plan'],
    required: ['display'],
    chartField: 'medications',
    promptDoc: `- add-medication: { kind, display, searchTerms, strength, doseForm } — a medication the patient
  already takes at home ("using her albuterol at home", "takes lisinopril daily") OR one you start,
  give, or prescribe today. Both belong on the chart; do not drop the home meds just because a
  treatment med is also present.
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
  not a procedure — but it still has billing consequences; see add-cpt.`,
  },
  'remove-medication': {
    surfaces: ['plan', 'review'],
    required: ['display'],
    chartField: 'medications',
    promptDoc: `- remove-medication: { kind, display, searchTerms } — remove a medication already on the chart.`,
  },

  'add-surgical-history': {
    surfaces: ['plan'],
    required: ['display'],
    chartField: 'surgicalHistory',
    promptDoc: `- add-surgical-history: { kind, display, searchTerms } — a past operation the narrative states.`,
  },
  'remove-surgical-history': {
    surfaces: ['plan'],
    required: ['display'],
    chartField: 'surgicalHistory',
    promptDoc: `- remove-surgical-history: { kind, display, searchTerms } — remove a surgical-history item already on the chart.`,
  },

  'add-hospitalization': {
    surfaces: ['plan'],
    required: ['display'],
    chartField: 'episodeOfCare',
    promptDoc: `- add-hospitalization: { kind, display, searchTerms } — a past hospitalization the narrative states.`,
  },
  'remove-hospitalization': {
    surfaces: ['plan'],
    required: ['display'],
    chartField: 'episodeOfCare',
    promptDoc: `- remove-hospitalization: { kind, display, searchTerms } — remove a hospitalization already on the chart.`,
  },

  'edit-note-text': {
    surfaces: ['plan', 'review'],
    required: ['field', 'newText'],
    chartField: ['chiefComplaint', 'historyOfPresentIllness', 'mechanismOfInjury', 'ros', 'medicalDecision'],
    promptDoc: `- edit-note-text: { kind, field, newText } — field is one of: ${NOTE_FIELD_LIST}.
  newText is the FULL new content for that field. When existing text is shown in the context below and
  the narrative implies an edit in place, return the entire updated paragraph, not just the change.
  ALWAYS emit edit-note-text for historyOfPresentIllness AND medicalDecision on EVERY visit, even when
  a template was applied — both are required for a complete, signable note, they are patient-specific,
  and a template's defaults are generic boilerplate the patient-specific text must supersede.
  chiefComplaint is CONDITIONAL: most providers leave it blank because the HPI's opening one-liner
  already states the reason for the visit. Emit it ONLY when it adds information that first line does
  not already carry, and then as a 2–6 word label ("Low back pain", "Cough x3 days"), never a
  sentence, and never merged into the HPI. mechanismOfInjury: injury visits only.
  Review of Systems is NOT free text here — it is structured; use add-ros-finding, not
  edit-note-text on "ros".

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
    surfaces: ['plan'],
    required: ['field', 'display'],
    chartField: 'vitalsObservations',
    promptDoc: `- set-vital: { kind, field, display } — field is one of: ${VITAL_FIELD_LIST}.
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
    surfaces: ['plan'],
    required: ['display'],
    chartField: 'examObservations',
    promptDoc: `- add-exam-finding: { kind, display, searchTerms } — matched against the practice's exam-template leaf
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
  WHEN NO TEMPLATE WAS APPLIED the exam section starts EMPTY, so emit an add-exam-finding for every
  dictated finding INCLUDING the pertinent normals ("lungs clear bilaterally", "5/5 strength", "normal
  gait") — anything you do not emit is simply absent from the note. WHEN A TEMPLATE WAS APPLIED it
  already checked that section's default normals: emit only the ABNORMAL findings, plus any normal the
  narrative specifically calls out that the template does not cover.
  Never pad the exam with findings nobody addressed.`,
  },
  'remove-exam-finding': {
    surfaces: ['plan'],
    required: ['display'],
    chartField: 'examObservations',
    promptDoc: `- remove-exam-finding: { kind, display, searchTerms } — an applied template fills in a FULL normal
  physical exam. When the narrative states an ABNORMAL finding, the template's matching NORMAL finding
  is now wrong and must be removed so the note is not self-contradictory. The display must be the
  charted finding's exact wording, taken from the "already checked" list in the context below.
  STRICT LIMITS — only remove a normal the narrative DIRECTLY contradicts, and only when the finding is
  actually PRESENT (see the negation guard on add-exam-finding). Keep every normal the narrative is
  silent about or consistent with: keep "Regular rate and rhythm with no murmur" even when the patient
  is tachycardic (tachycardia is a vital, not a murmur). Do not remove a normal merely because its body
  system was examined or mentioned.
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
    surfaces: ['plan', 'review'],
    required: ['display'],
    chartField: 'rosObservations',
    promptDoc: `- add-ros-finding: { kind, display, searchTerms } — a structured Review-of-Systems finding. The display
  MUST begin with "Denies" or "Reports" followed by the symptom name; searchTerms are 1–3 synonyms for
  the symptom and must NOT include the word Denies/Reports.
  UNLIKE exam findings, ROS records NEGATIVES too — this is the one place a denied symptom is a
  chartable item. "denies fevers, nausea, vomiting" → a separate "Denies …" finding for EACH symptom.
  Also record dictated pertinent POSITIVES in other systems ("she has a mild headache" → "Reports
  headache") — positives outside the chief complaint are easy to lose.
  Focus the ROS on the pertinent negatives the provider stated and on associated symptoms in systems
  OTHER than the chief complaint; you need not mechanically re-list every chief-complaint phrase from
  the HPI. Never invent a negative nobody addressed, and never deny the chief complaint itself.
  Format example — "denies chest pain and shortness of breath; reports a headache":
    {"kind":"add-ros-finding","display":"Denies chest pain","searchTerms":["chest pain"]}
    {"kind":"add-ros-finding","display":"Denies shortness of breath","searchTerms":["shortness of breath","dyspnea"]}
    {"kind":"add-ros-finding","display":"Reports headache","searchTerms":["headache","cephalgia"]}`,
  },
  'remove-ros-finding': {
    surfaces: ['plan'],
    required: ['display'],
    chartField: 'rosObservations',
    promptDoc: `- remove-ros-finding: { kind, display, searchTerms } — remove a ROS symptom already on the chart. KEEP
  the leading "Denies"/"Reports" verb in display ("Denies eye pain") so the right polarity is removed.
  Use this for ROS symptoms only; remove-exam-finding is for physical-exam findings.`,
  },

  'add-diagnosis': {
    surfaces: ['plan', 'review'],
    required: ['display'],
    chartField: 'diagnosis',
    promptDoc: `- add-diagnosis: { kind, display, searchTerms, code, isPrimary } — mark isPrimary=true for exactly ONE
  primary; every other diagnosis is isPrimary=false. Emit a SEPARATE add-diagnosis for EVERY distinct
  diagnosis made this visit — many encounters have two or three ("otitis media AND otitis externa") —
  and do not collapse a multi-problem visit into one.
  When a template was applied whose title matches the PRIMARY diagnosis, OMIT the add-diagnosis for
  that one (the template already added it) but STILL emit every OTHER diagnosis: a template carries
  only its own diagnosis, never the secondaries.
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
    surfaces: ['plan', 'review'],
    required: ['display'],
    chartField: 'diagnosis',
    promptDoc: `- remove-diagnosis: { kind, display, searchTerms } — remove a diagnosis already on the chart. When you
  remove a diagnosis because the note does not support it, pair it with an add-diagnosis for the
  diagnosis the note DOES support, restating the removed item's isPrimary status — swapping the primary
  without isPrimary:true leaves the note with no primary diagnosis, which is billing-invalid. Emit a
  bare removal only when the note supports no replacement at all.`,
  },

  'add-in-house-lab': {
    surfaces: ['plan'],
    required: ['display'],
    promptDoc: `- add-in-house-lab: { kind, display, searchTerms } — an IN-OFFICE / point-of-care test ORDERED this
  visit: rapid strep, rapid flu/COVID/RSV, urinalysis or urine dip, mono spot, fingerstick glucose,
  urine hCG, wet prep. Use the test's common name as display ("Rapid Strep A").
  Results already obtained are NOT orders: "urinalysis showed positive nitrites" is a result to enter
  through the labs flow — emit a provider-note quoting the values instead.
  Do NOT also emit add-cpt for a test you order this way; the lab order carries its own billing.`,
  },
  'add-external-lab': {
    surfaces: ['plan'],
    required: ['display'],
    promptDoc: `- add-external-lab: { kind, display, searchTerms } — a SEND-OUT / reference-lab test ORDERED this
  visit: CBC, CMP/BMP, lipid panel, TSH, A1c, cultures, anything drawn and sent out. Same
  results-are-not-orders and no-extra-CPT rules as add-in-house-lab.`,
  },
  'add-radiology': {
    surfaces: ['plan'],
    required: ['display'],
    promptDoc: `- add-radiology: { kind, display, searchTerms } — order an imaging study. display is the study name
  including view count and body site ("3-view right ankle X-ray"); searchTerms are 1–3 alternates the
  client matches against the radiology catalogue. The client links the primary diagnosis
  automatically. Do NOT also emit add-cpt for imaging.`,
  },

  'add-procedure': {
    surfaces: ['plan'],
    required: ['display'],
    chartField: 'procedures',
    promptDoc: `- add-procedure: { kind, display, searchTerms } — matched against the practice's procedure quick picks.
  Suturing, splinting, lavage, I&D, foreign-body removal, and the like.
  An in-clinic medication administration is NOT a procedure — emit add-medication for it (plus the
  administration CPT), even when the narrative groups it under "procedures".`,
  },
  'update-procedure': {
    surfaces: ['plan'],
    required: ['updates'],
    chartField: 'procedures',
    promptDoc: `- update-procedure: { kind, updates: [{field, value}, …], procedureMatch } — set fields on a procedure
  emitted earlier in this plan, referenced by name via procedureMatch.
  Field names: ${PROCEDURE_UPDATE_FIELDS.join(', ')}.
  bodySide values: left | right | bilateral | not-applicable. specimenSent / consentObtained: "true" |
  "false". Common pitfall: words like "site", "side", "body", "to" are field-name synonyms in the
  narrative, NOT values — never emit bodySide="side".`,
  },

  'set-em-code': {
    surfaces: ['plan', 'review'],
    required: ['code'],
    chartField: 'emCode',
    promptDoc: `- set-em-code: { kind, code, display } — ALWAYS emit exactly one. Templates never carry an E&M code,
  so you must always supply it.
  Pick the code FAMILY from the PATIENT STATUS line in the per-visit context below, never from the
  narrative: NEW patient (no professional services in the past 3 years) → 99202-99205; ESTABLISHED
  patient → 99212-99215. When no patient-status line is present the status is UNKNOWN — do not guess;
  default to the established family.
  The MDM-complexity logic is IDENTICAL in both families (the last digit is the level): level 3
  (99203/99213) for a straightforward, low-complexity visit — a single self-limited problem with simple
  management; level 4 (99204/99214) for moderate complexity, which prescription drug management, an
  acute illness needing a procedure, an injury needing imaging, or multiple problems commonly support.
  Reserve level 5 (99205/99215) for high complexity or high risk. When torn between two levels choose
  the LOWER — the goal is that a defensible level is always present and the provider can adjust.`,
  },
  'remove-em-code': {
    surfaces: ['plan'],
    required: [],
    chartField: 'emCode',
    promptDoc: `- remove-em-code: { kind } or { kind, code } — clear the charted E&M level.`,
  },

  'add-cpt': {
    surfaces: ['plan', 'review'],
    required: ['code'],
    chartField: 'cptCodes',
    promptDoc: `- add-cpt: { kind, code, display } — an additional CPT/HCPCS code for something actually PERFORMED
  this visit. Not send-out labs (they bill through the lab order), not imaging orders, not
  prescriptions, not planned or declined procedures, and not a code already charted.
  INJECTION ADMINISTRATION BILLING is the one case where you should supply codes yourself, and only
  when a medication was GIVEN IN CLINIC by an INJECTED/INFUSED route (IM, SC, IV). It does NOT apply to
  oral meds, topical creams, otic/ophthalmic drops, inhalers/nebulisers, or anything sent to a
  pharmacy. When the route IS injection, emit the add-medication for the drug AND an add-cpt for the
  administration code AND an add-cpt for the drug's HCPCS supply code when it is in the table below.
  These are deterministic standard codes; supplying them is not "making up a code".
    Administration (pick the most specific that fits):
      96372 — therapeutic/prophylactic/diagnostic injection, SC or IM (the usual IM/SC default)
      96374 — IV push, single drug, initial
      96365 — IV infusion, initial up to 1 hour
    Common in-clinic drug HCPCS supply codes (emit alongside 96372 when the drug matches):
      J1885 ketorolac per 15 mg · J1100 dexamethasone per 1 mg · J0696 ceftriaxone per 250 mg
      J2550 promethazine per 25 mg · J2405 ondansetron per 1 mg · J1200 diphenhydramine per 50 mg
      J3420 vitamin B-12 per 1000 mcg
  If the drug is given in clinic but is not in the table, still emit the 96372 administration code and
  omit the J-code rather than guess it.
  Every CPT/HCPCS code is validated downstream and dropped if it is not real.`,
  },
  'remove-cpt': {
    surfaces: ['plan', 'review'],
    required: ['code'],
    chartField: 'cptCodes',
    promptDoc: `- remove-cpt: { kind, code } — remove a CPT code already on the chart.`,
  },

  'set-disposition': {
    surfaces: ['plan', 'review'],
    required: ['dispositionType', 'text'],
    chartField: 'disposition',
    promptDoc: `- set-disposition: { kind, dispositionType, text, followUpInDays } — where the patient goes after this
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
    surfaces: ['plan'],
    required: ['text'],
    chartField: 'instructions',
    promptDoc: `- add-patient-instruction: { kind, text } — patient-FACING guidance, written as a directive TO THE
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

  'add-nursing-order': {
    surfaces: ['plan'],
    required: ['text'],
    promptDoc: `- add-nursing-order: { kind, text } — a task for nursing staff, phrased as a directive ("Apply a
  posterior short-leg splint to the right ankle."). Triggered by "nursing order for wound care", "have
  nursing do a straight cath".`,
  },

  'provider-note': {
    surfaces: ['plan', 'review'],
    required: ['text'],
    promptDoc: `- provider-note: { kind, text } — a message for the PROVIDER, rendered in the chat and never written to
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
    surfaces: ['plan'],
    required: ['text'],
    promptDoc: `- reply: { kind, text } — the ANSWER to a question the provider asked. Writes nothing to the chart.
  Use it when the message is a question about the note or the visit ("what's still missing before I can
  sign?", "what did you code the ear infection as?") rather than an instruction to chart something.
  A turn that is purely a question returns exactly one reply and no other actions.
  This is distinct from provider-note, which means "this cannot be charted, you must do it yourself in
  the regular chart". reply means "here is the answer to what you asked".`,
  },

  unknown: {
    surfaces: ['plan'],
    required: [],
    promptDoc: `- unknown: { kind, message } — use sparingly; prefer omitting an action you cannot classify. If the
  message contains nothing chartable at all, return an empty actions array rather than guessing.`,
  },
} as const satisfies Record<ActionKind, Capability>;

/**
 * For every action with no `chartField`: which endpoint it uses instead, or that it writes nothing.
 * Every kind must have one or the other — enforced by registry.test.ts.
 */
export const NON_CHART_TARGETS: Partial<Record<ActionKind, string>> = {
  'apply-template': 'apply-template zambda',
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
  return CAPABILITIES[kind];
}

/** Where this action's data lands: a chart-write property, or the endpoint named in NON_CHART_TARGETS. */
export function writeTargetOf(kind: ActionKind): { chartFields: ChartField[] } | { endpoint: string } {
  const chartField = capabilityOf(kind).chartField;
  if (chartField != null) {
    return { chartFields: Array.isArray(chartField) ? [...chartField] : [chartField as ChartField] };
  }
  return { endpoint: NON_CHART_TARGETS[kind] ?? 'unknown' };
}

export function isActionKind(value: unknown): value is ActionKind {
  return typeof value === 'string' && (ACTION_KINDS as readonly string[]).includes(value);
}

export function capabilitiesForSurface(surface: Surface): ActionKind[] {
  return ACTION_KINDS.filter((kind) => (CAPABILITIES[kind].surfaces as readonly Surface[]).includes(surface));
}

/**
 * Every field any capability on this surface needs, plus the fields every action carries. The
 * response schema is generated from exactly this list, so a `required` field the schema does not
 * declare is impossible by construction (and pinned by a test besides).
 */
export function fieldsForSurface(surface: Surface): ActionField[] {
  const needed = new Set<ActionField>(['kind', 'sourceText']);
  for (const kind of capabilitiesForSurface(surface)) {
    for (const field of CAPABILITIES[kind].required) needed.add(field);
    for (const field of OPTIONAL_FIELDS_BY_KIND[kind] ?? []) needed.add(field);
  }
  return [...needed];
}

/**
 * Fields an action may carry beyond its required ones. Kept next to the registry rather than
 * inferred from the TS union: the schema is data the model reads, and it must be legible here.
 */
const OPTIONAL_FIELDS_BY_KIND: Partial<Record<ActionKind, readonly ActionField[]>> = {
  'apply-template': ['searchTerms'],
  'add-allergy': ['searchTerms'],
  'remove-allergy': ['searchTerms'],
  'add-condition': ['searchTerms', 'code'],
  'remove-condition': ['searchTerms'],
  'add-medication': ['searchTerms', 'strength', 'doseForm'],
  'remove-medication': ['searchTerms'],
  'add-surgical-history': ['searchTerms'],
  'remove-surgical-history': ['searchTerms'],
  'add-hospitalization': ['searchTerms'],
  'remove-hospitalization': ['searchTerms'],
  'add-exam-finding': ['searchTerms'],
  'remove-exam-finding': ['searchTerms'],
  'add-ros-finding': ['searchTerms', 'finding'],
  'remove-ros-finding': ['searchTerms', 'finding'],
  'add-diagnosis': ['searchTerms', 'code', 'isPrimary'],
  'remove-diagnosis': ['searchTerms'],
  'add-in-house-lab': ['searchTerms'],
  'add-external-lab': ['searchTerms'],
  'add-radiology': ['searchTerms'],
  'add-procedure': ['searchTerms'],
  'update-procedure': ['procedureMatch'],
  'set-em-code': ['display'],
  'remove-em-code': ['code'],
  'add-cpt': ['display'],
  'set-disposition': ['followUpInDays'],
  unknown: ['message'],
};

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
  return CAPABILITIES[kind].required.filter((field) => !isPresent((obj as Record<string, unknown>)[field]));
}

function isPresent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}
