import { Add as AddIcon, ArrowBack as ArrowBackIcon, DeleteOutline as DeleteOutlineIcon } from '@mui/icons-material';
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
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BILLING_INSURANCE_TYPE_OPTIONS,
  BILLING_INSURANCE_TYPE_TITLES,
  BillingCoverageOption,
  BillingInsuranceType,
  getApiError,
  PatientDetailResponse,
  UpdateBillingPatientInput,
  VALUE_SETS,
} from 'utils';
import {
  deleteBillingCoverage,
  getBillingPatientDetail,
  getPatientCoverages,
  updateBillingCoverage,
  updateBillingPatient,
} from '../api/api';
import { AddCoverageDialog } from '../components/AddCoverageDialog';
import { AddressFields } from '../components/AddressFields';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { EditableSection } from '../components/claim/EditableSection';
import { CoverageFields } from '../components/CoverageFields';
import { DemographicFields } from '../components/DemographicFields';
import { DetailRow } from '../components/DetailRow';
import { CLAIM_STATUS_COLORS, formatAntCaseString } from '../constants/claimStatus';
import { CoverageForm, coverageToUpdateInput, defaultCoverageFormValues } from '../constants/coverage';
import { useApiClients } from '../hooks/useAppClients';
import { otherColors } from '../themes/ottehr/colors';
import { buildAddressInput, formatCurrency } from '../utils/format';

const INSURANCE_TYPE_ORDER: BillingInsuranceType[] = BILLING_INSURANCE_TYPE_OPTIONS.map((o) => o.value);
const insuranceTypeRank = (type: BillingInsuranceType | undefined): number => {
  const idx = type ? INSURANCE_TYPE_ORDER.indexOf(type) : -1;
  return idx === -1 ? INSURANCE_TYPE_ORDER.length : idx;
};

const PLAN_TYPE_OPTIONS = VALUE_SETS.insuranceTypeOptions;
const planTypeLabel = (candidCode: string): string =>
  PLAN_TYPE_OPTIONS.find((option) => option.candidCode === candidCode)?.label ?? '';

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
          label={formatAntCaseString(value as string)}
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
  {
    field: 'insurancePaid',
    headerName: 'Insurance Paid',
    width: 120,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: (params: { value: number }) => formatCurrency(params.value),
  },
  {
    field: 'patientResp',
    headerName: 'Patient Resp',
    width: 120,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: (params: { value: number }) => formatCurrency(params.value),
  },
  {
    field: 'patientPaid',
    headerName: 'Patient Paid',
    width: 110,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: (params: { value: number }) => formatCurrency(params.value),
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
      const data = await getBillingPatientDetail(oystehrZambda, { patientId: id });
      setPatient(data);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to load patient' }));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const savePatient = useCallback(
    async (payload: Record<string, unknown>): Promise<string | null> => {
      if (!oystehrZambda || !id) return 'Client not ready';
      try {
        await updateBillingPatient(oystehrZambda, { patientId: id, ...payload } as UpdateBillingPatientInput);
      } catch (err) {
        return getApiError({ error: err, defaultError: 'Failed to save changes' });
      }
      await fetchDetail();
      return null;
    },
    [oystehrZambda, id, fetchDetail]
  );

  if (loading && !patient) {
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

      <Card variant="outlined" sx={{ mb: 2, ml: 5 }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', gap: 4 }}>
            <BalanceItem label="Current Balance" value={formatCurrency(patient.balance.currentBalance)} />
            <BalanceItem label="Claims with Patient Balance" value={String(patient.balance.claimsWithPatientBalance)} />
            <BalanceItem label="Pending Payments" value={formatCurrency(patient.balance.pendingPayments)} />
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
            <Tab label="Insurance" value="2" />
            <Tab label="Claims" value="3" />
          </TabList>

          <TabPanel value="1" sx={{ px: 0, pt: 2 }}>
            <DemographicsSection patient={patient} onSave={savePatient} />
          </TabPanel>

          <TabPanel value="2" sx={{ px: 0, pt: 2 }}>
            <InsuranceTab patientId={patient.id} />
          </TabPanel>

          <TabPanel value="3" sx={{ px: 0, pt: 2 }}>
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

interface DemographicsForm {
  firstName: string | null;
  lastName: string | null;
  dob: string | null;
  gender: string | null;
  email: string | null;
  phone: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

function DemographicsSection({
  patient,
  onSave,
}: {
  patient: PatientDetailResponse;
  onSave: (payload: Record<string, unknown>) => Promise<string | null>;
}): ReactElement {
  const defaultValues = useMemo(
    () => ({
      firstName: patient.firstName,
      lastName: patient.lastName,
      dob: patient.dob,
      gender: patient.gender,
      phone: patient.phone,
      email: patient.email,
      line1: patient.addressParts.line1,
      line2: patient.addressParts.line2,
      city: patient.addressParts.city,
      state: patient.addressParts.state,
      zip: patient.addressParts.postalCode,
    }),
    [patient]
  );

  const handleSave = async (data: DemographicsForm): Promise<string | null> => {
    const address = buildAddressInput(data.line1, data.line2, data.city, data.state, data.zip);
    return onSave({
      firstName: data.firstName!.trim(),
      lastName: data.lastName!.trim(),
      ...(data.dob ? { dob: data.dob } : {}),
      ...(data.gender ? { gender: data.gender } : {}),
      ...(data.phone?.trim() ? { phone: data.phone.trim() } : {}),
      ...(data.email?.trim() ? { email: data.email.trim() } : {}),
      ...(address ? { address } : {}),
    });
  };

  const patientName = `${patient.firstName} ${patient.lastName}`.trim() || 'Unknown';

  return (
    <EditableSection
      title="Demographics"
      defaultValues={defaultValues}
      onSave={handleSave}
      editForm={
        <Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2.25, maxWidth: 1280 }}>
            <DemographicFields />
            <AddressFields />
          </Box>
        </Box>
      }
    >
      <DetailRow label="Patient" value={patientName} labelWidth={120} />
      <DetailRow label="MRN" value={patient.id} labelWidth={120} />
      <DetailRow label="Friendly ID" value={patient.friendlyId} labelWidth={120} />
      <DetailRow label="DOB" value={patient.dob} labelWidth={120} />
      <DetailRow label="Gender" value={patient.gender} labelWidth={120} />
      <DetailRow label="Phone" value={patient.phone} labelWidth={120} />
      <DetailRow label="Email" value={patient.email} labelWidth={120} />
      <DetailRow label="Address" value={patient.address} labelWidth={120} />
    </EditableSection>
  );
}

function InsuranceTab({ patientId }: { patientId: string }): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [coverages, setCoverages] = useState<BillingCoverageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const fetchCoverages = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getPatientCoverages(oystehrZambda, { patientId });
      // Order primary, then secondary, then workers' comp; unknown types sort last.
      const sorted = [...res.coverages].sort(
        (a, b) => insuranceTypeRank(a.insuranceType) - insuranceTypeRank(b.insuranceType)
      );
      setCoverages(sorted);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to load coverages' }));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, patientId]);

  useEffect(() => {
    void fetchCoverages();
  }, [fetchCoverages]);

  // Insurance types already held by active coverages — one coverage per type.
  const takenTypes = coverages.map((c) => c.insuranceType).filter((t): t is BillingInsuranceType => t !== undefined);
  // Default a new coverage to the first type that isn't taken yet.
  const defaultType: BillingInsuranceType = INSURANCE_TYPE_ORDER.find((t) => !takenTypes.includes(t)) ?? 'primary';

  if (loading && coverages.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
          Add coverage
        </Button>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {coverages.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No insurance coverages on file.
        </Typography>
      ) : (
        coverages.map((coverage) => (
          <CoverageCard
            key={coverage.id}
            coverage={coverage}
            unavailableTypes={takenTypes.filter((t) => t !== coverage.insuranceType)}
            onChanged={fetchCoverages}
          />
        ))
      )}
      <AddCoverageDialog
        open={addOpen}
        patientId={patientId}
        defaultType={defaultType}
        unavailableTypes={takenTypes}
        onClose={() => setAddOpen(false)}
        onCreated={() => void fetchCoverages()}
      />
    </Box>
  );
}

function CoverageCard({
  coverage,
  unavailableTypes,
  onChanged,
}: {
  coverage: BillingCoverageOption;
  unavailableTypes: BillingInsuranceType[];
  onChanged: () => Promise<void>;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const resetForm = useCallback((): void => {
    setConfirming(false);
    setDeleteError(null);
  }, []);

  useEffect(() => {
    resetForm();
  }, [resetForm]);

  const handleSave = async (data: CoverageForm): Promise<string | null> => {
    if (!oystehrZambda || !coverage.id) return 'Client not ready';
    try {
      await updateBillingCoverage(oystehrZambda, coverageToUpdateInput(data, coverage.id));
    } catch (err) {
      return getApiError({ error: err, defaultError: 'Failed to save coverage' });
    }
    await onChanged();
    return null;
  };

  const handleDelete = async (): Promise<void> => {
    if (!oystehrZambda || !coverage.id) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteBillingCoverage(oystehrZambda, { coverageId: coverage.id });
    } catch (err) {
      setDeleteError(getApiError({ error: err, defaultError: 'Failed to remove coverage' }));
      setDeleting(false);
      return;
    }
    await onChanged();
  };

  const title = BILLING_INSURANCE_TYPE_TITLES[coverage.insuranceType ?? 'primary'];
  const policyHolderName = coverage.policyHolder
    ? `${coverage.policyHolder.firstName} ${coverage.policyHolder.lastName}`.trim()
    : '';

  return (
    <EditableSection
      title={title}
      onSave={handleSave}
      onCancel={resetForm}
      defaultValues={defaultCoverageFormValues(coverage)}
      editForm={<CoverageFields unavailableTypes={unavailableTypes} />}
    >
      <DetailRow label="Payer" value={coverage.payorName} labelWidth={170} />
      <DetailRow label="Payer ID" value={coverage.payorId} labelWidth={170} />
      <DetailRow label="Member ID" value={coverage.memberId ?? coverage.subscriberId} labelWidth={170} />
      {coverage.planType ? <DetailRow label="Plan type" value={planTypeLabel(coverage.planType)} /> : <></>}
      <DetailRow label="Relationship to insured" value={coverage.relationship ?? ''} labelWidth={170} />
      {policyHolderName && <DetailRow label="Policy holder" value={policyHolderName} labelWidth={170} />}
      <Box sx={{ mt: 1.5 }}>
        {deleteError && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {deleteError}
          </Alert>
        )}
        {confirming ? (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Permanently delete this coverage? This cannot be undone.
            </Typography>
            <Button size="small" onClick={() => setConfirming(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              size="small"
              color="error"
              variant="contained"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? 'Removing...' : 'Confirm remove'}
            </Button>
          </Box>
        ) : (
          <Button
            size="small"
            color="error"
            startIcon={<DeleteOutlineIcon fontSize="small" />}
            onClick={() => setConfirming(true)}
          >
            Remove coverage
          </Button>
        )}
      </Box>
    </EditableSection>
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
