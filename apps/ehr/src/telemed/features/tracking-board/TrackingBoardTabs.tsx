import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Paper, Tab } from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import Loading from '../../../components/Loading';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useZapEHRAPIClient } from '../../hooks/useOystehrAPIClient';
import { useGetTelemedAppointments, useTrackingBoardStore } from '../../state';
import { ApptTab, ApptTabToStatus } from '../../utils';
import { TrackingBoardTable } from './TrackingBoardTable';
import CreateDemoVisits from '../../../components/CreateDemoVisits';

export function TrackingBoardTabs(): ReactElement {
  const { alignment, selectedStates, date, providers, groups, setAppointments } = getSelectors(useTrackingBoardStore, [
    'alignment',
    'selectedStates',
    'providers',
    'groups',
    'date',
    'setAppointments',
  ]);

  const [value, setValue] = useState<ApptTab>(ApptTab.ready);

  const handleChange = (_: any, newValue: ApptTab): any => {
    setValue(newValue);
  };

  const apiClient = useZapEHRAPIClient();

  // removing date filter from ready, provider and unsigned tabs
  const dateFilter = [ApptTab.ready, ApptTab.provider, ApptTab['not-signed']].includes(value)
    ? undefined
    : date
    ? date.toISODate()!
    : undefined;

  const actualStatesFilter = selectedStates ? selectedStates : undefined;
  const { isFetching, isFetchedAfterMount } = useGetTelemedAppointments(
    {
      apiClient,
      usStatesFilter: actualStatesFilter,
      providersFilter: providers || undefined,
      groupsFilter: groups || undefined,
      patientFilter: alignment,
      statusesFilter: ApptTabToStatus[value],
      dateFilter,
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
            <Tab label="Ready for provider" value={ApptTab.ready} sx={{ textTransform: 'none', fontWeight: 700 }} />
            <Tab label="Provider" value={ApptTab.provider} sx={{ textTransform: 'none', fontWeight: 700 }} />
            <Tab label="Unsigned" value={ApptTab['not-signed']} sx={{ textTransform: 'none', fontWeight: 700 }} />
            <Tab label="Complete" value={ApptTab.complete} sx={{ textTransform: 'none', fontWeight: 700 }} />
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
