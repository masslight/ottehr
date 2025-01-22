import {
  Box,
  Button,
  FormControl,
  MenuItem,
  Select,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { DateTime } from 'luxon';
import { ReactNode, SyntheticEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { breakpoints, findLabelFromOptions, RenderLabelFromSelect } from 'ottehr-components';
import { useAppointmentStore } from '../features/appointments';
import { SelectSlot } from './schedule/SelectSlot';
import { DATETIME_FULL_NO_YEAR, availableTimezones, createLocalDateTime, getBestTimezone } from 'ottehr-utils';
import { LocalizationProvider, StaticDatePicker } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';

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
  const theme = useTheme();
  const { t } = useTranslation();
  const { selectedSlot, setAppointment } = useAppointmentStore((state) => state);
  const [currentTab, setCurrentTab] = useState(0);
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

  const [formTimezone, setTimezone] = useState(getBestTimezone());

  const { firstAvailableDay, secondAvailableDay, lastSlotDate } = useMemo(() => {
    let firstAvailableDay: DateTime | undefined = undefined;
    let secondAvailableDay: DateTime | undefined = undefined;

    if (slotData == null || slotData.length === 0) {
      return { firstAvailableDay, secondAvailableDay, lastSlot: undefined };
    }

    firstAvailableDay = createLocalDateTime(DateTime.fromISO(slotData[0]), formTimezone);
    if (firstAvailableDay) {
      secondAvailableDay = nextAvailableFrom(firstAvailableDay, slotData, formTimezone);
    }

    const lastSlotDate = DateTime.fromISO(slotData[slotData.length - 1]);

    return { firstAvailableDay, secondAvailableDay, lastSlotDate };
  }, [formTimezone, slotData]);

  const isFirstAppointment = useMemo(() => {
    return slotData && slotData[0] ? selectedSlot === slotData[0] : false;
  }, [selectedSlot, slotData]);

  const handleChange = (_: SyntheticEvent, newCurrentTab: number): void => {
    setCurrentTab(newCurrentTab);
  };

  const [selectedOtherDate, setSelectedOtherDate] = useState<DateTime | undefined>();

  useEffect(() => {
    if (selectedOtherDate === undefined && secondAvailableDay != undefined && slotData) {
      setSelectedOtherDate(nextAvailableFrom(secondAvailableDay, slotData, formTimezone));
    }
  }, [formTimezone, secondAvailableDay, selectedOtherDate, slotData]);

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

  if (slotsList.length === 0) {
    return <Typography variant="body1">{t('schedule.noSlotsAvailable')}</Typography>;
  }

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
        <Typography variant="h3" color="secondary">
          {t('schedule.selectDate')}
        </Typography>
        <FormControl sx={{ pt: { xs: 1, md: 0 }, width: '150px' }}>
          <Select
            variant="standard"
            labelId="select-timezone-label"
            id="select-timezone"
            value={formTimezone}
            label="Timezone"
            sx={{ height: '25px' }}
            MenuProps={{ disableScrollLock: true }}
            onChange={(event) => {
              setTimezone(event.target.value);
            }}
            renderValue={(selected) => {
              return (
                <RenderLabelFromSelect styles={{ color: theme.palette.text.secondary }}>
                  {t('schedule.timezone', {
                    timezone: findLabelFromOptions(selected, availableTimezones(selectedDate)),
                  })}
                </RenderLabelFromSelect>
              );
            }}
          >
            {availableTimezones(selectedDate).map((timezone) => {
              const { value, label } = timezone;
              return (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
      </Box>
      {slotsList && selectedDate != undefined ? (
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
          <span style={{ fontWeight: 700 }}>{t('schedule.firstAvailableTime')}&nbsp;</span>
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
          }}
        >
          <Typography variant="body2">{t('schedule.calculatingFirstAvailableTime')}</Typography>
        </Box>
      )}
      {firstAvailableDay != undefined ? (
        <Box>
          <Box sx={{ width: '100%' }}>
            <Tabs
              value={currentTab}
              onChange={handleChange}
              TabIndicatorProps={{
                style: {
                  background: theme.palette.secondary.main,
                  height: '5px',
                  borderRadius: '2.5px',
                },
              }}
              textColor="inherit"
              variant="fullWidth"
              aria-label={t('schedule.tabsArialLabel')}
            >
              <Tab
                label={firstAvailableDay.toLocaleString(DateTime.DATE_MED)}
                {...tabProps(0)}
                sx={{
                  color: currentTab == 0 ? theme.palette.secondary.main : theme.palette.primary.main,
                  opacity: 1,
                  fontWeight: currentTab == 0 ? 700 : 400,
                }}
              />
              {secondAvailableDay && (
                <Tab
                  label={secondAvailableDay.toLocaleString(DateTime.DATE_MED)}
                  {...tabProps(1)}
                  sx={{
                    color: currentTab == 1 ? theme.palette.secondary.main : theme.palette.primary.main,
                    opacity: 1,
                    fontWeight: currentTab == 1 ? 700 : 400,
                  }}
                />
              )}
              <Tab
                label="Other dates"
                {...tabProps(2)}
                sx={{
                  color: currentTab == 2 ? theme.palette.secondary.main : theme.palette.primary.main,
                  opacity: 1,
                  fontWeight: currentTab == 2 ? 700 : 400,
                }}
              />
            </Tabs>
          </Box>
          <Box>
            <TabPanel value={currentTab} index={0} dir={theme.direction}>
              <Typography variant="h3" color="#000000" sx={{ textAlign: 'center' }}>
                {firstAvailableDay.toLocaleString(DateTime.DATE_HUGE)}
              </Typography>
              <SelectSlot slots={getSlotsForDate(firstAvailableDay)} timezone={formTimezone} />
            </TabPanel>
            {secondAvailableDay && (
              <TabPanel value={currentTab} index={1} dir={theme.direction}>
                <Typography variant="h3" color="#000000" sx={{ textAlign: 'center' }}>
                  {secondAvailableDay.toLocaleString(DateTime.DATE_HUGE)}
                </Typography>
                <SelectSlot slots={getSlotsForDate(secondAvailableDay)} timezone={formTimezone} />
              </TabPanel>
            )}

            {firstAvailableDay && lastSlotDate && (
              <TabPanel value={currentTab} index={secondAvailableDay ? 2 : 1} dir={theme.direction}>
                <LocalizationProvider dateAdapter={AdapterLuxon}>
                  <StaticDatePicker
                    displayStaticWrapperAs="desktop"
                    // openTo="day"
                    // disablePast
                    views={['month', 'day']}
                    value={selectedDate ?? null}
                    onChange={(newDate) => {
                      if (newDate != null) {
                        setSelectedOtherDate(newDate);
                      }
                    }}
                    // renderInput={(params) => <TextField {...params} />}
                    shouldDisableDate={(date) =>
                      // date.ordinal < firstAvailableDay.ordinal ||
                      // date.ordinal > lastSlotDate.ordinal ||
                      daySlotsMap[date.ordinal] == null
                    }
                    // Minus one day for timezone shenanigans
                    minDate={firstAvailableDay.minus({ days: 1 })}
                    // Plus one month for month picker dropdown
                    maxDate={lastSlotDate.plus({ months: 1 })}
                  />
                </LocalizationProvider>
                <Typography variant="h3" color="#000000" sx={{ textAlign: 'center' }}>
                  {selectedDate ? selectedDate.toLocaleString(DateTime.DATE_HUGE) : t('schedule.unknownDate')}
                </Typography>
                <SelectSlot slots={getSlotsForDate(selectedDate)} timezone={formTimezone} />
              </TabPanel>
            )}
          </Box>
        </Box>
      ) : (
        <Typography variant="body2" m={1} textAlign={'center'}>
          {t('general.loading')}
        </Typography>
      )}
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
