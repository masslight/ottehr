import AddIcon from '@mui/icons-material/Add';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DeviceAssignmentModal } from '../components/DeviceAssignModal';
import { RoundedButton } from './RoundedButton';

interface Device {
  id: string;
  name: string;
  deviceId: string;
  dateTime?: string;
}

export const PatientDevicesTab: FC<{ loading: boolean }> = ({ loading }) => {
  const [openModal, setOpenModal] = useState(false);
  const [assignedDevices, setAssignedDevices] = useState<Device[]>([]);
  const [availableDevices, setAvailableDevices] = useState<Device[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [_searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const allDevices = useRef<Device[]>([]);

  const loadMoreDevices = useCallback(() => {
    if (loadingMore) return;

    setLoadingMore(true);
    setTimeout(() => {
      const newDevices = Array.from({ length: 20 }, (_, i) => ({
        id: `new-${availableDevices.length + i}`,
        name: `Device ${availableDevices.length + i + 1}`,
        deviceId: `DV-${10000 + availableDevices.length + i}`,
      }));

      const updatedDevices = [...availableDevices, ...newDevices];
      setAvailableDevices(updatedDevices);
      allDevices.current = updatedDevices;
      setLoadingMore(false);
      setHasMore(updatedDevices.length < 100);
    }, 1000);
  }, [availableDevices, loadingMore]);

  useEffect(() => {
    const initialDevices = [
      { id: '1', name: 'Blood Glucose Meter', deviceId: 'BG-12345', dateTime: '2023-05-15T10:30:00Z' },
      { id: '2', name: 'Sphygmomanometer', deviceId: 'SM-67890', dateTime: '2023-05-10T14:45:00Z' },
    ];
    setAssignedDevices(initialDevices);
    setAvailableDevices(initialDevices);
    allDevices.current = initialDevices;
    loadMoreDevices();
  }, [loadMoreDevices]);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    if (term) {
      setAvailableDevices(
        allDevices.current.filter(
          (device) =>
            device.name.toLowerCase().includes(term.toLowerCase()) ||
            device.deviceId.toLowerCase().includes(term.toLowerCase())
        )
      );
    } else {
      setAvailableDevices(allDevices.current);
    }
  }, []);

  const handleAssignDevices = useCallback(
    (deviceIds: string[]): void => {
      const selectedDevices = availableDevices.filter((device) => deviceIds.includes(device.id));
      const now = new Date().toISOString();
      const devicesToAdd = selectedDevices.map((device) => ({
        ...device,
        dateTime: now,
      }));
      setAssignedDevices((prev) => [...prev, ...devicesToAdd]);
      setAvailableDevices((prev) => prev.filter((device) => !deviceIds.includes(device.id)));
      alert(`${selectedDevices.length} device(s) assigned successfully!`);
    },
    [availableDevices]
  );

  const handleViewHeartbeat = useCallback(
    (deviceId: string): void => {
      navigate(`/device/${deviceId}`);
    },
    [navigate]
  );
  const columns: GridColDef<Device>[] = [
    {
      field: 'name',
      headerName: 'Device Name',
      width: 350,
      sortable: false,
    },
    {
      field: 'deviceId',
      headerName: 'Device ID',
      width: 350,
      sortable: false,
    },
    {
      field: 'dateTime',
      headerName: 'Date & Time',
      width: 350,
      sortable: false,
      valueFormatter: (params) => {
        if (!params.value) return '-';
        const date = new Date(params.value);
        return date.toLocaleString();
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 350,
      sortable: false,
      renderCell: () => {
        return (
          <div style={{ display: 'flex', width: '100%', gap: '8px' }}>
            <RoundedButton onClick={() => handleViewHeartbeat('1')}>View Vitals</RoundedButton>
            <RoundedButton
              onClick={() => {
                ('');
              }}
            >
              Unassign Device
            </RoundedButton>
          </div>
        );
      },
    },
  ];

  return (
    <Paper sx={{ padding: 3 }} component={Stack} spacing={2}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="h4" color="primary.dark" sx={{ flexGrow: 1 }}>
          Patient Devices
        </Typography>
        <RoundedButton onClick={() => setOpenModal(true)} variant="contained" startIcon={<AddIcon fontSize="small" />}>
          Assign New Device
        </RoundedButton>
      </Box>

      <DataGridPro
        rows={assignedDevices}
        columns={columns}
        initialState={{
          pagination: {
            paginationModel: {
              pageSize: 5,
            },
          },
        }}
        autoHeight
        loading={loading}
        pagination
        disableColumnMenu
        pageSizeOptions={[5]}
        disableRowSelectionOnClick
        sx={{
          width: '100%',
          border: 0,
          overflowX: 'auto',
          '.MuiDataGrid-columnHeaderTitle': {
            fontWeight: 500,
            whiteSpace: 'normal',
            lineHeight: 1.2,
          },
          '.MuiDataGrid-cell': {
            whiteSpace: 'normal',
            lineHeight: 1.4,
          },
        }}
      />

      <DeviceAssignmentModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onAssign={handleAssignDevices}
        availableDevices={availableDevices}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onSearch={handleSearch}
        onLoadMore={loadMoreDevices}
      />
    </Paper>
  );
};
