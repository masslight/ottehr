import { Autocomplete, AutocompleteRenderInputParams, TextField } from '@mui/material';
import { ReactElement, useEffect, useMemo, useState } from 'react';

import Oystehr from '@oystehr/sdk';
import { Location } from 'fhir/r4b';
import { useNavigate } from 'react-router-dom';
import { isLocationVirtual } from 'utils';
import { sortLocationsByLabel } from '../helpers';
import { useApiClients } from '../hooks/useAppClients';
import { dataTestIds } from '../constants/data-test-ids';

type CustomFormEventHandler = (event: React.FormEvent<HTMLFormElement>, value: any, field: string) => void;

interface LocationSelectProps {
  location?: Location | undefined;
  setLocation: (location: Location | undefined) => void;
  updateURL?: boolean;
  storeLocationInLocalStorage?: boolean;
  required?: boolean;
  queryParams?: URLSearchParams;
  handleSubmit?: CustomFormEventHandler;
  renderInputProps?: Partial<AutocompleteRenderInputParams>;
}

enum LoadingState {
  initial,
  loading,
  loaded,
}

export default function LocationSelect({
  queryParams,
  location,
  handleSubmit,
  setLocation,
  updateURL,
  storeLocationInLocalStorage,
  required,
  renderInputProps,
}: LocationSelectProps): ReactElement {
  const { oystehr } = useApiClients();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingState, setLoadingState] = useState(LoadingState.initial);
  const navigate = useNavigate();
  useEffect(() => {
    if (updateURL && localStorage.getItem('selectedLocation')) {
      queryParams?.set('locationID', JSON.parse(localStorage.getItem('selectedLocation') ?? '')?.id ?? '');
      navigate(`?${queryParams?.toString()}`);
    }
  }, [navigate, queryParams, updateURL]);
  useEffect(() => {
    async function getLocationsResults(oystehr: Oystehr): Promise<void> {
      if (!oystehr) {
        return;
      }

      setLoadingState(LoadingState.loading);

      try {
        let locationsResults = (
          await oystehr.fhir.search<Location>({
            resourceType: 'Location',
            params: [{ name: '_count', value: '1000' }],
          })
        ).unbundle();
        locationsResults = locationsResults.filter((loc) => !isLocationVirtual(loc));
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

  const options = useMemo(() => {
    const allLocations = locations.map((location) => {
      return { label: `${location.address?.state?.toUpperCase()} - ${location.name}`, value: location.id };
    });

    return sortLocationsByLabel(allLocations as { label: string; value: string }[]);
  }, [locations]);

  const handleLocationChange = (event: any, newValue: any): void => {
    const selectedLocation = newValue
      ? locations.find((locationTemp) => locationTemp.id === newValue.value)
      : undefined;
    console.log('selected location in handle location change', selectedLocation);
    setLocation(selectedLocation);

    if (storeLocationInLocalStorage) {
      if (newValue) {
        localStorage.setItem('selectedLocation', JSON.stringify(selectedLocation));
      } else {
        localStorage.removeItem('selectedLocation');
      }
    }

    if (handleSubmit) {
      handleSubmit(event, selectedLocation, 'location');
    }
  };

  return (
    <Autocomplete
      data-testid={dataTestIds.dashboard.locationSelect}
      disabled={renderInputProps?.disabled}
      value={
        location ? { label: `${location.address?.state?.toUpperCase()} - ${location.name}`, value: location?.id } : null
      }
      onChange={handleLocationChange}
      isOptionEqualToValue={(option, tempValue) => option.value === tempValue.value}
      options={options}
      renderOption={(props, option) => {
        return (
          <li {...props} key={option.value}>
            {option.label}
          </li>
        );
      }}
      fullWidth
      renderInput={(params) => (
        <TextField placeholder="Search location" name="location" {...params} label="Location" required={required} />
      )}
    />
  );
}
