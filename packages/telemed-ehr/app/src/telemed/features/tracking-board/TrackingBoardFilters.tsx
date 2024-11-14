import React, { FC, useEffect, useState } from 'react';
import { FormControl, Grid, InputLabel, MenuItem, Select } from '@mui/material';
import { DateTime } from 'luxon';
import { ApptTab, UnsignedFor } from '../../utils';
import { useTrackingBoardStore } from '../../state';
import { getSelectors } from '../../../shared/store/getSelectors';
import { StateSelect } from './StateSelect';
import DateSearch from '../../../components/DateSearch';
import { useApiClients } from '../../../hooks/useAppClients';
import { HealthcareService, Practitioner } from 'fhir/r4';
import { FhirClient } from '@zapehr/sdk';
import ProvidersSelect from '../../../components/inputs/ProvidersSelect';
import GroupSelect from '../../../components/inputs/GroupSelect';

const selectOptions = [
  {
    label: 'Under 12 hours',
    value: UnsignedFor.under12,
  },
  {
    label: '12 - 24 hours',
    value: UnsignedFor['12to24'],
  },
  {
    label: 'More than 24 hours',
    value: UnsignedFor.more24,
  },
  {
    label: 'All',
    value: UnsignedFor.all,
  },
];

export const TrackingBoardFilters: FC<{ tab: ApptTab }> = (props) => {
  const { tab } = props;
  const { fhirClient } = useApiClients();
  const [practitioners, setPractitioners] = useState<Practitioner[] | undefined>(undefined);
  const [healthcareServices, setHealthcareServices] = useState<HealthcareService[] | undefined>(undefined);
  const [providers, setProviders] = useState<string[] | undefined>(undefined);
  const [groups, setGroups] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    async function getPractitioners(fhirClient: FhirClient): Promise<void> {
      if (!fhirClient) {
        return;
      }

      try {
        const practitionersTemp: Practitioner[] = await fhirClient.searchResources({
          resourceType: 'Practitioner',
          searchParams: [
            { name: '_count', value: '1000' },
            // { name: 'name:missing', value: 'false' },
          ],
        });
        setPractitioners(practitionersTemp);
      } catch (e) {
        console.error('error loading practitioners', e);
      }
    }
    async function getHealthcareServices(fhirClient: FhirClient): Promise<void> {
      if (!fhirClient) {
        return;
      }

      try {
        const healthcareServicessTemp: HealthcareService[] = await fhirClient.searchResources({
          resourceType: 'HealthcareService',
          searchParams: [{ name: '_count', value: '1000' }],
        });
        setHealthcareServices(healthcareServicessTemp);
      } catch (e) {
        console.error('error loading healthcare services', e);
      }
    }

    if (fhirClient) {
      void getPractitioners(fhirClient);
      void getHealthcareServices(fhirClient);
    }
  }, [fhirClient]);

  const { date, unsignedFor } = getSelectors(useTrackingBoardStore, ['date', 'unsignedFor']);

  const useDate = tab === ApptTab.complete;
  const useUnsigned = tab === ApptTab['not-signed'];
  const handleProviderChange = (_e: any, value: string[]): void => {
    console.log(10, value);
    setProviders(value);
    useTrackingBoardStore.setState({ providers: value });
  };
  const handleGroupChange = (_e: any, value: string[]): void => {
    console.log(10, value);
    setGroups(value);
    useTrackingBoardStore.setState({ groups: value });
  };

  return (
    <Grid container spacing={2} sx={{ padding: 2, paddingTop: 0 }}>
      <Grid item xs={4}>
        <StateSelect />
      </Grid>
      <Grid item xs={4}>
        <ProvidersSelect
          providers={providers ?? []}
          practitioners={practitioners}
          handleSubmit={handleProviderChange}
        />
      </Grid>
      <Grid item xs={4}>
        <GroupSelect groups={groups ?? []} healthcareServices={healthcareServices} handleSubmit={handleGroupChange} />
      </Grid>
      {useDate && (
        <Grid item xs={6}>
          <DateSearch
            label="Date"
            date={date}
            setDate={(date) => useTrackingBoardStore.setState({ date })}
            updateURL={false}
            storeDateInLocalStorage={false}
            defaultValue={DateTime.now().toLocaleString(DateTime.DATE_SHORT)}
          />
        </Grid>
      )}
      {useUnsigned && (
        <Grid item xs={6}>
          <FormControl fullWidth>
            <InputLabel>Unsigned for</InputLabel>
            <Select
              value={unsignedFor}
              label="Unsigned for"
              onChange={(event) => useTrackingBoardStore.setState({ unsignedFor: event.target.value as UnsignedFor })}
            >
              {selectOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      )}
    </Grid>
  );
};
