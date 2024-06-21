import { Autocomplete, TextField } from '@mui/material';
import { ReactElement } from 'react';
import { HealthcareService } from 'fhir/r4';

type CustomFormEventHandler = (event: React.FormEvent<HTMLFormElement>, value: any, field: string) => void;

interface GroupSelectProps {
  groups: string[];
  healthcareServices?: HealthcareService[];
  handleSubmit?: CustomFormEventHandler;
}

export default function GroupSelect({ groups, healthcareServices, handleSubmit }: GroupSelectProps): ReactElement {
  const healthcareServiceIDToName: { [id: string]: string } = {};
  healthcareServices?.map((healthcareService) => {
    if (healthcareService.id && healthcareService.name != undefined) {
      healthcareServiceIDToName[healthcareService.id] = healthcareService.name;
    }
  });
  return (
    <Autocomplete
      id="groups"
      value={groups.map((group) => ({
        value: group,
        label: healthcareServiceIDToName[group] == undefined ? 'Loading...' : healthcareServiceIDToName[group],
      }))}
      isOptionEqualToValue={(option, tempValue) => option.value === tempValue.value}
      options={
        healthcareServices
          ? healthcareServices
              // .filter((healthcareService) => healthcareService.name != undefined)
              .map((healthcareService) => ({
                value: healthcareService.id,
                label: healthcareService.name != undefined ? healthcareService.name : 'Unknown',
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
      onChange={(event, groups) => {
        const groupIDs = groups.map((group) => group.value);
        if (groupIDs) {
          localStorage.setItem('selectedGroups', JSON.stringify(groupIDs));
        } else {
          localStorage.removeItem('selectedGroups');
        }

        if (handleSubmit) {
          handleSubmit(event as any, groupIDs, 'groups');
        }
      }}
      multiple
      renderInput={(params) => <TextField name="groups" {...params} label="Groups" required={false} />}
    />
  );
}
