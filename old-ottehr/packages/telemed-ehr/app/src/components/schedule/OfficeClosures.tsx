import { ReactElement } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { Closure, ClosureType } from '../../types/types';
import DateSearch from '../DateSearch';
import { DateTime } from 'luxon';
import { OVERRIDE_DATE_FORMAT } from '../../helpers/formatDateTime';

interface OfficeClosuresProps {
  closures: Closure[] | undefined;
  setClosures: (closures: Closure[] | undefined) => void;
}

export default function OfficeClosures({ closures, setClosures }: OfficeClosuresProps): ReactElement {
  function handleUpdateClosures(index: number, newClosure: Closure): void {
    const newClosures: Closure[] | undefined = closures?.map((closureTemp, indexTemp) => {
      if (index === indexTemp) {
        return newClosure;
      } else {
        return closureTemp;
      }
    });
    setClosures(newClosures);
  }

  return (
    <Box marginTop={5}>
      <Typography variant="h4" color="primary.dark">
        Closed Dates
      </Typography>
      <Table sx={{ marginTop: 3, tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow key="closures-table-headers" sx={{ height: '40px' }}>
            <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Start Date</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>End Date</TableCell>
            {/* empty header for delete icon */}
            <TableCell sx={{ width: '10%' }}></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {closures &&
            closures
              .sort((d1: Closure, d2: Closure): number => {
                return (
                  DateTime.fromFormat(d1.start, OVERRIDE_DATE_FORMAT).toSeconds() -
                  DateTime.fromFormat(d2.start, OVERRIDE_DATE_FORMAT).toSeconds()
                );
              })
              .map((closure, index) => {
                return (
                  <TableRow key={`closure-${index}`}>
                    <TableCell>
                      <FormControl required>
                        <RadioGroup
                          value={closure.type || undefined}
                          row
                          name="closureType"
                          onChange={(e) => {
                            handleUpdateClosures(index, {
                              start: closure.start,
                              end: e.target.value === ClosureType.OneDay ? '' : closure.end,
                              type: e.target.value,
                            } as Closure);
                          }}
                        >
                          <FormControlLabel
                            value={ClosureType.OneDay}
                            control={<Radio />}
                            label="One day"
                            required
                            sx={{ '.MuiFormControlLabel-asterisk': { display: 'none' } }}
                          />
                          <FormControlLabel
                            value={ClosureType.Period}
                            control={<Radio />}
                            label="Period"
                            required
                            sx={{ '.MuiFormControlLabel-asterisk': { display: 'none' } }}
                          />
                        </RadioGroup>
                      </FormControl>
                    </TableCell>
                    <TableCell>
                      <DateSearch
                        date={DateTime.fromFormat(closure.start, OVERRIDE_DATE_FORMAT)}
                        setDate={(date) => {
                          handleUpdateClosures(index, {
                            start: date?.toFormat(OVERRIDE_DATE_FORMAT) ?? '',
                            end: closure.end,
                            type: closure.type,
                          });
                        }}
                        required
                        closeOnSelect
                        small
                      ></DateSearch>
                    </TableCell>
                    <TableCell>
                      <DateSearch
                        date={closure.end ? DateTime.fromFormat(closure.end, OVERRIDE_DATE_FORMAT) : null}
                        required={closure.type === ClosureType.Period}
                        disabled={closure.type === ClosureType.OneDay}
                        disableDates={(day: DateTime) =>
                          day <= DateTime.fromFormat(closure.start, OVERRIDE_DATE_FORMAT)
                        }
                        setDate={(date) => {
                          handleUpdateClosures(index, {
                            start: closure.start,
                            end: date?.toFormat(OVERRIDE_DATE_FORMAT) ?? '',
                            type: closure.type,
                          });
                        }}
                        closeOnSelect
                        small
                      ></DateSearch>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        color="error"
                        onClick={() => {
                          const deleteIndex = closures.indexOf(closure);
                          const closuresDeepClone: Closure[] = JSON.parse(JSON.stringify(closures));
                          closuresDeepClone.splice(deleteIndex, 1);
                          setClosures(closuresDeepClone);
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
        </TableBody>
      </Table>

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
          const defaultClosure = { start: '', end: '', type: ClosureType.OneDay };
          setClosures([...(closures ?? []), defaultClosure]);
        }}
      >
        Add closed date
      </Button>

      <Typography sx={{ marginTop: 1 }}>
        This override should be utilized when the facility is closed for the whole day and will not be opening at all.
      </Typography>
    </Box>
  );
}
