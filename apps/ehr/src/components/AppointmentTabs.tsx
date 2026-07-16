import { otherColors } from '@ehrTheme/colors';
import FmdBadOutlinedIcon from '@mui/icons-material/FmdBadOutlined';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Grid, Tab, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  GetVitalsForListOfEncountersResponseData,
  InPersonAppointmentInformation,
  OrdersForTrackingBoardTable,
} from 'utils';
import { dataTestIds } from '../constants/data-test-ids';
import AppointmentTable from './AppointmentTable';
import Loading from './Loading';

export enum ApptTab {
  prebooked = 'prebooked',
  'in-office' = 'in-office',
  completed = 'completed',
  cancelled = 'cancelled',
}

export const SELECTED_TAB_STORAGE_KEY = 'selectedAppointmentTab';

const getStoredTab = (): ApptTab | undefined => {
  const stored = localStorage.getItem(SELECTED_TAB_STORAGE_KEY);
  if (!stored) return undefined;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed === 'string' && (Object.values(ApptTab) as string[]).includes(parsed)) {
      return parsed as ApptTab;
    }
  } catch {
    // malformed storage value, fall through
  }
  return undefined;
};

interface AppointmentsTabProps {
  showSelectFiltersMessage: boolean;
  preBookedAppointments: InPersonAppointmentInformation[];
  completedAppointments: InPersonAppointmentInformation[];
  cancelledAppointments: InPersonAppointmentInformation[];
  inOfficeAppointments: InPersonAppointmentInformation[];
  loading: boolean;
  updateAppointments: () => void;
  setEditingComment: (editingComment: boolean) => void;
  orders: OrdersForTrackingBoardTable;
  vitals?: GetVitalsForListOfEncountersResponseData;
}

export default function AppointmentTabs({
  showSelectFiltersMessage,
  preBookedAppointments,
  completedAppointments,
  cancelledAppointments,
  inOfficeAppointments,
  loading,
  updateAppointments,
  setEditingComment,
  orders,
  vitals,
}: AppointmentsTabProps): ReactElement {
  const routeLocation = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Selected tab is read from `?tab=` (the canonical, bookmarkable source),
  // then falls back to `location.state?.tab` (legacy nav-state pattern still
  // used by a couple of callers we haven't migrated yet), then to the
  // localStorage-persisted tab from the user's last session, and finally to
  // the default. All sources are validated against the ApptTab enum so a
  // bogus value (`?tab=foo`) is ignored rather than left in `value` as a
  // non-tab.
  const isApptTab = (v: unknown): v is ApptTab =>
    typeof v === 'string' && (Object.values(ApptTab) as string[]).includes(v);
  const tabFromUrl = searchParams.get('tab');
  const resolvedTab: ApptTab = isApptTab(tabFromUrl)
    ? tabFromUrl
    : isApptTab(routeLocation.state?.tab)
      ? (routeLocation.state.tab as ApptTab)
      : (getStoredTab() ?? ApptTab['in-office']);

  const [value, setValue] = useState<ApptTab>(resolvedTab);
  const [now, setNow] = useState<DateTime>(DateTime.now());

  // Sync local state when the URL tab changes from outside this component
  // (e.g. command-palette navigation, browser back/forward). This also resets
  // back to the default tab when `?tab=` is removed from the URL.
  useEffect(() => {
    if (resolvedTab !== value) {
      setValue(resolvedTab);
    }
  }, [resolvedTab, value]);

  useEffect(() => {
    if (!isApptTab(tabFromUrl)) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('tab', resolvedTab);
          return next;
        },
        { replace: true }
      );
    }
  }, [tabFromUrl, resolvedTab, setSearchParams]);

  const handleChange = useCallback(
    (_event: any, newValue: ApptTab): void => {
      setValue(newValue);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('tab', newValue);
          return next;
        },
        { replace: true }
      );
      // Persist for the next session — `?tab=` wins on load, this is just the
      // fallback when the user returns without one.
      localStorage.setItem(SELECTED_TAB_STORAGE_KEY, JSON.stringify(newValue));
    },
    [setSearchParams]
  );

  React.useEffect(() => {
    function updateTime(): void {
      setNow(DateTime.now());
    }

    const timeInterval = setInterval(updateTime, 60000);
    // Call updateTime so we don't need to wait for it to be called
    updateTime();

    return () => clearInterval(timeInterval);
  }, []);

  const selectLocationMsg = showSelectFiltersMessage && (
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

  const renderAppointmentTable = useCallback(
    (appointments: InPersonAppointmentInformation[]): ReactElement => {
      return (
        <AppointmentTable
          appointments={appointments}
          orders={orders}
          vitals={vitals}
          tab={value}
          now={now}
          updateAppointments={updateAppointments}
          setEditingComment={setEditingComment}
        />
      );
    },
    [orders, vitals, value, now, updateAppointments, setEditingComment]
  );

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
              label={`Active${inOfficeAppointments ? ` – ${inOfficeAppointments?.length}` : ''}`}
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
              label={`Cancelled${cancelledAppointments ? ` – ${cancelledAppointments?.length}` : ''}`}
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
