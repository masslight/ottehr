import React, { useEffect, ReactElement, useState } from 'react';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Button, Paper, Tab, Typography } from '@mui/material';
import { TrackingBoardTable } from './TrackingBoardTable';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useGetTelemedAppointments, useTrackingBoardStore } from '../../state';
import { ApptTab, ApptTabToStatus } from '../../utils';
import { useZapEHRAPIClient } from '../../hooks/useZapEHRAPIClient';
import Loading from '../../../components/Loading';
import CreateDemoVisitsButton from './CreateDemoVisitsButton';

export function TrackingBoardTabs(): ReactElement {
  const { alignment, state, date, providers, groups, setAppointments } = getSelectors(useTrackingBoardStore, [
    'alignment',
    'state',
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

  const { isFetching, isFetchedAfterMount } = useGetTelemedAppointments(
    {
      apiClient,
      stateFilter: state || undefined,
      providersFilter: providers || undefined,
      groupsFilter: groups || undefined,
      patientFilter: alignment,
      statusesFilter: ApptTabToStatus[value],
      dateFilter: (typeof date === 'object' ? date?.toISODate() : date) as string,
    },
    (data) => {
      setAppointments(data.appointments);
    },
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
        <Paper sx={{ marginTop: 5 }}>
          <TabPanel value={value} sx={{ padding: 0 }}>
            <TrackingBoardTable tab={value} />
          </TabPanel>
        </Paper>
        <CreateDemoVisitsButton visitService="telemedicine" />
      </TabContext>
    </Box>
  );
}
