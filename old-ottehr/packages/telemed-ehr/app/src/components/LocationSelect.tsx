import { Autocomplete, AutocompleteRenderInputParams, TextField } from '@mui/material';
import { ReactElement, useEffect, useMemo, useState } from 'react';

import { FhirClient } from '@zapehr/sdk';
import { Location } from 'fhir/r4';
import { useNavigate } from 'react-router-dom';
import { sortLocationsByLabel } from '../helpers';
import { useApiClients } from '../hooks/useAppClients';

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
  const { fhirClient } = useApiClients();
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
    async function getLocationsResults(fhirClient: FhirClient): Promise<void> {
      if (!fhirClient) {
        return;
      }

      setLoadingState(LoadingState.loading);

      try {
        const locationsResults = await fhirClient.searchResources<Location>({
          resourceType: 'Location',
          searchParams: [
            { name: '_count', value: '1000' },
            { name: 'status', value: 'active' },
          ],
        });
        setLocations(locationsResults);
      } catch (e) {
        console.error('error loading locations', e);
      } finally {
        setLoadingState(LoadingState.loaded);
      }
    }

    if (fhirClient && loadingState === LoadingState.initial) {
      void getLocationsResults(fhirClient);
    }
  }, [fhirClient, loadingState]);

  const options = useMemo(() => {
    const allLocations = locations.map((location) => {
      return { label: location.name, value: location.id };
    });

    return sortLocationsByLabel(allLocations as { label: string; value: string }[]);
  }, [locations]);

  const handleLocationChange = (event: any, newValue: any): void => {
    const selectedLocation = newValue
      ? locations.find((locationTemp) => locationTemp.id === newValue.value)
      : undefined;
    console.log('selected location in handle location change', selectedLocation);
    if (selectedLocation?.id) {
      localStorage.setItem('selectedLocationID', selectedLocation.id);
    }
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
      disabled={renderInputProps?.disabled}
      value={location ? { label: location.name, value: location?.id } : null}
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
        <TextField placeholder="Search office" name="location" {...params} label="Office" required={required} />
      )}
    />
  );
}
