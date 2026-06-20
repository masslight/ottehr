// Generates ~30 NEW template-less archetype scenario files (variants + new
// complaints) from compact clinical specs, using the harness's new chart-finding
// schema fields (diagnoses/exam/reviewOfSystems/medicalDecision/prescriptions).
// Writes scenario JSONs to ../examples/gen-<key>.json and prints registry rows
// for archetypes.ts. Does NOT run anything against the population.
//
//   npx tsx generate-new-archetypes.ts            # write files + print registry
//
// Identity (name/dob/sex/email) is overridden per-visit by the runner, so the
// base patient block is shared. Exam = general normal + per-system comment notes
// for the abnormal findings. ROS = structured {reports,denies} → field codes.

import { writeFileSync } from 'fs';
import { resolve } from 'path';

const EXAMPLES = resolve(__dirname, '..', 'examples');

const BASE_PATIENT = {
  firstName: 'Pat',
  lastName: 'Sample',
  dateOfBirth: '1985-01-01',
  sex: 'female',
  email: 'pat.sample@example.com',
  phoneNumber: '+12015550100',
  address: { line1: '100 Main Street', city: 'New Brunswick', state: 'NJ', postalCode: '08901' },
  race: 'Other Race',
  ethnicity: 'Not Hispanic or Latino',
  preferredLanguage: 'English',
  preferredCommunication: 'Cell Phone',
  mobileOptIn: true,
  responsibleParty: { relationship: 'Self' },
  consents: { hipaa: true, treat: true, signerRelationship: 'Self' },
  fixtures: {
    idCardFront: '../fixtures/driversLicenseFront.jpeg',
    idCardBack: '../fixtures/driversLicenseBackSample.jpeg',
    insuranceCardFront: '../fixtures/insuranceSampleFront.png',
    insuranceCardBack: '../fixtures/insuranceSampleBack.jpeg',
  },
  insurance: {
    primary: {
      carrier: 'Aetna',
      memberId: 'AET100200300',
      groupNumber: 'GRP-AET-100',
      planName: 'Aetna Choice PPO',
      subscriberRelationship: 'self',
    },
  },
};

const NORMAL_EXAM = [
  'alert',
  'active',
  'in-no-acute-distress',
  'well-hydrated',
  'normocephalic',
  'atraumatic',
  'right-eye-conjunctiva-non-injected-no-discharge',
  'left-eye-conjunctiva-non-injected-no-discharge',
  'lids-and-lashes-normal',
  'right-tm-pearly-with-good-light-reflex-preserved-landmarks',
  'left-tm-pearly-with-good-light-reflex-preserved-landmarks',
  'no-effusion',
  'normal-canals',
  'normal-external-ear',
  'moist-mucous-membranes',
  'oropharynx-clear-with-no-erythema-lesions-or-exudate',
  'uvula-midline',
  'normal-appearance-of-neck',
  'no-rash',
  'warm-and-dry',
  'regular-rate-and-rhythm-with-no-murmur',
  'extremities-are-warm-and-well-perfused',
  'good-air-movement-throughout-lung-fields',
  'no-signs-of-respiratory-distress',
  'chest-is-clear-to-auscultation-bilaterally',
  'soft',
  'nondistended',
  'nontender',
  'moves-all-extremities-symmetrically',
  'no-obvious-injury-or-swelling',
  'normal-mental-status',
  'normal-tone',
];

type Vitals = Partial<{
  temp: number;
  hr: number;
  sys: number;
  dia: number;
  rr: number;
  o2: number;
  wt: number;
  ht: number;
}>;
interface Spec {
  key: string;
  label: string;
  ageMin: number;
  ageMax: number;
  sex: 'any' | 'female' | 'male';
  weight: number;
  reason: string;
  em: [string, string];
  dx: Array<[string, string, boolean?]>;
  examOmit?: string[];
  examComment: Array<[string, string]>; // [system-comment field, note]
  rosReports: string[];
  rosDenies: string[];
  mdm: string;
  rx: Array<[string, string]>;
  vitals?: Vitals;
  modules?: Record<string, unknown>;
  disp: { type: string; text: string; note: string; followUpIn?: number; followUp?: unknown[] };
}

const ageBandVitals = (mid: number, v: Vitals = {}): any => {
  let base: Required<Vitals>;
  if (mid <= 2) base = { temp: 37, hr: 120, sys: 95, dia: 60, rr: 30, o2: 99, wt: 12, ht: 84 };
  else if (mid <= 12) base = { temp: 37, hr: 96, sys: 102, dia: 66, rr: 20, o2: 99, wt: 28, ht: 130 };
  else if (mid <= 17) base = { temp: 37, hr: 82, sys: 116, dia: 72, rr: 16, o2: 99, wt: 60, ht: 165 };
  else if (mid <= 64) base = { temp: 37, hr: 78, sys: 122, dia: 78, rr: 16, o2: 99, wt: 75, ht: 170 };
  else base = { temp: 36.8, hr: 76, sys: 134, dia: 80, rr: 18, o2: 97, wt: 70, ht: 166 };
  const m = { ...base, ...v };
  return {
    temperature: { value: m.temp, unit: 'C' },
    heartRate: { value: m.hr },
    bloodPressure: { systolic: m.sys, diastolic: m.dia },
    respirationRate: { value: m.rr },
    oxygenSaturation: { value: m.o2 },
    weight: { value: m.wt, unit: 'kg' },
    height: { value: m.ht, unit: 'cm' },
  };
};

const ros = (item: string, state: 'reports' | 'denies'): string => `${item}-${state}`;

function buildScenario(s: Spec): any {
  const mid = Math.round((s.ageMin + s.ageMax) / 2);
  const examFields = NORMAL_EXAM.filter((f) => !(s.examOmit ?? []).includes(f)).map((field) => ({
    field,
    value: true,
  }));
  const examComments = s.examComment.map(([field, note]) => ({ field, value: true, note }));
  const reviewOfSystems = [
    ...s.rosReports.map((i) => ({ field: ros(i, 'reports') })),
    ...s.rosDenies.map((i) => ({ field: ros(i, 'denies') })),
  ];
  return {
    schemaVersion: '1.0',
    label: s.label,
    patient: { ...BASE_PATIENT, sex: s.sex === 'male' ? 'male' : 'female' },
    visit: {
      type: 'in-person',
      date: '2026-04-25',
      reasonForVisit: s.reason,
      locationName: 'New York',
      language: 'en',
      targetStatus: 'completed',
    },
    emCode: { code: s.em[0], display: s.em[1] },
    vitals: ageBandVitals(mid, s.vitals),
    diagnoses: s.dx.map(([code, display, isPrimary]) => ({ code, display, isPrimary: isPrimary ?? false })),
    exam: [...examFields, ...examComments],
    reviewOfSystems,
    medicalDecision: s.mdm,
    prescriptions: s.rx.map(([name, sig]) => ({ name, sig })),
    ...(s.modules ? { modules: s.modules } : {}),
    disposition: { followUp: [], ...s.disp },
    signOff: {
      practitionerName: 'Demo Admin',
      userRole: 'Provider',
      timezone: 'America/New_York',
      supervisorApproval: false,
      patientInfoConfirmed: true,
      complete: true,
    },
  };
}

// ── 30 specs ─────────────────────────────────────────────────────────────────
const EM_213: [string, string] = ['99213', 'Office visit, established, low complexity'];
const EM_214: [string, string] = ['99214', 'Office visit, established, moderate complexity'];
const PCP = (note: string, days = 3): Spec['disp'] => ({
  type: 'pcp',
  text: 'Discharge home with PCP follow-up',
  note,
  followUpIn: days,
});

const SPECS: Spec[] = [
  // ── variants ──
  {
    key: 'mono',
    label: 'Infectious mononucleosis',
    ageMin: 14,
    ageMax: 24,
    sex: 'any',
    weight: 5,
    reason: 'Throat pain - 5 days severe sore throat, fatigue, swollen glands',
    em: EM_214,
    dx: [['B27.90', 'Infectious mononucleosis, without complication', true]],
    examComment: [
      [
        'oral-comment',
        'Posterior pharynx erythematous with tonsillar exudate; tender, enlarged posterior cervical lymph nodes.',
      ],
      ['abdomen-comment', 'Mild LUQ fullness, no rebound or guarding; spleen not clearly enlarged.'],
    ],
    rosReports: [
      'ros-constitutional-fever',
      'ros-constitutional-fatigue',
      'ros-ent-sore-throat',
      'ros-ent-throat-swelling',
      'ros-heme-swollen-nodes',
    ],
    rosDenies: ['ros-respiratory-cough', 'ros-respiratory-shortness-of-breath'],
    mdm: 'Adolescent with exudative pharyngitis, posterior cervical lymphadenopathy and marked fatigue; rapid strep negative, monospot positive consistent with infectious mononucleosis. Counseled on supportive care, avoidance of contact sports for 3-4 weeks given splenomegaly risk, and return precautions for abdominal pain or difficulty breathing.',
    rx: [['ibuprofen 600 mg tablet', 'Take 1 tablet by mouth every 6 hours as needed for pain (with food)']],
    modules: {
      inHouseLabs: [
        {
          testName: 'Mono Spot',
          diagnoses: [{ code: 'B27.90', display: 'Infectious mononucleosis', isPrimary: true }],
          results: [{ analyte: 'Heterophile antibody', value: 'positive', flag: 'abnormal' }],
        },
      ],
    },
    disp: PCP(
      'Supportive care for infectious mononucleosis. Avoid contact sports 3-4 weeks. Return for severe abdominal pain, difficulty swallowing, or trouble breathing.',
      7
    ),
  },

  {
    key: 'bronchitis',
    label: 'Acute bronchitis',
    ageMin: 18,
    ageMax: 70,
    sex: 'any',
    weight: 6,
    reason: 'Cough and/or congestion - 6 days productive cough, chest congestion',
    em: EM_213,
    dx: [['J20.9', 'Acute bronchitis, unspecified', true]],
    examComment: [
      ['lungs-comment', 'Scattered rhonchi that clear with cough; no focal crackles, no wheeze; good air movement.'],
    ],
    rosReports: [
      'ros-respiratory-cough',
      'ros-respiratory-sputum',
      'ros-respiratory-chest-tightness',
      'ros-constitutional-fatigue',
    ],
    rosDenies: ['ros-constitutional-fever', 'ros-respiratory-hemoptysis', 'ros-respiratory-shortness-of-breath'],
    mdm: 'Adult with productive cough and chest congestion, afebrile, lungs without focal consolidation or hypoxia. Clinical picture consistent with viral acute bronchitis; antibiotics not indicated. Symptomatic management and return precautions for fever, dyspnea, or hemoptysis discussed.',
    rx: [['benzonatate 100 mg capsule', 'Take 1 capsule by mouth three times daily as needed for cough']],
    vitals: { o2: 98 },
    disp: PCP('Supportive care for acute bronchitis. Return for fever, shortness of breath, or coughing up blood.'),
  },

  {
    key: 'covid',
    label: 'COVID-19',
    ageMin: 5,
    ageMax: 80,
    sex: 'any',
    weight: 5,
    reason: 'Cough and/or congestion - 3 days fever, cough, sore throat, body aches',
    em: EM_213,
    dx: [['U07.1', 'COVID-19', true]],
    examComment: [
      ['nose-comment', 'Nasal mucosa erythematous with clear rhinorrhea.'],
      ['oral-comment', 'Mild pharyngeal erythema, no exudate.'],
    ],
    rosReports: [
      'ros-constitutional-fever',
      'ros-constitutional-fatigue',
      'ros-msk-muscle-aches',
      'ros-respiratory-cough',
      'ros-ent-sore-throat',
    ],
    rosDenies: ['ros-respiratory-shortness-of-breath'],
    mdm: 'Febrile viral syndrome with positive SARS-CoV-2 antigen test. Well-appearing, no hypoxia or respiratory distress. Counseled on isolation, supportive care, hydration, and return precautions for shortness of breath or persistent high fever. Discussed antiviral eligibility.',
    rx: [
      [
        'acetaminophen 500 mg tablet',
        'Take 2 tablets by mouth every 6 hours as needed for fever or aches (max 3 g/day)',
      ],
    ],
    vitals: { temp: 38.4, hr: 96, o2: 97 },
    modules: {
      inHouseLabs: [
        {
          testName: 'SARS-CoV-2 Antigen',
          diagnoses: [{ code: 'U07.1', display: 'COVID-19', isPrimary: true }],
          results: [{ analyte: 'SARS-CoV-2 Ag', value: 'positive', flag: 'abnormal' }],
        },
      ],
    },
    disp: PCP(
      'Supportive care for COVID-19, isolate per guidance. Return for shortness of breath, chest pain, or persistent high fever.',
      5
    ),
  },

  {
    key: 'influenza',
    label: 'Influenza',
    ageMin: 5,
    ageMax: 80,
    sex: 'any',
    weight: 5,
    reason: 'Fever - abrupt fever, body aches, cough, headache 1 day',
    em: EM_213,
    dx: [['J11.1', 'Influenza due to unidentified influenza virus with other respiratory manifestations', true]],
    examComment: [['nose-comment', 'Nasal congestion with clear discharge; pharynx mildly injected.']],
    rosReports: [
      'ros-constitutional-fever',
      'ros-constitutional-chills',
      'ros-msk-muscle-aches',
      'ros-neuro-headache',
      'ros-respiratory-cough',
    ],
    rosDenies: ['ros-respiratory-shortness-of-breath', 'ros-gi-diarrhea'],
    mdm: 'Abrupt-onset febrile illness with myalgias, headache and cough during influenza season; rapid influenza A positive. Well-appearing without respiratory distress. Within antiviral window — oseltamivir prescribed. Supportive care and return precautions reviewed.',
    rx: [
      ['oseltamivir 75 mg capsule', 'Take 1 capsule by mouth twice daily for 5 days'],
      ['acetaminophen 500 mg tablet', 'Take 2 tablets by mouth every 6 hours as needed for fever (max 3 g/day)'],
    ],
    vitals: { temp: 38.9, hr: 100 },
    modules: {
      inHouseLabs: [
        {
          testName: 'Rapid Influenza A/B',
          diagnoses: [{ code: 'J11.1', display: 'Influenza', isPrimary: true }],
          results: [{ analyte: 'Influenza A', value: 'positive', flag: 'abnormal' }],
        },
      ],
    },
    disp: PCP(
      'Supportive care for influenza, complete oseltamivir course. Return for shortness of breath or persistent high fever.',
      5
    ),
  },

  {
    key: 'croup',
    label: 'Croup (laryngotracheitis)',
    ageMin: 1,
    ageMax: 5,
    sex: 'any',
    weight: 5,
    reason: 'Cough and/or congestion - barky cough and noisy breathing overnight',
    em: EM_214,
    dx: [['J05.0', 'Acute obstructive laryngitis [croup]', true]],
    examComment: [
      [
        'lungs-comment',
        'Intermittent inspiratory stridor at rest resolving with calm; no retractions after treatment; good air entry.',
      ],
      ['nose-comment', 'Mild rhinorrhea, hoarse voice, barky cough.'],
    ],
    rosReports: ['ros-respiratory-cough', 'ros-respiratory-stridor', 'ros-ent-hoarseness', 'ros-constitutional-fever'],
    rosDenies: ['ros-respiratory-shortness-of-breath', 'ros-ent-difficulty-swallowing'],
    mdm: 'Toddler with classic barky cough and intermittent inspiratory stridor consistent with viral croup. Given single dose dexamethasone with improvement; no stridor at rest, no retractions at discharge, tolerating PO. Counseled on cool mist, return precautions for stridor at rest or respiratory distress.',
    rx: [
      [
        'dexamethasone 1 mg/mL oral solution',
        'Give a single weight-based dose (0.6 mg/kg) by mouth, already administered in clinic',
      ],
    ],
    vitals: { temp: 37.8, hr: 120, rr: 28, o2: 98 },
    disp: PCP(
      'Supportive care for croup. Return immediately for noisy breathing at rest, drooling, or trouble breathing.',
      2
    ),
  },

  {
    key: 'sinusitis',
    label: 'Acute bacterial sinusitis',
    ageMin: 18,
    ageMax: 70,
    sex: 'any',
    weight: 6,
    reason: 'Cough and/or congestion - 10 days congestion, facial pressure, worsening',
    em: EM_213,
    dx: [['J01.90', 'Acute sinusitis, unspecified', true]],
    examComment: [
      ['nose-comment', 'Boggy, erythematous nasal mucosa with purulent discharge; tenderness over maxillary sinuses.'],
    ],
    rosReports: [
      'ros-ent-nasal-congestion',
      'ros-ent-sinus-pain',
      'ros-ent-post-nasal-drip',
      'ros-constitutional-fatigue',
    ],
    rosDenies: ['ros-eyes-vision-changes', 'ros-respiratory-shortness-of-breath'],
    mdm: 'Symptoms >10 days with purulent nasal discharge and maxillary sinus tenderness, worsening after initial improvement — consistent with acute bacterial sinusitis. No orbital or CNS warning signs. Amoxicillin-clavulanate prescribed with supportive nasal care and return precautions for vision change or severe headache.',
    rx: [
      ['amoxicillin-clavulanate 875-125 mg tablet', 'Take 1 tablet by mouth twice daily for 7 days'],
      ['fluticasone 50 mcg nasal spray', 'Use 2 sprays in each nostril once daily'],
    ],
    disp: PCP(
      'Antibiotics for bacterial sinusitis, nasal saline + steroid spray. Return for vision changes, severe headache, or facial swelling.',
      5
    ),
  },

  {
    key: 'otitis-externa',
    label: 'Otitis externa (swimmer’s ear)',
    ageMin: 5,
    ageMax: 50,
    sex: 'any',
    weight: 5,
    reason: 'Ear pain - right ear pain and drainage, worse with touch, after swimming',
    em: EM_213,
    dx: [['H60.339', 'Other infective otitis externa, unspecified ear', true]],
    examComment: [
      [
        'ears-comment',
        'Right ear canal erythematous and edematous with debris; marked pain on tragal manipulation and auricle traction; TM not well visualized but no perforation seen.',
      ],
    ],
    rosReports: ['ros-ent-ear-pain', 'ros-ent-ear-drainage'],
    rosDenies: ['ros-constitutional-fever', 'ros-ent-hearing-loss', 'ros-ent-sore-throat'],
    mdm: 'Painful, edematous external auditory canal with pain on tragal manipulation after water exposure — acute otitis externa. No signs of malignant otitis externa. Topical antibiotic-steroid drops prescribed, keep ear dry, return precautions for spreading erythema or fever.',
    rx: [['ciprofloxacin-dexamethasone otic suspension', 'Instill 4 drops into the right ear twice daily for 7 days']],
    disp: PCP('Topical drops for swimmer’s ear, keep ear dry. Return for fever, facial swelling, or worsening pain.'),
  },

  {
    key: 'pyelonephritis',
    label: 'Acute pyelonephritis',
    ageMin: 18,
    ageMax: 55,
    sex: 'female',
    weight: 4,
    reason: 'Urinary problem - 2 days dysuria now with fever, chills, flank pain',
    em: EM_214,
    dx: [['N10', 'Acute pyelonephritis', true]],
    examComment: [
      ['back-comment', 'Right costovertebral angle tenderness to percussion.'],
      ['abdomen-comment', 'Mild suprapubic tenderness, no rebound or guarding.'],
    ],
    rosReports: [
      'ros-constitutional-fever',
      'ros-constitutional-chills',
      'ros-gu-dysuria',
      'ros-gu-frequency',
      'ros-gu-flank-pain',
      'ros-gi-nausea',
    ],
    rosDenies: ['ros-gu-hematuria'],
    mdm: 'Young woman with dysuria progressing to fever, chills and CVA tenderness with pyuria on urinalysis — acute pyelonephritis. Hemodynamically stable, tolerating PO, no signs of sepsis or obstruction. Outpatient fluoroquinolone with antipyretics; urine culture sent; strict return precautions for vomiting, worsening pain, or inability to keep fluids down.',
    rx: [
      ['ciprofloxacin 500 mg tablet', 'Take 1 tablet by mouth twice daily for 7 days'],
      ['ondansetron 4 mg ODT', 'Dissolve 1 tablet on the tongue every 8 hours as needed for nausea'],
    ],
    vitals: { temp: 38.6, hr: 102 },
    modules: {
      inHouseLabs: [
        {
          testName: 'Urinalysis',
          diagnoses: [{ code: 'N10', display: 'Acute pyelonephritis', isPrimary: true }],
          results: [
            { analyte: 'Leukocyte esterase', value: 'large', flag: 'abnormal' },
            { analyte: 'Nitrite', value: 'positive', flag: 'abnormal' },
          ],
        },
      ],
    },
    disp: PCP(
      'Antibiotics for kidney infection; urine culture pending. Return immediately for vomiting, inability to keep fluids down, or worsening pain.',
      2
    ),
  },

  {
    key: 'allergic-conjunctivitis',
    label: 'Allergic conjunctivitis',
    ageMin: 5,
    ageMax: 60,
    sex: 'any',
    weight: 5,
    reason: 'Eye concern - both eyes itchy, watery, red for several days',
    em: EM_213,
    dx: [['H10.45', 'Other chronic allergic conjunctivitis', true]],
    examOmit: ['right-eye-conjunctiva-non-injected-no-discharge', 'left-eye-conjunctiva-non-injected-no-discharge'],
    examComment: [
      [
        'eyes-comment',
        'Bilateral conjunctival injection with watery discharge and chemosis; no purulent discharge; vision intact, no photophobia, cornea clear.',
      ],
    ],
    rosReports: ['ros-eyes-redness', 'ros-eyes-itching', 'ros-eyes-discharge'],
    rosDenies: ['ros-eyes-vision-changes', 'ros-eyes-photophobia', 'ros-eyes-eye-pain'],
    mdm: 'Bilateral itchy, watery, injected eyes with chemosis and no purulence — allergic conjunctivitis. Vision intact, cornea clear. Antihistamine eye drops and oral antihistamine prescribed; avoid allergen, cool compresses; return for vision change or eye pain.',
    rx: [
      ['ketotifen 0.025% ophthalmic solution', 'Instill 1 drop in each eye twice daily'],
      ['cetirizine 10 mg tablet', 'Take 1 tablet by mouth once daily'],
    ],
    disp: PCP('Allergy eye drops + oral antihistamine. Return for vision changes, eye pain, or pus-like discharge.'),
  },

  {
    key: 'hand-laceration',
    label: 'Hand laceration (sutured)',
    ageMin: 8,
    ageMax: 60,
    sex: 'any',
    weight: 5,
    reason: 'Cut to arm or leg - cut to right palm on broken glass, bleeding controlled',
    em: EM_214,
    dx: [['S61.411A', 'Laceration without foreign body of right hand, initial encounter', true]],
    examOmit: ['no-obvious-injury-or-swelling'],
    examComment: [
      [
        'skin-comment',
        '3 cm linear laceration to the right palm, edges approximated; no visible foreign body, no tendon exposure.',
      ],
      ['neurologic-comment', 'Intact sensation to all digits; full flexion/extension; 2-second capillary refill.'],
    ],
    rosReports: ['ros-skin-wounds'],
    rosDenies: ['ros-neuro-numbness', 'ros-neuro-weakness', 'ros-constitutional-fever'],
    mdm: 'Clean 3 cm palmar laceration without tendon, nerve, or vascular compromise and no retained foreign body. Wound irrigated and closed with simple sutures; tetanus status updated. Wound care and suture-removal instructions given; return precautions for signs of infection or loss of function.',
    rx: [['ibuprofen 600 mg tablet', 'Take 1 tablet by mouth every 6 hours as needed for pain']],
    modules: {
      procedures: [
        {
          procedureType: 'laceration-repair',
          occurrenceDateTime: '2026-04-25T14:00:00Z',
          documentedDateTime: '2026-04-25T14:20:00Z',
          performerType: 'Provider',
          bodySite: 'Other',
          technique: ['Clean'],
          suppliesUsed: '4-0 nylon suture, lidocaine',
          procedureDetails: 'Simple repair of 3 cm right palmar laceration, 4 interrupted sutures.',
          specimenSent: false,
          complications: 'None',
          patientResponse: 'Tolerated Well',
          timeSpent: '20-30 min',
          documentedBy: 'Provider',
          consentObtained: true,
          cptCode: '12001',
          diagnosisCode: 'S61.411A',
        },
      ],
    },
    disp: PCP(
      'Wound care for sutured hand laceration; suture removal in 10-14 days. Return for redness, drainage, fever, or numbness.',
      10
    ),
  },

  {
    key: 'ankle-fracture',
    label: 'Ankle fracture (lateral malleolus)',
    ageMin: 14,
    ageMax: 60,
    sex: 'any',
    weight: 4,
    reason: 'Injury to leg - twisted right ankle, immediate swelling, cannot bear weight',
    em: EM_214,
    dx: [
      [
        'S82.62XA',
        'Displaced fracture of lateral malleolus of right fibula, initial encounter for closed fracture',
        true,
      ],
    ],
    examOmit: ['no-obvious-injury-or-swelling', 'moves-all-extremities-symmetrically'],
    examComment: [
      [
        'extremities-comment',
        'Right lateral malleolus swollen, ecchymotic, tender over the distal fibula (positive bony tenderness); unable to bear weight; limited painful range of motion. Distal pulses 2+, sensation intact, foot warm.',
      ],
    ],
    rosReports: ['ros-msk-joint-pain', 'ros-msk-joint-swelling', 'ros-msk-limited-rom'],
    rosDenies: ['ros-neuro-numbness', 'ros-neuro-tingling', 'ros-constitutional-fever'],
    mdm: 'Inversion ankle injury with lateral malleolar bony tenderness and inability to bear weight (Ottawa positive); radiograph confirms a displaced lateral malleolus fracture, neurovascularly intact. Placed in a posterior splint, made non-weight-bearing with crutches, and referred to orthopedics. Analgesia provided; return precautions for numbness or increasing pain.',
    rx: [
      ['ibuprofen 600 mg tablet', 'Take 1 tablet by mouth every 6 hours as needed for pain (with food)'],
      ['acetaminophen 500 mg tablet', 'Take 2 tablets by mouth every 6 hours as needed for pain'],
    ],
    modules: {
      radiology: [
        {
          studyName: 'X-ray right ankle, 3 views',
          cptCode: '73610',
          diagnosisCode: 'S82.62XA',
          stat: false,
          clinicalHistory: 'Inversion injury, lateral malleolar tenderness, unable to bear weight.',
          consentObtained: true,
        },
      ],
    },
    disp: {
      type: 'specialty',
      text: 'Orthopedic follow-up',
      note: 'Posterior splint applied, non-weight-bearing with crutches. Orthopedics follow-up in 5-7 days for possible operative vs non-operative management.',
      followUpIn: 5,
      followUp: [{ type: 'orthopedics', note: 'Lateral malleolus fracture, splinted, NWB' }],
    },
  },

  // ── new complaints ──
  {
    key: 'urticaria',
    label: 'Acute allergic reaction (urticaria)',
    ageMin: 5,
    ageMax: 70,
    sex: 'any',
    weight: 5,
    reason: 'Allergic reaction to medication or food - diffuse hives and itching after eating',
    em: EM_214,
    dx: [
      ['T78.40XA', 'Allergy, unspecified, initial encounter', true],
      ['L50.9', 'Urticaria, unspecified', false],
    ],
    examOmit: ['no-rash'],
    examComment: [
      ['skin-comment', 'Diffuse blanching urticarial wheals over trunk and extremities, no mucosal involvement.'],
      ['oral-comment', 'No lip, tongue, or uvular swelling.'],
      ['lungs-comment', 'No stridor or wheeze; speaking in full sentences.'],
    ],
    rosReports: ['ros-skin-rash', 'ros-skin-itching'],
    rosDenies: ['ros-respiratory-shortness-of-breath', 'ros-ent-throat-swelling', 'ros-constitutional-fever'],
    mdm: 'Acute generalized urticaria after a food trigger without angioedema, respiratory compromise, or hemodynamic instability — not anaphylaxis. Improved with antihistamine in clinic. Prescribed antihistamines and a short steroid course, counseled on allergen avoidance, given an anaphylaxis action plan and epinephrine return precautions.',
    rx: [
      ['cetirizine 10 mg tablet', 'Take 1 tablet by mouth once daily; may increase to twice daily for itching'],
      ['prednisone 20 mg tablet', 'Take 2 tablets by mouth once daily for 3 days'],
    ],
    disp: PCP(
      'Antihistamines + short steroid course for hives. Return immediately for lip/tongue swelling, trouble breathing, or fainting.',
      2
    ),
  },

  {
    key: 'migraine',
    label: 'Migraine headache',
    ageMin: 16,
    ageMax: 55,
    sex: 'any',
    weight: 5,
    reason: 'Other - severe one-sided throbbing headache with nausea and light sensitivity',
    em: EM_214,
    dx: [['G43.909', 'Migraine, unspecified, not intractable, without status migrainosus', true]],
    examComment: [
      [
        'neurologic-comment',
        'Nonfocal neurologic exam: cranial nerves intact, no pronator drift, normal gait and coordination, no meningismus.',
      ],
    ],
    rosReports: ['ros-neuro-headache', 'ros-eyes-photophobia', 'ros-gi-nausea'],
    rosDenies: ['ros-neuro-weakness', 'ros-neuro-numbness', 'ros-neuro-confusion'],
    mdm: 'Recurrent unilateral throbbing headache with photophobia and nausea, consistent with migraine; nonfocal neuro exam, no red-flag features (no thunderclap onset, fever, neck stiffness, or focal deficit). Treated with antiemetic and NSAID in clinic with relief. Triptan prescribed for future attacks; return precautions for worst-ever or focal symptoms.',
    rx: [
      [
        'sumatriptan 50 mg tablet',
        'Take 1 tablet at onset of migraine; may repeat once after 2 hours (max 200 mg/day)',
      ],
      ['ondansetron 4 mg ODT', 'Dissolve 1 tablet on the tongue every 8 hours as needed for nausea'],
    ],
    disp: PCP(
      'Migraine treatment; rest in a dark room, hydrate. Return for worst headache of life, fever with neck stiffness, weakness, or vision loss.'
    ),
  },

  {
    key: 'back-strain',
    label: 'Acute lumbar strain',
    ageMin: 20,
    ageMax: 60,
    sex: 'any',
    weight: 6,
    reason: 'Other - lower back pain after lifting, worse with movement',
    em: EM_213,
    dx: [['S39.012A', 'Strain of muscle, fascia and tendon of lower back, initial encounter', true]],
    examComment: [
      [
        'back-comment',
        'Paraspinal lumbar muscle tenderness and spasm; pain with flexion; no midline bony tenderness, no CVA tenderness.',
      ],
      [
        'neurologic-comment',
        'Straight-leg raise negative bilaterally; strength 5/5, sensation intact, reflexes symmetric; no saddle anesthesia.',
      ],
    ],
    rosReports: ['ros-msk-back-pain', 'ros-msk-muscle-aches', 'ros-msk-limited-rom'],
    rosDenies: ['ros-neuro-numbness', 'ros-neuro-weakness', 'ros-gu-incontinence'],
    mdm: 'Mechanical low back pain after lifting with paraspinal spasm and no neurologic deficit or red flags (no incontinence, saddle anesthesia, fever, or trauma). Mechanical lumbar strain. Encouraged activity as tolerated, NSAIDs and muscle relaxant; return precautions for weakness, numbness, or bowel/bladder changes.',
    rx: [
      ['ibuprofen 600 mg tablet', 'Take 1 tablet by mouth every 6 hours as needed for pain (with food)'],
      ['cyclobenzaprine 5 mg tablet', 'Take 1 tablet by mouth three times daily as needed for spasm'],
    ],
    disp: PCP(
      'Activity as tolerated, NSAIDs, muscle relaxant for back strain. Return for leg weakness, numbness, or loss of bladder/bowel control.',
      7
    ),
  },

  {
    key: 'cellulitis',
    label: 'Cellulitis of the leg',
    ageMin: 18,
    ageMax: 75,
    sex: 'any',
    weight: 5,
    reason: 'Rash or skin issue - spreading red, warm, painful area on right lower leg',
    em: EM_214,
    dx: [['L03.115', 'Cellulitis of right lower limb', true]],
    examOmit: ['no-rash'],
    examComment: [
      [
        'skin-comment',
        'Right lower leg with ~8 cm area of warmth, erythema, edema and tenderness, borders marked; no fluctuance, no crepitus, no lymphangitic streaking; no open wound.',
      ],
    ],
    rosReports: ['ros-constitutional-fever', 'ros-skin-redness', 'ros-skin-swelling'],
    rosDenies: ['ros-skin-wounds', 'ros-respiratory-shortness-of-breath'],
    mdm: 'Non-purulent cellulitis of the right lower leg without abscess, crepitus, or systemic toxicity; borders marked for tracking. Outpatient cephalexin with leg elevation; counseled on return for spreading erythema beyond the marked border, fever, or blistering.',
    rx: [['cephalexin 500 mg capsule', 'Take 1 capsule by mouth four times daily for 7 days']],
    vitals: { temp: 38, hr: 90 },
    disp: PCP(
      'Antibiotics for cellulitis; elevate the leg, mark the border. Return for spreading redness past the line, fever, or blistering.',
      2
    ),
  },

  {
    key: 'dental-abscess',
    label: 'Dental abscess',
    ageMin: 18,
    ageMax: 65,
    sex: 'any',
    weight: 4,
    reason: 'Other - severe tooth pain and gum swelling for 3 days',
    em: EM_213,
    dx: [['K04.7', 'Periapical abscess without sinus', true]],
    examComment: [
      [
        'oral-comment',
        'Tender swelling of the right lower gingiva adjacent to a carious molar with localized fluctuance; no floor-of-mouth elevation, no trismus, no airway compromise.',
      ],
    ],
    rosReports: ['ros-ent-oral-sores', 'ros-constitutional-fever'],
    rosDenies: ['ros-ent-sore-throat', 'ros-ent-difficulty-swallowing'],
    mdm: 'Localized periapical dental abscess without spreading deep-space infection, trismus, or airway concern. Prescribed antibiotics and analgesia, urged urgent dental follow-up for definitive source control; return precautions for facial swelling, difficulty swallowing/breathing, or fever.',
    rx: [
      ['amoxicillin 500 mg capsule', 'Take 1 capsule by mouth three times daily for 7 days'],
      ['ibuprofen 600 mg tablet', 'Take 1 tablet by mouth every 6 hours as needed for pain'],
    ],
    vitals: { temp: 37.8 },
    disp: {
      type: 'specialty',
      text: 'Urgent dental referral',
      note: 'Antibiotics and analgesia started; refer to dentist within 1-2 days for definitive treatment.',
      followUpIn: 1,
      followUp: [{ type: 'dentistry', note: 'Periapical abscess, needs source control' }],
    },
  },

  {
    key: 'renal-colic',
    label: 'Renal colic (kidney stone)',
    ageMin: 25,
    ageMax: 65,
    sex: 'any',
    weight: 4,
    reason: 'Abdominal (belly) pain - sudden severe right flank pain radiating to groin, nausea',
    em: EM_214,
    dx: [['N20.0', 'Calculus of kidney', true]],
    examOmit: ['nontender'],
    examComment: [
      [
        'abdomen-comment',
        'Soft, nondistended; patient writhing in discomfort, mild right-sided tenderness without rebound or guarding.',
      ],
      ['back-comment', 'Right costovertebral angle tenderness.'],
    ],
    rosReports: ['ros-gi-abdominal-pain', 'ros-gi-nausea', 'ros-gu-flank-pain', 'ros-gu-hematuria'],
    rosDenies: ['ros-constitutional-fever', 'ros-gu-dysuria'],
    mdm: 'Acute unilateral colicky flank pain radiating to the groin with microscopic hematuria, afebrile, consistent with renal colic. No fever or signs of obstructing infection. Pain controlled with ketorolac and antiemetic; counseled on strain-urine, hydration, and urgent return for fever, intractable vomiting, or single kidney.',
    rx: [
      ['ketorolac 10 mg tablet', 'Take 1 tablet by mouth every 6 hours as needed for pain for up to 5 days'],
      ['tamsulosin 0.4 mg capsule', 'Take 1 capsule by mouth once daily to aid stone passage'],
      ['ondansetron 4 mg ODT', 'Dissolve 1 tablet on the tongue every 8 hours as needed for nausea'],
    ],
    vitals: { hr: 96 },
    modules: {
      inHouseLabs: [
        {
          testName: 'Urinalysis',
          diagnoses: [{ code: 'N20.0', display: 'Calculus of kidney', isPrimary: true }],
          results: [{ analyte: 'Blood', value: 'moderate', flag: 'abnormal' }],
        },
      ],
    },
    disp: PCP(
      'Pain control + tamsulosin, strain urine, hydrate. Return for fever, uncontrolled vomiting, or worsening pain.',
      3
    ),
  },

  {
    key: 'vertigo-bppv',
    label: 'Benign positional vertigo (BPPV)',
    ageMin: 40,
    ageMax: 80,
    sex: 'any',
    weight: 3,
    reason: 'Other - brief spinning episodes triggered by head movement since this morning',
    em: EM_214,
    dx: [['H81.10', 'Benign paroxysmal vertigo, unspecified ear', true]],
    examComment: [
      [
        'neurologic-comment',
        'Positive Dix-Hallpike on the right reproducing transient rotatory nystagmus and vertigo; otherwise nonfocal — normal gait, no dysmetria, cranial nerves intact, no nystagmus at rest.',
      ],
    ],
    rosReports: ['ros-neuro-dizziness', 'ros-gi-nausea'],
    rosDenies: ['ros-neuro-headache', 'ros-neuro-weakness', 'ros-neuro-difficulty-speaking', 'ros-ent-hearing-loss'],
    mdm: 'Episodic positional vertigo with a positive Dix-Hallpike and otherwise reassuring nonfocal neuro exam — BPPV; no central features (no dysarthria, focal weakness, or persistent nystagmus). Performed Epley maneuver with improvement; meclizine for symptoms; return precautions for focal deficits, severe headache, or persistent symptoms.',
    rx: [['meclizine 25 mg tablet', 'Take 1 tablet by mouth every 6 hours as needed for vertigo']],
    disp: PCP(
      'BPPV — Epley maneuver done, meclizine PRN. Return for slurred speech, weakness, severe headache, or hearing loss.',
      5
    ),
  },

  {
    key: 'wrist-fracture',
    label: 'Distal radius fracture (FOOSH)',
    ageMin: 8,
    ageMax: 70,
    sex: 'any',
    weight: 4,
    reason: 'Injury to arm - fell on outstretched hand, wrist pain and swelling',
    em: EM_214,
    dx: [
      [
        'S52.501A',
        'Unspecified fracture of the lower end of right radius, initial encounter for closed fracture',
        true,
      ],
    ],
    examOmit: ['no-obvious-injury-or-swelling', 'moves-all-extremities-symmetrically'],
    examComment: [
      [
        'extremities-comment',
        'Right wrist swollen with dorsal tenderness over the distal radius and mild deformity; painful, limited range of motion. Radial pulse 2+, sensation intact including median nerve distribution, capillary refill brisk.',
      ],
    ],
    rosReports: ['ros-msk-joint-pain', 'ros-msk-joint-swelling', 'ros-msk-limited-rom'],
    rosDenies: ['ros-neuro-numbness', 'ros-neuro-tingling'],
    mdm: 'FOOSH mechanism with focal distal radius tenderness, swelling and deformity; radiograph confirms a distal radius fracture, neurovascularly intact without median nerve compromise. Sugar-tong splint applied; orthopedic referral; analgesia. Return precautions for numbness, increasing pain, or color change.',
    rx: [
      ['ibuprofen 600 mg tablet', 'Take 1 tablet by mouth every 6 hours as needed for pain (with food)'],
      ['acetaminophen 500 mg tablet', 'Take 2 tablets by mouth every 6 hours as needed for pain'],
    ],
    modules: {
      radiology: [
        {
          studyName: 'X-ray right wrist, 3 views',
          cptCode: '73110',
          diagnosisCode: 'S52.501A',
          stat: false,
          clinicalHistory: 'FOOSH, distal radius tenderness, deformity.',
          consentObtained: true,
        },
      ],
    },
    disp: {
      type: 'specialty',
      text: 'Orthopedic follow-up',
      note: 'Sugar-tong splint applied, neurovascularly intact. Orthopedics in 3-5 days for definitive management.',
      followUpIn: 4,
      followUp: [{ type: 'orthopedics', note: 'Distal radius fracture, splinted' }],
    },
  },

  {
    key: 'concussion',
    label: 'Concussion',
    ageMin: 12,
    ageMax: 45,
    sex: 'any',
    weight: 4,
    reason: 'Injury to head - hit head in a fall, headache and dizziness, no LOC',
    em: EM_214,
    dx: [['S06.0X0A', 'Concussion without loss of consciousness, initial encounter', true]],
    examComment: [
      ['head-comment', 'Small frontal scalp contusion without laceration or step-off; no hemotympanum or Battle sign.'],
      [
        'neurologic-comment',
        'GCS 15, oriented, cranial nerves intact, no focal deficit, normal gait; symptomatic with headache and difficulty concentrating.',
      ],
    ],
    rosReports: ['ros-neuro-headache', 'ros-neuro-dizziness', 'ros-eyes-photophobia'],
    rosDenies: ['ros-neuro-seizures', 'ros-neuro-weakness', 'ros-gi-vomiting', 'ros-neuro-confusion'],
    mdm: 'Minor closed head injury without loss of consciousness; GCS 15, nonfocal neuro exam, low-risk by clinical decision rules — no CT indicated. Concussion. Counseled on cognitive/physical rest, acetaminophen (avoid NSAIDs initially), and strict head-injury return precautions for repeated vomiting, worsening headache, confusion, or focal symptoms.',
    rx: [['acetaminophen 500 mg tablet', 'Take 2 tablets by mouth every 6 hours as needed for headache (max 3 g/day)']],
    disp: PCP(
      'Concussion — cognitive and physical rest, gradual return to activity. Return immediately for repeated vomiting, worsening headache, confusion, weakness, or seizure.',
      3
    ),
  },

  {
    key: 'dog-bite',
    label: 'Dog bite (hand)',
    ageMin: 5,
    ageMax: 70,
    sex: 'any',
    weight: 3,
    reason: 'Injury (Other) - bitten on the right hand by a dog 2 hours ago',
    em: EM_214,
    dx: [['S61.451A', 'Open bite of right hand, initial encounter', true]],
    examOmit: ['no-obvious-injury-or-swelling'],
    examComment: [
      [
        'skin-comment',
        'Two puncture wounds with surrounding erythema over the dorsal right hand; bleeding controlled, no purulence, no exposed tendon or joint involvement.',
      ],
      ['neurologic-comment', 'Intact sensation and full range of motion of all digits; distal perfusion normal.'],
    ],
    rosReports: ['ros-skin-wounds'],
    rosDenies: ['ros-neuro-numbness', 'ros-constitutional-fever'],
    mdm: 'Dog bite to the right hand with puncture wounds, irrigated and left open per bite-wound principles; neurovascularly intact, no deep structure involvement. Tetanus updated; rabies risk assessed (known, vaccinated, observable animal) — prophylaxis not indicated. Prophylactic amoxicillin-clavulanate given hand-bite risk; return precautions for spreading infection.',
    rx: [['amoxicillin-clavulanate 875-125 mg tablet', 'Take 1 tablet by mouth twice daily for 5 days']],
    modules: {
      immunizations: [
        {
          vaccineName: 'Tetanus, Diphtheria (Td)',
          dose: '0.5',
          units: 'mL',
          route: 'IM',
          location: { name: 'left deltoid', code: 'LD' },
          administered: true,
        },
      ],
    },
    disp: PCP(
      'Antibiotics for dog bite, wound left open, tetanus updated. Return for spreading redness, drainage, fever, or numbness.',
      2
    ),
  },

  {
    key: 'epistaxis',
    label: 'Epistaxis (nosebleed)',
    ageMin: 6,
    ageMax: 80,
    sex: 'any',
    weight: 3,
    reason: 'Other - recurrent right-sided nosebleeds, now controlled',
    em: EM_213,
    dx: [['R04.0', 'Epistaxis', true]],
    examComment: [
      [
        'nose-comment',
        'Anterior bleeding source at the right Kiesselbach plexus, controlled with pressure and topical vasoconstrictor; no active bleeding at discharge, no posterior bleeding.',
      ],
    ],
    rosReports: ['ros-ent-epistaxis'],
    rosDenies: ['ros-heme-easy-bruising', 'ros-constitutional-fatigue', 'ros-cardiovascular-palpitations'],
    mdm: 'Anterior epistaxis from Kiesselbach plexus controlled with direct pressure and oxymetazoline; hemodynamically stable, no posterior source or coagulopathy concern. Counseled on humidification, avoiding nose-picking and NSAIDs, and pressure technique; return precautions for uncontrolled bleeding or lightheadedness.',
    rx: [
      [
        'oxymetazoline 0.05% nasal spray',
        'Use 2 sprays in the affected nostril, then hold pressure, for recurrent bleeding (limit 3 days)',
      ],
    ],
    disp: PCP(
      'Nosebleed care — humidify, avoid nose-picking and NSAIDs, pinch nose for bleeding. Return for bleeding that won’t stop after 15 minutes of pressure or lightheadedness.',
      5
    ),
  },

  {
    key: 'minor-burn',
    label: 'Second-degree burn (forearm)',
    ageMin: 5,
    ageMax: 65,
    sex: 'any',
    weight: 3,
    reason: 'Injury (Other) - scalded right forearm with hot water, blistering',
    em: EM_214,
    dx: [['T22.211A', 'Burn of second degree of right forearm, initial encounter', true]],
    examOmit: ['no-obvious-injury-or-swelling'],
    examComment: [
      [
        'skin-comment',
        'Right volar forearm with ~3% TBSA partial-thickness burn: erythema and small blisters, brisk capillary refill, sensate; no circumferential involvement, no deep/charred areas.',
      ],
    ],
    rosReports: ['ros-skin-wounds', 'ros-skin-redness'],
    rosDenies: ['ros-constitutional-fever', 'ros-respiratory-shortness-of-breath'],
    mdm: 'Small partial-thickness (second-degree) burn of the right forearm, ~3% TBSA, not involving face/hands/genitalia or circumferential, no inhalation injury. Cleaned, deroofed loose blisters, applied topical antibiotic and non-adherent dressing; tetanus updated; analgesia and burn wound care taught; return precautions for infection.',
    rx: [
      ['silver sulfadiazine 1% cream', 'Apply a thin layer to the burn and cover with a clean dressing twice daily'],
      ['ibuprofen 600 mg tablet', 'Take 1 tablet by mouth every 6 hours as needed for pain'],
    ],
    disp: PCP(
      'Burn wound care with daily dressing changes. Return for increasing redness, pus, fever, or worsening pain.',
      2
    ),
  },

  {
    key: 'corneal-abrasion',
    label: 'Corneal abrasion',
    ageMin: 8,
    ageMax: 60,
    sex: 'any',
    weight: 4,
    reason: 'Eye concern - right eye pain and foreign-body sensation after something blew in',
    em: EM_213,
    dx: [['S05.01XA', 'Abrasion of cornea without foreign body, right eye, initial encounter', true]],
    examOmit: ['right-eye-conjunctiva-non-injected-no-discharge'],
    examComment: [
      [
        'eyes-comment',
        'Right eye: conjunctival injection with tearing; fluorescein reveals a small corneal epithelial defect without infiltrate; no foreign body under lids on eversion; visual acuity intact; pupil reactive, anterior chamber clear.',
      ],
    ],
    rosReports: ['ros-eyes-eye-pain', 'ros-eyes-redness', 'ros-eyes-photophobia'],
    rosDenies: ['ros-eyes-vision-changes'],
    mdm: 'Right corneal abrasion confirmed by fluorescein uptake, no retained foreign body or infiltrate, vision intact. Antibiotic ointment for prophylaxis, oral analgesia, avoid contact lenses and eye rubbing; ophthalmology follow-up if not improved in 24-48h; return precautions for worsening vision or pain.',
    rx: [['erythromycin 0.5% ophthalmic ointment', 'Apply a thin ribbon to the right eye four times daily for 3 days']],
    disp: PCP(
      'Corneal abrasion — antibiotic ointment, no contact lenses, do not rub the eye. Return for worsening vision, increasing pain, or pus.',
      2
    ),
  },

  {
    key: 'dehydration',
    label: 'Dehydration',
    ageMin: 2,
    ageMax: 75,
    sex: 'any',
    weight: 4,
    reason: 'Vomiting and/or diarrhea - poor intake with vomiting, lightheaded and tired',
    em: EM_214,
    dx: [['E86.0', 'Dehydration', true]],
    examComment: [
      [
        'general-comment',
        'Tired-appearing but interactive; dry mucous membranes, mild tachycardia, capillary refill ~2-3 seconds; improved after oral/IV rehydration.',
      ],
    ],
    rosReports: ['ros-constitutional-fatigue', 'ros-constitutional-poor-appetite', 'ros-gi-nausea', 'ros-gi-vomiting'],
    rosDenies: ['ros-gi-blood-in-stool', 'ros-neuro-confusion'],
    mdm: 'Mild-to-moderate dehydration from poor intake and vomiting; dry mucous membranes and mild tachycardia that improved with rehydration and an antiemetic, now tolerating oral fluids. No peritoneal signs or surgical abdomen. Discharged with antiemetic and oral rehydration guidance; return precautions for inability to keep fluids down or decreased urination.',
    rx: [['ondansetron 4 mg ODT', 'Dissolve 1 tablet on the tongue every 8 hours as needed for nausea']],
    vitals: { hr: 104 },
    disp: PCP(
      'Oral rehydration in small frequent sips, antiemetic as needed. Return for inability to keep fluids down, no urination, or confusion.',
      2
    ),
  },

  {
    key: 'costochondritis',
    label: 'Costochondritis',
    ageMin: 18,
    ageMax: 55,
    sex: 'any',
    weight: 3,
    reason: 'Breathing problem - sharp left chest pain, worse with movement and deep breath',
    em: EM_214,
    dx: [['M94.0', 'Chondrocostal junction syndrome [Tietze]', true]],
    examComment: [
      [
        'heart-comment',
        'Reproducible point tenderness over the left costochondral junctions; regular rate and rhythm, no murmur, pain not exertional.',
      ],
      ['lungs-comment', 'Clear to auscultation bilaterally, no respiratory distress.'],
    ],
    rosReports: ['ros-cardiovascular-chest-pain', 'ros-respiratory-chest-tightness'],
    rosDenies: ['ros-respiratory-shortness-of-breath', 'ros-cardiovascular-palpitations', 'ros-constitutional-fever'],
    mdm: 'Young adult with reproducible chest-wall tenderness, non-exertional pleuritic pain, normal vitals and oxygenation — costochondritis. Low-risk for ACS/PE by history and exam; ECG reassuring. Reassured, prescribed NSAIDs, and counseled on cardiac/PE return precautions (exertional pain, dyspnea, syncope).',
    rx: [['naproxen 500 mg tablet', 'Take 1 tablet by mouth twice daily with food as needed for pain']],
    disp: PCP(
      'Costochondritis — NSAIDs, warm compress, avoid aggravating activity. Return for pain with exertion, shortness of breath, sweating, or fainting.',
      5
    ),
  },

  {
    key: 'cervicitis-sti',
    label: 'Dysuria / suspected STI',
    ageMin: 18,
    ageMax: 40,
    sex: 'female',
    weight: 4,
    reason: 'Urinary problem - dysuria and vaginal discharge for several days',
    em: EM_214,
    dx: [['N89.8', 'Other specified noninflammatory disorders of vagina', true]],
    examOmit: [],
    examComment: [
      [
        'gu-female-comment',
        'External genitalia normal; mucopurulent cervical discharge with cervical friability on speculum exam; no cervical motion tenderness, no adnexal tenderness or mass.',
      ],
    ],
    rosReports: ['ros-gu-dysuria', 'ros-gu-vaginal-discharge', 'ros-gu-pelvic-pain'],
    rosDenies: ['ros-gu-flank-pain', 'ros-constitutional-fever', 'ros-gu-abnormal-vaginal-bleeding'],
    mdm: 'Dysuria with mucopurulent cervical discharge and friability suggesting cervicitis; no CMT or adnexal tenderness to suggest PID. NAAT for gonorrhea/chlamydia sent; empiric treatment per CDC guidance started. Counseled on partner treatment, abstinence until treated, and return precautions for fever or pelvic pain.',
    rx: [
      ['ceftriaxone 500 mg intramuscular', 'Single 500 mg intramuscular dose administered in clinic'],
      ['doxycycline 100 mg capsule', 'Take 1 capsule by mouth twice daily for 7 days'],
    ],
    modules: {
      inHouseLabs: [
        {
          testName: 'Urinalysis',
          diagnoses: [{ code: 'N89.8', display: 'Vaginal discharge', isPrimary: true }],
          results: [{ analyte: 'Leukocyte esterase', value: 'trace', flag: 'normal' }],
        },
      ],
    },
    disp: PCP(
      'Empiric STI treatment; partner should be treated, abstain until 7 days after treatment. Return for fever, pelvic pain, or no improvement.',
      7
    ),
  },

  {
    key: 'contact-dermatitis',
    label: 'Contact dermatitis',
    ageMin: 5,
    ageMax: 70,
    sex: 'any',
    weight: 5,
    reason: 'Rash or skin issue - itchy red rash where a new bracelet touched the skin',
    em: EM_213,
    dx: [['L25.9', 'Unspecified contact dermatitis, unspecified cause', true]],
    examOmit: ['no-rash'],
    examComment: [
      [
        'skin-comment',
        'Well-demarcated erythematous, scaly patch in the distribution of jewelry contact on the wrist; no vesicles, no secondary infection, no spreading cellulitis.',
      ],
    ],
    rosReports: ['ros-skin-rash', 'ros-skin-itching', 'ros-skin-redness'],
    rosDenies: ['ros-constitutional-fever', 'ros-skin-wounds'],
    mdm: 'Localized allergic contact dermatitis in a jewelry distribution without signs of secondary infection. Counseled on allergen avoidance; mid-potency topical steroid and oral antihistamine for itch; return precautions for spreading, weeping, or signs of infection.',
    rx: [
      ['triamcinolone 0.1% cream', 'Apply a thin layer to the affected skin twice daily for up to 2 weeks'],
      ['cetirizine 10 mg tablet', 'Take 1 tablet by mouth once daily for itching'],
    ],
    disp: PCP(
      'Avoid the trigger; topical steroid + antihistamine for contact dermatitis. Return for spreading rash, blistering, pus, or fever.',
      7
    ),
  },

  {
    key: 'plantar-fasciitis',
    label: 'Plantar fasciitis',
    ageMin: 25,
    ageMax: 65,
    sex: 'any',
    weight: 3,
    reason: 'Injury to leg - heel pain worst with first steps in the morning',
    em: EM_213,
    dx: [['M72.2', 'Plantar fascial fibromatosis', true]],
    examComment: [
      [
        'extremities-comment',
        'Point tenderness at the medial calcaneal tubercle of the right heel, worse with dorsiflexion of the toes; no swelling, deformity, or Achilles tenderness; neurovascularly intact.',
      ],
    ],
    rosReports: ['ros-msk-joint-pain', 'ros-msk-gait-difficulty'],
    rosDenies: ['ros-msk-joint-swelling', 'ros-neuro-numbness', 'ros-constitutional-fever'],
    mdm: 'Classic plantar fasciitis with medial calcaneal tenderness and first-step pain; no signs of fracture, rupture, or neuropathy. Conservative management: stretching, supportive footwear, NSAIDs; return precautions for sudden pop, numbness, or inability to bear weight.',
    rx: [['naproxen 500 mg tablet', 'Take 1 tablet by mouth twice daily with food as needed for pain']],
    disp: PCP(
      'Plantar fasciitis — calf/plantar stretches, supportive shoes, NSAIDs. Return for sudden pop, numbness, or inability to walk.',
      14
    ),
  },

  {
    key: 'impetigo',
    label: 'Impetigo (pediatric)',
    ageMin: 2,
    ageMax: 12,
    sex: 'any',
    weight: 5,
    reason: 'Rash or skin issue - crusty sores around the nose and mouth, spreading',
    em: EM_213,
    dx: [['L01.00', 'Impetigo, unspecified', true]],
    examOmit: ['no-rash'],
    examComment: [
      [
        'skin-comment',
        'Clusters of honey-crusted erosions around the nares and perioral region with surrounding erythema; no deep ulceration, no surrounding cellulitis or systemic signs.',
      ],
    ],
    rosReports: ['ros-skin-rash', 'ros-skin-wounds'],
    rosDenies: ['ros-constitutional-fever', 'ros-skin-swelling'],
    mdm: 'Localized non-bullous impetigo with classic honey-colored crusting and no surrounding cellulitis or systemic illness. Topical mupirocin prescribed with hygiene counseling (handwashing, no sharing towels, keep area clean); may return to school 24h after starting treatment; return precautions for spreading or fever.',
    rx: [
      [
        'mupirocin 2% ointment',
        'Apply to the affected areas three times daily for 5 days after gently removing crusts',
      ],
    ],
    disp: PCP(
      'Topical antibiotic for impetigo, good hand hygiene, avoid sharing towels. Return for spreading sores, swelling, or fever.',
      5
    ),
  },
];

// ── Generate ─────────────────────────────────────────────────────────────────
const registry: string[] = [];
for (const s of SPECS) {
  const scenario = buildScenario(s);
  const file = `gen-${s.key}.json`;
  writeFileSync(resolve(EXAMPLES, file), JSON.stringify(scenario, null, 2));
  registry.push(
    `  { key: '${s.key}', file: '${file}', label: '${s.label.replace(/'/g, "\\'")}', ageMin: ${s.ageMin}, ageMax: ${
      s.ageMax
    }, sex: '${s.sex}', weight: ${s.weight} },`
  );
}
console.log(`Wrote ${SPECS.length} scenario files to ${EXAMPLES}/gen-*.json\n`);
console.log('Registry entries for archetypes.ts ARCHETYPES[]:');
console.log(registry.join('\n'));
