import React from 'react';
import { Box, Table, TableHead, TableRow, TableCell, TableBody, Typography, TextField } from '@mui/material';
import { formatHourNumber } from '../../helpers/formatDateTime';
import { Day } from '../../pages/Schedule';

interface CapacitySectionProps {
  day: Day;
  setDay: (dayTemp: Day) => void;
  openingHour: number;
  closingHour: number;
  openingBuffer: number;
  closingBuffer: number;
}

export const CapacitySection: React.FC<CapacitySectionProps> = ({
  day,
  setDay,
  openingHour,
  closingHour,
  openingBuffer,
  closingBuffer,
}) => {
  const open = openingHour || day.open;
  let close = closingHour || day.close;
  close = close === 0 && open !== 0 ? 24 : close;

  // create a list of all times in 1 hour increments between open and close
  const openHours = React.useMemo(() => {
    const times = [];
    for (let i = open; i < close; i++) {
      times.push(i);
    }
    return times;
  }, [open, close]);

  return (
    <>
      <Box>
        <Table>
          <TableHead>
            <TableRow key="headRow">
              <TableCell sx={{ fontWeight: 'bold' }}>Hour</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '70%' }}># of prebooked slots</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {openHours.map((hour, index) => (
              <TableRow key={hour}>
                <TableCell sx={{ fontSize: '16px' }}>
                  {`${formatHourNumber(hour)} - ${formatHourNumber(hour + 1)}`}
                  {index === 0 && (
                    <Typography variant="body2">{`Opening buffer ${
                      openingBuffer ?? day.openingBuffer ?? '-'
                    } minutes`}</Typography>
                  )}
                  {index === openHours.length - 1 && (
                    <Typography variant="body2">{`Closing buffer ${
                      closingBuffer ?? day.closingBuffer ?? '-'
                    } minutes`}</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    required
                    defaultValue={day.hours.find((capacityTemp) => capacityTemp.hour === hour)?.capacity || 0}
                    onChange={(newCapacity) => {
                      const dayTemp = day;
                      const tempHours = [];
                      for (let i = openingHour; i < close; i++) {
                        let updatedHour = undefined;
                        if (hour === i) {
                          updatedHour = Number(newCapacity.target.value);
                        } else {
                          updatedHour = day.hours.find((hourTemp) => hourTemp.hour === i)?.capacity;
                        }
                        tempHours.push({
                          hour: i,
                          capacity: updatedHour || 0,
                        });
                      }
                      dayTemp.hours = tempHours;
                      setDay(dayTemp);
                    }}
                    sx={{
                      width: '100px',
                    }}
                    InputProps={{
                      inputProps: {
                        min: 0,
                      },
                    }}
                    size="small"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {/* )} */}
    </>
  );
};
