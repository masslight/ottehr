import { otherColors } from '@ehrTheme/colors';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { LoadingButton, TabContext, TabList, TabPanel } from '@mui/lab';
import {
  Box,
  capitalize,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Typography,
} from '@mui/material';
import Alert, { AlertColor } from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { DateTime } from 'luxon';
import React, { ReactElement, useMemo } from 'react';
import { DailySchedule, DOW, HourOfDay, ScheduleDTO, UpdateScheduleParams } from 'utils';
import { Day, Weekday } from '../../types/types';
import { ScheduleCapacity } from './ScheduleCapacity';
import { ScheduleOverridesComponent, UpdateOverridesInput } from './ScheduleOverridesComponent';

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

  const timeMenuItems = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => (
        <MenuItem key={i} value={i}>
          {i % 12 || 12} {i < 12 ? 'AM' : 'PM'}
        </MenuItem>
      )),
    []
  );

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
          {timeMenuItems}
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
        </form>
      </>
    </Box>
  );
}

interface ScheduleProps {
  item: ScheduleDTO;
  id: string;
  loading: boolean;
  update: (scheduleData: UpdateScheduleParams) => Promise<void>;
  hideOverrides?: boolean;
}

export default function ScheduleComponent({
  item,
  update,
  loading,
  hideOverrides = false,
}: ScheduleProps): ReactElement {
  const today = DateTime.now().toLocaleString({ weekday: 'long' }).toLowerCase();
  const [dayOfWeek, setDayOfWeek] = React.useState(today);
  const [days, setDays] = React.useState<DailySchedule | undefined>(item.schema.schedule);
  const [toastMessage, setToastMessage] = React.useState<string | undefined>(undefined);
  const [toastType, setToastType] = React.useState<AlertColor | undefined>(undefined);
  const [snackbarOpen, setSnackbarOpen] = React.useState<boolean>(false);
  const [savingOverrides, setSavingOverrides] = React.useState<boolean>(false);

  const handleTabChange = (event: React.SyntheticEvent, newDayOfWeek: string): void => {
    setDayOfWeek(newDayOfWeek);
  };

  const handleScheduleUpdate = async (event: any): Promise<void> => {
    event.preventDefault();
    //console.log('handling update', event.target, new FormData(event.target), days);
    await update({ scheduleId: item.id, schedule: days });
  };

  const saveOverrides = async (overrides: UpdateOverridesInput): Promise<void> => {
    setSavingOverrides(true);
    console.log('handling overrides', overrides);
    await update({ scheduleId: item.id, ...overrides });
    setSavingOverrides(false);
  };

  const handleSnackBarClose = (): void => {
    setSnackbarOpen(false);
  };

  React.useEffect(() => {
    setDays(item.schema.schedule);
  }, [item]);

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
                      fontWeight: 500,
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
                    day={days[day as DOW]}
                    setDay={(dayTemp: Day) => {
                      const daysTemp = days;
                      daysTemp[day as DOW] = {
                        ...dayTemp,
                        open: dayTemp.open as HourOfDay,
                        close: dayTemp.close as HourOfDay,
                        workingDay: days[day as DOW].workingDay,
                      };
                      setDays(daysTemp);
                    }}
                    dayOfWeek={dayOfWeek}
                    updateItem={handleScheduleUpdate}
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
      {!hideOverrides && (
        <ScheduleOverridesComponent
          loading={savingOverrides}
          model={item.schema}
          dayOfWeek={dayOfWeek}
          update={saveOverrides}
          setToastMessage={setToastMessage}
          setToastType={setToastType}
          setSnackbarOpen={setSnackbarOpen}
        />
      )}
    </>
  );
}
