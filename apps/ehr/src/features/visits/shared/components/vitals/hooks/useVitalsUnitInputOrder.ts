import { useProgressNoteConfig } from 'src/hooks/useProgressNoteConfig';
import { DEFAULT_PROGRESS_NOTE_CONFIG, VitalsUnitInputOrder } from 'utils';

/**
 * Resolves the admin-configured order in which metric/imperial vital input fields are displayed.
 * Falls back to the default while the config is loading or unavailable.
 */
export function useVitalsUnitInputOrder(): VitalsUnitInputOrder {
  const { data } = useProgressNoteConfig();
  return data?.vitalsUnitInputOrder ?? DEFAULT_PROGRESS_NOTE_CONFIG.vitalsUnitInputOrder;
}
