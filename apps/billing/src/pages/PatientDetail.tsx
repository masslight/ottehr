import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Tab,
  Typography,
} from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import { ReactElement, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { chooseJson, PatientDetailResponse } from 'utils';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { DetailRow } from '../components/DetailRow';
import { CLAIM_STATUS_COLORS, formatClaimStatus } from '../constants/claimStatus';
import { useApiClients } from '../hooks/useAppClients';
import { otherColors } from '../themes/ottehr/colors';
import { formatCurrency } from '../utils/format';

const claimColumns: GridColDef[] = [
  { field: 'serviceDate', headerName: 'Date of Service', width: 130 },
  {
    field: 'status',
    headerName: 'Status',
    width: 130,
    renderCell: ({ value }) => {
      const color = CLAIM_STATUS_COLORS[value as string] ?? 'default';
      return (
        <Chip
          label={formatClaimStatus(value as string)}
          color={color}
          variant="outlined"
          size="small"
          sx={{ borderRadius: '4px', fontSize: 12 }}
        />
      );
    },
  },
  { field: 'payerName', headerName: 'Payer Name', flex: 1, minWidth: 160 },
  {
    field: 'billed',
    headerName: 'Billed',
    width: 110,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: (params: { value: number }) => formatCurrency(params.value),
  },
  // TODO: should be wired from ClaimResponse? showing placeholder until real data available
  {
    field: 'insurancePaid',
    headerName: 'Insurance Paid',
    width: 120,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: () => '—',
  },
  {
    field: 'patientResp',
    headerName: 'Patient Resp',
    width: 120,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: () => '—',
  },
  {
    field: 'patientPaid',
    headerName: 'Patient Paid',
    width: 110,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: () => '—',
  },
];

export default function PatientDetail(): ReactElement {
  const { id } = useParams();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [patient, setPatient] = useState<PatientDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('1');

  const fetchDetail = useCallback(async () => {
    if (!oystehrZambda || !id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await oystehrZambda.zambda.execute({ id: 'get-billing-patient-detail', patientId: id });
      setPatient(chooseJson(response));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !patient) {
    return (
      <Box sx={{ p: 0 }}>
        <Alert severity="error">{error ?? 'Patient not found'}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/patients')}>
          Back to Patients
        </Button>
      </Box>
    );
  }

  const patientName = `${patient.firstName} ${patient.lastName}`.trim() || 'Unknown';

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
        <IconButton onClick={() => navigate('/patients')} size="small" sx={{ mt: 0.5 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h5" color="primary.dark" fontWeight={600}>
            {patientName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            DOB {patient.dob} | {patient.id}
          </Typography>
        </Box>
      </Box>

      {/* TODO: wire real balance data from ClaimResponse/PaymentReconciliation */}
      <Card variant="outlined" sx={{ mb: 2, ml: 5 }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', gap: 4 }}>
            <BalanceItem label="Current Balance" value="—" />
            <BalanceItem label="Claims with Patient Balance" value="—" />
            <BalanceItem label="Pending Payments" value="—" />
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ ml: 5 }}>
        <TabContext value={tab}>
          <TabList
            onChange={(_, v) => setTab(v)}
            sx={{
              borderBottom: `1px solid ${otherColors.lightDivider}`,
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 500, fontSize: 14 },
            }}
          >
            <Tab label="Demographics" value="1" />
            <Tab label="Claims" value="2" />
          </TabList>

          <TabPanel value="1" sx={{ px: 0, pt: 2 }}>
            <Card variant="outlined">
              <CardContent>
                <DetailRow label="Patient" value={patientName} labelWidth={120} />
                <DetailRow label="MRN" value={patient.id} labelWidth={120} />
                <DetailRow label="Friendly ID" value={patient.friendlyId} labelWidth={120} />
                <DetailRow label="DOB" value={patient.dob} labelWidth={120} />
                <DetailRow label="Gender" value={patient.gender} labelWidth={120} />
                <DetailRow label="Phone" value={patient.phone} labelWidth={120} />
                <DetailRow label="Email" value={patient.email} labelWidth={120} />
                <DetailRow label="Address" value={patient.address} labelWidth={120} />
              </CardContent>
            </Card>
          </TabPanel>

          <TabPanel value="2" sx={{ px: 0, pt: 2 }}>
            <DataGridPro
              rows={patient.claims}
              columns={claimColumns}
              onRowClick={(params) => navigate(`/claims/${params.id}`)}
              disableRowSelectionOnClick
              disableColumnMenu
              autoHeight
              pageSizeOptions={[25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
              slots={dataGridSlots}
              sx={{ ...dataGridSx }}
            />
          </TabPanel>
        </TabContext>
      </Box>
    </Box>
  );
}

function BalanceItem({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" fontWeight={600}>
        {value}
      </Typography>
    </Box>
  );
}
