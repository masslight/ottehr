import CloseIcon from '@mui/icons-material/Close';
import { Autocomplete, Box, Chip, CircularProgress, FormControl, Modal, TextField, Typography } from '@mui/material';
import { FC, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { assignDevices, getDevices } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { Device, Output } from 'utils';
import { RoundedButton } from './RoundedButton';

const modalStyle = {
  position: 'absolute' as const,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 500,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 4,
  display: 'flex',
  flexDirection: 'column',
};

interface DeviceAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  refetchAssignedDevices: () => void;
  onAssignmentResult?: (success: boolean, message?: string) => void;
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
  onAssignmentResult,
}) => {
  const { oystehrZambda } = useApiClients();
  const [selectedDevices, setSelectedDevices] = useState<DeviceOption[]>([]);
  const [deviceOptions, setDeviceOptions] = useState<DeviceOption[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!open) {
      setSelectedDevices([]);
      setDeviceOptions([]);
      setOffset(0);
      setHasMore(true);
      setInputValue('');
      setSearchTerm('');
    }
  }, [open]);

  const payload = {
    count: 10,
    offset,
    missing: true,
    search: searchTerm || undefined,
  };

  const { isFetching: isFetchingDevices } = useQuery(
    ['get-unassigned-devices', offset, searchTerm, { oystehrZambda }],
    () => (oystehrZambda ? getDevices(payload, oystehrZambda) : null),
    {
      onSuccess: (response: Output) => {
        if (response?.devices) {
          const options = response.devices.map((device: Device) => ({
            label: device.identifier?.[0]?.value || 'Unknown Device',
            value: device.id,
          }));

          setDeviceOptions((prev) => {
            if (offset === 0) {
              return options;
            }
            const existingIds = new Set(prev.map((opt) => opt.value));
            const newOptions = options.filter((opt) => !existingIds.has(opt.value));
            return [...prev, ...newOptions];
          });

          setHasMore(response.devices.length === 10);
        }
      },
      enabled: !!oystehrZambda && open,
      keepPreviousData: true,
    }
  );

  const { mutateAsync: assignDevicesMutate, isLoading: isAssigning } = useMutation(
    () =>
      assignDevices(
        {
          deviceIds: selectedDevices.map((d) => d.value),
          patientId,
        },
        oystehrZambda!
      ),
    {
      onSuccess: (response: any) => {
        const message = response?.message || 'Devices assigned successfully';
        onAssignmentResult?.(true, message);
        refetchAssignedDevices();
        onClose();
      },
      onError: (error: any) => {
        const message = error?.error || 'Failed to assign devices';
        onAssignmentResult?.(false, message);
        console.error('Failed to assign devices:', error);
      },
    }
  );

  const handleAssign = async (): Promise<void> => {
    await assignDevicesMutate();
  };

  const handleDeviceChange = (event: React.SyntheticEvent, values: DeviceOption[]): void => {
    setSelectedDevices(values);
  };

  const handleInputChange = (event: React.SyntheticEvent, value: string, reason: string): void => {
    setInputValue(value);

    if (reason === 'input') {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(() => {
        setSearchTerm(value);
        setOffset(0);
        setHasMore(true);
      }, 400);
    }
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

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
            value={selectedDevices}
            onChange={handleDeviceChange}
            inputValue={inputValue}
            onInputChange={handleInputChange}
            isOptionEqualToValue={(option, value) => option.value === value.value}
            loading={isFetchingDevices}
            filterOptions={(x) => x}
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
                    setSelectedDevices((prev) => prev.filter((d) => d.value !== option.value));
                  }}
                  deleteIcon={<CloseIcon />}
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Devices"
                placeholder="Type to search devices..."
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {isFetchingDevices ? <CircularProgress size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
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
                  setOffset((prev) => prev + 10);
                }
              },
            }}
          />
        </FormControl>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <RoundedButton
            variant="contained"
            onClick={handleAssign}
            disabled={selectedDevices.length === 0 || isAssigning}
          >
            {isAssigning ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              `Assign Devices (${selectedDevices.length})`
            )}
          </RoundedButton>
          <RoundedButton variant="outlined" onClick={onClose} disabled={isAssigning}>
            Cancel
          </RoundedButton>
        </Box>
      </Box>
    </Modal>
  );
};
