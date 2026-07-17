import { Alert, Box, Button, Tab, Tabs, Typography, useMediaQuery, useTheme } from '@mui/material';
import { LocalizationProvider, StaticDatePicker } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { FormEvent, ReactNode, SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BOOKING_CONFIG,
  BRANDING_CONFIG,
  createLocalDateTime,
  DATE_FULL_NO_YEAR,
  DATETIME_FULL_NO_YEAR,
  DEFAULT_PREBOOK_MAX_MONTHS_AHEAD,
  nextAvailableFrom,
  ScheduleType,
  ServiceCategoryCode,
} from 'utils';
import { dataTestIds } from '../helpers/data-test-ids';
import { getLocaleDateTimeString } from '../helpers/dateUtils';
import { otherColors } from '../IntakeThemeProvider';
import i18n from '../lib/i18n';
import { breakpoints } from '../providers';
import { useOystehrAPIClient } from '../telemed/utils';
import { SelectSlot } from '.';
import { ErrorDialog, ErrorDialogConfig } from './ErrorDialog';
import { ControlButtons } from './form';

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

interface ScheduleProps {
  slotData: Slot[] | undefined;
  slotsLoading: boolean;
  submitPending?: boolean;
  backButton?: boolean;
  submitLabelAdjective?: string;
  existingSelectedSlot: Slot | undefined;
  handleSlotSelected: (slot: Slot) => void;
  timezone: string;
  forceClosedToday: boolean;
  forceClosedTomorrow: boolean;
  customOnSubmit?: (slot?: Slot) => void;
  // On-demand "Other dates" mode (mirrors the EHR slot picker): when a bookable
  // target is supplied, picking a date in the calendar fetches that day's slots
  // instead of only allowing dates that were preloaded into slotData. Omit these
  // for the legacy preloaded-only behavior (e.g. the reschedule flow).
  bookableSlug?: string;
  bookableScheduleType?: ScheduleType;
  serviceCategoryCode?: ServiceCategoryCode;
  atLocationSlug?: string;
}

const Schedule = ({
  slotData,
  backButton = false,
  slotsLoading,
  existingSelectedSlot,
  handleSlotSelected,
  submitLabelAdjective = i18n.t('schedule.submitLabel'),
  timezone,
  forceClosedToday,
  submitPending,
  customOnSubmit,
  bookableSlug,
  bookableScheduleType,
  serviceCategoryCode,
  atLocationSlug,
}: ScheduleProps): JSX.Element => {
  const theme = useTheme();
  const [currentTab, setCurrentTab] = useState(0);
  const [errorDialog, setErrorDialog] = useState<ErrorDialogConfig | undefined>(undefined);
  const [locallySelectedSlot, setLocallySelectedSlot] = useState<Slot | undefined>(existingSelectedSlot);
  const [slotAvailableCheckPending, setSlotAvailableCheckPending] = useState(false);
  const { t } = useTranslation();

  // On-demand "Other dates" mode: when a bookable target is supplied, the
  // calendar fetches the picked day's slots (like the EHR picker) rather than
  // being limited to the days preloaded in slotData.
  const apiClient = useOystehrAPIClient({ tokenless: true });
  const onDemandDates = Boolean(bookableSlug);
  const [otherDateSlots, setOtherDateSlots] = useState<Slot[]>([]);
  const [otherDateSlotsLoading, setOtherDateSlotsLoading] = useState(false);
  // Tracks the most recently requested other-date so out-of-order slot responses
  // from earlier clicks are ignored (avoids showing date A's slots under date B).
  const latestOtherDateReq = useRef<string | null>(null);
  const bookableMonthsAhead = BOOKING_CONFIG.prebookMaxMonthsAhead ?? DEFAULT_PREBOOK_MAX_MONTHS_AHEAD;

  const processingSubmit = useMemo(() => {
    return slotAvailableCheckPending || submitPending;
  }, [slotAvailableCheckPending, submitPending]);

  useEffect(() => {
    setLocallySelectedSlot(existingSelectedSlot);
  }, [existingSelectedSlot]);

  const hasChosenSlot = locallySelectedSlot !== undefined;

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    // Guard first so both the custom and default submit paths surface the
    // "select a time" dialog instead of silently no-oping when nothing's chosen.
    if (!hasChosenSlot) {
      setErrorDialog({
        title: t('schedule.errors.selection.title'),
        description: t('schedule.errors.selection.description'),
      });
      return;
    }
    if (customOnSubmit) {
      customOnSubmit(locallySelectedSlot);
      return;
    }

    try {
      handleSlotSelected(locallySelectedSlot);
    } catch (error) {
      console.log(error);
      setSlotAvailableCheckPending(false);
    }
  };

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

  const [firstAvailableDay, secondAvailableDay] = useMemo(() => {
    const firstAvailableDay = createLocalDateTime(DateTime.fromISO(slotsList[0]?.start), timezone);
    const secondAvailableDay = nextAvailableFrom(firstAvailableDay, slotsList, timezone);

    return [firstAvailableDay, secondAvailableDay];
  }, [slotsList, timezone]);

  const isFirstAppointment = useMemo(() => {
    return slotsList && slotsList[0] ? locallySelectedSlot === slotsList[0].id : false;
  }, [slotsList, locallySelectedSlot]);

  const handleChange = (_: SyntheticEvent, newCurrentTab: number): void => {
    setCurrentTab(newCurrentTab);
  };

  const [selectedOtherDate, setSelectedOtherDate] = useState<DateTime | undefined>();

  useEffect(() => {
    // In on-demand mode the user picks the "Other dates" day explicitly (slots
    // are fetched on click), so skip the legacy auto-select of a preloaded day.
    if (onDemandDates) return;
    if (selectedOtherDate === undefined && secondAvailableDay != undefined) {
      setSelectedOtherDate(nextAvailableFrom(secondAvailableDay, slotsList, timezone));
    }
  }, [secondAvailableDay, selectedOtherDate, slotsList, timezone, onDemandDates]);

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

  const selectedSlotTimezoneAdjusted = useMemo(() => {
    const selectedAppointmentStart = locallySelectedSlot;
    if (selectedAppointmentStart) {
      return createLocalDateTime(DateTime.fromISO(selectedAppointmentStart.start), timezone);
    }

    return undefined;
  }, [locallySelectedSlot, timezone]);

  const getSlotsForDate = useCallback(
    (date: DateTime | undefined): Slot[] => {
      if (date === undefined) {
        return [];
      }
      return daySlotsMap[date.ordinal] ?? [];
    },
    [daySlotsMap]
  );

  // Fetch the picked day's slots on demand (on-demand mode only). Mirrors the
  // EHR SlotPicker: the calendar itself only needs a wide maxDate; slots for the
  // selected day are loaded here when it's clicked.
  const handleSelectOtherDate = useCallback(
    async (newDate: DateTime | null): Promise<void> => {
      if (!newDate) return;
      setSelectedOtherDate(newDate);
      // Drop any slot chosen for a previous date so a stale selection can't be
      // submitted under the newly picked date.
      setLocallySelectedSlot(undefined);
      if (!onDemandDates || !bookableSlug || !apiClient) return;
      const iso = newDate.toISODate() ?? null;
      latestOtherDateReq.current = iso;
      try {
        setOtherDateSlotsLoading(true);
        const response = await apiClient.getSchedule({
          slug: bookableSlug,
          scheduleType: bookableScheduleType ?? ScheduleType.location,
          selectedDate: iso ?? undefined,
          ...(serviceCategoryCode ? { serviceCategoryCode } : {}),
          ...(atLocationSlug ? { atLocationSlug } : {}),
        });
        // Ignore a response superseded by a newer date selection.
        if (latestOtherDateReq.current !== iso) return;
        setOtherDateSlots(response.available?.map((s) => s.slot) ?? []);
      } catch (error) {
        if (latestOtherDateReq.current !== iso) return;
        console.error('Error loading slots for date:', error);
        setOtherDateSlots([]);
      } finally {
        if (latestOtherDateReq.current === iso) setOtherDateSlotsLoading(false);
      }
    },
    [apiClient, bookableSlug, bookableScheduleType, serviceCategoryCode, atLocationSlug, onDemandDates]
  );

  const [firstAvailableDaySlots, secondAvailableDaySlots, slotsExist] = useMemo(() => {
    const firstAvailableDaySlots = getSlotsForDate(firstAvailableDay);
    const secondAvailableDaySlots = getSlotsForDate(secondAvailableDay);
    const slotsExist = firstAvailableDaySlots.length || secondAvailableDaySlots.length;
    return [firstAvailableDaySlots, secondAvailableDaySlots, slotsExist];
  }, [firstAvailableDay, getSlotsForDate, secondAvailableDay]);

  // Cause TS thinks breakpoints.values may be undefined and won't let me use a non-null assertion.
  const isMobile = useMediaQuery(`(max-width: ${breakpoints.values?.sm}px)`);

  // console.log('office is closed today, tomorrow', forceClosedToday, forceClosedTomorrow);
  // console.log('slots today, slots tomorrow', slotsToday, forceClosedTomorrow);

  const { firstTabVisible } = useMemo(() => {
    return { firstTabVisible: firstAvailableDaySlots.length > 0 || forceClosedToday };
  }, [firstAvailableDaySlots.length, forceClosedToday]);

  /*
  console.log('firstTabVisible', firstTabVisible);
  console.log('secondTabVisible', secondTabVisible);
  console.log('secondAvailableDaySlots', JSON.stringify(secondAvailableDaySlots));
  console.log('secondAvailableDay', secondAvailableDay, secondAvailableDay?.ordinal);
  console.log('daySlotsMap', JSON.stringify(daySlotsMap));
  console.log('timezone', timezone);
*/

  // The "Other dates" tab sits at index 2 when the Tomorrow tab is shown,
  // otherwise index 1. Keep in sync with the tabProps/TabPanel indices below.
  const otherDatesTabIndex = secondAvailableDay ? 2 : 1;
  const showControlButtons = useMemo(() => {
    if (currentTab === 0 && slotsExist) {
      return true;
    }
    if (currentTab === 1 && secondAvailableDaySlots.length) {
      return true;
    }
    // On-demand: the Other-dates tab can be at index 1 (no Tomorrow tab) and is
    // bookable only once a date is picked. Legacy keeps the prior index-2 gate.
    if (onDemandDates && currentTab === otherDatesTabIndex && selectedOtherDate) {
      return true;
    }
    if (!onDemandDates && currentTab === 2 && slotsExist) {
      return true;
    }
    return false;
  }, [currentTab, secondAvailableDaySlots.length, slotsExist, onDemandDates, otherDatesTabIndex, selectedOtherDate]);

  if (slotsList.length === 0) {
    if (!slotsLoading)
      return (
        <Alert severity="error">
          {t('schedule.officeClosed.todayOrTomorrow', { PROJECT_NAME: BRANDING_CONFIG.projectName })}
        </Alert>
      );
    return <></>;
  }

  return (
    <>
      <form onSubmit={(e) => onSubmit(e)}>
        {selectedDate != undefined ? (
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
            onClick={() => {
              setLocallySelectedSlot(slotsList[0]);
              handleSlotSelected(slotsList[0]);
            }}
            type="button"
            className="first-button"
            data-testid={dataTestIds.firstAvailableTime}
          >
            <span style={{ fontWeight: 700 }}>{t('schedule.firstAvailable.label')}</span>
            {isMobile && <br />}
            {firstAvailableDay?.toFormat(DATETIME_FULL_NO_YEAR)}
          </Button>
        ) : slotsExist ? (
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
            <Typography variant="body2">{t('schedule.firstAvailable.calculating')}</Typography>
          </Box>
        ) : (
          <></>
        )}
        {!slotsLoading ? (
          <Box>
            <Box sx={{ width: '100%' }}>
              <Tabs
                value={currentTab}
                onChange={handleChange}
                TabIndicatorProps={{
                  style: {
                    background: otherColors.borderLightBlue,
                    height: '5px',
                    borderRadius: '2.5px',
                  },
                }}
                textColor="inherit"
                variant="fullWidth"
                aria-label={t('schedule.tabAriaLabel')}
              >
                <Tab
                  label={firstAvailableDay?.toLocaleString(DateTime.DATE_MED) || 'Unknown date'}
                  {...tabProps(0)}
                  sx={{
                    color:
                      currentTab == 0 && firstTabVisible ? theme.palette.secondary.main : theme.palette.text.secondary,
                    opacity: 1,
                  }}
                />
                {secondAvailableDay && (
                  <Tab
                    label={secondAvailableDay?.toLocaleString(DateTime.DATE_MED) || 'Unknown date'}
                    {...tabProps(1)}
                    sx={{
                      color:
                        currentTab == 1 || !firstTabVisible
                          ? theme.palette.secondary.main
                          : theme.palette.text.secondary,
                      opacity: 1,
                    }}
                  />
                )}
                <Tab
                  label="Other dates"
                  {...tabProps(otherDatesTabIndex)}
                  sx={{
                    color:
                      currentTab == 2 || !firstTabVisible ? theme.palette.secondary.main : theme.palette.text.secondary,
                    opacity: 1,
                  }}
                />
              </Tabs>
            </Box>
            <Box>
              <TabPanel value={currentTab} index={0} dir={theme.direction}>
                <Typography variant="h3" color={theme.palette.primary.main} sx={{ textAlign: 'center' }}>
                  {firstAvailableDay?.setLocale(i18n.language).toFormat(DATE_FULL_NO_YEAR)}
                </Typography>
                <SelectSlot
                  slots={firstAvailableDaySlots}
                  currentTab={currentTab}
                  timezone={timezone}
                  currentSelectedSlot={locallySelectedSlot}
                  handleSlotSelected={setLocallySelectedSlot}
                  noSlotsMessage={
                    slotsExist
                      ? t('schedule.officeClosed.today', { PROJECT_NAME: BRANDING_CONFIG.projectName })
                      : t('schedule.officeClosed.todayOrTomorrow', { PROJECT_NAME: BRANDING_CONFIG.projectName })
                  }
                />
              </TabPanel>

              {secondAvailableDay && (
                <TabPanel value={currentTab} index={1} dir={theme.direction}>
                  <Typography variant="h3" color="#000000" sx={{ textAlign: 'center' }}>
                    {secondAvailableDay?.setLocale(i18n.language).toFormat(DATE_FULL_NO_YEAR)}
                  </Typography>
                  <SelectSlot
                    slots={secondAvailableDaySlots}
                    currentTab={currentTab}
                    timezone={timezone}
                    currentSelectedSlot={locallySelectedSlot}
                    handleSlotSelected={setLocallySelectedSlot}
                  />
                </TabPanel>
              )}
              <TabPanel value={currentTab} index={otherDatesTabIndex} dir={theme.direction}>
                <LocalizationProvider dateAdapter={AdapterLuxon}>
                  <StaticDatePicker
                    displayStaticWrapperAs="desktop"
                    // openTo="day"
                    // disablePast
                    views={['month', 'day']}
                    value={selectedDate ?? null}
                    onChange={(newDate) => {
                      if (onDemandDates) {
                        void handleSelectOtherDate(newDate);
                      } else if (newDate != null) {
                        setSelectedOtherDate(newDate);
                      }
                    }}
                    // renderInput={(params) => <TextField {...params} />}
                    shouldDisableDate={(date) => {
                      // On-demand mode: any future date is selectable (its slots
                      // are fetched on click); only today/tomorrow are handled by
                      // their own tabs. Legacy mode: only preloaded days.
                      if (onDemandDates) {
                        const tomorrow = DateTime.now().startOf('day').plus({ days: 1 });
                        return date <= tomorrow.endOf('day');
                      }
                      // date.ordinal < firstAvailableDay.ordinal ||
                      // date.ordinal > lastSlotDate.ordinal ||
                      return daySlotsMap[date.ordinal] == null;
                    }}
                    // Minus one day for timezone shenanigans
                    minDate={firstAvailableDay?.minus({ days: 1 })}
                    maxDate={
                      onDemandDates
                        ? firstAvailableDay?.plus({ months: bookableMonthsAhead })
                        : // Plus one month for month picker dropdown
                          DateTime.fromISO(slotsList[slotsList.length - 1].start)?.plus({ months: 1 })
                    }
                  />
                </LocalizationProvider>
                {/* On-demand mode: only show the day's slots once a date is
                    picked (slots are fetched on click). Legacy mode always has a
                    selected date from the preloaded set. */}
                {(!onDemandDates || selectedOtherDate) && (
                  <>
                    <Typography variant="h3" color="#000000" sx={{ textAlign: 'center' }}>
                      {selectedDate ? selectedDate.toLocaleString(DateTime.DATE_HUGE) : 'Unknown date'}
                    </Typography>
                    {onDemandDates && otherDateSlotsLoading ? (
                      <Typography variant="body2" m={1} textAlign={'center'}>
                        {t('schedule.loading')}
                      </Typography>
                    ) : (
                      <SelectSlot
                        slots={onDemandDates ? otherDateSlots : getSlotsForDate(selectedDate)}
                        timezone={timezone}
                        currentSelectedSlot={locallySelectedSlot}
                        handleSlotSelected={setLocallySelectedSlot}
                        noSlotsMessage={onDemandDates ? t('schedule.noSlotsForDate') : undefined}
                      />
                    )}
                  </>
                )}
              </TabPanel>
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" m={1} textAlign={'center'}>
            {t('schedule.loading')}
          </Typography>
        )}

        {showControlButtons && (
          <ControlButtons
            loading={processingSubmit}
            backButton={backButton}
            submitLabel={
              hasChosenSlot && selectedSlotTimezoneAdjusted !== undefined
                ? `${submitLabelAdjective} ${getLocaleDateTimeString(
                    selectedSlotTimezoneAdjusted,
                    'medium',
                    i18n.language
                  )}`
                : t('schedule.selectTime')
            }
          />
        )}
      </form>
      <ErrorDialog
        open={!!errorDialog}
        title={errorDialog?.title || ''}
        description={errorDialog?.description || ''}
        closeButtonText={
          errorDialog?.closeButtonText ?? hasChosenSlot ? t('schedule.selectAnother') : t('schedule.selectATime')
        }
        handleClose={() => {
          setErrorDialog(undefined);
        }}
      />
    </>
  );
};

export default Schedule;
