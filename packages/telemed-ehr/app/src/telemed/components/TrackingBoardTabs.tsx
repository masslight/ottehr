import React from 'react';
import { ReactElement } from 'react';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Grid, Paper, Tab } from '@mui/material';
import { useState } from 'react';
import { TrackingBoardTable } from './TrackingBoardTable';
import Loading from '../../components/Loading';
import { ApptTab, ApptTabToStatus } from '../utils';
import { useZapEHRTelemedAPIClient } from '../hooks/useZapEHRAPIClient';
import { useTrackingBoardStore, useGetTelemedAppointments } from '../state';
import { getSelectors } from '../../shared/store/getSelectors';
import { StateSelect } from './StateSelect';
import DateSearch from '../../components/DateSearch';
import { DateTime } from 'luxon';

export function TrackingBoardTabs(): ReactElement {
  const { alignment, state, date, setDate, setAppointments } = getSelectors(useTrackingBoardStore, [
    'alignment',
    'state',
    'date',
    'setDate',
    'setAppointments',
  ]);

  const [value, setValue] = useState<ApptTab>(ApptTab.ready);

  const handleChange = (event: any, newValue: ApptTab): any => {
    setValue(newValue);
  };

  const apiClient = useZapEHRTelemedAPIClient();

  const { isFetching } = useGetTelemedAppointments(
    {
      apiClient,
      stateFilter: state || undefined,
      patientFilter: alignment,
      statusesFilter: ApptTabToStatus[value],
      dateFilter: (typeof date === 'object' ? date?.toISODate() : date) as string,
    },
    (data) => {
      setAppointments(data.appointments);
    },
  );

  return (
    <Box sx={{ width: '100%', marginTop: 3 }}>
      <TabContext value={value}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <TabList onChange={handleChange} aria-label="appointment tabs">
            <Tab label="Ready for provider" value={ApptTab.ready} sx={{ textTransform: 'none', fontWeight: 700 }} />
            <Tab label="Provider" value={ApptTab.provider} sx={{ textTransform: 'none', fontWeight: 700 }} />
            <Tab label="Not signed" value={ApptTab['not-signed']} sx={{ textTransform: 'none', fontWeight: 700 }} />
            <Tab label="Complete" value={ApptTab.complete} sx={{ textTransform: 'none', fontWeight: 700 }} />
            {isFetching && <Loading />}
          </TabList>
        </Box>
        <Paper sx={{ marginTop: 5 }}>
          <Grid container spacing={2} sx={{ padding: 2, paddingTop: 0 }}>
            <Grid item xs={6}>
              <StateSelect />
            </Grid>
            <Grid item xs={6}>
              <DateSearch
                label="Date"
                date={date}
                setDate={setDate}
                updateURL={false}
                storeDateInLocalStorage={false}
                defaultValue={DateTime.now().toLocaleString(DateTime.DATE_SHORT)}
              ></DateSearch>
            </Grid>
          </Grid>
          <TabPanel value={value} sx={{ padding: 0 }}>
            <TrackingBoardTable tab={value}></TrackingBoardTable>
          </TabPanel>
        </Paper>
      </TabContext>
    </Box>
  );
}
