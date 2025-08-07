import AddIcon from '@mui/icons-material/Add';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { DataGridPro, GridColDef, GridPaginationModel } from '@mui/x-data-grid-pro';
import { FC, useCallback, useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { getDevices } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { DeviceAssignmentModal } from '../components/DeviceAssignModal';
import { RoundedButton } from './RoundedButton';

interface Device {
  id: string;
  name: string;
  manufacturer: string;
  lastUpdated: string;
}

export const PatientDevicesTab: FC<{ loading: boolean }> = ({ loading }) => {
  const [openModal, setOpenModal] = useState(false);
  const [assignedDevices, setAssignedDevices] = useState<Device[]>([]);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 5 });
  const [totalCount, setTotalCount] = useState(0);
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const payload = {
    offset: paginationModel.page * paginationModel.pageSize,
    count: paginationModel.pageSize,
    patientId: 'Patient/1b1c9771-3da5-4798-aff9-0cea267b62bf',
  };

  const { isFetching } = useQuery(
    ['get-devices', paginationModel, { oystehrZambda }],
    () => (oystehrZambda ? getDevices(payload, oystehrZambda) : null),
    {
      onSuccess: (response) => {
        console.log('Devices fetched successfully:', response);
        if (response?.devices) {
          const devices = response?.devices.map((device: any) => ({
            id: device.id,
            name: device.deviceName[0]?.name || '-',
            manufacturer: device.manufacturer || '-',
            lastUpdated: device.meta.lastUpdated,
          }));
          setAssignedDevices(devices);
          setTotalCount(response.total || 0);
        }
      },
      enabled: !!oystehrZambda,
    }
  );

  const handleViewHeartbeat = useCallback(
    (deviceId: string): void => {
      navigate(`/device/${deviceId}`);
    },
    [navigate]
  );

  const handlePaginationModelChange = useCallback((newPaginationModel: GridPaginationModel) => {
    setPaginationModel(newPaginationModel);
  }, []);

  const columns: GridColDef<Device>[] = [
    {
      field: 'id',
      headerName: 'Device ID',
      width: 350,
      sortable: false,
    },
    {
      field: 'name',
      headerName: 'Device Name',
      width: 350,
      sortable: false,
    },
    {
      field: 'manufacturer',
      headerName: 'Device Manufacturer',
      width: 350,
      sortable: false,
    },
    {
      field: 'lastUpdated',
      headerName: 'Last Updated',
      width: 200,
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
      renderCell: (params) => {
        return (
          <div style={{ display: 'flex', width: '100%', gap: '8px' }}>
            <RoundedButton onClick={() => handleViewHeartbeat(params.row.id)}>View Vitals</RoundedButton>
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
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationModelChange}
        rowCount={totalCount}
        paginationMode="server"
        initialState={{
          pagination: {
            paginationModel: {
              pageSize: 5,
            },
          },
        }}
        autoHeight
        loading={loading || isFetching}
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
        onAssign={() => {
          ('');
        }}
        loadingMore={false}
        hasMore={false}
        onSearch={() => {
          ('');
        }}
        onLoadMore={() => {
          ('');
        }}
      />
    </Paper>
  );
};
