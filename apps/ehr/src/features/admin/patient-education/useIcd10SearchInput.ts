import { useState } from 'react';
import { useICD10SearchNew } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { IcdSearchResponse } from 'utils';

export type Icd10Option = IcdSearchResponse['codes'][number];

const ICD_SEARCH_DEBOUNCE_MS = 800;

export interface Icd10SearchInputState {
  inputValue: string;
  setInputValue: (next: string) => void;
  options: Icd10Option[];
  isFetching: boolean;
}

/**
 * Composes input-state + debounced-fetch for the ICD-10 search autocomplete.
 * Pairs with the `PrimaryDiagnosisInput` / `AlternateDiagnosesInput` components,
 * but can be used directly if a caller needs more control over the autocomplete.
 */
export const useIcd10SearchInput = (): Icd10SearchInputState => {
  const [inputValue, setInputValueState] = useState('');
  const [debounced, setDebounced] = useState('');
  const { debounce } = useDebounce(ICD_SEARCH_DEBOUNCE_MS);
  const { data, isFetching } = useICD10SearchNew({ search: debounced });

  const setInputValue = (next: string): void => {
    setInputValueState(next);
    debounce(() => setDebounced(next));
  };

  return {
    inputValue,
    setInputValue,
    options: data?.codes ?? [],
    isFetching,
  };
};
