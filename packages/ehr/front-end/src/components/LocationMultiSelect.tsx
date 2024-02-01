import React, { Dispatch, ReactElement, SetStateAction, useEffect } from 'react';
import { Autocomplete, Checkbox, TextField, useTheme } from '@mui/material';
import { Location } from 'fhir/r4';
import useFhirClient from '../hooks/useFhirClient';

interface LocationMultiSelectProps {
  setLocations: Dispatch<SetStateAction<Location[]>>;
  setSelectedLocations: Dispatch<
    SetStateAction<{ label: string | undefined; id: string | undefined; location: Location }[]>
  >;
  locations: Location[];
  selectedLocations: { label: string | undefined; id: string | undefined; location: Location }[];
}

export default function LocationMultiSelect({
  setLocations,
  setSelectedLocations,
  locations,
  selectedLocations,
}: LocationMultiSelectProps): ReactElement {
  const fhirClient = useFhirClient();
  const theme = useTheme();

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
  }, [fhirClient, setLocations]);

  const suggestions =
    locations.length > 0
      ? locations.map((location) => {
          return { label: location.name, id: location.id, location: location };
        })
      : [];

  return (
    <div>
      <Autocomplete
        options={suggestions}
        value={selectedLocations}
        onChange={(_, newValue) => {
          setSelectedLocations(newValue);
        }}
        getOptionLabel={(option) => option.label ?? ''}
        multiple
        disableCloseOnSelect
        renderInput={(params) => <TextField {...params} label="Search to add location" />}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        renderOption={(props, option) => (
          <li {...props}>
            <Checkbox
              checked={selectedLocations.some((loc) => loc.id === option.id)}
              sx={{
                '&.Mui-checked': {
                  color: theme.palette.primary.main,
                },
              }}
            />

            {option.label}
          </li>
        )}
      />
    </div>
  );
}
