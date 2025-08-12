import AddIcon from '@mui/icons-material/Add';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { DataGridPro, GridColDef, GridPaginationModel } from '@mui/x-data-grid-pro';
import { FC, useCallback, useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { getDevices, unassignDevices } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { DeviceColumns, DeviceResponse, Output } from 'utils';
import { DeviceAssignmentModal } from '../components/DeviceAssignModal';
import { RoundedButton } from './RoundedButton';

export const PatientDevicesTab: FC<{ loading: boolean }> = ({ loading }) => {
  const [openModal, setOpenModal] = useState(false);
  const [assignedDevices, setAssignedDevices] = useState<DeviceColumns[]>([]);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 5 });
  const [totalCount, setTotalCount] = useState(0);
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const { id: patientId } = useParams<{ id: string }>();

  const payload = {
    offset: paginationModel.page * paginationModel.pageSize,
    count: paginationModel.pageSize,
    patientId: patientId ? `Patient/${patientId}` : undefined,
  };

  const { isFetching, refetch } = useQuery(
    ['get-devices', paginationModel, { oystehrZambda }],
    () => (oystehrZambda ? getDevices(payload, oystehrZambda) : null),
    {
      onSuccess: (response: Output) => {
        if (response?.devices) {
          const devices = response?.devices.map((device: DeviceResponse) => ({
            id: device.id,
            name: device.deviceName[0]?.name || '-',
            manufacturer: device.manufacturer || '-',
            lastUpdated: device.meta.lastUpdated,
          }));
          setAssignedDevices(devices);
          setTotalCount(response?.total || 0);
        }
      },
      enabled: !!oystehrZambda && !!patientId,
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

  const { mutateAsync: unassignDevice, isLoading: isUnassigning } = useMutation(
    (deviceId: string) => unassignDevices({ deviceId }, oystehrZambda!),
    {
      onSuccess: async () => {
        await refetch();
      },
      onError: (error: unknown) => {
        console.error('Failed to unassign devices:', error);
      },
    }
  );

  const handleUnAssign = async (deviceId: string): Promise<void> => {
    await unassignDevice(deviceId);
  };

  const columns: GridColDef<DeviceColumns>[] = [
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
      width: 250,
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
            <div>
              <RoundedButton
                onClick={async () => {
                  await handleUnAssign(params.row.id);
                }}
                disabled={isUnassigning}
                variant="outlined"
              >
                Unassign Device
              </RoundedButton>
            </div>
            <div>
              <RoundedButton onClick={() => handleViewHeartbeat(params.row.id)}>View Vitals</RoundedButton>
            </div>
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
        <RoundedButton
          onClick={() => setOpenModal(true)}
          variant="contained"
          startIcon={<AddIcon fontSize="small" />}
          disabled={!patientId}
        >
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
        loading={loading || isFetching || isUnassigning}
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

      {patientId && (
        <DeviceAssignmentModal
          open={openModal}
          onClose={() => setOpenModal(false)}
          patientId={patientId}
          refetchAssignedDevices={refetch}
        />
      )}
    </Paper>
  );
};
