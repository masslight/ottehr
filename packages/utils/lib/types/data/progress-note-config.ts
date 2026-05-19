import { z } from 'zod';
import { DispositionType } from '../api/chart-data/chart-data.types';

export const PROGRESS_NOTE_CONFIG_TAG_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/progress-note-config';
export const PROGRESS_NOTE_CONFIG_TAG_CODE = 'progress-note-defaults';
export const PROGRESS_NOTE_CONFIG_TAG = {
  system: PROGRESS_NOTE_CONFIG_TAG_SYSTEM,
  code: PROGRESS_NOTE_CONFIG_TAG_CODE,
};

export const PROGRESS_NOTE_MDM_EXTENSION_URL = 'https://fhir.ottehr.com/Extension/mdm-default-text';
export const PROGRESS_NOTE_DISPOSITION_DEFAULTS_EXTENSION_URL =
  'https://fhir.ottehr.com/Extension/disposition-defaults';

export interface ProgressNoteConfig {
  mdmDefaultText: string;
  dispositionDefaults: Partial<Record<DispositionType, string>>;
}

export const ProgressNoteConfigSchema = z.object({
  mdmDefaultText: z.string(),
  dispositionDefaults: z.record(z.string()),
});

export interface AdminGetProgressNoteConfigOutput {
  config: ProgressNoteConfig;
}

export interface AdminUpdateProgressNoteConfigInput {
  config: ProgressNoteConfig;
}
