import React, { useState, ReactElement, Fragment } from 'react';
import {
  Paper,
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  MenuItem,
  Button,
  Select,
  InputLabel,
  FormControl,
  IconButton,
  AlertColor,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import { DateTime } from 'luxon';
import DateSearch from '../DateSearch';
import { Location } from 'fhir/r4';
import ScheduleOverridesDialog from '../ScheduleOverridesDialog';
import { Day, Overrides } from '../../pages/Schedule';
import { CapacitySection } from './Capacity';
import { datesCompareFn } from '../../helpers/formatDateTime';

interface ScheduleOverridesProps {
  location: Location;
  dayOfWeek: string;
  overrides: Overrides;
  setLocation: React.Dispatch<React.SetStateAction<Location>>;
  setOverrides: React.Dispatch<React.SetStateAction<any>>;
  updateLocation: any;
  setToastMessage: React.Dispatch<React.SetStateAction<string | undefined>>;
  setToastType: React.Dispatch<React.SetStateAction<AlertColor | undefined>>;
  setSnackbarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function ScheduleOverrides({
  location,
  setLocation,
  overrides,
  setOverrides,
  updateLocation,
  setToastMessage,
  setToastType,
  setSnackbarOpen,
}: ScheduleOverridesProps): ReactElement {
  const [isScheduleOverridesDialogOpen, setIsScheduleOverridesDialogOpen] = useState<boolean>(false);
  const [overridesOpen, setOverridesOpen] = React.useState<{ [index: string]: boolean }>({});
  const handleOverridesSave = (event: any): void => {
    event.preventDefault();
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
          value={type === 'Open' ? overrides[override].open : overrides[override].close}
          onChange={(updatedFrom) => {
            const overridesTemp = { ...overrides };
            if (type === 'Open') {
              overridesTemp[override].open = Number(updatedFrom.target.value);
            } else if (type === 'Close') {
              overridesTemp[override].close = Number(updatedFrom.target.value);
            }
            setOverrides(overridesTemp);
          }}
          size="small"
        >
          {type === 'Open' && <MenuItem value={0}>12:00 AM</MenuItem>}
          <MenuItem value={1}>1:00 AM</MenuItem>
          <MenuItem value={2}>2:00 AM</MenuItem>
          <MenuItem value={3}>3:00 AM</MenuItem>
          <MenuItem value={4}>4:00 AM</MenuItem>
          <MenuItem value={5}>5:00 AM</MenuItem>
          <MenuItem value={6}>6:00 AM</MenuItem>
          <MenuItem value={7}>7:00 AM</MenuItem>
          <MenuItem value={8}>8:00 AM</MenuItem>
          <MenuItem value={9}>9:00 AM</MenuItem>
          <MenuItem value={10}>10:00 AM</MenuItem>
          <MenuItem value={11}>11:00 AM</MenuItem>
          <MenuItem value={12}>12:00 PM</MenuItem>
          <MenuItem value={13}>1:00 PM</MenuItem>
          <MenuItem value={14}>2:00 PM</MenuItem>
          <MenuItem value={15}>3:00 PM</MenuItem>
          <MenuItem value={16}>4:00 PM</MenuItem>
          <MenuItem value={17}>5:00 PM</MenuItem>
          <MenuItem value={18}>6:00 PM</MenuItem>
          <MenuItem value={19}>7:00 PM</MenuItem>
          <MenuItem value={20}>8:00 PM</MenuItem>
          <MenuItem value={21}>9:00 PM</MenuItem>
          <MenuItem value={22}>10:00 PM</MenuItem>
          <MenuItem value={23}>11:00 PM</MenuItem>
          {type === 'Close' && <MenuItem value={24}>12:00 AM</MenuItem>}
        </Select>
      </FormControl>
    );
  };

  return (
    <>
      <Paper>
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
          <form onSubmit={handleOverridesSave}>
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
                {Object.keys(overrides)
                  .sort(datesCompareFn)
                  .map((override) => (
                    <Fragment key={override}>
                      <TableRow>
                        <TableCell>
                          {/* Date Select */}
                          <DateSearch
                            date={DateTime.fromFormat(override, 'D')}
                            required
                            setDate={(date) => {
                              const overridesTemp = { ...overrides };
                              const dateFormatted = date?.toLocaleString(DateTime.DATE_SHORT);
                              if (dateFormatted) {
                                overridesTemp[dateFormatted] = overrides[override];
                                delete overridesTemp[override];
                              }
                              setOverrides(overridesTemp);
                            }}
                            small={true}
                          ></DateSearch>
                        </TableCell>
                        <TableCell>
                          {/* Open Select */}
                          {createOpenCloseSelectField('Open', override)}
                        </TableCell>
                        <TableCell>
                          {/* Opening Buffer Select */}
                          <FormControl sx={{ width: '100%' }}>
                            <InputLabel id="opening-buffer-label">Opening buffer</InputLabel>
                            <Select
                              labelId="opening-buffer-label"
                              label="Opening buffer"
                              id="opening-buffer"
                              value={overrides[override].openingBuffer}
                              onChange={(updatedFrom) => {
                                const overridesTemp = { ...overrides };
                                overridesTemp[override].openingBuffer = Number(updatedFrom.target.value);
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
                              <MenuItem value={30}>30 mins</MenuItem>
                              <MenuItem value={60}>60 mins</MenuItem>
                              <MenuItem value={90}>90 mins</MenuItem>
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          {/* Close Select */}
                          {createOpenCloseSelectField('Close', override)}
                        </TableCell>
                        <TableCell>
                          {/* closing buffer select */}
                          <FormControl sx={{ width: '100%' }}>
                            <InputLabel id="closing-buffer-label">Closing buffer</InputLabel>
                            <Select
                              labelId="closing-buffer-label"
                              label="Closing buffer"
                              id="closing-buffer"
                              value={overrides[override].closingBuffer}
                              onChange={(updatedClosing) => {
                                const overridesTemp = { ...overrides };
                                overridesTemp[override].closingBuffer = Number(updatedClosing.target.value);
                                setOverrides(overridesTemp);
                              }}
                              size="small"
                            >
                              <MenuItem value={0}>0 mins</MenuItem>
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
                              overridesOpenTemp[override] = !overridesOpenTemp[override];
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
                              delete overridesTemp[override];
                              setOverrides(overridesTemp);
                            }}
                            sx={{ marginLeft: 2.5 }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>

                      {overridesOpen[override] && (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <CapacitySection
                              day={overrides[override]}
                              setDay={(dayTemp: Day) => {
                                overrides[override] = dayTemp;
                              }}
                              openingHour={overrides[override].open}
                              closingHour={overrides[override].close}
                              openingBuffer={overrides[override].openingBuffer}
                              closingBuffer={overrides[override].closingBuffer}
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
                  setToastMessage('Cannot have two overrides for the same day');
                  setToastType('warning');
                  setSnackbarOpen(true);
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

            {/* save changes and cancel buttons */}
            <Box marginTop={5} display="flex" flexDirection="row">
              <Button
                variant="contained"
                type="submit"
                disabled={!overrides}
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
            <Typography sx={{ marginTop: 1 }}>
              Please note if you save changes to Schedule Overrides, edits to Working Hours will be saved too.
            </Typography>
          </form>
        </Box>
        <ScheduleOverridesDialog
          location={location}
          setLocation={setLocation}
          overrides={overrides}
          setIsScheduleOverridesDialogOpen={setIsScheduleOverridesDialogOpen}
          handleClose={() => setIsScheduleOverridesDialogOpen(false)}
          open={isScheduleOverridesDialogOpen}
          updateLocation={updateLocation}
        />
      </Paper>
    </>
  );
}
