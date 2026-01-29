import { MEDICAL_HISTORY_OVERRIDES } from '../../../ottehr-config-overrides';
import { mergeAndFreezeConfigObjects } from '../helpers';
import { MedicalHistoryConfig, validateMedicalHistoryConfig } from './medical-history.schema';

const MEDICAL_HISTORY_DEFAULTS: MedicalHistoryConfig = {
  medicalConditions: {
    favorites: [],
  },
  allergies: {
    favorites: [],
  },
  medications: {
    favorites: [],
  },
};

const mergedMedicalHistoryConfig = mergeAndFreezeConfigObjects(
  MEDICAL_HISTORY_DEFAULTS,
  MEDICAL_HISTORY_OVERRIDES || {}
);

export const MEDICAL_HISTORY_CONFIG = Object.freeze(validateMedicalHistoryConfig(mergedMedicalHistoryConfig));

export * from './medical-history.schema';
