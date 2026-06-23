import { DispositionType, getDefaultNote } from '../types/api/chart-data/chart-data.types';
import {
  DEFAULT_VITALS_UNIT_INPUT_ORDER,
  ProgressNoteConfig,
} from '../types/api/progress-note-config/progress-note-config.types';
import { MDM_FIELD_DEFAULT_TEXT } from '../types/data/appointments/appointments.constants';

export const PROGRESS_NOTE_CONFIG_BASIC_TAG = {
  system: 'progress-note-config',
  code: 'progress-note-config',
};

export const PROGRESS_NOTE_CONFIG_EXTENSION_URL_PREFIX = 'https://fhir.ottehr.com/Extension/progress-note-config';

export const PROGRESS_NOTE_CONFIG_MDM_REQUIRED_EXTENSION_URL = `${PROGRESS_NOTE_CONFIG_EXTENSION_URL_PREFIX}-mdm-required`;
export const PROGRESS_NOTE_CONFIG_MEDICAL_DECISION_DEFAULT_TEXT_EXTENSION_URL = `${PROGRESS_NOTE_CONFIG_EXTENSION_URL_PREFIX}-medical-decision-default-text`;
export const PROGRESS_NOTE_CONFIG_PCP_NO_TYPE_DISPOSITION_DEFAULT_TEXT_EXTENSION_URL = `${PROGRESS_NOTE_CONFIG_EXTENSION_URL_PREFIX}-pcp-no-type-disposition-default-text`;
export const PROGRESS_NOTE_CONFIG_ANOTHER_DISPOSITION_DEFAULT_TEXT_EXTENSION_URL = `${PROGRESS_NOTE_CONFIG_EXTENSION_URL_PREFIX}-another-disposition-default-text`;
export const PROGRESS_NOTE_CONFIG_ED_DISPOSITION_DEFAULT_TEXT_EXTENSION_URL = `${PROGRESS_NOTE_CONFIG_EXTENSION_URL_PREFIX}-ed-disposition-default-text`;
export const PROGRESS_NOTE_CONFIG_VITALS_UNIT_INPUT_ORDER_EXTENSION_URL = `${PROGRESS_NOTE_CONFIG_EXTENSION_URL_PREFIX}-vitals-unit-input-order`;

export const DEFAULT_PROGRESS_NOTE_CONFIG: ProgressNoteConfig = {
  mdmRequired: true,
  medicalDecisionDefaultText: MDM_FIELD_DEFAULT_TEXT,
  pcpNoTypeDispositionDefaultText: getDefaultNote('pcp-no-type'),
  anotherDispositionDefaultText: getDefaultNote('another'),
  edDispositionDefaultText: getDefaultNote('ed'),
  vitalsUnitInputOrder: DEFAULT_VITALS_UNIT_INPUT_ORDER,
};

export const getDispositionDefaultTextFromProgressNoteConfig = (
  config: ProgressNoteConfig | undefined,
  dispositionType: DispositionType
): string => {
  switch (dispositionType) {
    case 'pcp-no-type':
      return config?.pcpNoTypeDispositionDefaultText ?? DEFAULT_PROGRESS_NOTE_CONFIG.pcpNoTypeDispositionDefaultText;
    case 'another':
      return config?.anotherDispositionDefaultText ?? DEFAULT_PROGRESS_NOTE_CONFIG.anotherDispositionDefaultText;
    case 'ed':
      return config?.edDispositionDefaultText ?? DEFAULT_PROGRESS_NOTE_CONFIG.edDispositionDefaultText;
    default:
      return getDefaultNote(dispositionType);
  }
};
