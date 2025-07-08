import { otherColors } from '@ehrTheme/colors';
import FmdBadOutlinedIcon from '@mui/icons-material/FmdBadOutlined';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Grid, Tab, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import React, { ReactElement, useState } from 'react';
import { LocationWithWalkinSchedule } from 'src/pages/AddPatient';
import { InPersonAppointmentInformation, OrdersForTrackingBoardTable } from 'utils';
import { dataTestIds } from '../constants/data-test-ids';
import AppointmentTable from './AppointmentTable';
import Loading from './Loading';

export enum ApptTab {
  'prebooked' = 'prebooked',
  'in-office' = 'in-office',
  'completed' = 'completed',
  'cancelled' = 'cancelled',
}

interface AppointmentsTabProps {
  location: LocationWithWalkinSchedule | undefined;
  providers: string[] | undefined;
  groups: string[] | undefined;
  preBookedAppointments: InPersonAppointmentInformation[];
  completedAppointments: InPersonAppointmentInformation[];
  cancelledAppointments: InPersonAppointmentInformation[];
  inOfficeAppointments: InPersonAppointmentInformation[];
  loading: boolean;
  updateAppointments: () => void;
  setEditingComment: (editingComment: boolean) => void;
  orders: OrdersForTrackingBoardTable;
}

export default function AppointmentTabs({
  location,
  providers,
  groups,
  preBookedAppointments,
  completedAppointments,
  cancelledAppointments,
  inOfficeAppointments,
  loading,
  updateAppointments,
  setEditingComment,
  orders,
}: AppointmentsTabProps): ReactElement {
  const [value, setValue] = useState<ApptTab>(ApptTab['in-office']);
  const [now, setNow] = useState<DateTime>(DateTime.now());

  const handleChange = (event: any, newValue: ApptTab): any => {
    setValue(newValue);
  };

  React.useEffect(() => {
    function updateTime(): void {
      setNow(DateTime.now());
    }

    const timeInterval = setInterval(updateTime, 1000);
    // Call updateTime so we don't need to wait for it to be called
    updateTime();

    return () => clearInterval(timeInterval);
  }, []);

  const selectLocationMsg = !location && providers?.length === 0 && groups?.length === 0 && (
    <Grid container sx={{ width: '100%' }} padding={4}>
      <Grid item>
        <FmdBadOutlinedIcon
          sx={{
            width: 62,
            height: 62,
            color: otherColors.orange700,
            borderRadius: '50%',
            backgroundColor: otherColors.orange100,
            padding: 1.4,
            marginRight: 2,
          }}
        ></FmdBadOutlinedIcon>
      </Grid>
      <Grid
        item
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Typography sx={{ fontWeight: 'bold' }}>Please select an office, provider, or group</Typography>
        <Typography>Please select an office, provider, or group to get appointments</Typography>
      </Grid>
    </Grid>
  );

  const renderAppointmentTable = (appointments: InPersonAppointmentInformation[]): ReactElement => {
    return (
      <AppointmentTable
        appointments={appointments}
        orders={orders}
        location={location}
        tab={value}
        now={now}
        updateAppointments={updateAppointments}
        setEditingComment={setEditingComment}
      />
    );
  };

  return (
    <Box sx={{ width: '100%', marginTop: 3 }}>
      <TabContext value={value}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <TabList
            variant="scrollable"
            allowScrollButtonsMobile={true}
            onChange={handleChange}
            aria-label="appointment tabs"
          >
            <Tab
              data-testid={dataTestIds.dashboard.prebookedTab}
              label={`Pre-booked${preBookedAppointments ? ` – ${preBookedAppointments?.length}` : ''}`}
              value={ApptTab.prebooked}
              sx={{ textTransform: 'none', fontWeight: 500 }}
            />
            <Tab
              data-testid={dataTestIds.dashboard.inOfficeTab}
              label={`In Office${inOfficeAppointments ? ` – ${inOfficeAppointments?.length}` : ''}`}
              value={ApptTab['in-office']}
              sx={{ textTransform: 'none', fontWeight: 500 }}
            />
            <Tab
              data-testid={dataTestIds.dashboard.dischargedTab}
              label={`Discharged${completedAppointments ? ` – ${completedAppointments?.length}` : ''}`}
              value={ApptTab.completed}
              sx={{ textTransform: 'none', fontWeight: 500 }}
            />
            <Tab
              data-testid={dataTestIds.dashboard.cancelledTab}
              label="Cancelled"
              value={ApptTab.cancelled}
              sx={{ textTransform: 'none', fontWeight: 500 }}
            />
            {loading && <Loading />}
          </TabList>
        </Box>
        <TabPanel value={ApptTab.prebooked} sx={{ padding: 0 }}>
          {selectLocationMsg || renderAppointmentTable(preBookedAppointments)}
        </TabPanel>
        <TabPanel value={ApptTab['in-office']} sx={{ padding: 0 }}>
          {selectLocationMsg || renderAppointmentTable(inOfficeAppointments)}
        </TabPanel>
        <TabPanel value={ApptTab.completed} sx={{ padding: 0 }}>
          {selectLocationMsg || renderAppointmentTable(completedAppointments)}
        </TabPanel>
        <TabPanel value={ApptTab.cancelled} sx={{ padding: 0 }}>
          {selectLocationMsg || renderAppointmentTable(cancelledAppointments)}
        </TabPanel>
      </TabContext>
    </Box>
  );
}
