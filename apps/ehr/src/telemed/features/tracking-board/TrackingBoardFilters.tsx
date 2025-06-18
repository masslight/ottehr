import { Box, Checkbox, FormControl, FormControlLabel, Grid, InputLabel, MenuItem, Select } from '@mui/material';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { ApptTelemedTab } from 'utils';
import DateSearch from '../../../components/DateSearch';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useTrackingBoardStore } from '../../state';
import { UnsignedFor } from '../../utils';
import { LocationsSelect } from './LocationSelect';
import { StateSelect } from './StateSelect';
import { VisitTypeSelect } from './VisitTypeSelect';

const selectOptions = [
  {
    label: 'Under 12 hours',
    value: UnsignedFor.under12,
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

export const TrackingBoardFilters: FC<{ tab: ApptTelemedTab }> = (props) => {
  const { tab } = props;
  // const { oystehr: oystehrClient } = useApiClients();
  // const [practitioners, setPractitioners] = useState<Practitioner[] | undefined>(undefined);
  // const [healthcareServices, setHealthcareServices] = useState<HealthcareService[] | undefined>(undefined);
  // const [providers, setProviders] = useState<string[] | undefined>(undefined);
  // const [groups, setGroups] = useState<string[] | undefined>(undefined);

  // useEffect(() => {
  //   async function getPractitioners(oystehrClient: Oystehr): Promise<void> {
  //     if (!oystehrClient) {
  //       return;
  //     }

  //     try {
  //       const practitionersTemp: Practitioner[] = (
  //         await oystehrClient.fhir.search<Practitioner>({
  //           resourceType: 'Practitioner',
  //           params: [
  //             { name: '_count', value: '1000' },
  //             // { name: 'name:missing', value: 'false' },
  //           ],
  //         })
  //       ).unbundle();
  //       setPractitioners(practitionersTemp);
  //     } catch (e) {
  //       console.error('error loading practitioners', e);
  //     }
  //   }
  //   async function getHealthcareServices(oystehrClient: Oystehr): Promise<void> {
  //     if (!oystehrClient) {
  //       return;
  //     }

  //     try {
  //       const healthcareServicesTemp: HealthcareService[] = (
  //         await oystehrClient.fhir.search<HealthcareService>({
  //           resourceType: 'HealthcareService',
  //           params: [{ name: '_count', value: '1000' }],
  //         })
  //       ).unbundle();
  //       setHealthcareServices(healthcareServicesTemp);
  //     } catch (e) {
  //       console.error('error loading healthcare services', e);
  //     }
  //   }

  //   if (oystehrClient) {
  //     void getPractitioners(oystehrClient);
  //     void getHealthcareServices(oystehrClient);
  //   }
  // }, [oystehrClient]);

  const { date, unsignedFor, showOnlyNext } = getSelectors(useTrackingBoardStore, [
    'date',
    'unsignedFor',
    'showOnlyNext',
  ]);

  // const handleProviderChange = (_e: any, value: string[]): void => {
  //   console.log(10, value);
  //   setProviders(value);
  //   useTrackingBoardStore.setState({ providers: value });
  // };
  // const handleGroupChange = (_e: any, value: string[]): void => {
  //   console.log(10, value);
  //   setGroups(value);
  //   useTrackingBoardStore.setState({ groups: value });
  // };
  const useUnsigned = tab === ApptTelemedTab['not-signed'];
  const useFirst = tab === ApptTelemedTab.ready;

  return (
    <Box sx={{ padding: 2, display: 'flex', flexDirection: 'column' }}>
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <LocationsSelect />
        </Grid>
        <Grid item xs={6}>
          <StateSelect />
        </Grid>
        {/* <Grid item xs={6}>
          <ProvidersSelect
            providers={providers ? providers : []}
            practitioners={practitioners}
            handleSubmit={handleProviderChange}
          ></ProvidersSelect>
        </Grid> */}
        {/* <Grid item xs={6}>
          <GroupSelect
            groups={groups ? groups : []}
            healthcareServices={healthcareServices}
            handleSubmit={handleGroupChange}
          ></GroupSelect>
        </Grid> */}
        <Grid item xs={6}>
          <DateSearch
            label="Date"
            date={date}
            setDate={(date) => useTrackingBoardStore.setState({ date })}
            updateURL={false}
            storeDateInLocalStorage={false}
            defaultValue={DateTime.now()}
          />
        </Grid>
        <Grid item xs={6}>
          <VisitTypeSelect />
        </Grid>
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
      {useFirst && (
        <FormControlLabel
          sx={{ pt: 2 }}
          control={
            <Checkbox
              checked={showOnlyNext}
              onChange={(e) => useTrackingBoardStore.setState({ showOnlyNext: e.target.checked })}
            />
          }
          label="Show only NEXT"
        />
      )}
    </Box>
  );
};
