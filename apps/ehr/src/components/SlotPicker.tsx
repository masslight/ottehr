import { Box, Button, Tab, Tabs, Typography, useTheme } from '@mui/material';
import { StaticDatePicker } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ReactNode, SyntheticEvent, useCallback, useMemo, useState } from 'react';
import { getLocations } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { nextAvailableFrom, ScheduleType, SLUG_SYSTEM } from 'utils';
import { Slots } from './Slots';
interface TabPanelProps {
  children?: ReactNode;
  dir?: string;
  index: number;
  value: number;
}

const DATETIME_FULL_NO_YEAR = 'MMMM d, h:mm a ZZZZ';
const DATE_FULL_NO_YEAR = 'EEEE, MMMM d';
function createLocalDateTime(dateTime: DateTime | undefined, timezone: string): DateTime | undefined {
  let localDateTime: DateTime | undefined;
  if (dateTime !== undefined) {
    localDateTime = dateTime.setZone(timezone);
  }
  return localDateTime;
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
  index: number
): {
  id: string;
  'aria-controls': string;
} => {
  return {
    id: `appointment-picker-tab-${index}`,
    'aria-controls': `appointment-picker-tabpanel-${index}`,
  };
};
interface SlotPickerProps {
  slotData: Slot[] | undefined;
  slotsLoading: boolean;
  selectedLocation: any;
  timezone: string;
  selectedSlot: Slot | undefined;
  setSelectedSlot: (slot: Slot | undefined) => void;
}

const SlotPicker = ({
  slotData,
  slotsLoading,
  selectedLocation,
  timezone,
  selectedSlot,
  setSelectedSlot,
}: SlotPickerProps): JSX.Element => {
  const { oystehrZambda } = useApiClients();
  const theme = useTheme();
  const [currentTab, setCurrentTab] = useState(0);
  const [nextDay, setNextDay] = useState<boolean>(false);
  const [otherDateSlots, setOtherDateSlots] = useState<Slot[]>([]);
  const [otherDateSlotsLoading, setOtherDateSlotsLoading] = useState(false);
  const [selectedOtherDate, setSelectedOtherDate] = useState<DateTime | undefined>();

  const [slotsList, daySlotsMap] = useMemo(() => {
    if (slotData) {
      const slots = [...slotData];

      // This maps days to an array of slots
      const map: { [ord: number]: Slot[] } = slots.reduce(
        (accumulator, current) => {
          const dateOfCurrent = DateTime.fromISO(current.start, { zone: timezone });
          const existing = accumulator[dateOfCurrent.ordinal];
          if (existing) {
            existing.push(current);
          } else {
            accumulator[dateOfCurrent.ordinal] = [current];
          }
          return accumulator;
        },
        {} as { [ord: number]: Slot[] }
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

    firstAvailableDay = createLocalDateTime(DateTime.fromISO(slotsList[0].start), timezone);
    const firstSlot = slotsList[0];
    const firstTime = DateTime.fromISO(firstSlot.start)?.setZone(timezone).toISODate();
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

  const handleChangeTab = useCallback((_: SyntheticEvent, newTab: number) => {
    setCurrentTab(newTab);
    if (newTab >= 2) setSelectedOtherDate(undefined); // reset the selected date
  }, []);

  const selectedDate = useMemo(() => {
    if (currentTab === 0) {
      return firstAvailableDay;
    } else if (secondAvailableDay && currentTab === 1) {
      return secondAvailableDay;
    } else {
      if (selectedOtherDate) {
        return selectedOtherDate;
      }
      return firstAvailableDay;
    }
  }, [currentTab, firstAvailableDay, secondAvailableDay, selectedOtherDate]);

  const getSlotsForDate = useCallback(
    (date: DateTime | undefined): Slot[] => {
      if (date === undefined) {
        return [];
      }
      return daySlotsMap[date.ordinal] ?? [];
    },
    [daySlotsMap]
  );

  const isFirstAppointment = selectedSlot === slotsList[0];
  const slotsExist = getSlotsForDate(firstAvailableDay).length > 0 || getSlotsForDate(secondAvailableDay).length > 0;

  const handleSelectOtherDate = useCallback(
    async (newDate: DateTime | null) => {
      if (!newDate) return;
      setSelectedOtherDate(newDate);

      const locationSlug = selectedLocation?.identifier?.find(
        (identifierTemp: { system: string }) => identifierTemp.system === SLUG_SYSTEM
      )?.value;

      try {
        setOtherDateSlotsLoading(true);

        if (!locationSlug || !oystehrZambda) return;

        const response = await getLocations(oystehrZambda, {
          slug: locationSlug,
          scheduleType: ScheduleType.location,
          selectedDate: newDate.toISODate() ?? undefined,
        });

        setOtherDateSlots(response.available?.map((s) => s.slot) ?? []);
      } catch (error) {
        console.error('Error loading slots for date:', error);
      } finally {
        setOtherDateSlotsLoading(false);
      }
    },
    [oystehrZambda, selectedLocation]
  );

  return (
    <Box sx={{ backgroundColor: theme.palette.background.default, padding: 2, borderRadius: 2, marginTop: 2 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
        }}
      >
        <Typography variant="h3" color="primary" fontSize="20px">
          Select check-in date and time
        </Typography>
        {selectedDate?.offsetNameShort && (
          <Typography color="theme.palette.text.secondary" sx={{ pt: { xs: 1.5, md: 0.5 } }}>
            Time Zone: {selectedDate.setLocale('en-us')?.offsetNameShort}
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
            textTransform: 'none',
            fontWeight: 400,
            display: { xs: 'block', md: 'inline' },
          }}
          onClick={() => setSelectedSlot(slotsList[0])}
          type="button"
          className="first-button"
        >
          <span style={{ fontWeight: 500 }}>First available time:&nbsp;</span>
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
      {!slotsLoading ? (
        <>
          {firstAvailableDay ? (
            <Box>
              <Box sx={{ width: '100%' }}>
                <Tabs
                  value={currentTab}
                  onChange={handleChangeTab}
                  TabIndicatorProps={{
                    style: {
                      // background: otherColors.borderLightBlue,
                      background: theme.palette.secondary.main,
                      height: '5px',
                      borderRadius: '2.5px',
                    },
                  }}
                  variant="fullWidth"
                  aria-label="Appointment tabs for switching between appointments slots for today and tomorrow"
                >
                  <Tab
                    label={nextDay ? 'Tomorrow' : 'Today'}
                    {...tabProps(0)}
                    sx={{
                      color: currentTab == 0 ? theme.palette.secondary.main : theme.palette.text.secondary,
                      opacity: 1,
                      textTransform: 'capitalize',
                      fontWeight: 500,
                    }}
                  />
                  {secondAvailableDay && (
                    <Tab
                      label="Tomorrow"
                      {...tabProps(1)}
                      sx={{
                        color: currentTab == 1 ? theme.palette.secondary.main : theme.palette.text.secondary,
                        opacity: 1,
                        textTransform: 'capitalize',
                        fontWeight: 500,
                      }}
                    />
                  )}
                  <Tab
                    label="Other dates"
                    {...tabProps(secondAvailableDay ? 2 : 1)}
                    sx={{
                      color: currentTab === 2 ? theme.palette.secondary.main : theme.palette.text.secondary,
                      opacity: 1,
                      textTransform: 'capitalize',
                      fontWeight: 500,
                    }}
                  />
                </Tabs>
              </Box>
              <Box>
                <TabPanel value={currentTab} index={0} dir={theme.direction}>
                  <Typography
                    variant="h3"
                    color="#000000"
                    sx={{ textAlign: 'center', fontSize: '20px', color: theme.palette.primary.main }}
                  >
                    {firstAvailableDay?.toFormat(DATE_FULL_NO_YEAR)}
                  </Typography>
                  <Slots
                    slots={getSlotsForDate(firstAvailableDay)}
                    timezone={timezone}
                    selectedSlot={selectedSlot}
                    setSelectedSlot={setSelectedSlot}
                  />
                </TabPanel>
                <TabPanel value={currentTab} index={1} dir={theme.direction}>
                  <Typography
                    variant="h3"
                    color="#000000"
                    sx={{ textAlign: 'center', fontSize: '20px', color: theme.palette.primary.main }}
                  >
                    {secondAvailableDay?.toFormat(DATE_FULL_NO_YEAR)}
                  </Typography>
                  <Slots
                    slots={getSlotsForDate(secondAvailableDay)}
                    timezone={timezone}
                    selectedSlot={selectedSlot}
                    setSelectedSlot={setSelectedSlot}
                  />
                </TabPanel>
                <TabPanel value={currentTab} index={secondAvailableDay ? 2 : 1} dir={theme.direction}>
                  <LocalizationProvider dateAdapter={AdapterLuxon}>
                    <StaticDatePicker
                      displayStaticWrapperAs="desktop"
                      disableHighlightToday={true}
                      views={['month', 'day']}
                      value={selectedOtherDate ?? null}
                      onChange={handleSelectOtherDate}
                      shouldDisableDate={(date) => {
                        const today = DateTime.now().startOf('day');
                        const tomorrow = today.plus({ days: 1 });
                        return date <= tomorrow.endOf('day');
                      }}
                      // Minus one day for timezone shenanigans
                      minDate={firstAvailableDay?.minus({ days: 1 })}
                      // Plus one month for month picker dropdown
                      maxDate={DateTime.fromISO(slotsList[slotsList.length - 1].start)?.plus({ months: 1 })}
                    />
                  </LocalizationProvider>
                  {selectedOtherDate && (
                    <>
                      <Typography
                        variant="h3"
                        color="#000000"
                        sx={{ textAlign: 'center', fontSize: '20px', color: theme.palette.primary.main }}
                      >
                        {selectedOtherDate.toLocaleString(DateTime.DATE_HUGE)}
                      </Typography>
                      <Slots
                        slots={otherDateSlots}
                        timezone={timezone}
                        selectedSlot={selectedSlot}
                        setSelectedSlot={setSelectedSlot}
                        loading={currentTab === (secondAvailableDay ? 2 : 1) && otherDateSlotsLoading}
                      />
                    </>
                  )}
                </TabPanel>
              </Box>
            </Box>
          ) : (
            <Typography variant="body2" color="#000000" sx={{ textAlign: 'center', marginTop: '30px' }}>
              There are no slots available, please come in when we are open.
            </Typography>
          )}
        </>
      ) : (
        <Typography variant="body2" m={1} textAlign={'center'}>
          Loading...
        </Typography>
      )}
    </Box>
  );
};

export default SlotPicker;
