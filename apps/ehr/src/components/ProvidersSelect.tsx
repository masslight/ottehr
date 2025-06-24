import { Autocomplete, TextField } from '@mui/material';
import { Practitioner } from 'fhir/r4b';
import { ReactElement } from 'react';
import { useApiClients } from '../hooks/useAppClients';

type CustomFormEventHandler = (event: React.FormEvent<HTMLFormElement>, value: any, field: string) => void;

interface LocationSelectProps {
  providers: string[];
  practitioners?: Practitioner[];
  handleSubmit?: CustomFormEventHandler;
}

export default function ProvidersSelect({ providers, practitioners, handleSubmit }: LocationSelectProps): ReactElement {
  const { oystehr } = useApiClients();
  const practitionerIDToName: { [id: string]: string } = {};
  practitioners?.map((practitioner) => {
    if (practitioner.id && practitioner.name != undefined) {
      practitionerIDToName[practitioner.id] = oystehr?.fhir.formatHumanName(practitioner.name[0]) || 'Unknown provider';
    }
  });
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
                label: practitioner.name != undefined ? oystehr?.fhir.formatHumanName(practitioner.name[0]) : 'Unknown',
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
