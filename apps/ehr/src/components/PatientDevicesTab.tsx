import AddIcon from '@mui/icons-material/Add';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { DataGridPro, GridColDef, GridPaginationModel } from '@mui/x-data-grid-pro';
import { FC, useCallback, useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { useParams } from 'react-router-dom';
import { assignThreshold, getDevices, unassignDevices } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { DeviceColumns, DeviceProperty, DeviceResponse, Output } from 'utils';
import { DeviceAssignmentModal } from '../components/DeviceAssignModal';
import { RoundedButton } from './RoundedButton';
import { ThresholdAssignModal } from './ThresholdAssignModal';

export const PatientDevicesTab: FC<{
  loading?: boolean;
  onViewVitals?: (id: string, type: string, thresholds: any, name: string) => void;
}> = ({ loading, onViewVitals }) => {
  const [openModal, setOpenModal] = useState(false);
  const [deviceId, _setDeviceId] = useState<string>('');
  const [selectUnassignDevice, setSelectUnassignDevice] = useState<string>('');
  const [deviceType, _setDeviceType] = useState<string>('');
  const [thresholdModal, setThresholdModal] = useState(false);
  const [assignedDevices, setAssignedDevices] = useState<DeviceColumns[]>([]);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 5 });
  const [totalCount, setTotalCount] = useState(0);
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
            name: device?.identifier?.[0]?.value || '-',
            manufacturer: device.manufacturer || '-',
            lastUpdated: device.meta.lastUpdated,
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
      onSuccess: async () => {
        setSelectUnassignDevice('');
        await refetch();
      },
      onError: (error: unknown) => {
        setSelectUnassignDevice('');
        console.error('Failed to unassign devices:', error);
      },
    }
  );

  const handleUnAssign = async (deviceId: string): Promise<void> => {
    await unassignDevice(deviceId);
  };

  const { mutateAsync: assignThresholdMutate, isLoading: isUpdatingThreshold } = useMutation(
    (params: { deviceId: string; deviceType: string; thresholds: Record<string, number> }) =>
      assignThreshold(
        {
          deviceId: params.deviceId,
          patientId: patientId!,
          deviceType: params.deviceType,
          thresholds: params.thresholds,
        },
        oystehrZambda!
      ),
    {
      onSuccess: async (): Promise<any> => {
        console.log('Threshold updated successfully');
        await refetch();
      },
      onError: (error: unknown) => {
        console.error('Failed to update threshold:', error);
      },
    }
  );

  const handleSaveThreshold = async (thresholds: Record<string, string>): Promise<any> => {
    if (!deviceId || !patientId) return;

    try {
      const thresholdValues: Record<string, number> = {};

      if (deviceType === 'WS') {
        thresholdValues.weight = parseInt(thresholds.weight || '0');
      } else if (deviceType === 'BG') {
        thresholdValues.glucose = parseInt(thresholds.glucose || '0');
      } else if (deviceType === 'BP') {
        thresholdValues.systolic = parseInt(thresholds.systolic || '0');
        thresholdValues.diastolic = parseInt(thresholds.diastolic || '0');
      } else {
        thresholdValues.default = parseInt(thresholds.default || '0');
      }

      await assignThresholdMutate({ deviceId, deviceType, thresholds: thresholdValues });
    } catch (error) {
      console.error('Failed to save thresholds:', error);
      throw error;
    }
  };

  const deviceTypeMap: Record<string, string> = {
    BP: 'Blood Pressure Monitor',
    BG: 'Blood Glucose Monitor',
    WS: 'Weight Scale',
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
      headerName: 'Device IMEI',
      width: 350,
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
                onClick={async () => {
                  setSelectUnassignDevice(params.row.id);
                  await handleUnAssign(params.row.id);
                }}
                disabled={isUnassigning && selectUnassignDevice == params.row.id}
              >
                Unassign Device
              </RoundedButton>
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
        loading={loading || isFetching || isUnassigning || isUpdatingThreshold}
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
      {deviceId && (
        <ThresholdAssignModal
          open={thresholdModal}
          onClose={() => setThresholdModal(false)}
          deviceId={deviceId}
          deviceType={deviceType}
          onSaveThreshold={handleSaveThreshold}
        />
      )}
    </Paper>
  );
};
