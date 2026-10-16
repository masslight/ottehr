import { useProgressNoteConfig } from 'src/hooks/useProgressNoteConfig';
import { VitalsHeaderUnitSystem } from 'utils/lib/types/api/progress-note-config/progress-note-config.types';
import { DEFAULT_PROGRESS_NOTE_CONFIG } from 'utils/lib/utils/progress-note-config';

/**
 * Resolves the admin-configured unit system the visit header displays vitals in.
 * Falls back to the default while the config is loading or unavailable.
 */
export function useVitalsHeaderUnitSystem(): VitalsHeaderUnitSystem {
  const { data } = useProgressNoteConfig();
  return data?.vitalsHeaderUnitSystem ?? DEFAULT_PROGRESS_NOTE_CONFIG.vitalsHeaderUnitSystem;
}
