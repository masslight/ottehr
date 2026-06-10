import { ProgressNoteConfig } from '../types/api/progress-note-config/progress-note-config.types';

export const PROGRESS_NOTE_CONFIG_BASIC_TAG = {
  system: 'progress-note-config',
  code: 'progress-note-config',
};

export const PROGRESS_NOTE_CONFIG_EXTENSION_URL_PREFIX = 'https://fhir.ottehr.com/Extension/progress-note-config';

export const PROGRESS_NOTE_CONFIG_MDM_REQUIRED_EXTENSION_URL = `${PROGRESS_NOTE_CONFIG_EXTENSION_URL_PREFIX}-mdm-required`;

export const DEFAULT_PROGRESS_NOTE_CONFIG: ProgressNoteConfig = {
  mdmRequired: true,
};
