import AddIcon from '@mui/icons-material/Add';
import { Alert, AlertColor, Box, Paper, Snackbar, Stack, Typography } from '@mui/material';
import { DataGridPro, GridColDef, GridPaginationModel } from '@mui/x-data-grid-pro';
import { FC, useCallback, useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { useParams } from 'react-router-dom';
import { getDevices, unassignDevices } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { DeviceColumns, DeviceProperty, DeviceResponse, Output } from 'utils';
import { DeviceAssignmentModal } from '../components/DeviceAssignModal';
import { ConfirmationModal } from './ConfirmationModal';
import { RoundedButton } from './RoundedButton';

export const PatientDevicesTab: FC<{
  loading?: boolean;
  onViewVitals?: (id: string, type: string, thresholds: any, name: string) => void;
}> = ({ loading, onViewVitals }) => {
  const [openModal, setOpenModal] = useState(false);
  const [openConfirmModal, setOpenConfirmModal] = useState(false);
  const [selectUnassignDevice, setSelectUnassignDevice] = useState<string>('');
  const [assignedDevices, setAssignedDevices] = useState<DeviceColumns[]>([]);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const [totalCount, setTotalCount] = useState(0);
  const { oystehrZambda } = useApiClients();
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastSeverity, setToastSeverity] = useState<AlertColor>('info');
  const [confirmationModal, setConfirmationModal] = useState({
    deviceId: '',
    deviceName: '',
  });
  const { id: patientId } = useParams<{ id: string }>();

  const showToast = useCallback((message: string, severity: AlertColor = 'info') => {
    setToastMessage(message);
    setToastSeverity(severity);
    setToastOpen(true);
  }, []);

  const handleCloseToast = useCallback(() => {
    setToastOpen(false);
  }, []);

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
            name: device?.identifier?.[0]?.value || '-',
            manufacturer: device.manufacturer || '-',
            lastUpdated: device?.meta.lastUpdated || '-',
            serialNumber: device?.serialNumber || '-',
            modelNumber: device?.modelNumber || '-',
            distinctIdentifier: device.distinctIdentifier || '-',
            property: device.property || [],
            deviceType: device.distinctIdentifier || [],
          }));
          setAssignedDevices(devices);
          setTotalCount(response?.total || 0);
        }
      },
      enabled: !!oystehrZambda && !!patientId,
    }
  );

  const handleDeviceVitals = useCallback(
    async (deviceId: string, deviceType: string, thresholds: DeviceProperty[], name: string) => {
      if (onViewVitals) {
        onViewVitals(deviceId, deviceType, thresholds, name);
      }
    },
    [onViewVitals]
  );

  const handlePaginationModelChange = useCallback((newPaginationModel: GridPaginationModel) => {
    setPaginationModel(newPaginationModel);
  }, []);

  const { mutateAsync: unassignDevice, isLoading: isUnassigning } = useMutation(
    (deviceId: string) => unassignDevices({ deviceId, patientId }, oystehrZambda!),
    {
      onSuccess: async (response: any) => {
        setSelectUnassignDevice('');
        const message = response?.message || 'Device unassigned successfully';
        showToast(message, 'success');
        await refetch();
      },
      onError: (error: any) => {
        setSelectUnassignDevice('');
        const message = error?.error || 'Failed to unassign device';
        showToast(message, 'error');
        console.error('Failed to unassign devices:', error);
      },
    }
  );

  const handleUnAssign = async (deviceId: string): Promise<any> => {
    await unassignDevice(deviceId);
  };

  const handleUnassignClick = (deviceId: string, deviceName: string): void => {
    setConfirmationModal({
      deviceId,
      deviceName,
    });
    setOpenConfirmModal(true);
  };

  const handleConfirmUnassign = async (): Promise<any> => {
    setOpenConfirmModal(false);
    setSelectUnassignDevice(confirmationModal.deviceId);
    try {
      await handleUnAssign(confirmationModal.deviceId);
      setConfirmationModal({
        deviceId: '',
        deviceName: '',
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleCloseConfirmation = (): any => {
    setConfirmationModal({
      deviceId: '',
      deviceName: '',
    });
    setOpenConfirmModal(false);
  };

  const deviceTypeMap: Record<string, string> = {
    BP: 'Blood Pressure Monitor',
    BG: 'Blood Glucose Monitor',
    WS: 'Weight Scale',
  };

  const columns: GridColDef<DeviceColumns>[] = [
    {
      field: 'name',
      headerName: 'Device IMEI',
      width: 300,
      sortable: false,
    },
    {
      field: 'deviceType',
      headerName: 'Device Type',
      width: 250,
      sortable: false,
      valueGetter: (params) => deviceTypeMap[params.row.distinctIdentifier] || (params.row?.distinctIdentifier ?? '-'),
    },
    {
      field: 'serialNumber',
      headerName: 'Serial Number',
      width: 250,
      sortable: false,
    },
    {
      field: 'modelNumber',
      headerName: 'Model Number',
      width: 200,
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
      width: 300,
      sortable: false,
      renderCell: (params) => {
        return (
          <div style={{ display: 'flex', width: '100%', gap: '8px' }}>
            <div>
              <RoundedButton
                onClick={() => {
                  console.log(params);
                  void handleDeviceVitals(
                    params.row.id,
                    params.row.distinctIdentifier,
                    params.row.property,
                    params.row.name
                  );
                }}
              >
                View Vitals
              </RoundedButton>
            </div>
            <div>
              <RoundedButton
                onClick={() => handleUnassignClick(params.row.id, params.row.name)}
                disabled={isUnassigning && selectUnassignDevice === params.row.id}
              >
                Unassign Device
              </RoundedButton>
            </div>
          </div>
        );
      },
    },
  ];

  const handleAssignmentResult = useCallback(
    (success: boolean, message?: string) => {
      if (success) {
        showToast(message || 'Device assigned successfully', 'success');
      } else {
        showToast(message || 'Failed to assign device', 'error');
      }
    },
    [showToast]
  );

  return (
    <>
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
                pageSize: 10,
              },
            },
          }}
          autoHeight
          loading={loading || isFetching || isUnassigning}
          pagination
          disableColumnMenu
          pageSizeOptions={[5, 10]}
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
            onAssignmentResult={handleAssignmentResult}
          />
        )}

        <ConfirmationModal
          open={openConfirmModal}
          onClose={handleCloseConfirmation}
          onConfirm={handleConfirmUnassign}
          title="Unassign Device"
          message={`Are you sure you want to unassign device "${confirmationModal.deviceName}"?`}
          confirmText="Unassign"
          loading={isUnassigning && selectUnassignDevice === confirmationModal.deviceId}
        />
      </Paper>

      <Snackbar
        open={toastOpen}
        autoHideDuration={6000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseToast} severity={toastSeverity} sx={{ width: '100%' }}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </>
  );
};
