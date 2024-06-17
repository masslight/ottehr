import { Autocomplete, TextField } from '@mui/material';
import { ReactElement } from 'react';
import { formatHumanName } from '@zapehr/sdk';
import { Practitioner } from 'fhir/r4';

type CustomFormEventHandler = (event: React.FormEvent<HTMLFormElement>, value: any, field: string) => void;

interface LocationSelectProps {
  providers: string[];
  practitioners?: Practitioner[];
  handleSubmit?: CustomFormEventHandler;
}

export default function ProvidersSelect({ providers, practitioners, handleSubmit }: LocationSelectProps): ReactElement {
  const practitionerIDToName: { [id: string]: string } = {};
  practitioners?.map((practitioner) => {
    if (practitioner.id && practitioner.name != undefined) {
      practitionerIDToName[practitioner.id] = formatHumanName(practitioner.name[0]);
    }
  });
  console.log(1, providers, practitioners, 4);
  return (
    <Autocomplete
      id="providers"
      value={providers.map((provider) => ({
        value: provider,
        label: practitionerIDToName[provider] == undefined ? 'Loading...' : practitionerIDToName[provider],
      }))}
      isOptionEqualToValue={(option, tempValue) => option.value === tempValue.value}
      options={
        practitioners
          ? practitioners
              // .filter((practitioner) => practitioner.name != undefined)
              .map((practitioner) => ({
                value: practitioner.id,
                label: practitioner.name != undefined ? formatHumanName(practitioner.name[0]) : 'Unknown',
              }))
          : []
      }
      renderOption={(props, option) => {
        return (
          <li {...props} key={option.value}>
            {option.label}
          </li>
        );
      }}
      // getOptionLabel={(option) => option.label}
      onChange={(event, providers) => {
        const providerIDs = providers.map((provider) => provider.value);
        if (providerIDs) {
          localStorage.setItem('selectedProviders', JSON.stringify(providerIDs));
        } else {
          localStorage.removeItem('selectedProviders');
        }

        if (handleSubmit) {
          handleSubmit(event as any, providerIDs, 'providers');
        }
      }}
      multiple
      renderInput={(params) => <TextField name="providers" {...params} label="Providers" required={false} />}
    />
  );
}
