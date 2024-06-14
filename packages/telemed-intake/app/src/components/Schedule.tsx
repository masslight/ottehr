import { Box, Button, Tab, Tabs, Typography, useMediaQuery, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { ReactNode, SyntheticEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { breakpoints, ErrorDialog } from 'ottehr-components';
import { otherColors } from '../IntakeThemeProvider';
import { useAppointmentStore } from '../features/appointments';
import { SelectSlot } from './schedule/SelectSlot';
import { DATETIME_FULL_NO_YEAR, DATE_FULL_NO_YEAR, createLocalDateTime } from 'ottehr-utils';

interface TabPanelProps {
  children?: ReactNode;
  dir?: string;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps): JSX.Element => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`appointment-picker-tabpanel-${index}`}
      aria-labelledby={`appointment-picker-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3, pb: 3 }}>{children}</Box>}
    </div>
  );
};

const tabProps = (
  index: number,
): {
  id: string;
  'aria-controls': string;
} => {
  return {
    id: `appointment-picker-tab-${index}`,
    'aria-controls': `appointment-picker-tabpanel-${index}`,
  };
};

const nextAvailableFrom = (firstDate: DateTime, slotDataFHIR: string[], timezone: string): DateTime | undefined => {
  const nextDaySlot = slotDataFHIR.find((slot) => {
    const dt = DateTime.fromISO(slot, { zone: timezone });
    if (dt.ordinal === firstDate.ordinal) {
      return false;
    }
    return dt > firstDate;
  });

  if (nextDaySlot) {
    return DateTime.fromISO(nextDaySlot, { zone: timezone });
  }
  return undefined;
};

interface ScheduleProps {
  slotData: string[] | undefined;
  timezone: string;
}

const Schedule = ({ slotData, timezone }: ScheduleProps): JSX.Element => {
  const { selectedSlot, setAppointment } = useAppointmentStore((state) => state);
  const theme = useTheme();
  const [currentTab, setCurrentTab] = useState(0);
  const [nextDay, setNextDay] = useState<boolean>(false);
  const [choiceErrorDialogOpen, setChoiceErrorDialogOpen] = useState(false);
  // const [slotsErrorDialogOpen, setSlotsErrorDialogOpen] = useState(false);

  const [slotsList, daySlotsMap] = useMemo(() => {
    if (slotData) {
      const slots = [...slotData];

      // This maps days to an array of slots
      const map: { [ord: number]: string[] } = slots.reduce(
        (accumulator, current) => {
          const dateOfCurrent = DateTime.fromISO(current, { zone: timezone });
          const existing = accumulator[dateOfCurrent.ordinal];
          if (existing) {
            existing.push(current);
          } else {
            accumulator[dateOfCurrent.ordinal] = [current];
          }
          return accumulator;
        },
        {} as { [ord: number]: string[] },
      );

      return [slots, map];
    }
    return [[], {}];
  }, [timezone, slotData]);

  const { firstAvailableDay, secondAvailableDay } = useMemo(() => {
    let firstAvailableDay: DateTime | undefined = undefined;
    let secondAvailableDay: DateTime | undefined = undefined;
    const currentTime = DateTime.now().setZone(timezone);
    if (slotsList == null || slotsList.length === 0) {
      return { firstAvailableDay, secondAvailableDay, lastSlot: undefined };
    }

    firstAvailableDay = createLocalDateTime(DateTime.fromISO(slotsList[0]), timezone);
    const firstSlot = slotsList[0];
    const firstTime = DateTime.fromISO(firstSlot)?.setZone(timezone).toISODate();
    const currentExistingTime = currentTime?.setZone(timezone)?.toISODate();
    if (!firstTime || !currentExistingTime) {
      return { firstAvailableDay, secondAvailableDay, lastSlot: undefined };
    } else if (firstTime > currentExistingTime) {
      setNextDay(true);
    }
    if (firstAvailableDay) {
      secondAvailableDay = nextAvailableFrom(firstAvailableDay, slotsList, timezone);
      if (secondAvailableDay) {
        setNextDay(false);
      }
    }
    return { firstAvailableDay, secondAvailableDay };
  }, [slotsList, timezone]);

  const isFirstAppointment = useMemo(() => {
    return slotsList && slotsList[0] ? selectedSlot === slotsList[0] : false;
  }, [selectedSlot, slotsList]);

  const handleChange = (_: SyntheticEvent, newCurrentTab: number): void => {
    setCurrentTab(newCurrentTab);
  };

  const [selectedOtherDate, setSelectedOtherDate] = useState<DateTime | undefined>();

  useEffect(() => {
    if (selectedOtherDate === undefined && secondAvailableDay != undefined) {
      setSelectedOtherDate(nextAvailableFrom(secondAvailableDay, slotsList, timezone));
    }
  }, [secondAvailableDay, selectedOtherDate, slotsList, timezone]);

  const selectedDate = useMemo(() => {
    if (currentTab === 0) {
      return firstAvailableDay;
    } else if (currentTab === 1) {
      return secondAvailableDay;
    } else {
      return selectedOtherDate;
    }
  }, [currentTab, firstAvailableDay, secondAvailableDay, selectedOtherDate]);

  const selectedSlotTimezoneAdjusted = useMemo(() => {
    const selectedAppointmentStart = selectedSlot;
    if (selectedAppointmentStart) {
      return createLocalDateTime(DateTime.fromISO(selectedAppointmentStart), timezone);
    }

    return undefined;
  }, [selectedSlot, timezone]);

  const getSlotsForDate = useCallback(
    (date: DateTime | undefined): string[] => {
      if (date === undefined) {
        return [];
      }
      return daySlotsMap[date.ordinal] ?? [];
    },
    [daySlotsMap],
  );

  // Cause TS thinks breakpoints.values may be undefined and won't let me use a non-null assertion.
  const isMobile = useMediaQuery(`(max-width: ${breakpoints.values?.sm}px)`);
  const slotsExist = getSlotsForDate(firstAvailableDay).length > 0 || getSlotsForDate(secondAvailableDay).length > 0;
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          mt: 3,
        }}
      >
        <Typography variant="h3" color="primary">
          Select check-in date and time
        </Typography>
        {selectedDate?.offsetNameShort && (
          <Typography color="otherColors.textGray" sx={{ pt: { xs: 1.5, md: 0.5 } }}>
            Time Zone: {selectedDate?.offsetNameShort}
          </Typography>
        )}
      </Box>
      {slotsList && selectedDate != undefined && slotsExist ? (
        <Button
          variant={isFirstAppointment ? 'contained' : 'outlined'}
          sx={{
            color: isFirstAppointment ? theme.palette.primary.contrastText : theme.palette.text.primary,
            border: isFirstAppointment
              ? `1px solid ${theme.palette.primary.main}`
              : `1px solid ${theme.palette.divider}`,
            p: 1,
            borderRadius: '8px',
            textAlign: 'center',
            mt: 2.5,
            mb: 1.5,
            width: '100%',
            fontWeight: 400,
            display: { xs: 'block', md: 'inline' },
          }}
          onClick={() => setAppointment({ selectedSlot: slotsList[0] })}
          type="button"
        >
          <span style={{ fontWeight: 700 }}>First available time:&nbsp;</span>
          {isMobile && <br />}
          {firstAvailableDay?.toFormat(DATETIME_FULL_NO_YEAR)}
        </Button>
      ) : (
        <Box
          sx={{
            border: `1px solid ${theme.palette.divider}`,
            p: 1,
            borderRadius: '8px',
            textAlign: 'center',
            mt: 1,
            display: slotsExist ? 'inherit' : 'none',
          }}
        >
          <Typography variant="body2">Calculating...</Typography>
        </Box>
      )}
      <>
        {firstAvailableDay ? (
          <Box>
            <Box sx={{ width: '100%' }}>
              <Tabs
                value={currentTab}
                onChange={handleChange}
                TabIndicatorProps={{
                  style: {
                    background: otherColors.lightBlue,
                    height: '5px',
                    borderRadius: '2.5px',
                  },
                }}
                textColor="inherit"
                variant="fullWidth"
                aria-label="Appointment tabs for switching between appointments slots for today and tomorrow"
              >
                <Tab
                  label={nextDay ? 'Tomorrow' : 'Today'}
                  {...tabProps(0)}
                  sx={{
                    color: currentTab == 0 ? theme.palette.text.secondary : theme.palette.primary.main,
                    opacity: 1,
                  }}
                />
                {secondAvailableDay && (
                  <Tab
                    label="Tomorrow"
                    {...tabProps(1)}
                    sx={{
                      color: currentTab == 1 ? theme.palette.text.secondary : theme.palette.primary.main,
                      opacity: 1,
                    }}
                  />
                )}
              </Tabs>
            </Box>
            <Box>
              <TabPanel value={currentTab} index={0} dir={theme.direction}>
                <SelectSlot slots={getSlotsForDate(firstAvailableDay)} currentTab={currentTab} timezone={timezone} />
              </TabPanel>
              <TabPanel value={currentTab} index={1} dir={theme.direction}>
                <Typography variant="h3" color="#FFFFFF" sx={{ textAlign: 'center' }}>
                  {secondAvailableDay?.toFormat(DATE_FULL_NO_YEAR)}
                </Typography>
                <SelectSlot slots={getSlotsForDate(secondAvailableDay)} currentTab={currentTab} timezone={timezone} />
              </TabPanel>
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" sx={{ textAlign: 'center', marginTop: '30px' }}>
            There are no slots available
          </Typography>
        )}
      </>
      <ErrorDialog
        open={choiceErrorDialogOpen}
        title="Please select a date and time"
        description="To continue, please select an available appointment."
        closeButtonText="Close"
        handleClose={() => setChoiceErrorDialogOpen(false)}
      />
      {/* <ErrorDialog
          open={slotsErrorDialogOpen}
          title={t('schedule.errors.availability.title')}
          description={t('schedule.errors.availability.description')}
          closeButtonText={t('general.button.close')}
          handleClose={() => setSlotsErrorDialogOpen(false)}
        /> */}
    </>
  );
};

export default Schedule;
