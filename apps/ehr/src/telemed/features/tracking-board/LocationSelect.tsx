import { Autocomplete, Chip, TextField } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { Location } from 'fhir/r4b';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { dataTestIds } from '../../../constants/data-test-ids';
import { sortLocationsByLabel } from '../../../helpers';
import { useApiClients } from '../../../hooks/useAppClients';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useTrackingBoardStore } from '../../state';

type LocationsDropdownOption = {
  label: string;
  value: string | null;
};

enum LoadingState {
  initial,
  loading,
  loaded,
}

export function LocationsSelect(): ReactElement {
  const { oystehr } = useApiClients();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingState, setLoadingState] = useState(LoadingState.initial);
  const { locationsIds } = getSelectors(useTrackingBoardStore, ['locationsIds']);

  useEffect(() => {
    async function getLocationsResults(oystehr: Oystehr): Promise<void> {
      if (!oystehr) {
        return;
      }

      setLoadingState(LoadingState.loading);

      try {
        const locationsResults = (
          await oystehr.fhir.search<Location>({
            resourceType: 'Location',
            params: [{ name: '_count', value: '1000' }],
          })
        ).unbundle();
        setLocations(locationsResults);
      } catch (e) {
        console.error('error loading locations', e);
      } finally {
        setLoadingState(LoadingState.loaded);
      }
    }

    if (oystehr && loadingState === LoadingState.initial) {
      void getLocationsResults(oystehr);
    }
  }, [oystehr, loadingState]);

  const options: LocationsDropdownOption[] = useMemo(() => {
    const allLocations = locations.map((location) => {
      return { label: `${location.address?.state?.toUpperCase()} - ${location.name}`, value: location.id };
    });

    return sortLocationsByLabel(allLocations as { label: string; value: string }[]);
  }, [locations]);

  const currentDropdownValues: LocationsDropdownOption[] = useMemo(() => {
    if (locationsIds?.length === 0) {
      return [];
    }
    const actualSelectedLocationsOptions: LocationsDropdownOption[] = (locationsIds || []).map((locationId) => ({
      label: locations.find((locationTemp) => locationTemp.id === locationId)?.name || '',
      value: locationId,
    }));

    return actualSelectedLocationsOptions;
  }, [locationsIds, locations]);

  const handleLocationsChange = useCallback((event: any, selectedOptions: LocationsDropdownOption[]): void => {
    const locationsIds = selectedOptions
      .filter((locationOption) => !!locationOption.value)
      .map((locationOption) => locationOption.value!);

    const locationsIdsOrNull = locationsIds.length !== 0 ? locationsIds : null;
    useTrackingBoardStore.setState({ locationsIds: locationsIdsOrNull });
  }, []);

  return (
    <Autocomplete
      data-testid={dataTestIds.telemedEhrFlow.trackingBoardLocationsSelect}
      value={currentDropdownValues}
      onChange={handleLocationsChange}
      getOptionLabel={(state) => state.label || 'Unknown'}
      isOptionEqualToValue={(option, tempValue) => option.value === tempValue.value}
      options={options}
      renderOption={(props, option) => {
        return (
          <li
            {...props}
            key={option.value}
            data-testid={dataTestIds.telemedEhrFlow.trackingBoardLocationsSelectOption(option.value!)}
          >
            {option.label}
          </li>
        );
      }}
      fullWidth
      multiple
      renderInput={(params) => <TextField name="location" {...params} label="Locations" />}
      renderTags={(options: readonly LocationsDropdownOption[], getTagProps) =>
        options.map((option: LocationsDropdownOption, index: number) => {
          const { key, onDelete, ...tagProps } = getTagProps({ index });
          return <Chip variant="filled" label={option.label} key={key} onDelete={onDelete} {...tagProps} />;
        })
      }
    />
  );
}
