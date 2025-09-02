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
import { useMutation, useQuery } from 'react-query';
import { assignDevices, getDevices } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { Device, Output } from 'utils';

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
  patientId: string;
  refetchAssignedDevices: () => void;
}

interface DeviceOption {
  label: string;
  value: string;
}

export const DeviceAssignmentModal: FC<DeviceAssignmentModalProps> = ({
  open,
  onClose,
  patientId,
  refetchAssignedDevices,
}) => {
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [deviceOptions, setDeviceOptions] = useState<DeviceOption[]>([]);
  const { oystehrZambda } = useApiClients();
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (!open) {
      setSelectedDevices([]);
      setDeviceOptions([]);
      setOffset(0);
      setHasMore(true);
    }
  }, [open]);

  const payload = {
    count: 10,
    offset: offset,
    missing: true,
  };

  const { isFetching: isFetchingDevices } = useQuery(
    ['get-unassigned-devices', offset, { oystehrZambda }],
    () => (oystehrZambda ? getDevices(payload, oystehrZambda) : null),
    {
      onSuccess: (response: Output) => {
        if (response?.devices) {
          const options = response.devices.map((device: Device) => ({
            label: device.identifier?.[0]?.value || 'Unknown Device',
            value: device.id,
          }));
          setDeviceOptions([...deviceOptions, ...options]);
          setHasMore(response.devices.length === 10);
        }
      },
      enabled: !!oystehrZambda && open,
    }
  );

  const { mutateAsync: assignDevicesMutate, isLoading: isAssigning } = useMutation(
    () =>
      assignDevices(
        {
          deviceIds: selectedDevices,
          patientId: patientId,
        },
        oystehrZambda!
      ),
    {
      onSuccess: () => {
        refetchAssignedDevices();
        onClose();
      },
      onError: (error: unknown) => {
        console.error('Failed to assign devices:', error);
      },
    }
  );

  const handleAssign = async (): Promise<void> => {
    await assignDevicesMutate();
  };

  const handleDeviceChange = (event: React.SyntheticEvent, values: DeviceOption[]): void => {
    setSelectedDevices(values.map((option) => option.value));
    event.stopPropagation();
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
            disabled={isAssigning}
            options={deviceOptions}
            value={deviceOptions.filter((option) => selectedDevices.includes(option.value))}
            onChange={handleDeviceChange}
            isOptionEqualToValue={(option, value) => option.value === value.value}
            loading={isFetchingDevices}
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
                  endAdornment: <>{params.InputProps.endAdornment}</>,
                }}
              />
            )}
            ListboxProps={{
              onScroll: (event: React.UIEvent<HTMLUListElement>) => {
                const listboxNode = event.currentTarget;

                if (
                  hasMore &&
                  !isFetchingDevices &&
                  listboxNode.scrollTop + listboxNode.clientHeight >= listboxNode.scrollHeight - 100
                ) {
                  setOffset((prev) => prev + 10); // Load next page
                }
              },
            }}
          />
        </FormControl>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button variant="outlined" onClick={onClose} disabled={isAssigning}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleAssign} disabled={selectedDevices.length === 0 || isAssigning}>
            {isAssigning ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              `Assign Devices (${selectedDevices.length})`
            )}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};
