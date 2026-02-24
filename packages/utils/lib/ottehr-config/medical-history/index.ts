import { MEDICAL_HISTORY_OVERRIDES } from '../../../ottehr-config-overrides';
import { mergeAndFreezeConfigObjects } from '../helpers';
import { MedicalHistoryConfig, validateMedicalHistoryConfig } from './medical-history.schema';

const MEDICAL_HISTORY_DEFAULTS = {
  medicalConditions: {
    favorites: [
      {
        display: 'Arthritis',
      },
      {
        display: 'Blood Disorder',
      },
      {
        display: 'Cancer',
      },
      {
        display: 'Diabetes',
      },
      {
        display: 'Gastrointestinal',
      },
      {
        display: 'Genitourinary',
      },
      {
        display: 'Heart Disorders',
      },
      {
        display: 'High Blood Pressure',
      },
      {
        display: 'High Cholesterol',
      },
      {
        display: 'Kidney Disorders',
      },
      {
        display: 'Live Disorders, Hepatitis',
      },
      {
        display: 'Lung Disorders',
      },
      {
        display: 'Musculokskeletal Diseases',
      },
      {
        display: 'Neurological',
      },
      {
        display: 'Psychiatric',
      },
      {
        display: 'Sexually Transmitted Diseases',
      },
      {
        display: 'Skin Disorders',
      },
      {
        display: 'Thyroid',
      },
      {
        display: 'Diabetes type 2',
        code: 'E11.9',
      },
      {
        display: 'Diabetes Type 1',
        code: 'E10.9',
      },
      {
        display: 'High Blood pressure',
        code: 'i10',
      },
      {
        display: 'Heart Disease',
        code: 'I51.9',
      },
      {
        display: 'Elevated Cholesterol',
        code: 'E78.5',
      },
      {
        display: 'Asthma',
        code: 'J45.909',
      },
      {
        display: 'COPD',
        code: 'J44.9',
      },
      {
        display: 'Back Pain',
        code: 'M54.50',
      },
      {
        display: 'HypoThyroid',
        code: 'E03.9',
      },
      {
        display: 'Gout',
        code: 'M10.9',
      },
      {
        display: 'Arthritis',
        code: 'M19.90',
      },
    ],
  },
  allergies: {
    favorites: [
      {
        name: 'Amoxicillin',
      },
      {
        name: 'Augmentin',
      },
      {
        name: 'Azithromycin',
      },
      {
        name: 'Sulfa/Bactrim',
      },
      {
        name: 'Codeine',
      },
      {
        name: 'Nsaids',
      },
      {
        name: 'Tylenol',
      },
      {
        name: 'Levaquin',
      },
      {
        name: 'Ciprofloxacin',
      },
      {
        name: 'Zofran',
      },
      {
        name: 'Keflex',
      },
      {
        name: 'Clindamycin',
      },
    ],
  },
  medications: {
    favorites: [
      {
        name: 'Toradol',
        strength: '60 mg',
        id: 10098,
      },
      {
        name: 'Toradol',
        strength: '30 mg',
        id: 81146,
      },
      {
        name: 'Decadron',
        strength: '8 mg',
        id: 39039,
      },
      {
        name: 'Decadron',
        strength: '4 mg',
        id: 39038,
      },
      {
        name: 'Rocephin',
        strength: '1 g',
        id: 30900,
      },
      {
        name: 'Rocephin',
        strength: '500 mg',
        id: 30901,
      },
    ],
  },
  inHouseMedications: {
    favorites: [
      {
        name: 'Acetaminophen - Adult',
        dose: 650,
        units: 'mg',
        route: '26643006',
        instructions: 'Take 2 tablets (325 mg each) by mouth every 6 hours as needed for pain or fever.',
        dosespotId: 23170,
      },
      {
        name: 'Albuterol - Adult',
        dose: 2.5,
        units: 'mg',
        route: '447694001',
        instructions:
          'Inhale 1 vial (2.5 mg/3 mL) via nebulizer every 4–6 hours as needed for shortness of breath or wheezing.',
        dosespotId: 29518,
      },
      {
        name: 'Albuterol - Pediatric',
        dose: 1.25,
        units: 'mg',
        route: '447694001',
        instructions:
          'Inhale 1 vial (1.25 mg/3 mL) via nebulizer every 4–6 hours as needed for shortness of breath or wheezing.',
        dosespotId: 29518,
      },
      {
        name: 'Amoxicillin - Adult',
        dose: 500,
        units: 'mg',
        route: '26643006',
        instructions: 'Take 1 capsule by mouth every 12 hours for 10 days until finished.',
        dosespotId: 34220,
      },
    ],
  },
} as const satisfies MedicalHistoryConfig;

const mergedMedicalHistoryConfig = mergeAndFreezeConfigObjects(
  MEDICAL_HISTORY_DEFAULTS,
  MEDICAL_HISTORY_OVERRIDES || {}
);

export const MEDICAL_HISTORY_CONFIG = Object.freeze(validateMedicalHistoryConfig(mergedMedicalHistoryConfig));

export * from './medical-history.schema';
