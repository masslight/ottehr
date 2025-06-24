import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  AlertColor,
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import React, { Fragment, ReactElement, useEffect, useMemo, useState } from 'react';
import { HourOfDay, ScheduleExtension, ScheduleOverrides } from 'utils';
import { datesCompareFn, OVERRIDE_DATE_FORMAT } from '../../helpers/formatDateTime';
import { Closure, ClosureType, Day, DOW } from '../../types/types';
import DateSearch from '../DateSearch';
import OfficeClosures from './OfficeClosures';
import { ScheduleCapacity } from './ScheduleCapacity';
import ScheduleOverridesDialog from './ScheduleOverridesDialog';

export interface UpdateOverridesInput {
  scheduleOverrides: ScheduleOverrides;
  closures: Closure[];
}
interface ScheduleOverridesProps {
  model: ScheduleExtension;
  dayOfWeek: string;
  loading: boolean;
  update: (data: UpdateOverridesInput) => Promise<void>;
  setToastMessage: React.Dispatch<React.SetStateAction<string | undefined>>;
  setToastType: React.Dispatch<React.SetStateAction<AlertColor | undefined>>;
  setSnackbarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function ScheduleOverridesComponent({
  model,
  loading,
  update,
  setToastMessage,
  setToastType,
  setSnackbarOpen,
}: ScheduleOverridesProps): ReactElement {
  const [isScheduleOverridesDialogOpen, setIsScheduleOverridesDialogOpen] = useState<boolean>(false);
  const [overridesOpen, setOverridesOpen] = React.useState<{ [index: string]: boolean }>({});
  const [overrides, setOverrides] = React.useState<ScheduleOverrides | undefined>(model.scheduleOverrides);
  const [closures, setClosures] = React.useState<Closure[] | undefined>(model.closures ?? []);

  useEffect(() => {
    setOverrides(model.scheduleOverrides);
    setClosures(model.closures ?? []);
  }, [model]);

  const setToastWarning = (message: string): void => {
    setToastMessage(message);
    setToastType('warning');
    setSnackbarOpen(true);
  };

  const timeMenuItems = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => (
        <MenuItem key={i} value={i}>
          {i % 12 || 12} {i < 12 ? 'AM' : 'PM'}
        </MenuItem>
      )),
    []
  );

  const handleOverridesSave = (event: any): void => {
    event.preventDefault();

    // validate closures
    if (closures) {
      const startDates = closures.map((closure) => closure.start);
      const startDatesSet = new Set(startDates);
      if (startDates.length !== startDatesSet.size) {
        setToastWarning('Closed times cannot start on the same day');
        return;
      }

      for (const closure of closures) {
        if (
          closure.type === ClosureType.Period &&
          DateTime.fromFormat(closure.end, OVERRIDE_DATE_FORMAT) <
            DateTime.fromFormat(closure.start, OVERRIDE_DATE_FORMAT)
        ) {
          setToastWarning('Closed time end date must be after start date');
          return;
        }
      }
    }

    // confirm schedule changes before saving
    setIsScheduleOverridesDialogOpen(true);
  };

  const createOpenCloseSelectField = (type: 'Open' | 'Close', override: string): ReactElement => {
    return (
      <FormControl sx={{ width: '100%' }}>
        {type === 'Open' ? (
          <InputLabel id="open-label">Open</InputLabel>
        ) : (
          <InputLabel id="close-label">Close</InputLabel>
        )}
        <Select
          id={type === 'Open' ? 'open' : 'close'}
          labelId={type === 'Open' ? 'open-label' : 'close-label'}
          label={type === 'Open' ? 'Open' : 'Close'}
          required
          value={type === 'Open' ? overrides?.[override].open : overrides?.[override].close}
          onChange={(updatedFrom) => {
            const overridesTemp = { ...overrides };
            if (type === 'Open') {
              overridesTemp[override].open = Number(updatedFrom.target.value) as HourOfDay;
            } else if (type === 'Close') {
              overridesTemp[override].close = Number(updatedFrom.target.value) as HourOfDay;
            }
            setOverrides(overridesTemp);
          }}
          size="small"
        >
          {type === 'Open' && <MenuItem value={0}>12 AM</MenuItem>}
          {timeMenuItems}
          {type === 'Close' && <MenuItem value={24}>12 AM</MenuItem>}
        </Select>
      </FormControl>
    );
  };

  return (
    <>
      <Paper>
        <form onSubmit={handleOverridesSave}>
          <Box paddingY={2} paddingX={3} marginTop={4}>
            {/* Schedule overrides title */}
            <Typography variant="h4" color="primary.dark">
              Schedule Overrides
            </Typography>

            {/* Schedule overrides subtext */}
            <Typography variant="body1" color="black" marginTop={2}>
              One-time deviations from standing working hours. Any changes made will override the standard working hours
              set above for the date(s) selected.
            </Typography>
            {/* Schedule overrides table */}
            {/* Headers: Date, From, Opening buffer, To, Closing Buffer, Capacity, Trash */}

            <Table sx={{ marginTop: 3, tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow key="headRow" sx={{ height: '40px' }}>
                  <TableCell sx={{ fontWeight: 'bold', width: '19%' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '14%' }}>Open</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '14%' }}>Opening buffer</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '14%' }}>Close</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '14%' }}>Closing buffer</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '17%' }}>Capacity</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '6%' }}>Delete</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {overrides &&
                  Object.keys(overrides)
                    .sort(datesCompareFn(OVERRIDE_DATE_FORMAT))
                    .map((dateString) => (
                      <Fragment key={`override-${dateString}`}>
                        <TableRow>
                          <TableCell>
                            {/* Date Select */}
                            <DateSearch
                              date={DateTime.fromFormat(dateString, 'D')}
                              setDate={(date) => {
                                // get default override values from schedule for selected day
                                const overridesTemp = { ...overrides };
                                const dateFormatted = date?.toLocaleString(DateTime.DATE_SHORT);
                                if (dateFormatted) {
                                  const schedule = model.schedule;
                                  const currentDayOfWeek = date?.toFormat('cccc').toLowerCase() as DOW;
                                  const currentDayInfo = currentDayOfWeek && schedule?.[currentDayOfWeek as DOW];
                                  if (currentDayInfo) {
                                    overridesTemp[dateFormatted] = {
                                      open: currentDayInfo.open,
                                      close: currentDayInfo.close,
                                      openingBuffer: currentDayInfo.openingBuffer,
                                      closingBuffer: currentDayInfo.closingBuffer,
                                      hours: currentDayInfo.hours || [],
                                    };
                                  } else {
                                    overridesTemp[dateFormatted] = overridesTemp[dateString];
                                  }
                                  delete overridesTemp[dateString];
                                }
                                setOverrides(overridesTemp);
                              }}
                              required
                              closeOnSelect
                              small
                            ></DateSearch>
                          </TableCell>
                          <TableCell>
                            {/* Open Select */}
                            {createOpenCloseSelectField('Open', dateString)}
                          </TableCell>
                          <TableCell>
                            {/* Opening Buffer Select */}
                            <FormControl sx={{ width: '100%' }}>
                              <InputLabel id="opening-buffer-label">Opening buffer</InputLabel>
                              <Select
                                labelId="opening-buffer-label"
                                label="Opening buffer"
                                id="opening-buffer"
                                value={overrides[dateString].openingBuffer}
                                onChange={(updatedFrom) => {
                                  const overridesTemp = { ...overrides };
                                  overridesTemp[dateString].openingBuffer = Number(updatedFrom.target.value);
                                  setOverrides(overridesTemp);
                                }}
                                sx={{
                                  display: 'flex',
                                  height: '40px',
                                  flexShrink: 1,
                                }}
                                size="small"
                              >
                                <MenuItem value={0}>0 mins</MenuItem>
                                <MenuItem value={15}>15 mins</MenuItem>
                                <MenuItem value={30}>30 mins</MenuItem>
                                <MenuItem value={60}>60 mins</MenuItem>
                                <MenuItem value={90}>90 mins</MenuItem>
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            {/* Close Select */}
                            {createOpenCloseSelectField('Close', dateString)}
                          </TableCell>
                          <TableCell>
                            {/* closing buffer select */}
                            <FormControl sx={{ width: '100%' }}>
                              <InputLabel id="closing-buffer-label">Closing buffer</InputLabel>
                              <Select
                                labelId="closing-buffer-label"
                                label="Closing buffer"
                                id="closing-buffer"
                                value={overrides[dateString].closingBuffer}
                                onChange={(updatedClosing) => {
                                  const overridesTemp = { ...overrides };
                                  overridesTemp[dateString].closingBuffer = Number(updatedClosing.target.value);
                                  setOverrides(overridesTemp);
                                }}
                                size="small"
                              >
                                <MenuItem value={0}>0 mins</MenuItem>
                                <MenuItem value={15}>15 mins</MenuItem>
                                <MenuItem value={30}>30 mins</MenuItem>
                                <MenuItem value={60}>60 mins</MenuItem>
                                <MenuItem value={90}>90 mins</MenuItem>
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            {/* button that opens the override capacity section */}
                            <Button
                              variant="text"
                              color="primary"
                              endIcon={<ExpandMoreIcon />}
                              sx={{
                                borderRadius: '50px',
                                textTransform: 'none',
                                height: 36,
                                fontWeight: 'bold',
                                display: 'inline-flex',
                              }}
                              onClick={() => {
                                const overridesOpenTemp = { ...overridesOpen };
                                overridesOpenTemp[dateString] = !overridesOpenTemp[dateString];
                                setOverridesOpen(overridesOpenTemp);
                              }}
                            >
                              Override capacity
                            </Button>
                          </TableCell>
                          <TableCell>
                            <IconButton
                              color="error"
                              onClick={() => {
                                const overridesTemp = { ...overrides };
                                delete overridesTemp[dateString];
                                setOverrides(overridesTemp);
                              }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>

                        {overridesOpen[dateString] && (
                          <TableRow>
                            <TableCell colSpan={7}>
                              <ScheduleCapacity
                                day={overrides[dateString]}
                                setDay={(dayTemp: Day) => {
                                  overrides[dateString] = {
                                    ...dayTemp,
                                    open: dayTemp.open as HourOfDay,
                                    close: dayTemp.close as HourOfDay,
                                  };
                                }}
                                openingHour={overrides[dateString].open}
                                closingHour={overrides[dateString].close}
                                openingBuffer={overrides[dateString].openingBuffer}
                                closingBuffer={overrides[dateString].closingBuffer}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
              </TableBody>
            </Table>

            {/* Add new override button */}
            <Button
              variant="outlined"
              color="primary"
              sx={{
                borderRadius: '50px',
                textTransform: 'none',
                height: 36,
                fontWeight: 'bold',
                marginTop: 3,
              }}
              onClick={() => {
                const overridesTemp = { ...overrides };
                if (overridesTemp['override-new']) {
                  setToastWarning('Cannot have two overrides for the same day');
                } else {
                  overridesTemp['override-new'] = {
                    open: 8,
                    close: 17,
                    openingBuffer: 0,
                    closingBuffer: 0,
                    hours: [],
                  };
                }
                setOverrides(overridesTemp);
              }}
            >
              Add override rule
            </Button>

            <OfficeClosures closures={closures} setClosures={setClosures} />

            {/* save changes and cancel buttons */}
            <Box marginTop={5}>
              <Button
                variant="contained"
                type="submit"
                sx={{
                  borderRadius: '50px',
                  textTransform: 'none',
                  height: 36,
                  fontWeight: 'bold',
                }}
              >
                Save Changes
              </Button>
            </Box>
          </Box>
        </form>
        <ScheduleOverridesDialog
          loading={loading}
          handleClose={() => setIsScheduleOverridesDialogOpen(false)}
          open={isScheduleOverridesDialogOpen}
          handleConfirm={() => {
            void update({ scheduleOverrides: overrides ?? {}, closures: closures ?? [] });
            setIsScheduleOverridesDialogOpen(false);
          }}
        />
      </Paper>
    </>
  );
}
