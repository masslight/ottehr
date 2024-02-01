import { LoadingButton, TabContext, TabList, TabPanel } from '@mui/lab';
import {
  Box,
  Select,
  Typography,
  Checkbox,
  InputLabel,
  MenuItem,
  FormControlLabel,
  FormControl,
  Paper,
  Tab,
  capitalize,
} from '@mui/material';
import Alert, { AlertColor } from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import React, { ReactElement } from 'react';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { CapacitySection } from '../components/schedule/Capacity';
import { Location, LocationHoursOfOperation } from 'fhir/r4';
import useFhirClient from '../hooks/useFhirClient';
import { ScheduleOverrides } from '../components/schedule/Overrides';
import { otherColors } from '../CustomThemeProvider';
import { DateTime } from 'luxon';
import { Operation } from 'fast-json-patch';

interface InfoForDayProps {
  day: Weekday;
  setDay: any;
  dayOfWeek: string;
  updateLocation: any;
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

function InfoForDay({ day, setDay, updateLocation, loading }: InfoForDayProps): ReactElement {
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
    const bufferValue = type === 'Open' ? openingBuffer ?? '' : closingBuffer ?? '';

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
        <form onSubmit={updateLocation}>
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

              <CapacitySection
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
            Please note if you save changes to Working Hours, edits to Schedule Overrides will be saved too.
          </Typography>
        </form>
      </>
    </Box>
  );
}

interface ScheduleProps {
  location: Location;
  id: string;
  setLocation: React.Dispatch<React.SetStateAction<Location>>;
}

interface Weekdays {
  [day: string]: Weekday;
}

export interface Overrides {
  [day: string]: Day;
}

interface Weekday extends Day {
  workingDay: boolean;
}

export interface Day {
  open: number;
  close: number;
  openingBuffer: number;
  closingBuffer: number;
  hours: Capacity[];
}

export interface Capacity {
  hour: number;
  capacity: number;
}

export default function Schedule({ location, setLocation }: ScheduleProps): ReactElement {
  const today = DateTime.now().toLocaleString({ weekday: 'long' }).toLowerCase();
  const [dayOfWeek, setDayOfWeek] = React.useState(today);
  const [days, setDays] = React.useState<Weekdays | undefined>(undefined);
  const [overrides, setOverrides] = React.useState<Overrides | undefined>(undefined);
  const [loading, setLoading] = React.useState<boolean>(false);
  const fhirClient = useFhirClient();
  const [toastMessage, setToastMessage] = React.useState<string | undefined>(undefined);
  const [toastType, setToastType] = React.useState<AlertColor | undefined>(undefined);
  const [snackbarOpen, setSnackbarOpen] = React.useState<boolean>(false);

  const handleTabChange = (event: React.SyntheticEvent, newDayOfWeek: string): void => {
    setDayOfWeek(newDayOfWeek);
  };

  function getWorkingHoursOperation(): Operation | undefined {
    if (!days || !overrides) {
      return;
    }

    const newHoursOfOperation: LocationHoursOfOperation[] = [];
    Object.keys(days).forEach((day) => {
      if (!days[day].workingDay) {
        return;
      }

      const dayInfo: Day = overrides[day] ? overrides[day] : (days[day] as Day);
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

    return newHoursOfOperation.length === 0
      ? undefined
      : {
          op: location.hoursOfOperation ? 'replace' : 'add',
          path: '/hoursOfOperation',
          value: newHoursOfOperation,
        };
  }

  async function updateLocation(event: any): Promise<void> {
    event.preventDefault();
    const extensionTemp = location.extension;
    const extensionSchedule = extensionTemp?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule',
    );
    if (!fhirClient || !extensionSchedule) {
      return;
    }

    if (overrides) {
      Object.keys(overrides).map((overrideTemp) => {
        const today = DateTime.now().toLocaleString(DateTime.DATE_SHORT);
        if (overrideTemp === 'override-new') {
          overrides[today] = overrides[overrideTemp];
          delete overrides['override-new'];
        }
      });
    }

    extensionSchedule.valueString = JSON.stringify({ schedule: days, scheduleOverrides: overrides });
    const operations: Operation[] = [
      {
        op: 'replace',
        path: '/extension',
        value: extensionTemp,
      },
    ];

    const workingHoursOperation = getWorkingHoursOperation();
    if (workingHoursOperation) {
      operations.push(workingHoursOperation);
    }

    setLoading(true);
    await fhirClient.patchResource({
      resourceType: 'Location',
      resourceId: location.id || '',
      operations: operations,
    });

    setLoading(false);
    setToastMessage('Schedule changes saved');
    setToastType('success');
    setSnackbarOpen(true);
  }

  const handleSnackBarClose = (): void => {
    setSnackbarOpen(false);
  };

  React.useEffect(() => {
    const scheduleExtension = location.extension?.find(
      (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule',
    )?.valueString;

    if (scheduleExtension) {
      const scheduleTemp = JSON.parse(scheduleExtension);
      setDays(scheduleTemp.schedule);
      setOverrides(scheduleTemp.scheduleOverrides);
    }
  }, [location.extension]);

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
                      borderLeft: '1px solid #3B98BF',
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
                      borderRight: '1px solid #3B98BF',
                      borderTop: '1px solid #3B98BF',
                      borderBottom: '1px solid #3B98BF',
                      color: '#3B98BF',
                      width: 'fit-content',
                      height: '36px',
                      minHeight: '36px',
                      fontWeight: 700,
                      '&.Mui-selected': {
                        color: '#FFFFFF',
                        background: '#3B98BF',
                      },
                    }}
                    label={capitalize(day)}
                    value={day}
                    key={day}
                  ></Tab>
                ))}
              </TabList>
            </Box>
            <span>{JSON.stringify(undefined)}</span>
            {days &&
              Object.keys(days).map((day) => (
                <TabPanel value={day} key={day}>
                  <InfoForDay
                    day={days[day]}
                    setDay={(dayTemp: Weekday): any => {
                      const daysTemp = days;
                      daysTemp[day] = dayTemp;
                      setDays(daysTemp);
                    }}
                    dayOfWeek={dayOfWeek}
                    updateLocation={updateLocation}
                    loading={loading}
                  ></InfoForDay>
                </TabPanel>
              ))}
          </Box>
        </Paper>
        <Snackbar
          // anchorOrigin={{ vertical: snackbarOpen.vertical, horizontal: snackbarOpen.horizontal }}
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={handleSnackBarClose}
          message={toastMessage}
        >
          <Alert onClose={handleSnackBarClose} severity={toastType} sx={{ width: '100%' }}>
            {toastMessage}
          </Alert>
        </Snackbar>
      </TabContext>
      {overrides && (
        <ScheduleOverrides
          overrides={overrides}
          location={location}
          dayOfWeek={dayOfWeek}
          setLocation={setLocation}
          setOverrides={setOverrides}
          updateLocation={updateLocation}
          setToastMessage={setToastMessage}
          setToastType={setToastType}
          setSnackbarOpen={setSnackbarOpen}
        />
      )}
    </>
  );
}
