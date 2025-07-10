import { Autocomplete, Chip, TextField } from '@mui/material';
import { ReactElement } from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { AllStatesToVirtualLocationsData } from 'utils';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useTrackingBoardStore } from '../../state';

type UsStateDropdownOption = {
  label: string;
  value: string | null;
};

const ALL_STATES_LABEL = 'All states';
const ALL_STATES_OPTION: UsStateDropdownOption = { label: ALL_STATES_LABEL, value: null };

const intersectArrays = (arr1: string[], arr2: string[]): string[] => {
  const buffer = new Set(arr2);
  return arr1.filter((element) => buffer.has(element));
};

const areArraysEqual = (arr1: string[], arr2: string[]): boolean => {
  if (arr1.length !== arr2.length) {
    return false;
  }
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }
  return true;
};

export function StateSelect(): ReactElement {
  const {
    availableStates: providerLicensedStates,
    selectedStates,
    alignment,
  } = getSelectors(useTrackingBoardStore, ['availableStates', 'selectedStates', 'alignment']);

  const isMyPatientsFilterActivated = alignment === 'my-patients';
  const possibleUsStates = isMyPatientsFilterActivated
    ? providerLicensedStates
    : Object.keys(AllStatesToVirtualLocationsData);

  useEffect(() => {
    if (!isMyPatientsFilterActivated) {
      return;
    }

    if (!selectedStates) {
      return;
    }

    const statesAfterAlignmentToggle = intersectArrays(selectedStates ?? [], providerLicensedStates);

    if (areArraysEqual(selectedStates, statesAfterAlignmentToggle)) {
      return;
    }

    useTrackingBoardStore.setState({ selectedStates: statesAfterAlignmentToggle });
  }, [alignment, isMyPatientsFilterActivated, selectedStates, providerLicensedStates]);

  const dropdownOptions: UsStateDropdownOption[] = [
    ALL_STATES_OPTION,
    ...possibleUsStates.map((usState) => ({ label: usState, value: usState })),
  ];
  const currentDropdownValues: UsStateDropdownOption[] = useMemo(() => {
    if (possibleUsStates.length === 0) {
      return [];
    }
    const actualSelectedStates = isMyPatientsFilterActivated
      ? intersectArrays(selectedStates ?? [], providerLicensedStates)
      : selectedStates;
    const actualSelectedStatesOptions: UsStateDropdownOption[] = (actualSelectedStates || []).map((usState) => ({
      label: usState,
      value: usState,
    }));

    if (!actualSelectedStatesOptions || actualSelectedStatesOptions.length === 0) {
      return [ALL_STATES_OPTION];
    }
    return actualSelectedStatesOptions;
  }, [possibleUsStates, selectedStates, providerLicensedStates, isMyPatientsFilterActivated]);

  const isOnlyAllStatesOptionSelected = useMemo(() => {
    const firstOption = currentDropdownValues.at(0);
    return (firstOption && firstOption.label === ALL_STATES_LABEL) ?? false;
  }, [currentDropdownValues]);

  const handleStateChange = useCallback(
    (event: any, selectedOptions: UsStateDropdownOption[]): void => {
      const hadSelectedStates = (selectedStates && selectedStates.length > 0) ?? false;
      const hasSelectedAllStatesOption = selectedOptions.some((option) => option.label === ALL_STATES_LABEL);
      if (hadSelectedStates && hasSelectedAllStatesOption) {
        // if at least one US state has been previously selected and the user chooses "All States" option
        // from the dropdown then clear all previous US states selection
        useTrackingBoardStore.setState({ selectedStates: null });
        return;
      }

      const statesNames = selectedOptions
        .filter((usStateOption) => usStateOption.label !== ALL_STATES_LABEL)
        .filter((usStateOption) => !!usStateOption.value)
        .map((usStateOption) => usStateOption.value!);

      const statesNamesOrNull = statesNames.length !== 0 ? statesNames : null;
      useTrackingBoardStore.setState({ selectedStates: statesNamesOrNull });
    },
    [selectedStates]
  );

  return (
    <Autocomplete
      value={currentDropdownValues}
      onChange={handleStateChange}
      getOptionLabel={(state) => state.label || 'Unknown'}
      isOptionEqualToValue={(option, tempValue) => option.value === tempValue.value}
      options={dropdownOptions}
      renderOption={(props, option) => {
        return (
          <li {...props} key={option.value}>
            {option.label}
          </li>
        );
      }}
      fullWidth
      multiple
      disableClearable={isOnlyAllStatesOptionSelected}
      renderInput={(params) => <TextField name="state" {...params} label="State" />}
      renderTags={(options: readonly UsStateDropdownOption[], getTagProps) =>
        options.map((option: UsStateDropdownOption, index: number) => {
          const { key, onDelete, ...tagProps } = getTagProps({ index });
          const onDeleteHandler = option.label !== ALL_STATES_LABEL ? onDelete : undefined;
          return <Chip variant="filled" label={option.label} key={key} onDelete={onDeleteHandler} {...tagProps} />;
        })
      }
    />
  );
}
