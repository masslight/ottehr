import { Alert, Box, Button, Tab, Tabs, Typography, useMediaQuery, useTheme } from '@mui/material';
import { LocalizationProvider, StaticDatePicker } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { FormEvent, ReactNode, SyntheticEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createLocalDateTime, DATE_FULL_NO_YEAR, DATETIME_FULL_NO_YEAR, nextAvailableFrom, PROJECT_NAME } from 'utils';
import { dataTestIds } from '../helpers/data-test-ids';
import { getLocaleDateTimeString } from '../helpers/dateUtils';
import { otherColors } from '../IntakeThemeProvider';
import i18n from '../lib/i18n';
import { breakpoints } from '../providers';
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
}: ScheduleProps): JSX.Element => {
  const theme = useTheme();
  const [currentTab, setCurrentTab] = useState(0);
  const [errorDialog, setErrorDialog] = useState<ErrorDialogConfig | undefined>(undefined);
  const [locallySelectedSlot, setLocallySelectedSlot] = useState<Slot | undefined>(existingSelectedSlot);
  const [slotAvailableCheckPending, setSlotAvailableCheckPending] = useState(false);
  const { t } = useTranslation();

  const processingSubmit = useMemo(() => {
    return slotAvailableCheckPending || submitPending;
  }, [slotAvailableCheckPending, submitPending]);

  useEffect(() => {
    setLocallySelectedSlot(existingSelectedSlot);
  }, [existingSelectedSlot]);

  const hasChosenSlot = locallySelectedSlot !== undefined;

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (customOnSubmit) {
      customOnSubmit(locallySelectedSlot);
      return;
    }

    try {
      if (!hasChosenSlot) {
        setErrorDialog({
          title: t('schedule.errors.selection.title'),
          description: t('schedule.errors.selection.description'),
        });
      } else {
        handleSlotSelected(locallySelectedSlot);
      }
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
    if (selectedOtherDate === undefined && secondAvailableDay != undefined) {
      setSelectedOtherDate(nextAvailableFrom(secondAvailableDay, slotsList, timezone));
    }
  }, [secondAvailableDay, selectedOtherDate, slotsList, timezone]);

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

  const showControlButtons = useMemo(() => {
    if (currentTab === 0 && slotsExist) {
      return true;
    } else if (currentTab === 1 && secondAvailableDaySlots.length) {
      return true;
    } else if (currentTab === 2 && slotsExist) {
      return true;
    }
    return false;
  }, [currentTab, secondAvailableDaySlots.length, slotsExist]);

  if (slotsList.length === 0) {
    if (!slotsLoading)
      return <Alert severity="error">{t('schedule.officeClosed.todayOrTomorrow', { PROJECT_NAME })}</Alert>;
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
                  {...tabProps(secondAvailableDay ? 2 : 1)}
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
                <Typography variant="h3" color="#000000" sx={{ textAlign: 'center' }}>
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
                      ? t('schedule.officeClosed.today', { PROJECT_NAME })
                      : t('schedule.officeClosed.todayOrTomorrow', { PROJECT_NAME })
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
                    minDate={firstAvailableDay?.minus({ days: 1 })}
                    // Plus one month for month picker dropdown
                    maxDate={DateTime.fromISO(slotsList[slotsList.length - 1].start)?.plus({ months: 1 })}
                  />
                </LocalizationProvider>
                <Typography variant="h3" color="#000000" sx={{ textAlign: 'center' }}>
                  {selectedDate ? selectedDate.toLocaleString(DateTime.DATE_HUGE) : 'Unknown date'}
                </Typography>
                <SelectSlot
                  slots={getSlotsForDate(selectedDate)}
                  timezone={timezone}
                  currentSelectedSlot={locallySelectedSlot}
                  handleSlotSelected={setLocallySelectedSlot}
                />
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
