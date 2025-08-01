import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Modal,
  OutlinedInput,
  Paper,
  Popover,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { FC, useEffect, useRef, useState } from 'react';

interface Device {
  id: string;
  name: string;
  deviceId: string;
}

interface DeviceAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  onAssign: (deviceIds: string[]) => void;
  availableDevices: Device[];
  loadingMore: boolean;
  hasMore: boolean;
  onSearch: (searchTerm: string) => void;
  onLoadMore: () => void;
}

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

export const DeviceAssignmentModal: FC<DeviceAssignmentModalProps> = ({
  open,
  onClose,
  onAssign,
  availableDevices,
  loadingMore,
  hasMore,
  onSearch,
  onLoadMore,
}) => {
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setSelectedDevices([]);
      setSearchTerm('');
      setDropdownOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (dropdownOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [dropdownOpen]);

  const handleDeviceSelection = (deviceId: string): void => {
    return setSelectedDevices((prev) =>
      prev.includes(deviceId) ? prev.filter((id) => id !== deviceId) : [...prev, deviceId]
    );
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setSearchTerm(value);
    onSearch(value);
  };

  const handleAssign = (): void => {
    onAssign(selectedDevices);
    onClose();
  };

  const handleToggleDropdown = (): void => {
    setDropdownOpen((prev) => !prev);
  };

  const handleCloseDropdown = (): void => {
    setDropdownOpen(false);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + clientHeight) < 50 && !loadingMore && hasMore && !searchTerm) {
      onLoadMore();
    }
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
          <InputLabel id="devices-select-label">Devices</InputLabel>
          <Select
            labelId="devices-select-label"
            id="devices-select"
            multiple
            open={dropdownOpen}
            onOpen={handleToggleDropdown}
            onClose={handleCloseDropdown}
            value={selectedDevices}
            input={<OutlinedInput id="select-multiple-chip" label="Devices" />}
            renderValue={(selected) => (
              <Box
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    handleToggleDropdown();
                  }
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
              >
                {selected.map((value) => {
                  const device = availableDevices.find((d) => d.id === value);
                  return (
                    <Chip
                      key={value}
                      label={device ? `${device.name} (${device.deviceId})` : value}
                      onDelete={(e) => {
                        setSelectedDevices((prev) => prev.filter((id) => id !== value));
                        e.stopPropagation();
                      }}
                      deleteIcon={
                        <CloseIcon
                          fontSize="small"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        />
                      }
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      sx={{
                        '& .MuiChip-deleteIcon': {
                          pointerEvents: 'auto',
                        },
                      }}
                    />
                  );
                })}
              </Box>
            )}
            ref={anchorRef}
          />

          <Popover
            open={dropdownOpen}
            anchorEl={anchorRef.current}
            onClose={handleCloseDropdown}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
            sx={{
              '& .MuiPaper-root': {
                width: anchorRef.current?.clientWidth,
                maxHeight: 300,
                mt: 1,
              },
            }}
          >
            <Paper elevation={3} sx={{ width: '100%', maxHeight: 300, overflow: 'auto' }}>
              <Box sx={{ p: 1 }}>
                <TextField
                  inputRef={searchInputRef}
                  size="small"
                  fullWidth
                  placeholder="Search devices..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                  autoFocus
                />
              </Box>
              <Divider />
              <div onScroll={handleScroll} style={{ maxHeight: 200, overflow: 'auto' }}>
                {availableDevices.map((device) => (
                  <MenuItem
                    key={device.id}
                    selected={selectedDevices.includes(device.id)}
                    onClick={() => handleDeviceSelection(device.id)}
                  >
                    {device.name} ({device.deviceId})
                  </MenuItem>
                ))}
                {loadingMore && (
                  <Box display="flex" justifyContent="center" p={1}>
                    <CircularProgress size={20} />
                  </Box>
                )}
                {!hasMore && availableDevices.length > 0 && (
                  <Box display="flex" justifyContent="center" p={1}>
                    <Typography variant="body2" color="text.secondary">
                      No more devices
                    </Typography>
                  </Box>
                )}
                {availableDevices.length === 0 && (
                  <Box display="flex" justifyContent="center" p={2}>
                    <Typography variant="body2" color="text.secondary">
                      No devices found
                    </Typography>
                  </Box>
                )}
              </div>
            </Paper>
          </Popover>
        </FormControl>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleAssign} disabled={selectedDevices.length === 0}>
            Assign Devices
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};
