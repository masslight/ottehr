import { MedicalHistoryConfig } from '../../lib/ottehr-config/medical-history/medical-history.schema';

export const MEDICAL_HISTORY_OVERRIDES: Partial<MedicalHistoryConfig> = {
  medicalConditions: {
    favorites: [
      {
        code: 'I10',
        display: 'Essential (primary) hypertension',
      },
      {
        code: 'E11.9',
        display: 'Type 2 diabetes mellitus without complications',
      },
      {
        code: 'J45.909',
        display: 'Unspecified asthma, uncomplicated',
      },
      {
        code: 'M79.3',
        display: 'Panniculitis, unspecified',
      },
      {
        code: 'K21.9',
        display: 'Gastro-esophageal reflux disease without esophagitis',
      },
    ],
  },
  allergies: {
    favorites: [
      {
        name: 'Penicillin G Benzathine',
        id: 370,
      },
      {
        name: 'Latex',
        id: 3557,
      },
      {
        name: 'Crustacean shellfish',
        id: 3535,
      },
      {
        name: 'Peanut',
        id: 3568,
      },
      {
        name: 'Busulfan',
        id: 431,
      },
    ],
  },
  medications: {
    favorites: [
      {
        name: 'Ibuprofen Infants Drops Oral Suspension',
        strength: '50 MG/1.25ML',
        id: 866,
      },
      {
        name: 'Acetaminophen Oral Syrup',
        strength: '160 MG/5ML',
        id: 21886,
      },
      {
        name: 'Lisinopril Oral Tablet',
        strength: '30 MG',
        id: 7125,
      },
      {
        name: 'metFORMIN HCl Oral Tablet',
        strength: '750 MG',
        id: 94505,
      },
      {
        name: 'Albuterol  Powder',
        strength: undefined,
        id: 78840,
      },
    ],
  },
};
