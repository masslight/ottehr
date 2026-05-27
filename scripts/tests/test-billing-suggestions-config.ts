import { BillingSuggestionInput } from 'utils';

export interface ScenarioChecks {
  /** Expected ICD-10 codes; score = % of expected codes found in suggestions. */
  icd: { codes: string[]; expected: string };
  /**
   * Optional CPT check. Each slot is a code string or an array of alternatives
   * (any match counts for that slot). Score = % of slots matched.
   */
  cpt?: { codes: (string | string[])[]; expected: string };
  /** E&M code that must appear in suggestions. */
  em: { code: string };
}

export interface TestScenario {
  label: string;
  visit: BillingSuggestionInput;
  checks: ScenarioChecks;
}

// Established patient, confirmed strep pharyngitis via rapid strep test, antibiotic prescribed.
// Antibiotic prescription → Moderate risk → 99214. Expected ICD: J02.0, CPT: 87880.
const STREP_PHARYNGITIS_VISIT: BillingSuggestionInput = {
  newPatient: false,
  patientAge: '9 years',
  patientSex: 'female',
  hpi: 'The patient is a 9-year-old female presenting with a 2-day history of sore throat, headache, and fever of 101.2°F. She reports decreased appetite and mild fatigue. No cough or significant nasal congestion. Patient has adequate oral intake and urine output.',
  mdm: 'Patient with history and exam findings consistent with strep pharyngitis, confirmed by positive rapid strep test. No evidence of peritonsillar abscess, sepsis, or serious bacterial infection at this time. Airway patent. Appropriate antibiotic prescribed as documented.\nEncourage hydration.\nAcetaminophen/ibuprofen for fever/pain. Follow-up with PMD in 2-3 days if symptoms not improving. Seek immediate medical attention if unable to swallow, difficulty breathing, severe pain, or any other concerns.\nReviewed diagnosis, expected course, and treatment plan. Discharge instructions reviewed. Patient expressed understanding. All questions were answered, and patient is comfortable with discharge plan.',
  diagnoses: [],
  billing: [],
  externalLabOrders: '',
  internalLabOrders: 'Test: Rapid Strep | Results: Rapid Strep: Detected',
  radiologyOrders: '',
  radiologyReports: '',
  procedures: '',
};

// Established 5yo male: strep pharyngitis + bilateral cerumen impaction + flu ruled out.
// Multiple procedures (cerumen removal, rapid flu, rapid strep) + antibiotic → Moderate → 99214.
// Expected ICD: J02.0, H61.23, R50.9, R11.10. CPT: 69210, 87804, 87880.
const STREP_WITH_CERUMEN_VISIT: BillingSuggestionInput = {
  newPatient: false,
  patientAge: '5 years',
  patientSex: 'male',
  hpi: 'The patient is a 5-year-old male presenting with fever of 101.0°F and complaints of ear pain, sore throat, and abdominal pain. He vomited once prior to arrival. He has been congested with no runny nose and has had difficulty sleeping. Patient has adequate oral intake and urine output.',
  mdm: "Patient presented with history of fever and vomiting. Patient given Ondansetron. Able to tolerate liquids at time of discharge. Normal abdominal exam. Unable to visualize TM's initially due to cerumen impaction. Soft cerumen removed as documented. Normal TM's. With exposure to flu, patient initially tested for flu. Negative for flu. Exam findings consistent with strep pharyngitis, confirmed by positive rapid strep test. No evidence of peritonsillar abscess, sepsis, or serious bacterial infection at this time. Airway patent. Appropriate antibiotic prescribed as documented.\nEncourage hydration.\nAcetaminophen/ibuprofen for fever/pain. Follow-up with PMD in 2-3 days if symptoms not improving. Seek immediate medical attention if unable to swallow, difficulty breathing, severe pain, or any other concerns.\nReviewed diagnosis, expected course, and treatment plan. Discharge instructions reviewed. Patient expressed understanding. All questions were answered, and patient is comfortable with discharge plan.",
  diagnoses: [],
  billing: [],
  externalLabOrders: '',
  internalLabOrders:
    'Test: Rapid Flu A/B | Results: Rapid Influenza B: Not detected, Rapid Influenza A: Not detected\nTest: Rapid Strep | Results: Rapid Strep: Detected',
  radiologyOrders: '',
  radiologyReports: '',
  procedures:
    'Procedure: Ear Lavage / Cerumen Removal | Technique: Clean | CPT: 69210 | Dx: H61.23 | Supplies: Other: white looped ear currette | Details: Soft cerumen removed from both ear canals with white looped ear currette to visualize TM. Patient tolerated well. | Complications: None',
};

// Established 2yo male: nondisplaced right clavicle fracture after a fall, X-ray confirmed.
// New problem with imaging workup + OTC pain management → Moderate → 99214.
// Expected ICD: M25.511 (primary), S42.001A (secondary). CPT: 73000 (clavicle X-ray, right).
const CLAVICLE_FRACTURE_VISIT: BillingSuggestionInput = {
  newPatient: false,
  patientAge: '2 years',
  patientSex: 'male',
  hpi: 'A 2-year-old male presented after a witnessed fall from a chair. Since the fall, he has been guarding his right arm and refusing to lift it. Parents report no fever and no vomiting. No loss of consciousness. He has been acting normally otherwise.',
  mdm: 'Patient with pain to right shoulder after a fall. No concern for head injury. He is guarding his right arm and will not lift it above shoulder height. Mild point tenderness over the clavicle, no deformity noted. Based on initial reading of x-ray, nondisplaced clavicle fracture identified. X-ray sent for official reading; will contact family if any changes are needed. Advised limiting activity and ibuprofen for discomfort. Reviewed diagnosis, expected course, treatment plan, and reasons to seek urgent and/or emergent care.  Discharge instructions reviewed.  Caregiver expressed understanding.  All questions were answered, and caregiver is comfortable with discharge plan.',
  diagnoses: [],
  billing: [],
  externalLabOrders: '',
  internalLabOrders: '',
  radiologyOrders: '73000-RT — Radiologic examination; clavicle, complete - Right side',
  radiologyReports:
    '73000-RT — Radiologic examination; clavicle, complete - Right side (Final): SIGNIFICANT FINDINGS\n\nSTUDY: X-RAY OF RIGHT CLAVICLE, 1 VIEW\n\nINDICATION: Fall, tender along right clavicle, fracture of clavicle.\n\nTECHNIQUE: Single view of the right clavicle was submitted for interpretation.\n\nFINDINGS:\nBones: Fracture of the distal clavicular shaft is noted. Fracture fragments in anatomical position, no significant displacement. Humeral head, glenoid, and acromion appear intact.\n\nJoints: Glenohumeral and acromioclavicular joints are within normal limits.\n\nSoft Tissues: No abnormal soft tissue swelling or calcification.\n\nIMPRESSION:\n1. Right distal clavicular shaft undisplaced fracture.\n2. No associated dislocation or acute bony injury.',
  procedures: '',
};

// New patient, 27yo female: common cold, strep negative, dexamethasone injection + prescription management.
// New patient visit → 99204. Expected ICD: J00. CPT: J1100, 87880, 96372.
const COMMON_COLD_VISIT: BillingSuggestionInput = {
  newPatient: true,
  patientAge: '27 years',
  patientSex: 'female',
  hpi: 'The patient is a 27-year-old female presenting with sore throat onset 2 days ago, accompanied by body aches.',
  mdm: 'Prescription management',
  diagnoses: [],
  billing: [],
  externalLabOrders: '',
  internalLabOrders: 'Test: Rapid Strep | Results: Rapid Strep: Not detected',
  radiologyOrders: '',
  radiologyReports: '',
  procedures: '',
  rosFindings: 'Constitutional: Fatigue. Ears/Nose/Throat: Sore throat, Hoarseness. Neurologic: Headache',
};

// New patient, 42yo female: sinusitis + asthma flare, flu/COVID negative, nebulizer + dexamethasone injection given.
// New patient visit → 99204. Expected ICD: J01.80. CPT: 94640, 96372, 87804, 87811, J7620, J1100.
const SINUSITIS_ASTHMA_VISIT: BillingSuggestionInput = {
  newPatient: true,
  patientAge: '42 years',
  patientSex: 'female',
  hpi: 'The patient is a 42-year-old female presenting with a 3-day history of sinus congestion, facial pain, fever, and shortness of breath consistent with an asthma exacerbation. Temperature is 101.8°F. Shortness of breath has been present and stable throughout.',
  mdm: 'Reviewed diagnosis, expected course, treatment plan, and reasons to seek urgent and/or emergent care.  Discharge instructions reviewed.  Caregiver expressed understanding.  All questions were answered, and caregiver is comfortable with discharge plan.',
  diagnoses: [],
  billing: [],
  externalLabOrders: '',
  internalLabOrders:
    'Test: Flu | Results: Flu: Not detected\nTest: Rapid COVID-19 Antigen | Results: Rapid COVID-19 Antigen: Not detected',
  radiologyOrders: '',
  radiologyReports: '',
  procedures: 'Procedure: Respiratory Procedures: Nebulizer Treatment | CPT: 94640',
  rosFindings: '',
};

// Established 55yo female: unilateral blepharitis right upper eyelid, no labs/procedures.
// Established patient visit → 99214. Expected ICD: H01.001. No CPT codes beyond E&M.
const BLEPHARITIS_VISIT: BillingSuggestionInput = {
  newPatient: false,
  patientAge: '55 years',
  patientSex: 'female',
  hpi: 'The patient is a 55-year-old female presenting with right upper eyelid swelling and tenderness that began this morning, following redness of the eyelid yesterday. She reports a foreign body sensation in the eye and mild blurry vision in the affected eye. She denies discharge, contact lens use, or recent changes in eye products. Over-the-counter allergy drops provided no improvement.',
  mdm: 'Reviewed diagnosis, expected course, treatment plan, and reasons to seek urgent and/or emergent care.  Discharge instructions reviewed.  Patient expressed understanding.  All questions were answered, and patient is comfortable with discharge plan.',
  diagnoses: [],
  billing: [],
  externalLabOrders: '',
  internalLabOrders: '',
  radiologyOrders: '',
  radiologyReports: '',
  procedures: '',
  rosFindings: '',
};

// New patient, 13yo female: right ankle pain after a sports injury (heard a pop), Ottawa criteria evaluated.
// X-ray ordered. New patient visit → 99203. Expected ICD: M25.571. CPT: A6450, 73610-RT.
const ANKLE_PAIN_VISIT: BillingSuggestionInput = {
  newPatient: true,
  patientAge: '13 years',
  patientSex: 'female',
  hpi: 'The patient is a 13-year-old female presenting with right ankle pain for two days following a sports injury where she reported hearing a pop. Pain is localized to the posterior right ankle. She is able to ambulate but experiences pain with movement. No significant swelling of the foot or toes.',
  mdm: "The patient's clinical presentation was evaluated using the Ottawa Ankle Rules to determine the necessity of radiographic imaging. Due to bone tenderness at the malleolar zone, an X-ray of the ankle was ordered.",
  diagnoses: [],
  billing: [],
  externalLabOrders: '',
  internalLabOrders: '',
  radiologyOrders: '73610-RT — X-ray of ankle, minimum of 3 views - Right side',
  radiologyReports: '',
  procedures: '',
  rosFindings: '',
};

export const TEST_SCENARIOS: TestScenario[] = [
  {
    label: 'Confirmed strep pharyngitis → expect J02.0 ICD + 87880 CPT + 99214',
    visit: STREP_PHARYNGITIS_VISIT,
    checks: {
      icd: {
        codes: ['J02.0'],
        expected: 'J02.0 (Streptococcal pharyngitis)',
      },
      cpt: {
        codes: ['87880'],
        expected: '87880 (Rapid strep test)',
      },
      em: { code: '99214' },
    },
  },
  {
    label:
      'Strep + bilateral cerumen removal + flu ruled out → expect J02.0/H61.23/R50.9/R11.10 + 69210/87804/87880 + 99214',
    visit: STREP_WITH_CERUMEN_VISIT,
    checks: {
      icd: {
        codes: ['J02.0', 'H61.23', 'R50.9', 'R11.10'],
        expected: 'J02.0, H61.23, R50.9, R11.10',
      },
      cpt: {
        codes: ['69210', '87804', '87880'],
        expected: '69210, 87804, 87880',
      },
      em: { code: '99214' },
    },
  },
  {
    label: 'Nondisplaced right clavicle fracture → expect M25.511/S42.001A + 73000 CPT + 99214',
    visit: CLAVICLE_FRACTURE_VISIT,
    checks: {
      icd: {
        codes: ['M25.511', 'S42.001A'],
        expected: 'M25.511, S42.001A',
      },
      cpt: {
        // AI may return 73000 with or without the -RT modifier; either satisfies the slot
        codes: [['73000', '73000-RT']],
        expected: '73000 or 73000-RT (clavicle X-ray, right)',
      },
      em: { code: '99214' },
    },
  },
  {
    label:
      'New patient, common cold, strep negative, dex injection + prescription mgmt → expect J00 ICD + J1100/87880/96372 CPT + 99204',
    visit: COMMON_COLD_VISIT,
    checks: {
      icd: {
        codes: ['J00'],
        expected: 'J00 (Acute nasopharyngitis [common cold])',
      },
      cpt: {
        codes: ['J1100', '87880', '96372'],
        expected: 'J1100, 87880, 96372',
      },
      em: { code: '99204' },
    },
  },
  {
    label:
      'New patient, sinusitis + asthma flare, flu/COVID negative, nebulizer + dex injection → expect J01.80 ICD + 94640/96372/87804/87811/J7620/J1100 CPT + 99204',
    visit: SINUSITIS_ASTHMA_VISIT,
    checks: {
      icd: {
        codes: ['J01.80'],
        expected: 'J01.80 (Other acute sinusitis)',
      },
      cpt: {
        codes: ['94640', '96372', '87804', '87811', 'J7620', 'J1100'],
        expected: '94640, 96372, 87804, 87811, J7620, J1100',
      },
      em: { code: '99204' },
    },
  },
  {
    label: 'New patient, right ankle pain after sports injury → expect M25.571 ICD + A6450/73610-RT CPT + 99203',
    visit: ANKLE_PAIN_VISIT,
    checks: {
      icd: {
        codes: ['M25.571'],
        expected: 'M25.571 (Pain in right ankle)',
      },
      cpt: {
        codes: ['A6450', ['73610', '73610-RT']],
        expected: 'A6450, 73610-RT (ankle X-ray, right)',
      },
      em: { code: '99203' },
    },
  },
  {
    label: 'Established patient, blepharitis right upper eyelid, no labs/procedures → expect H01.001 ICD + 99214',
    visit: BLEPHARITIS_VISIT,
    checks: {
      icd: {
        codes: ['H01.001'],
        expected: 'H01.001 (Unspecified blepharitis right upper eyelid)',
      },
      em: { code: '99214' },
    },
  },
];
