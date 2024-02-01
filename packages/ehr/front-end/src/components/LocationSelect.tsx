import { ReactElement, useEffect, useState } from 'react';
import { Autocomplete, TextField } from '@mui/material';
import { Location } from 'fhir/r4';
import useFhirClient from '../hooks/useFhirClient';
import { useNavigate } from 'react-router-dom';

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
  const fhirClient = useFhirClient();
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

  const options = locations.map((location) => {
    return { label: location.name, value: location.id };
  });

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
      value={location ? { label: location?.name, value: location?.id } : null}
      onChange={handleLocationChange}
      getOptionLabel={(location) => location.label || 'Unknown'}
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
