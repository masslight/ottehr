import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Paper, Tab } from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { ApptTelemedTab } from 'utils';
import CreateDemoVisits from '../../../components/CreateDemoVisits';
import Loading from '../../../components/Loading';
import { dataTestIds } from '../../../constants/data-test-ids';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import { useGetTelemedAppointments, useTrackingBoardStore } from '../../state';
import { ApptTabToStatus } from '../../utils';
import { TrackingBoardTable } from './TrackingBoardTable';

export function TrackingBoardTabs(): ReactElement {
  const { alignment, selectedStates, date, providers, groups, setAppointments, locationsIds, visitTypes } =
    getSelectors(useTrackingBoardStore, [
      'alignment',
      'selectedStates',
      'providers',
      'groups',
      'date',
      'setAppointments',
      'locationsIds',
      'visitTypes',
    ]);

  const [value, setValue] = useState<ApptTelemedTab>(ApptTelemedTab.ready);

  const handleChange = (_: any, newValue: ApptTelemedTab): any => {
    setValue(newValue);
  };

  const apiClient = useOystehrAPIClient();

  const dateFilter = date ? date.toISODate()! : undefined;

  const actualStatesFilter = selectedStates ? selectedStates : undefined;
  const { isFetching, isFetchedAfterMount } = useGetTelemedAppointments(
    {
      apiClient,
      usStatesFilter: actualStatesFilter,
      locationsIdsFilter: locationsIds || undefined,
      providersFilter: providers || undefined,
      groupsFilter: groups || undefined,
      patientFilter: alignment,
      statusesFilter: ApptTabToStatus[value],
      dateFilter,
      visitTypesFilter: visitTypes || undefined,
    },
    (data) => {
      setAppointments(data.appointments);
    }
  );

  useEffect(() => {
    useTrackingBoardStore.setState({ isAppointmentsLoading: !isFetchedAfterMount });
  }, [isFetchedAfterMount]);

  return (
    <Box sx={{ width: '100%', marginTop: 3 }}>
      <TabContext value={value}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <TabList onChange={handleChange} aria-label="appointment tabs">
            <Tab
              label="Ready for provider"
              value={ApptTelemedTab.ready}
              sx={{ textTransform: 'none', fontWeight: 500 }}
              data-testid={dataTestIds.telemedEhrFlow.telemedAppointmentsTabs(ApptTelemedTab.ready)}
            />
            <Tab
              label="Provider"
              value={ApptTelemedTab.provider}
              sx={{ textTransform: 'none', fontWeight: 500 }}
              data-testid={dataTestIds.telemedEhrFlow.telemedAppointmentsTabs(ApptTelemedTab.provider)}
            />
            <Tab
              label="Unsigned"
              value={ApptTelemedTab['not-signed']}
              sx={{ textTransform: 'none', fontWeight: 500 }}
              data-testid={dataTestIds.telemedEhrFlow.telemedAppointmentsTabs(ApptTelemedTab['not-signed'])}
            />
            <Tab
              label="Complete"
              value={ApptTelemedTab.complete}
              sx={{ textTransform: 'none', fontWeight: 500 }}
              data-testid={dataTestIds.telemedEhrFlow.telemedAppointmentsTabs(ApptTelemedTab.complete)}
            />
            {isFetching && <Loading />}
          </TabList>
        </Box>
        <Paper sx={{ marginTop: 3 }}>
          <TabPanel value={value} sx={{ padding: 0 }}>
            <TrackingBoardTable tab={value} />
          </TabPanel>
        </Paper>
        <CreateDemoVisits />
      </TabContext>
    </Box>
  );
}
