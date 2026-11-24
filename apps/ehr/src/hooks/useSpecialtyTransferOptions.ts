import { DEFAULT_SPECIALTY_TRANSFER_OPTIONS } from 'utils/lib/fhir/disposition';
import { useProgressNoteConfig } from './useProgressNoteConfig';

export const useSpecialtyTransferOptions = (): { options: string[]; isLoading: boolean } => {
  const { data, isLoading } = useProgressNoteConfig();
  return { options: data?.specialtyTransferOptions ?? DEFAULT_SPECIALTY_TRANSFER_OPTIONS, isLoading };
};
