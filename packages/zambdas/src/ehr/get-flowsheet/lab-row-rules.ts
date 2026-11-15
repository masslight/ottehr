// What each lab row measures, in LOINC terms. A result belongs on a row when its LOINC code has one of the row's
// components in one of its specimens, in any unit, property or (unless narrowed) method. The code lists themselves
// are generated from these rules into lab-loinc-codes.generated.ts by src/scripts/generate-flowsheet-loinc-codes.ts.

export interface LabRowRule {
  /**
   * The component as LOINC's long common name spells it (e.g. 'Thyroxine (T4) free', 'MCV'), which can differ from
   * the formal COMPONENT field ('Thyroxine.free').
   */
  components: string[];
  /** LOINC SYSTEM (specimen) names as the long common name spells them ('' when it names none, as for MCH). */
  systems: string[];
  /** Keep only codes with one of these bracketed LOINC properties ('Sedimentation Rate'); any property when absent. */
  properties?: string[];
  /** Leave out codes with one of these properties: a yes/no ('Presence') code on a numeric row. */
  excludeProperties?: string[];
  /** Keep only codes with one of these LOINC METHOD_TYP values ('' = no method); any method when absent. */
  methods?: string[];
  excludeMethods?: string[];
}

const SERUM_OR_PLASMA = ['Serum or Plasma', 'Serum', 'Plasma'];
const BLOOD = ['Blood'];
const RED_BLOOD_CELLS = ['Red Blood Cells'];
const URINE = ['Urine'];
// A point-of-care (fingerstick) sample, or a venous one drawn into a CBC tube.
const BLOOD_ANY = [...BLOOD, 'Capillary blood', 'Venous blood'];
/** A yes/no code, left off numeric rows. */
const PRESENCE = ['Presence'];
// A viral load's log-scale result repeats its count.
const LOG_COUNT = ['Log #/volume', 'log units/volume'];
// Where a chlamydia or gonorrhea swab or urine sample is taken for an STI test (not the eye or nasopharynx of a newborn).
const STI_SITES = [
  'Specimen',
  'Urine',
  'Cervix',
  'Cervical mucus',
  'Vaginal fluid',
  'Urethra',
  'Genital specimen',
  'Genital fluid',
  'Semen',
  'Anal',
  'Anorectal',
  'Throat',
  'Mouth',
];
const CERVICAL = ['Cervix', 'Specimen', 'Genital specimen', 'Vaginal fluid'];
// eGFR codes name their specimen either way.
const EGFR_SYSTEMS = ['Serum, Plasma or Blood', 'Serum or Plasma'];
const EGFR_2021_METHODS = [
  'Creatinine-based formula (CKD-EPI 2021)/1.73 sq M',
  'Creatinine and Cystatin C-based formula (CKD-EPI 2021)/1.73 sq M',
];
// Race-based equations are never shown (see the Lab results eGFR row).
const EGFR_RACE_METHODS = [
  'Creatinine-based formula (MDRD)/1.73 sq M among black population',
  'Creatinine-based formula (MDRD)/1.73 sq M among non black population',
  'Creatinine-based formula (CKD-EPI)/1.73 sq M among black population',
  'Creatinine-based formula (CKD-EPI)/1.73 sq M among non black population',
];
// A newborn's bilirubin is often run on a heel-stick (whole, capillary or venous blood) sample; a cord blood level
// is taken at delivery and stays off.
const SERUM_PLASMA_OR_BLOOD = [...SERUM_OR_PLASMA, 'Blood', 'Capillary blood', 'Venous blood'];

export const LAB_ROW_RULES: Record<string, LabRowRule> = {
  // Thyroid
  tsh: { components: ['Thyrotropin'], systems: SERUM_OR_PLASMA },
  freeT4: { components: ['Thyroxine (T4) free'], systems: SERUM_OR_PLASMA },
  totalT4: { components: ['Thyroxine (T4)'], systems: SERUM_OR_PLASMA },
  freeT3: { components: ['Triiodothyronine (T3) Free'], systems: SERUM_OR_PLASMA },
  totalT3: { components: ['Triiodothyronine (T3)'], systems: SERUM_OR_PLASMA },
  tpoAntibodies: { components: ['Thyroperoxidase Ab'], systems: SERUM_OR_PLASMA },
  // Newborn bilirubin. The total row also carries the CMP total bilirubin row's serum codes. "Direct" is the
  // glucuronidated plus albumin-bound fraction and "conjugated" the glucuronidated one.
  newbornTotalBilirubin: { components: ['Bilirubin.total'], systems: SERUM_PLASMA_OR_BLOOD },
  newbornDirectBilirubin: {
    components: ['Bilirubin.direct', 'Bilirubin.conjugated'],
    systems: SERUM_PLASMA_OR_BLOOD,
    excludeProperties: PRESENCE,
  },
  transcutaneousBilirubin: { components: ['Bilirubin'], systems: ['Skin'] },
  // Lab results: CBC
  hemoglobin: { components: ['Hemoglobin'], systems: BLOOD_ANY, excludeProperties: PRESENCE },
  hematocrit: { components: ['Hematocrit'], systems: BLOOD },
  mcv: { components: ['MCV'], systems: RED_BLOOD_CELLS },
  mch: { components: ['MCH'], systems: [''] },
  mchc: { components: ['MCHC'], systems: RED_BLOOD_CELLS },
  rbc: { components: ['Erythrocytes'], systems: BLOOD },
  wbc: { components: ['Leukocytes'], systems: BLOOD },
  platelets: { components: ['Platelets'], systems: BLOOD, excludeProperties: PRESENCE },
  // LOINC names RDW "Erythrocyte [DistWidth] in Blood"; ESR shares the component.
  rdw: { components: ['Erythrocyte'], properties: ['DistWidth'], systems: BLOOD },
  neutrophilsPercent: { components: ['Neutrophils/Leukocytes'], systems: BLOOD },
  lymphocytesPercent: { components: ['Lymphocytes/Leukocytes'], systems: BLOOD },
  monocytesPercent: { components: ['Monocytes/Leukocytes'], systems: BLOOD },
  eosinophilsPercent: { components: ['Eosinophils/Leukocytes'], systems: BLOOD },
  basophilsPercent: { components: ['Basophils/Leukocytes'], systems: BLOOD },
  neutrophilsAbsolute: { components: ['Neutrophils'], systems: BLOOD },
  lymphocytesAbsolute: { components: ['Lymphocytes'], systems: BLOOD },
  monocytesAbsolute: { components: ['Monocytes'], systems: BLOOD },
  eosinophilsAbsolute: { components: ['Eosinophils'], systems: BLOOD, excludeProperties: PRESENCE },
  basophilsAbsolute: { components: ['Basophils'], systems: BLOOD },
  // Lab results: CMP/BMP. A fasting glucose code puts the result on the Glucose row marked "fasting".
  glucose: { components: ['Glucose'], systems: SERUM_OR_PLASMA },
  fastingGlucose: { components: ['Fasting glucose'], systems: SERUM_OR_PLASMA },
  bun: { components: ['Urea nitrogen'], systems: SERUM_OR_PLASMA },
  creatinine: { components: ['Creatinine'], systems: SERUM_OR_PLASMA },
  egfr2021: { components: ['Glomerular filtration rate'], systems: EGFR_SYSTEMS, methods: EGFR_2021_METHODS },
  egfr: {
    components: ['Glomerular filtration rate'],
    systems: EGFR_SYSTEMS,
    excludeMethods: [...EGFR_2021_METHODS, ...EGFR_RACE_METHODS],
  },
  bunCreatinineRatio: { components: ['Urea nitrogen/Creatinine'], systems: SERUM_OR_PLASMA },
  sodium: { components: ['Sodium'], systems: SERUM_OR_PLASMA },
  potassium: { components: ['Potassium'], systems: SERUM_OR_PLASMA },
  chloride: { components: ['Chloride'], systems: SERUM_OR_PLASMA },
  bicarbonate: { components: ['Carbon dioxide, total'], systems: SERUM_OR_PLASMA },
  calcium: { components: ['Calcium'], systems: SERUM_OR_PLASMA },
  anionGap: { components: ['Anion gap'], systems: [...SERUM_OR_PLASMA, 'Serum, Plasma or Blood'] },
  // Lab results: CMP
  totalProtein: { components: ['Protein'], systems: SERUM_OR_PLASMA },
  albumin: { components: ['Albumin'], systems: SERUM_OR_PLASMA, excludeProperties: PRESENCE },
  globulin: { components: ['Globulin'], systems: SERUM_OR_PLASMA },
  albuminGlobulinRatio: { components: ['Albumin/Globulin'], systems: SERUM_OR_PLASMA },
  totalBilirubin: { components: ['Bilirubin.total'], systems: SERUM_OR_PLASMA },
  alkalinePhosphatase: { components: ['Alkaline phosphatase'], systems: SERUM_OR_PLASMA },
  ast: { components: ['Aspartate aminotransferase'], systems: SERUM_OR_PLASMA, excludeProperties: PRESENCE },
  alt: { components: ['Alanine aminotransferase'], systems: SERUM_OR_PLASMA },
  // Lab results: lipid panel
  totalCholesterol: { components: ['Cholesterol'], systems: SERUM_OR_PLASMA },
  ldlCholesterol: { components: ['Cholesterol in LDL'], systems: SERUM_OR_PLASMA },
  hdlCholesterol: { components: ['Cholesterol in HDL'], systems: SERUM_OR_PLASMA, excludeProperties: PRESENCE },
  triglycerides: { components: ['Triglyceride'], systems: SERUM_OR_PLASMA, excludeProperties: PRESENCE },
  nonHdlCholesterol: { components: ['Cholesterol non HDL'], systems: SERUM_OR_PLASMA },
  // Lab results: iron panel
  iron: { components: ['Iron'], systems: SERUM_OR_PLASMA, excludeProperties: PRESENCE },
  tibc: { components: ['Iron binding capacity'], systems: SERUM_OR_PLASMA },
  transferrinSaturation: { components: ['Iron saturation'], systems: SERUM_OR_PLASMA },
  ferritin: { components: ['Ferritin'], systems: SERUM_OR_PLASMA },
  // Lab results: coagulation. The tissue factor method leaves out mixing studies and factor substitutions.
  pt: {
    components: ['Prothrombin time (PT)'],
    systems: ['', 'Blood', 'Capillary blood', 'Platelet poor plasma'],
    methods: ['Coag.tissue factor induced'],
  },
  inr: {
    components: ['INR'],
    systems: ['Blood', 'Capillary blood', 'Platelet poor plasma', 'Platelet poor plasma or blood'],
    methods: ['Coag.tissue factor induced.INR'],
  },
  // Lab results: hepatitis. Core antibody is the total; its IgM is another component.
  hepatitisBSurfaceAntigen: {
    components: ['Hepatitis B virus surface Ag'],
    systems: [...SERUM_OR_PLASMA, 'Serum, Plasma or Blood'],
  },
  hepatitisBSurfaceAntibody: {
    components: ['Hepatitis B virus surface Ab'],
    systems: [...SERUM_OR_PLASMA, 'Serum, Plasma or Blood'],
  },
  hepatitisBCoreAntibody: {
    components: ['Hepatitis B virus core Ab'],
    systems: [...SERUM_OR_PLASMA, 'Serum, Plasma or Blood'],
  },
  // 'Serum, Plasma or Blood' is the rapid (point-of-care) test's.
  hepatitisCAntibody: {
    components: ['Hepatitis C virus Ab', 'Hepatitis C virus IgG Ab'],
    systems: [...SERUM_OR_PLASMA, 'Serum, Plasma or Blood'],
  },
  hepatitisCRna: {
    components: ['Hepatitis C virus RNA'],
    systems: [...SERUM_OR_PLASMA, 'Blood'],
    excludeProperties: LOG_COUNT,
  },
  // Lab results: HIV and STI
  // The antigen/antibody screen, or an antibody-only screen such as a rapid (point-of-care) test; an immunoblot is a
  // confirmation, not a screen.
  hivAgAb: {
    components: ['HIV 1+2 Ab+HIV1 p24 Ag', 'HIV 1+2 Ab and HIV1 p24 Ag', 'HIV 1+2 Ab', 'HIV 1+2 IgG Ab'],
    systems: [...SERUM_OR_PLASMA, 'Serum, Plasma or Blood', 'Blood'],
    excludeMethods: ['IB'],
  },
  hiv1Rna: { components: ['HIV 1 RNA'], systems: [...SERUM_OR_PLASMA, 'Blood'], excludeProperties: LOG_COUNT },
  chlamydia: {
    components: ['Chlamydia trachomatis rRNA', 'Chlamydia trachomatis DNA'],
    systems: STI_SITES,
    properties: PRESENCE,
  },
  gonorrhea: {
    components: ['Neisseria gonorrhoeae rRNA', 'Neisseria gonorrhoeae DNA'],
    systems: STI_SITES,
    properties: PRESENCE,
  },
  // Reagin is the nontreponemal antibody; VDRL measures it too, but the row is the RPR.
  syphilisRpr: { components: ['Reagin Ab'], systems: SERUM_OR_PLASMA, methods: ['RPR', ''] },
  syphilisTreponemalAntibody: {
    components: ['Treponema pallidum Ab', 'Treponema pallidum IgG+IgM Ab', 'Treponema pallidum IgG Ab'],
    systems: [...SERUM_OR_PLASMA, 'Serum, Plasma or Blood'],
  },
  // The pooled high-risk types the cervical screening tests report (not 16 or 18 alone, nor the low-risk types).
  hpvHighRisk: {
    components: [
      'Human papilloma virus 16+18+31+33+35+39+45+51+52+56+58+59+68 DNA',
      'Human papilloma virus 16+18+31+33+35+39+45+51+52+56+58+59+66+68 DNA',
      'Human papilloma virus 16+18+31+33+35+45+51+52+56 DNA',
      'Human papilloma virus 31+33+35+39+45+51+52+56+58+59+66+68 DNA',
      'Human papilloma virus E6+E7 mRNA',
    ],
    systems: CERVICAL,
    properties: PRESENCE,
  },
  // The genotyping tests' own HPV 16 and HPV 18 (with 18/45) results; a pooled 16/18 result is on neither row.
  hpv16: {
    components: [
      'Human papilloma virus 16 DNA',
      'Human papilloma virus 16 mRNA',
      'Human papilloma virus 16 E6+E7 mRNA',
    ],
    systems: CERVICAL,
    properties: PRESENCE,
  },
  hpv18: {
    components: [
      'Human papilloma virus 18 DNA',
      'Human papilloma virus 18+45 mRNA',
      'Human papilloma virus 18+45 E6+E7 mRNA',
    ],
    systems: CERVICAL,
    properties: PRESENCE,
  },
  // Lab results: standalone tests
  hba1c: { components: ['Hemoglobin A1c/Hemoglobin.total'], systems: BLOOD },
  // A meter reading on a fingerstick, kept apart from the lab's serum or plasma glucose.
  fingerstickGlucose: { components: ['Glucose'], systems: ['Blood', 'Capillary blood'], excludeProperties: PRESENCE },
  vitaminD: {
    components: ['25-Hydroxyvitamin D3+25-Hydroxyvitamin D2', '25-hydroxyvitamin D3'],
    systems: SERUM_OR_PLASMA,
  },
  vitaminB12: { components: ['Cobalamin (Vitamin B12)'], systems: SERUM_OR_PLASMA },
  urineAlbuminCreatinineRatio: { components: ['Albumin/Creatinine', 'Microalbumin/Creatinine'], systems: URINE },
  psa: { components: ['Prostate specific Ag'], systems: SERUM_OR_PLASMA },
  magnesium: { components: ['Magnesium'], systems: SERUM_OR_PLASMA },
  crp: {
    components: ['C reactive protein'],
    systems: SERUM_OR_PLASMA,
    excludeMethods: ['High sensitivity'],
    excludeProperties: PRESENCE,
  },
  hsCrp: { components: ['C reactive protein'], systems: SERUM_OR_PLASMA, methods: ['High sensitivity'] },
  // The culture itself (630-4), as the report's or a result's code; organisms carry lab-local codes.
  urineCulture: { components: ['Bacteria identified'], systems: URINE, methods: ['Culture'] },
  // LOINC names ESR "Erythrocyte [Sedimentation Rate] in Blood"; RDW and morphology share the component.
  esr: { components: ['Erythrocyte'], properties: ['Sedimentation Rate'], systems: BLOOD },
  uricAcid: { components: ['Urate'], systems: SERUM_OR_PLASMA },
  folate: { components: ['Folate'], systems: SERUM_OR_PLASMA },
  testosterone: { components: ['Testosterone'], systems: SERUM_OR_PLASMA },
  urineHcg: { components: ['Choriogonadotropin', 'Choriogonadotropin.beta subunit'], systems: URINE },
  pth: { components: ['Parathyrin.intact'], systems: SERUM_OR_PLASMA },
  phosphorus: { components: ['Phosphate'], systems: SERUM_OR_PLASMA },
  // Every age, serum or plasma: a newborn's heel-stick result stays on Newborn bilirubin.
  directBilirubin: {
    components: ['Bilirubin.direct', 'Bilirubin.conjugated'],
    systems: SERUM_OR_PLASMA,
    excludeProperties: PRESENCE,
  },
  // A rule per specimen, so the row can show a capillary (fingerstick) screen apart from a venous level.
  lead: { components: ['Lead'], systems: BLOOD, excludeProperties: PRESENCE },
  leadCapillary: { components: ['Lead'], systems: ['Capillary blood'], excludeProperties: PRESENCE },
  leadVenous: { components: ['Lead'], systems: ['Venous blood'], excludeProperties: PRESENCE },
  // The test's interpretation ("Negative"), not its tubes' numbers; LOINC names one code's system "Blood Qualitative".
  igra: {
    components: [
      'Mycobacterium tuberculosis stimulated gamma interferon',
      'Mycobacterium tuberculosis tuberculin stimulated gamma interferon',
    ],
    systems: ['Blood', 'Blood Qualitative'],
    properties: ['Presence', 'Interpretation'],
  },
  // Immunoassay only: a guaiac test is another test.
  fit: {
    components: ['Hemoglobin'],
    systems: ['Stool from gastrointestinal lower', 'Stool from gastrointestinal'],
    methods: ['IA', 'IA.rapid'],
  },
  lipoproteinA: { components: ['Lipoprotein a'], systems: SERUM_OR_PLASMA },
  apoB: { components: ['Apolipoprotein B'], systems: SERUM_OR_PLASMA },
  ntProBnp: {
    components: ['Natriuretic peptide.B prohormone N-Terminal'],
    systems: [...SERUM_OR_PLASMA, 'Serum, Plasma or Blood', 'Blood'],
  },
  bnp: { components: ['Natriuretic peptide B'], systems: [...SERUM_OR_PLASMA, 'Blood'] },
  cystatinC: { components: ['Cystatin C'], systems: SERUM_OR_PLASMA },
  ck: { components: ['Creatine kinase'], systems: SERUM_OR_PLASMA },
  // A number: the yes/no pregnancy test and the multiple-of-the-median screening results are left out.
  serumHcg: {
    components: [
      'Choriogonadotropin',
      'Choriogonadotropin.beta subunit',
      'Choriogonadotropin.intact',
      'Choriogonadotropin.intact+Beta subunit',
    ],
    systems: SERUM_OR_PLASMA,
    properties: ['Units/volume', 'Moles/volume', 'Mass/volume', 'Measurement'],
  },
  ttgIga: { components: ['Tissue transglutaminase IgA Ab'], systems: SERUM_OR_PLASMA, excludeProperties: PRESENCE },
  // Lab results: urinalysis components
  uaColor: { components: ['Color'], systems: URINE },
  uaAppearance: { components: ['Appearance', 'Clarity'], systems: URINE },
  uaSpecificGravity: { components: ['Specific gravity'], systems: URINE },
  uaPh: { components: ['pH'], systems: URINE },
  uaProtein: { components: ['Protein'], systems: URINE },
  uaGlucose: { components: ['Glucose'], systems: URINE },
  uaKetones: { components: ['Ketones'], systems: URINE },
  uaBilirubin: { components: ['Bilirubin.total', 'Bilirubin'], systems: URINE },
  uaBlood: { components: ['Hemoglobin'], systems: URINE },
  uaNitrite: { components: ['Nitrite'], systems: URINE },
  uaLeukocyteEsterase: { components: ['Leukocyte esterase'], systems: URINE },
  uaUrobilinogen: { components: ['Urobilinogen'], systems: URINE },
};
