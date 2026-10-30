import { MedicationIngredient, MedicationProductDetails } from 'utils/lib/types/api/erx-search.types';

/** The structured details the medication search gives each test product, by its NDC: RxNorm's dose form and
 * ingredients, as RxNav reports them for the product's RxCUI (combinations in the search's order, amoxicillin
 * first). */

const ingredient = (name: string, amount: number, perUnit: string, unit = 'MG'): MedicationIngredient => ({
  name,
  amount,
  unit,
  per: 1,
  perUnit,
});

export const ERX_PRODUCT_DETAILS: Record<string, MedicationProductDetails> = {
  // amoxicillin 50 MG/ML Oral Suspension (250 mg/5 mL)
  '00093415573': {
    rxcui: '239191',
    doseForm: 'Oral Suspension',
    ingredients: [ingredient('amoxicillin', 50, 'ML')],
  },
  // amoxicillin 80 MG/ML Oral Suspension (400 mg/5 mL)
  '00093416173': {
    rxcui: '308189',
    doseForm: 'Oral Suspension',
    ingredients: [ingredient('amoxicillin', 80, 'ML')],
  },
  '00093310701': { rxcui: '308182', doseForm: 'Oral Capsule', ingredients: [ingredient('amoxicillin', 250, 'EACH')] },
  '00093310901': { rxcui: '308191', doseForm: 'Oral Capsule', ingredients: [ingredient('amoxicillin', 500, 'EACH')] },
  '00093226301': { rxcui: '308192', doseForm: 'Oral Tablet', ingredients: [ingredient('amoxicillin', 500, 'EACH')] },
  '00093226401': { rxcui: '308194', doseForm: 'Oral Tablet', ingredients: [ingredient('amoxicillin', 875, 'EACH')] },
  // amoxicillin 80 MG/ML / clavulanate 11.4 MG/ML Oral Suspension (400-57 mg/5 mL)
  '00093227573': {
    rxcui: '617430',
    doseForm: 'Oral Suspension',
    ingredients: [ingredient('amoxicillin', 80, 'ML'), ingredient('clavulanate', 11.4, 'ML')],
  },
  // amoxicillin 120 MG/ML / clavulanate 8.58 MG/ML Oral Suspension (600-42.9 mg/5 mL)
  '00093227873': {
    rxcui: '618028',
    doseForm: 'Oral Suspension',
    ingredients: [ingredient('amoxicillin', 120, 'ML'), ingredient('clavulanate', 8.58, 'ML')],
  },
  '00093117401': { rxcui: '834102', doseForm: 'Oral Tablet', ingredients: [ingredient('penicillin V', 500, 'EACH')] },
  // ibuprofen 20 MG/ML Oral Suspension (100 mg/5 mL)
  '00904585354': { rxcui: '197803', doseForm: 'Oral Suspension', ingredients: [ingredient('ibuprofen', 20, 'ML')] },
  '00054074287': {
    rxcui: '2123111',
    doseForm: 'Metered Dose Inhaler',
    ingredients: [ingredient('albuterol', 0.09, 'ACTUAT')],
  },
  '59310057922': {
    rxcui: '745752',
    doseForm: 'Metered Dose Inhaler',
    ingredients: [ingredient('albuterol', 0.09, 'ACTUAT')],
  },
  '00487950101': {
    rxcui: '630208',
    doseForm: 'Inhalation Solution',
    ingredients: [ingredient('albuterol', 0.83, 'ML')],
  },
  // mupirocin 0.02 MG/MG Topical Ointment (2%)
  '00093101042': { rxcui: '106346', doseForm: 'Topical Ointment', ingredients: [ingredient('mupirocin', 0.02, 'MG')] },
  '49502010202': { rxcui: '1870207', doseForm: 'Auto-Injector', ingredients: [ingredient('epinephrine', 1, 'ML')] },
};

/** A strength (by its first NDC) or product (by its NDC) with the details the search gives it. */
export const detailed = <T extends { ndc?: string; ndcs?: string[] }>(item: T): T & MedicationProductDetails => ({
  ...item,
  ...ERX_PRODUCT_DETAILS[item.ndc ?? item.ndcs?.[0] ?? ''],
});
