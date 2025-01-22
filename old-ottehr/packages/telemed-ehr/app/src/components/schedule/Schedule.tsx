import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { LoadingButton, TabContext, TabList, TabPanel } from '@mui/lab';
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Typography,
  capitalize,
} from '@mui/material';
import Alert, { AlertColor } from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import React, { ReactElement } from 'react';
import { ScheduleCapacity } from './ScheduleCapacity';
import { HealthcareService, Location, LocationHoursOfOperation, Practitioner } from 'fhir/r4';
import { ScheduleOverrides } from './ScheduleOverrides';
import { otherColors } from '../../CustomThemeProvider';
import { DateTime } from 'luxon';
import { Operation } from 'fast-json-patch';
import { Closure, Day, Overrides, ScheduleExtension, Weekday, Weekdays } from '../../types/types';
import { useApiClients } from '../../hooks/useAppClients';

interface InfoForDayProps {
  day: Weekday;
  setDay: (day: Day) => void;
  dayOfWeek: string;
  updateItem: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  loading: boolean;
}

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const DEFAULT_CAPACITY = 20; // default capacity

export const dayToDayCode: {
  [day: string]: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
} = {
  Monday: 'mon',
  Tuesday: 'tue',
  Wednesday: 'wed',
  Thursday: 'thu',
  Friday: 'fri',
  Saturday: 'sat',
  Sunday: 'sun',
};

export const allWorkingDays = ['sun', 'sat', 'fri', 'mon', 'tue', 'wed', 'thu'];
export function getTimeFromString(time: string): number {
  const timeHour = time.substring(0, 2);
  return Number(timeHour);
}

function InfoForDay({ day, setDay, updateItem, loading }: InfoForDayProps): ReactElement {
  const [open, setOpen] = React.useState<number>(day.open);
  const [openingBuffer, setOpeningBuffer] = React.useState<number>(day.openingBuffer);
  const [close, setClose] = React.useState<number>(day.close ?? 24);
  const [closingBuffer, setClosingBuffer] = React.useState<number>(day.closingBuffer);
  const [workingDay, setWorkingDay] = React.useState<boolean>(day.workingDay);

  function createOpenCloseSelectField(type: 'Open' | 'Close', day: Day): ReactElement {
    const typeLowercase = type.toLocaleLowerCase();
    return (
      <FormControl sx={{ marginRight: 2 }}>
        <InputLabel id={`${typeLowercase}-label`}>{type}</InputLabel>
        <Select
          labelId={`${typeLowercase}-label`}
          id={typeLowercase}
          value={type === 'Open' ? open : close}
          label={type}
          disabled={!workingDay}
          onChange={(newTime) => {
            const updatedTime = Number(newTime.target.value);
            const dayTemp = day;
            if (type === 'Open') {
              setOpen(updatedTime);
              dayTemp.open = updatedTime;
              setDay(dayTemp);
            } else if (type === 'Close') {
              setClose(updatedTime);
              dayTemp.close = updatedTime;
              setDay(dayTemp);
            }
          }}
          sx={{
            width: 200,
            maxWidth: '100%',
            flexShrink: 1,
          }}
          MenuProps={{
            PaperProps: {
              sx: {
                '& .MuiMenuItem-root:hover': {
                  backgroundColor: otherColors.selectMenuHover,
                },
              },
            },
          }}
        >
          {type === 'Open' && <MenuItem value={0}>12 AM</MenuItem>}
          <MenuItem value={1}>1 AM</MenuItem>
          <MenuItem value={2}>2 AM</MenuItem>
          <MenuItem value={3}>3 AM</MenuItem>
          <MenuItem value={4}>4 AM</MenuItem>
          <MenuItem value={5}>5 AM</MenuItem>
          <MenuItem value={6}>6 AM</MenuItem>
          <MenuItem value={7}>7 AM</MenuItem>
          <MenuItem value={8}>8 AM</MenuItem>
          <MenuItem value={9}>9 AM</MenuItem>
          <MenuItem value={10}>10 AM</MenuItem>
          <MenuItem value={11}>11 AM</MenuItem>
          <MenuItem value={12}>12 PM</MenuItem>
          <MenuItem value={13}>1 PM</MenuItem>
          <MenuItem value={14}>2 PM</MenuItem>
          <MenuItem value={15}>3 PM</MenuItem>
          <MenuItem value={16}>4 PM</MenuItem>
          <MenuItem value={17}>5 PM</MenuItem>
          <MenuItem value={18}>6 PM</MenuItem>
          <MenuItem value={19}>7 PM</MenuItem>
          <MenuItem value={20}>8 PM</MenuItem>
          <MenuItem value={21}>9 PM</MenuItem>
          <MenuItem value={22}>10 PM</MenuItem>
          <MenuItem value={23}>11 PM</MenuItem>
          {type === 'Close' && <MenuItem value={24}>12 AM</MenuItem>}
        </Select>
      </FormControl>
    );
  }

  function createOpenCloseBufferSelectField(type: 'Open' | 'Close', day: Day): ReactElement {
    const typeVerb = type === 'Close' ? 'Closing' : 'Opening';
    const typeLowercase = typeVerb.toLocaleLowerCase();
    const bufferValue = type === 'Open' ? (openingBuffer ?? '') : (closingBuffer ?? '');

    return (
      <FormControl sx={{ marginRight: 2 }}>
        <InputLabel id={`${typeLowercase}-buffer-label`}>{typeVerb} Buffer</InputLabel>
        <Select
          labelId={`${typeLowercase}-buffer-label`}
          id={`${typeLowercase}-buffer`}
          value={bufferValue}
          defaultValue={bufferValue}
          label={`${typeVerb} Buffer`}
          disabled={!workingDay}
          onChange={(newNumber) => {
            const updatedNumber = Number(newNumber.target.value);
            const dayTemp = day;
            if (type === 'Open') {
              setOpeningBuffer(updatedNumber);
              dayTemp.openingBuffer = updatedNumber;
              setDay(dayTemp);
            } else if (type === 'Close') {
              setClosingBuffer(updatedNumber);
              dayTemp.closingBuffer = updatedNumber;
              setDay(dayTemp);
            }
          }}
          sx={{
            width: 200,
            maxWidth: '100%',
            flexShrink: 1,
          }}
          MenuProps={{
            PaperProps: {
              sx: {
                '& .MuiMenuItem-root:hover': {
                  backgroundColor: otherColors.selectMenuHover,
                },
              },
            },
          }}
        >
          <MenuItem value={0}>0 mins</MenuItem>
          <MenuItem value={15}>15 mins</MenuItem>
          <MenuItem value={30}>30 mins</MenuItem>
          <MenuItem value={60}>60 mins</MenuItem>
          <MenuItem value={90}>90 mins</MenuItem>
        </Select>
      </FormControl>
    );
  }

  return (
    <Box>
      <>
        {/* Working Hours */}
        <Typography variant="h4" color="primary.dark" marginBottom={3} marginTop={-1}>
          Working Hours
        </Typography>

        {/* Working Hours Form */}

        <Box sx={{ display: 'flex', flexDirection: 'row' }} alignItems="center">
          {/* Checkbox */}
          <FormControlLabel
            control={
              <Checkbox
                checked={workingDay}
                onChange={(event) => {
                  const dayTemp = day;
                  dayTemp.workingDay = event.target.checked;
                  setDay(dayTemp);
                  setWorkingDay(event.target.checked);
                }}
              />
            }
            label="Working Day"
          />

          {createOpenCloseSelectField('Open', day)}
          {createOpenCloseBufferSelectField('Open', day)}

          {createOpenCloseSelectField('Close', day)}
          {createOpenCloseBufferSelectField('Close', day)}
        </Box>

        {/* Capacity */}
        <form onSubmit={updateItem}>
          {workingDay && (
            <Box>
              <Box sx={{ display: 'inline-flex', alignItems: 'center' }} marginBottom={3} marginTop={6}>
                <Typography variant="h4" color="primary.dark">
                  Capacity
                </Typography>

                {/* Visit duration */}
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <InfoOutlinedIcon
                    sx={{
                      marginRight: 1,
                      marginLeft: 3,
                      width: 18,
                      height: 18,
                    }}
                    color="secondary"
                  />
                  <Typography variant="body1">
                    <Box component="span" fontWeight="bold" display="inline">
                      Visit Duration:
                    </Box>{' '}
                    15 minutes
                  </Typography>
                </Box>
              </Box>

              <ScheduleCapacity
                day={day}
                setDay={setDay}
                openingHour={open}
                closingHour={close}
                openingBuffer={openingBuffer}
                closingBuffer={closingBuffer}
              />
            </Box>
          )}
          {/* save changes and cancel buttons */}
          <Box marginTop={3} display="flex" flexDirection="row">
            <LoadingButton
              variant="contained"
              sx={{
                borderRadius: '50px',
                textTransform: 'none',
                height: 36,
                fontWeight: 'bold',
              }}
              type="submit"
              loading={loading}
            >
              Save Changes
            </LoadingButton>
          </Box>
          <Typography sx={{ marginTop: 1 }}>
            Please note if you save changes to Working Hours, edits to Schedule Overrides and Closed Dates will be saved
            too.
          </Typography>
        </form>
      </>
    </Box>
  );
}

interface ScheduleProps {
  item: Location | Practitioner | HealthcareService;
  id: string;
  setItem: React.Dispatch<React.SetStateAction<Location | Practitioner | HealthcareService | undefined>>;
}

export default function Schedule({ item, setItem }: ScheduleProps): ReactElement {
  const today = DateTime.now().toLocaleString({ weekday: 'long' }).toLowerCase();
  const [dayOfWeek, setDayOfWeek] = React.useState(today);
  const [days, setDays] = React.useState<Weekdays | undefined>(undefined);
  const [overrides, setOverrides] = React.useState<Overrides | undefined>(undefined);
  const [closures, setClosures] = React.useState<Closure[]>();
  const [loading, setLoading] = React.useState<boolean>(false);
  const { fhirClient } = useApiClients();
  const [toastMessage, setToastMessage] = React.useState<string | undefined>(undefined);
  const [toastType, setToastType] = React.useState<AlertColor | undefined>(undefined);
  const [snackbarOpen, setSnackbarOpen] = React.useState<boolean>(false);

  const handleTabChange = (event: React.SyntheticEvent, newDayOfWeek: string): void => {
    setDayOfWeek(newDayOfWeek);
  };

  function getWorkingHoursOperation(): Operation | undefined {
    if (!days) {
      return;
    }

    const newHoursOfOperation: LocationHoursOfOperation[] = [];
    Object.keys(days).forEach((day) => {
      const dayInfo: Weekday = days[day];
      if (!dayInfo.workingDay) {
        return;
      }

      let dayHours: LocationHoursOfOperation;
      if (dayInfo.close !== 24) {
        dayHours = {
          openingTime: `${dayInfo.open.toString().padStart(2, '0')}:00:00`,
          closingTime: `${dayInfo.close.toString().padStart(2, '0')}:00:00`,
          daysOfWeek: [dayToDayCode[capitalize(day)]],
        };
      } else {
        dayHours = {
          openingTime: `${dayInfo.open.toString().padStart(2, '0')}:00:00`,
          daysOfWeek: [dayToDayCode[capitalize(day)]],
        };
      }

      newHoursOfOperation.push(dayHours);
    });

    if (newHoursOfOperation.length === 0) {
      return undefined;
    }

    if (item.resourceType === 'Location') {
      return {
        op: item.hoursOfOperation ? 'replace' : 'add',
        path: '/hoursOfOperation',
        value: newHoursOfOperation,
      };
    } else {
      return undefined;
    }
  }

  async function updateItem(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const extensionTemp = item.extension;
    const extensionSchedule = extensionTemp?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule',
    );

    try {
      if (!fhirClient || !extensionSchedule) {
        throw new Error('Failed to update item');
      }

      // Get patch operation for schedule extension that includes schedule/capacities, scheduleOverrides, and closures
      setLoading(true);

      extensionSchedule.valueString = JSON.stringify({
        schedule: days ?? {},
        scheduleOverrides: overrides ?? {},
        closures: closures,
      });
      const operations: Operation[] = [
        {
          op: 'replace',
          path: '/extension',
          value: extensionTemp,
        },
      ];

      // Get patch operation for item hoursOfOperation
      const workingHoursOperation = getWorkingHoursOperation();
      if (workingHoursOperation) {
        operations.push(workingHoursOperation);
      }

      await fhirClient.patchResource({
        resourceType: item.resourceType,
        resourceId: item.id || '',
        operations: operations,
      });

      setLoading(false);
      setToastMessage('Schedule changes saved');
      setToastType('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error(error);
      setToastMessage('Failed to save schedule changes');
      setToastType('error');
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  }

  const handleSnackBarClose = (): void => {
    setSnackbarOpen(false);
  };

  React.useEffect(() => {
    const scheduleExtension = item.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule',
    )?.valueString;

    if (scheduleExtension) {
      const { schedule, scheduleOverrides, closures } = JSON.parse(scheduleExtension) as ScheduleExtension;
      setDays(schedule);
      setOverrides(scheduleOverrides);
      setClosures(closures);
    }
  }, [item.extension]);

  return (
    <>
      <TabContext value={dayOfWeek}>
        {/* seven buttons, one for each day of the week */}
        <Paper>
          <Box paddingTop={1}>
            <Box marginX={3} marginTop={2}>
              <TabList
                TabIndicatorProps={{ style: { backgroundColor: 'transparent' } }}
                sx={{
                  '& .MuiButtonBase-root': {
                    '&:first-of-type': {
                      borderTopLeftRadius: '8px',
                      borderBottomLeftRadius: '8px',
                      borderLeft: '1px solid #2169F5',
                    },

                    '&:last-child': {
                      borderTopRightRadius: '8px',
                      borderBottomRightRadius: '8px',
                    },
                  },
                }}
                onChange={handleTabChange}
                aria-label="Weekdays for the schedule"
              >
                {WEEKDAYS.map((day) => (
                  <Tab
                    sx={{
                      textTransform: 'none',
                      borderRight: '1px solid #2169F5',
                      borderTop: '1px solid #2169F5',
                      borderBottom: '1px solid #2169F5',
                      color: '#2169F5',
                      width: 'fit-content',
                      height: '36px',
                      minHeight: '36px',
                      fontWeight: 700,
                      '&.Mui-selected': {
                        color: '#FFFFFF',
                        background: '#2169F5',
                      },
                    }}
                    label={capitalize(day)}
                    value={day}
                    key={day}
                  ></Tab>
                ))}
              </TabList>
            </Box>
            {days &&
              Object.keys(days).map((day) => (
                <TabPanel value={day} key={day}>
                  <InfoForDay
                    day={days[day]}
                    setDay={(dayTemp: Day) => {
                      const daysTemp = days;
                      daysTemp[day] = { ...dayTemp, workingDay: days[day].workingDay };
                      setDays(daysTemp);
                    }}
                    dayOfWeek={dayOfWeek}
                    updateItem={updateItem}
                    loading={loading}
                  ></InfoForDay>
                </TabPanel>
              ))}
          </Box>
        </Paper>
        <Snackbar
          // anchorOrigin={{ vertical: snackbarOpen.vertical, horizontal: snackbarOpen.horizontal }}
          open={snackbarOpen}
          // autoHideDuration={6000}
          onClose={handleSnackBarClose}
          message={toastMessage}
        >
          <Alert onClose={handleSnackBarClose} severity={toastType} sx={{ width: '100%' }}>
            {toastMessage}
          </Alert>
        </Snackbar>
      </TabContext>
      <ScheduleOverrides
        overrides={overrides}
        closures={closures}
        item={item}
        dayOfWeek={dayOfWeek}
        setItem={setItem}
        setOverrides={setOverrides}
        setClosures={setClosures}
        updateItem={updateItem}
        setToastMessage={setToastMessage}
        setToastType={setToastType}
        setSnackbarOpen={setSnackbarOpen}
      />
    </>
  );
}
