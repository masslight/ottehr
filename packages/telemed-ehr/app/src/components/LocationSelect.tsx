import { Autocomplete, TextField } from '@mui/material';
import { Location } from 'fhir/r4';
import { ReactElement, useEffect, useMemo, useState } from 'react';
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
}

export default function LocationSelect({
  queryParams,
  location,
  handleSubmit,
  setLocation,
  updateURL,
  storeLocationInLocalStorage,
  required,
}: LocationSelectProps): ReactElement {
  const { fhirClient } = useApiClients();
  const [locations, setLocations] = useState<Location[]>([]);
  const navigate = useNavigate();
  useEffect(() => {
    if (updateURL && localStorage.getItem('selectedLocation')) {
      queryParams?.set('locationId', JSON.parse(localStorage.getItem('selectedLocation') ?? '')?.id ?? '');
      navigate(`?${queryParams?.toString()}`);
    }
  }, [navigate, queryParams, updateURL]);
  useEffect(() => {
    async function locationsResults(): Promise<void> {
      if (!fhirClient) {
        return;
      }

      const locationsResults = await fhirClient.searchResources<Location>({
        resourceType: 'Location',
        searchParams: [{ name: '_count', value: '1000' }],
      });
      setLocations(locationsResults);
    }

    locationsResults().catch((error) => console.log(error));
  }, [fhirClient]);

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
        <TextField placeholder="Search office" name="location" {...params} label="Office" required={required} />
      )}
    />
  );
}
