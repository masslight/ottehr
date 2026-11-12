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
  /** Keep only codes with one of these LOINC METHOD_TYP values ('' = no method); any method when absent. */
  methods?: string[];
  excludeMethods?: string[];
}

const SERUM_OR_PLASMA = ['Serum or Plasma', 'Serum', 'Plasma'];
const BLOOD = ['Blood'];
const RED_BLOOD_CELLS = ['Red Blood Cells'];
const URINE = ['Urine'];
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

export const LAB_ROW_RULES: Record<string, LabRowRule> = {
  // Thyroid
  tsh: { components: ['Thyrotropin'], systems: SERUM_OR_PLASMA },
  freeT4: { components: ['Thyroxine (T4) free'], systems: SERUM_OR_PLASMA },
  totalT4: { components: ['Thyroxine (T4)'], systems: SERUM_OR_PLASMA },
  freeT3: { components: ['Triiodothyronine (T3) Free'], systems: SERUM_OR_PLASMA },
  totalT3: { components: ['Triiodothyronine (T3)'], systems: SERUM_OR_PLASMA },
  tpoAntibodies: { components: ['Thyroperoxidase Ab'], systems: SERUM_OR_PLASMA },
  // Newborn bilirubin (total bilirubin is also the CMP row). "Direct" is the glucuronidated plus albumin-bound
  // fraction and "conjugated" the glucuronidated one.
  totalBilirubin: { components: ['Bilirubin.total'], systems: SERUM_OR_PLASMA },
  directBilirubin: { components: ['Bilirubin.direct', 'Bilirubin.conjugated'], systems: SERUM_OR_PLASMA },
  transcutaneousBilirubin: { components: ['Bilirubin'], systems: ['Skin'] },
  // Lab results: CBC
  hemoglobin: { components: ['Hemoglobin'], systems: BLOOD },
  hematocrit: { components: ['Hematocrit'], systems: BLOOD },
  mcv: { components: ['MCV'], systems: RED_BLOOD_CELLS },
  mch: { components: ['MCH'], systems: [''] },
  mchc: { components: ['MCHC'], systems: RED_BLOOD_CELLS },
  rbc: { components: ['Erythrocytes'], systems: BLOOD },
  wbc: { components: ['Leukocytes'], systems: BLOOD },
  platelets: { components: ['Platelets'], systems: BLOOD },
  neutrophilsPercent: { components: ['Neutrophils/Leukocytes'], systems: BLOOD },
  lymphocytesPercent: { components: ['Lymphocytes/Leukocytes'], systems: BLOOD },
  monocytesPercent: { components: ['Monocytes/Leukocytes'], systems: BLOOD },
  eosinophilsPercent: { components: ['Eosinophils/Leukocytes'], systems: BLOOD },
  basophilsPercent: { components: ['Basophils/Leukocytes'], systems: BLOOD },
  neutrophilsAbsolute: { components: ['Neutrophils'], systems: BLOOD },
  lymphocytesAbsolute: { components: ['Lymphocytes'], systems: BLOOD },
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
  // Lab results: CMP
  totalProtein: { components: ['Protein'], systems: SERUM_OR_PLASMA },
  albumin: { components: ['Albumin'], systems: SERUM_OR_PLASMA },
  globulin: { components: ['Globulin'], systems: SERUM_OR_PLASMA },
  albuminGlobulinRatio: { components: ['Albumin/Globulin'], systems: SERUM_OR_PLASMA },
  alkalinePhosphatase: { components: ['Alkaline phosphatase'], systems: SERUM_OR_PLASMA },
  ast: { components: ['Aspartate aminotransferase'], systems: SERUM_OR_PLASMA },
  alt: { components: ['Alanine aminotransferase'], systems: SERUM_OR_PLASMA },
  // Lab results: lipid panel
  totalCholesterol: { components: ['Cholesterol'], systems: SERUM_OR_PLASMA },
  ldlCholesterol: { components: ['Cholesterol in LDL'], systems: SERUM_OR_PLASMA },
  hdlCholesterol: { components: ['Cholesterol in HDL'], systems: SERUM_OR_PLASMA },
  triglycerides: { components: ['Triglyceride'], systems: SERUM_OR_PLASMA },
  nonHdlCholesterol: { components: ['Cholesterol non HDL'], systems: SERUM_OR_PLASMA },
  // Lab results: iron panel
  iron: { components: ['Iron'], systems: SERUM_OR_PLASMA },
  tibc: { components: ['Iron binding capacity'], systems: SERUM_OR_PLASMA },
  transferrinSaturation: { components: ['Iron saturation'], systems: SERUM_OR_PLASMA },
  ferritin: { components: ['Ferritin'], systems: SERUM_OR_PLASMA },
  // Lab results: standalone tests
  hba1c: { components: ['Hemoglobin A1c/Hemoglobin.total'], systems: BLOOD },
  vitaminD: {
    components: ['25-Hydroxyvitamin D3+25-Hydroxyvitamin D2', '25-hydroxyvitamin D3'],
    systems: SERUM_OR_PLASMA,
  },
  vitaminB12: { components: ['Cobalamin (Vitamin B12)'], systems: SERUM_OR_PLASMA },
  urineAlbuminCreatinineRatio: { components: ['Albumin/Creatinine', 'Microalbumin/Creatinine'], systems: URINE },
  psa: { components: ['Prostate specific Ag'], systems: SERUM_OR_PLASMA },
  magnesium: { components: ['Magnesium'], systems: SERUM_OR_PLASMA },
  crp: { components: ['C reactive protein'], systems: SERUM_OR_PLASMA, excludeMethods: ['High sensitivity'] },
  hsCrp: { components: ['C reactive protein'], systems: SERUM_OR_PLASMA, methods: ['High sensitivity'] },
  // The culture itself (630-4), as the report's or a result's code; organisms carry lab-local codes.
  urineCulture: { components: ['Bacteria identified'], systems: URINE, methods: ['Culture'] },
  hivAgAb: { components: ['HIV 1+2 Ab+HIV1 p24 Ag', 'HIV 1+2 Ab and HIV1 p24 Ag'], systems: SERUM_OR_PLASMA },
  hepatitisCAntibody: { components: ['Hepatitis C virus Ab'], systems: SERUM_OR_PLASMA },
  // LOINC names ESR "Erythrocyte [Sedimentation Rate] in Blood"; RDW and morphology share the component.
  esr: { components: ['Erythrocyte'], properties: ['Sedimentation Rate'], systems: BLOOD },
  uricAcid: { components: ['Urate'], systems: SERUM_OR_PLASMA },
  folate: { components: ['Folate'], systems: SERUM_OR_PLASMA },
  testosterone: { components: ['Testosterone'], systems: SERUM_OR_PLASMA },
  urineHcg: { components: ['Choriogonadotropin', 'Choriogonadotropin.beta subunit'], systems: URINE },
  pth: { components: ['Parathyrin.intact'], systems: SERUM_OR_PLASMA },
  phosphorus: { components: ['Phosphate'], systems: SERUM_OR_PLASMA },
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
