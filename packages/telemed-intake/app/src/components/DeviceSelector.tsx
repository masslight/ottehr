import { FormControl, InputLabel, MenuItem, Select, SelectChangeEvent } from '@mui/material';
import { FC } from 'react';

interface Device {
  deviceId: string;
  label: string;
}

interface DeviceSelectorProps {
  devices: Device[];
  handleChange: (e: SelectChangeEvent<string>) => void;
  label: string;
  selectedDevice: string;
}

export const DeviceSelector: FC<DeviceSelectorProps> = ({ devices, selectedDevice, handleChange, label }) => (
  <FormControl fullWidth margin="normal" variant="outlined">
    <InputLabel>{label}</InputLabel>
    <Select label={label} onChange={handleChange} value={selectedDevice}>
      {devices.map((device) => (
        <MenuItem key={device.deviceId} value={device.deviceId}>
          {device.label}
        </MenuItem>
      ))}
    </Select>
  </FormControl>
);
