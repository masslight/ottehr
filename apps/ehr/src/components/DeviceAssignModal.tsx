import CloseIcon from '@mui/icons-material/Close';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  Modal,
  TextField,
  Typography,
} from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { useQuery } from 'react-query';
import { getDevices } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 500,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
  display: 'flex',
  flexDirection: 'column',
};

interface DeviceAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  onAssign: (deviceIds: string[]) => void;
  loadingMore: boolean;
  hasMore: boolean;
  onSearch: (searchTerm: string) => void;
  onLoadMore: () => void;
}

interface DeviceOption {
  label: string;
  value: string;
}

export const DeviceAssignmentModal: FC<DeviceAssignmentModalProps> = ({ open, onClose, onAssign }) => {
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [deviceOptions, setDeviceOptions] = useState<DeviceOption[]>([]);
  //eslint-disable-next-line
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!open) {
      setSelectedDevices([]);
      setSearchTerm('');
    }
  }, [open]);

  const handleAssign = (): void => {
    onAssign(selectedDevices);
    onClose();
  };

  const { oystehrZambda } = useApiClients();

  const payload = {
    offset: 0,
    count: 15,
    missing: true,
  };

  const { isFetching } = useQuery(
    ['get-unassigned-devices', { oystehrZambda }],
    () => (oystehrZambda ? getDevices(payload, oystehrZambda) : null),
    {
      onSuccess: (response) => {
        if (response?.devices) {
          const options = response.devices.map((device: any) => ({
            label: device.deviceName[0]?.name || 'Unknown Device',
            value: device.id,
          }));
          setDeviceOptions(options);
        }
      },
      enabled: !!oystehrZambda && open,
    }
  );

  const handleDeviceChange = (values: DeviceOption[]): void => {
    setSelectedDevices(values.map((option) => option.value));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="assign-devices-modal"
      aria-describedby="select-devices-to-assign"
    >
      <Box sx={modalStyle}>
        <Typography id="assign-devices-modal" variant="h6" component="h2" mb={2}>
          Assign Devices
        </Typography>

        <FormControl fullWidth sx={{ mb: 3 }}>
          <Autocomplete
            multiple
            disableCloseOnSelect
            disabled={isFetching}
            options={deviceOptions}
            value={deviceOptions.filter((option) => selectedDevices.includes(option.value))}
            onChange={(event, values) => handleDeviceChange(event, values || [])}
            isOptionEqualToValue={(option, value) => option.value === value.value}
            loading={isFetching}
            renderOption={(props, option) => (
              <li {...props} key={option.value}>
                {option.label}
              </li>
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option.value}
                  label={option.label}
                  onDelete={() => {
                    setSelectedDevices(selectedDevices.filter((id) => id !== option.value));
                  }}
                  deleteIcon={<CloseIcon />}
                />
              ))
            }
            fullWidth
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Devices"
                placeholder="Select Devices"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {isFetching ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </FormControl>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleAssign} disabled={selectedDevices.length === 0}>
            Assign Devices ({selectedDevices.length})
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};
