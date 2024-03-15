import React, { Dispatch, ReactElement, SetStateAction } from 'react';
import {
  OutlinedInput,
  InputLabel,
  MenuItem,
  FormControl,
  ListItemText,
  Checkbox,
  Select,
  SelectChangeEvent,
} from '@mui/material';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

const statuses = ['Pending', 'Booked', 'Arrived', 'Cancelled'];

interface AppointmentsStatusDropdownProps {
  appointmentStatus: string[];
  setAppointmentStatus?: Dispatch<SetStateAction<string[]>>;
}

export default function AppointmentStatusDropdown({
  appointmentStatus,
  setAppointmentStatus,
}: AppointmentsStatusDropdownProps): ReactElement {
  const handleChange = (event: SelectChangeEvent<typeof appointmentStatus>): void => {
    const value = event.target.value;
    value &&
      setAppointmentStatus &&
      setAppointmentStatus(
        // On autofill we get a stringified value.
        typeof value === 'string' ? value.split(',') : value,
      );
  };

  return (
    <div>
      <FormControl sx={{ mt: 2, width: 300 }}>
        <InputLabel id="multiple-checkbox-label">Status</InputLabel>
        <Select
          labelId="multiple-checkbox-label"
          id="multiple-checkbox"
          multiple
          value={appointmentStatus}
          onChange={handleChange}
          input={<OutlinedInput label="Status" />}
          renderValue={(selected) => selected.join(', ')}
          MenuProps={MenuProps}
        >
          {statuses.map((status) => (
            <MenuItem key={status} value={status}>
              <Checkbox checked={appointmentStatus && appointmentStatus.includes(status)} />
              <ListItemText primary={status} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
}
