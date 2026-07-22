import {
  ArrowBack as ArrowBackIcon,
  DeleteOutline as DeleteOutlineIcon,
  Edit as EditIcon,
  FileDownloadOutlined as FileDownloadIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Select,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AR_STAGE,
  BillingCoverageOption,
  BillingProviderOption,
  BillingTag,
  CLAIM_STATUS_FIELDS_BY_KEY,
  ClaimDetailResponse,
  ClaimRemitAdjustment,
  ClaimStatusFieldKey,
  CODE_SYSTEM_CLAIM_TYPE_CODE_NAMES,
  CODE_SYSTEM_SERVICE_CATEGORY_CODE_NAMES,
  CreateBillingProviderInput,
  ERA_CLAIM_STATUS_CODE,
  EraClaimStatusCode,
  formatClaimStatusValue,
  getApiError,
  RULES_ENGINES,
  RulesEngineDef,
  SaveServiceFacilityInput,
  ServiceFacilityItem,
  UpdateBillingPatientInput,
  UpdateBillingProviderInput,
  UpdateBillingResourceInput,
  VALUE_SETS,
} from 'utils';
import {
  createBillingCoverage,
  createBillingProvider,
  getBillingClaimDetail,
  getPatientCoverages,
  runBillingRulesEngine,
  saveBillingServiceFacility,
  searchBillingProviders,
  searchBillingServiceFacilities,
  searchBillingTags,
  tagBillingClaim,
  updateBillingCoverage,
  updateBillingPatient,
  updateBillingProvider,
  updateBillingResource,
} from '../api/api';
import { ClaimHistory } from '../components/claim/ClaimHistory';
import { ClaimStatusFields } from '../components/claim/ClaimStatusFields';
import { DiagnosesEditor } from '../components/claim/DiagnosesEditor';
import { EditableSection, EditableSectionSkeleton } from '../components/claim/EditableSection';
import { ServiceLineRow, ServiceLinesEditor } from '../components/claim/ServiceLinesEditor';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CoverageFields } from '../components/CoverageFields';
import { ExportX12Dialog } from '../components/ExportX12Dialog';
import { ProviderDetailForm } from '../components/ProviderDetailSection';
import { Row } from '../components/Row';
import { ServiceFacilityDetailForm } from '../components/ServiceFacilityDetailSection';
import { claimStatusValueColor, formatAntCaseString } from '../constants/claimStatus';
import {
  CoverageForm,
  coverageToCreateInput,
  coverageToUpdateInput,
  defaultCoverageFormValues,
} from '../constants/coverage';
import { useApiClients } from '../hooks/useAppClients';
import { usePatient } from '../hooks/usePatient';
import { useProvider } from '../hooks/useProvider';
import { useServiceFacility } from '../hooks/useServiceFacility';
import { otherColors } from '../themes/ottehr/colors';
import { formatCurrency, formatDate } from '../utils/format';
import { PatientDemographicsSection } from './PatientDetail';

type UpdateFn = (resourceType: string, resourceId: string, fields: Record<string, unknown>) => Promise<string | null>;

function applicableRulesEngine(claim: ClaimDetailResponse): RulesEngineDef | undefined {
  const arStage = claim.statuses.arStage;
  if (arStage === AR_STAGE.insurancePayer) return RULES_ENGINES['claim-submission'];
  if (arStage === AR_STAGE.nonInsurancePayer) return RULES_ENGINES['non-insurance-payer-pre-invoice'];
  if (arStage === AR_STAGE.patient && !claim.coverageFhirId) return RULES_ENGINES['patient-ar-pre-invoice'];
  return undefined;
}

const thSx = { color: 'primary.dark', fontWeight: 600, fontSize: 13 };

// EHR app base URL for the "View in EHR" backlink
const EHR_URL = import.meta.env.VITE_APP_EHR_URL;

export default function ClaimDetail(): ReactElement {
  const { id } = useParams();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [claim, setClaim] = useState<ClaimDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('1');
  const [exportOpen, setExportOpen] = useState(false);
  const [editingHeader, setEditingHeader] = useState(false);
  const [savingHeader, setSavingHeader] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [serviceDate, setServiceDate] = useState('');
  const [claimType, setClaimType] = useState('');
  const [service, setService] = useState('');

  const fetchDetail = useCallback(async () => {
    if (!oystehrZambda || !id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getBillingClaimDetail(oystehrZambda, { claimId: id });
      setClaim(data);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to load claim' }));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const updateResource = useCallback(
    async (resourceType: string, resourceId: string, fields: Record<string, unknown>): Promise<string | null> => {
      if (!oystehrZambda || !id) return 'Client not ready';
      try {
        await updateBillingResource(oystehrZambda, {
          resourceType,
          resourceId,
          claimId: id,
          fields,
        } as UpdateBillingResourceInput);
      } catch (err) {
        return getApiError({ error: err, defaultError: 'Failed to save changes' });
      }
      await fetchDetail();
      return null;
    },
    [oystehrZambda, fetchDetail, id]
  );

  const handleTagAction = useCallback(
    async (action: 'add' | 'remove', tagName: string): Promise<void> => {
      if (!oystehrZambda || !id) return;
      try {
        await tagBillingClaim(oystehrZambda, { claimId: id, action, tagName });
      } catch (err) {
        setError(getApiError({ error: err, defaultError: 'Failed to update tag' }));
        return;
      }
      await fetchDetail();
    },
    [oystehrZambda, id, fetchDetail]
  );

  const updateStatus = useCallback(
    async (field: ClaimStatusFieldKey, value: string): Promise<void> => {
      if (!oystehrZambda || !id) return;
      try {
        // An empty selection clears the tag back to the field's default.
        await oystehrZambda.zambda.execute({
          id: 'set-billing-claim-status',
          claimId: id,
          field,
          value: value || null,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update status');
        return;
      }
      await fetchDetail();
    },
    [oystehrZambda, id, fetchDetail]
  );

  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Submit claim / Prepare for invoice both run the claim's rules engine: it applies the configured
  // rules, then performs the engine's success effect — or holds the claim — in the background.
  const handleRunRulesEngine = useCallback(async (): Promise<void> => {
    if (!oystehrZambda || !id) return;
    const engine = claim ? applicableRulesEngine(claim) : undefined;
    if (!engine) {
      enqueueSnackbar('No rules engine applies to this claim, so the rules were not run.', { variant: 'error' });
      setConfirmingSubmit(false);
      return;
    }
    setSubmitting(true);
    try {
      await runBillingRulesEngine(oystehrZambda, { claimIds: [id] });
      enqueueSnackbar(
        `${engine.label} started — when every rule passes, ${engine.onPass}; a Hold keeps the claim for review. Refresh to see the result.`,
        { variant: 'info' }
      );
    } catch (err) {
      enqueueSnackbar(
        getApiError({
          error: err,
          defaultError: 'Failed to start the rules engine',
        }),
        { variant: 'error' }
      );
    } finally {
      setSubmitting(false);
      setConfirmingSubmit(false);
      await fetchDetail();
    }
  }, [oystehrZambda, id, claim, fetchDetail]);

  if (loading && !claim) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !claim) {
    return (
      <Box sx={{ p: 0 }}>
        <Alert severity="error">{error ?? 'Claim not found'}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/claims')}>
          Back to Claims
        </Button>
      </Box>
    );
  }

  const arStageCode = claim.statuses.arStage;
  const arStageLabel = formatClaimStatusValue(CLAIM_STATUS_FIELDS_BY_KEY.arStage, arStageCode);
  const dos = claim.serviceLines[0]?.serviceDate ?? claim.created;
  // Which engine the run button triggers for this claim (none -> no button).
  const runEngine = applicableRulesEngine(claim);

  const startHeaderEdit = (): void => {
    setServiceDate(claim.serviceLines[0]?.serviceDate ?? claim.created);
    setClaimType(claim.type);
    setService(claim.service ?? '');
    setHeaderError(null);
    setEditingHeader(true);
  };

  const saveHeader = async (): Promise<void> => {
    const fields: { type?: string; service?: string; serviceDate?: string } = {};
    if (claimType && claimType !== claim.type) fields.type = claimType;
    if (service && service !== claim.service) fields.service = service;
    if (serviceDate && serviceDate !== dos) fields.serviceDate = serviceDate;
    if (Object.keys(fields).length === 0) {
      setEditingHeader(false);
      return;
    }
    setSavingHeader(true);
    setHeaderError(null);
    const err = await updateResource('Claim', claim.id, fields);
    setSavingHeader(false);
    if (err) {
      setHeaderError(err);
      return;
    }
    setEditingHeader(false);
  };

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
        <IconButton onClick={() => navigate('/claims')} size="small" sx={{ mt: 0.5 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h5" color="primary.dark" fontWeight={600}>
              {claim.patientName}
            </Typography>
            {!editingHeader && (
              <Button size="small" startIcon={<EditIcon fontSize="small" />} onClick={startHeaderEdit}>
                Edit
              </Button>
            )}
          </Box>
          {!editingHeader ? (
            <Box sx={{ display: 'flex', gap: 3, mt: 0.5, flexWrap: 'wrap' }}>
              <Meta label="Date of Service" value={dos} />
              <Meta label="Claim ID" value={claim.id} />
              <Meta label="Claim Type" value={formatAntCaseString(claim.type)} />
              <Meta label="Service" value={formatAntCaseString(claim.service)} />
              <Meta label="Patient DOB" value={claim.patientDob} />
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', gap: 2.5, mt: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Date of Service
                  </Typography>
                  <TextField
                    type="date"
                    size="small"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    sx={{ width: 165 }}
                  />
                </Box>
                <Meta label="Claim ID" value={claim.id} />
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Claim Type
                  </Typography>
                  <Select
                    size="small"
                    value={claimType}
                    onChange={(e) => setClaimType(e.target.value)}
                    sx={{ width: 165 }}
                  >
                    {CODE_SYSTEM_CLAIM_TYPE_CODE_NAMES.map((code) => (
                      <MenuItem key={code} value={code}>
                        {formatAntCaseString(code)}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Service
                  </Typography>
                  <Select
                    size="small"
                    displayEmpty
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    sx={{ width: 185 }}
                    renderValue={
                      service
                        ? undefined
                        : () => (
                            <Box component="span" sx={{ color: 'text.disabled' }}>
                              Select...
                            </Box>
                          )
                    }
                  >
                    {CODE_SYSTEM_SERVICE_CATEGORY_CODE_NAMES.map((code) => (
                      <MenuItem key={code} value={code}>
                        {formatAntCaseString(code)}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
                <Meta label="Patient DOB" value={claim.patientDob} />
              </Box>
              {headerError && (
                <Alert severity="error" sx={{ mt: 1.5, maxWidth: 680 }}>
                  {headerError}
                </Alert>
              )}
              <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                <Button size="small" onClick={() => setEditingHeader(false)} disabled={savingHeader}>
                  Cancel
                </Button>
                <Button size="small" variant="contained" onClick={saveHeader} disabled={savingHeader}>
                  {savingHeader ? 'Saving...' : 'Save'}
                </Button>
              </Box>
            </>
          )}
        </Box>
        {runEngine && (
          <Button variant="contained" size="small" onClick={() => setConfirmingSubmit(true)} sx={{ mt: 0.5 }}>
            {runEngine.runButtonLabel}
          </Button>
        )}
        <Button
          size="small"
          variant="outlined"
          startIcon={<FileDownloadIcon />}
          onClick={() => setExportOpen(true)}
          sx={{ mt: 0.5 }}
        >
          Export X12
        </Button>
      </Box>
      {EHR_URL && claim.appointmentId && (
        <Button
          variant="outlined"
          size="small"
          startIcon={<OpenInNewIcon />}
          href={`${EHR_URL}/visit/${claim.appointmentId}`}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ mt: 0.5, flexShrink: 0 }}
        >
          View in EHR
        </Button>
      )}

      <ExportX12Dialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        claimId={claim.id}
        claimType={claim.type}
      />

      <Box sx={{ ml: 5, mb: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip
          label={arStageLabel || 'No AR Stage'}
          color={arStageCode ? claimStatusValueColor(arStageCode) : 'default'}
          variant="outlined"
          size="small"
          sx={{ borderRadius: '4px' }}
        />
        {claim.tags.map((tag) => (
          <Chip
            key={tag}
            label={tag}
            size="small"
            onDelete={() => void handleTagAction('remove', tag)}
            sx={{ borderRadius: '4px' }}
          />
        ))}
        <TagAdder claimId={claim.id} oystehrZambda={oystehrZambda} onAdded={fetchDetail} existingTags={claim.tags} />
      </Box>

      <Card variant="outlined" sx={{ mb: 2, ml: 5 }}>
        <CardContent>
          <ClaimStatusFields values={claim.statuses} onChange={updateStatus} title="Claim Status" />
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2, ml: 5 }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Amount label="Billed" value={claim.billed} />
            <Amount label="Allowed" value={claim.allowed} />
            <Amount label="Payments" sublabel="Primary Ins Paid" value={claim.insurancePaid} />
            <Amount label="Balance" value={claim.balance} />
            <Box>
              <Typography variant="caption" color="text.secondary">
                Responsible Party
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {claim.responsibleParty}
              </Typography>
            </Box>
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
            <Tab label="Claim Properties" value="1" />
            <Tab label="Dx, Service Lines & Remits" value="2" />
            <Tab label="Write offs & Patient payments" value="3" />
            <Tab label="Other claims" value="4" />
            <Tab label="History" value="5" />
          </TabList>

          <TabPanel value="1" sx={{ px: 0, pt: 2 }}>
            <PatientSection claim={claim} />
            <InsuranceSection claim={claim} updateResource={updateResource} />
            {claim.secondaryPayerName && (
              <ReadOnlySection title="Secondary Insurance">
                <Row label="Payer" value={claim.secondaryPayerName} />
                <Row label="Payer ID" value={claim.secondaryPayerId} />
                <Row label="Member ID" value={claim.secondaryMemberId} />
              </ReadOnlySection>
            )}
            <RenderingProviderSection claim={claim} updateResource={updateResource} />
            <FacilitySection claim={claim} updateResource={updateResource} />
            <BillingProviderSection claim={claim} updateResource={updateResource} />
          </TabPanel>

          <TabPanel value="2" sx={{ px: 0, pt: 2 }}>
            <DiagnosesSection claim={claim} updateResource={updateResource} />
            <ServiceLinesSection claim={claim} updateResource={updateResource} />
            <RemitsSection remits={claim.remits} />
            <InsurancePaymentsSection payments={claim.insurancePayments} navigate={navigate} />
          </TabPanel>

          <TabPanel value="3" sx={{ px: 0, pt: 2 }}>
            <ReadOnlySection title="Write offs">No write offs</ReadOnlySection>
            <ReadOnlySection title="Patient payments">No patient payments</ReadOnlySection>
          </TabPanel>

          <TabPanel value="4" sx={{ px: 0, pt: 2 }}>
            <OtherClaimsSection claims={claim.otherClaims} navigate={navigate} />
          </TabPanel>

          <TabPanel value="5" sx={{ px: 0, pt: 2 }}>
            <ClaimHistory claimId={claim.id} />
          </TabPanel>
        </TabContext>
      </Box>

      {runEngine && (
        <ConfirmDialog
          open={confirmingSubmit}
          title={runEngine.runButtonLabel}
          confirmLabel="Run rules"
          loading={submitting}
          onConfirm={() => void handleRunRulesEngine()}
          onCancel={() => setConfirmingSubmit(false)}
        >
          Run the {runEngine.label} on this claim? They apply the configured rules; when every rule passes,{' '}
          {runEngine.onPass} — or the claim is held if a rule applies the Hold tag.
        </ConfirmDialog>
      )}
    </Box>
  );
}

function PatientSection({ claim }: { claim: ClaimDetailResponse }): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [patient, refetchPatient] = usePatient({ id: claim.patientId });

  const handleSave = async (payload: UpdateBillingPatientInput): Promise<string | null> => {
    if (!oystehrZambda) return 'Client not ready';
    await updateBillingPatient(oystehrZambda, payload);
    await refetchPatient();
    return null;
  };

  if (!patient) {
    return <EditableSectionSkeleton title="Patient" />;
  }

  return <PatientDemographicsSection title="Patient" patient={patient} onSave={handleSave} />;
}

const PLAN_TYPE_OPTIONS = VALUE_SETS.insuranceTypeOptions;
const planTypeLabel = (candidCode: string): string =>
  PLAN_TYPE_OPTIONS.find((option) => option.candidCode === candidCode)?.label ?? '';

/**
 * This needs to support several cases:
 *  1. claim does not have insurance, user selects one and optionally makes edits, submit should add coverage w/ edits
 *  2. claim does not have insurance, user manually configures, submit should add coverage
 *  3. claim has insurance, user makes edits, submit should persist edits
 *  4. claim has insurance, user selects a different coverage and optionally makes edits, submit should persist edits
 *  5. claim has insurance but it no longer matches user's coverage list, user can still make edits
 */
export function InsuranceSection({
  claim,
  updateResource,
}: {
  claim: ClaimDetailResponse;
  updateResource: UpdateFn;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  const hasCoverage = !!claim.coverageFhirId;

  const [coverageOptions, setCoverageOptions] = useState<BillingCoverageOption[]>([]);
  const [selectedCoverage, setSelectedCoverage] = useState<BillingCoverageOption | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const resetFields = useCallback((): void => {
    setSelectedCoverage(null);
    // include claim to handle edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claim]);

  useEffect(() => {
    resetFields();
  }, [resetFields]);

  const defaultValues = useMemo(() => {
    if (selectedCoverage) {
      return defaultCoverageFormValues(selectedCoverage);
    }
    return defaultCoverageFormValues(claim);
  }, [selectedCoverage, claim]);

  const loadCoverages = useCallback((): void => {
    if (!oystehrZambda || !claim.patientOriginalId) return;
    void (async () => {
      const res = await getPatientCoverages(oystehrZambda, { patientId: claim.patientOriginalId });
      setCoverageOptions(res.coverages ?? []);
    })();
  }, [oystehrZambda, claim.patientOriginalId]);

  const handleSave = async (data: CoverageForm): Promise<string | null> => {
    if (!oystehrZambda) return null;
    const claimFields: { payerId?: string; planType?: string } = {};
    try {
      // By default, update existing coverage below
      let coverageId = claim.coverageFhirId;
      if (!coverageId) {
        if (selectedCoverage?.id) {
          // Selected from some base, add it to claim and update below
          await updateResource('Claim', claim.id, { coverageId: selectedCoverage.id });
          const updatedClaim = await getBillingClaimDetail(oystehrZambda, { claimId: claim.id });
          coverageId = updatedClaim.coverageFhirId;
        } else {
          // No base selected, make a new one and attach it
          const result = await createBillingCoverage(oystehrZambda, coverageToCreateInput(data, claim.patientId));
          return updateResource('Claim', claim.id, { coverageId: result.id });
        }
      }
      if (data.payerId && data.payerId !== claim.payorFhirId) claimFields.payerId = data.payerId;
      if (data.planType && data.planType !== claim.planType) claimFields.planType = data.planType;
      if (Object.keys(claimFields).length > 0) {
        const err = await updateResource('Claim', claim.id, claimFields);
        if (err) return err;
      }
      await updateBillingCoverage(oystehrZambda, coverageToUpdateInput(data, coverageId));
      resetFields();
      return null;
    } catch (err) {
      return getApiError({ error: err, defaultError: 'Failed to save changes' });
    }
  };

  const handleRemove = async (): Promise<void> => {
    setRemoving(true);
    setRemoveError(null);
    const err = await updateResource('Claim', claim.id, { removeCoverage: true });
    setConfirmingRemove(false);
    setRemoving(false);
    if (err) setRemoveError(err);
  };

  return (
    <EditableSection
      title="Primary Insurance"
      defaultValues={defaultValues}
      onSave={handleSave}
      onCancel={resetFields}
      editForm={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
          <Autocomplete
            size="small"
            options={coverageOptions}
            value={selectedCoverage}
            onChange={(_, v) => setSelectedCoverage(v)}
            onOpen={loadCoverages}
            getOptionLabel={(o) => o.payorName || o.id || ''}
            renderOption={(props, o) => (
              <Box component="li" {...props} key={o.id}>
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    {o.payorName || o.id}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Member ID: {o.subscriberId} | {o.status}
                  </Typography>
                </Box>
              </Box>
            )}
            renderInput={(p) => (
              <TextField {...p} size="small" label={claim.payerName ? 'Replace coverage' : 'Choose coverage'} />
            )}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            sx={{ maxWidth: 480 }}
          />
          <CoverageFields unavailableTypes={[]} />
        </Box>
      }
    >
      {hasCoverage ? (
        <>
          <Row label="Payer" value={claim.payerName} />
          <Row label="Payer ID" value={claim.payerId} />
          <Row label="Member ID" value={claim.memberId} />
          <Row label="Relationship to insured" value={claim.relationship} />
          {claim.policyHolder && (
            <Row
              label="Policy holder"
              value={`${claim.policyHolder.firstName} ${claim.policyHolder.lastName}`.trim()}
            />
          )}
          <Row label="Coverage Status" value={claim.coverageStatus} />
          <Row label="Plan type" value={planTypeLabel(claim.planType)} hideBorder />
        </>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ py: 0.5 }}>
          No insurance
        </Typography>
      )}
      {hasCoverage && (
        <Box sx={{ mt: 1.5 }}>
          {removeError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {removeError}
            </Alert>
          )}
          {confirmingRemove ? (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Remove coverage?
              </Typography>
              <Button size="small" onClick={() => setConfirmingRemove(false)} disabled={removing}>
                Cancel
              </Button>
              <Button
                size="small"
                color="error"
                variant="contained"
                onClick={() => void handleRemove()}
                disabled={removing}
              >
                {removing ? 'Removing...' : 'Confirm'}
              </Button>
            </Box>
          ) : (
            <Button
              size="small"
              color="error"
              startIcon={<DeleteOutlineIcon fontSize="small" />}
              onClick={() => setConfirmingRemove(true)}
            >
              Remove coverage
            </Button>
          )}
        </Box>
      )}
    </EditableSection>
  );
}

function RenderingProviderSection({
  claim,
  updateResource,
}: {
  claim: ClaimDetailResponse;
  updateResource: UpdateFn;
}): ReactElement {
  const { oystehrZambda } = useApiClients();

  const setLoading = useCallback(() => {}, []);
  const setError = useCallback(() => {}, []);
  const [claimProvider, refetchClaimProvider] = useProvider({
    type: 'rendering',
    id: claim.renderingProviderId,
    onLoading: setLoading,
    onError: setError,
  });

  const [options, setOptions] = useState<BillingProviderOption[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<BillingProviderOption | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const resetFields = useCallback((): void => {
    setSelectedProvider(null);
    // include claim to handle edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claim]);

  useEffect(() => {
    resetFields();
  }, [resetFields]);

  const searchProviders = useCallback(
    (query?: string): void => {
      if (!oystehrZambda) return;
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(async () => {
        const res = await searchBillingProviders(oystehrZambda, {
          providerType: 'rendering',
          ...(query ? { name: query } : {}),
        });
        setOptions(res.providers ?? []);
      }, 300);
    },
    [oystehrZambda]
  );

  const handleSave = async (
    payload: CreateBillingProviderInput | UpdateBillingProviderInput
  ): Promise<string | null> => {
    if (!oystehrZambda) return null;
    try {
      // By default, update existing provider below, taking into account that the payload
      // may include the selected provider's ID at this point
      let providerId =
        'providerId' in payload && payload.providerId
          ? selectedProvider
            ? claim.renderingProviderId
            : payload.providerId
          : undefined;
      if (!providerId) {
        if (selectedProvider?.id) {
          // Selected from some base, add it to claim and update below
          await updateResource('Claim', claim.id, {
            renderingProvider: {
              id: selectedProvider.id,
              type: selectedProvider.kind === 'organization' ? 'Organization' : 'Practitioner',
            },
          });
          const updatedClaim = await getBillingClaimDetail(oystehrZambda, { claimId: claim.id });
          providerId = updatedClaim.renderingProviderId;
        } else {
          // No base selected, make a new one and attach it, returning early
          const result = await createBillingProvider(oystehrZambda, payload);
          return updateResource('Claim', claim.id, {
            renderingProvider: {
              id: result.id,
              type: payload.kind === 'individual' ? 'Practitioner' : 'Organization',
            },
          });
        }
      }
      // Update provider
      await updateBillingProvider(oystehrZambda, { ...payload, providerId });
      resetFields();
      await refetchClaimProvider();
      return null;
    } catch (err) {
      return getApiError({ error: err, defaultError: 'Failed to save changes' });
    }
  };

  return (
    <ProviderDetailForm
      provider={selectedProvider ?? claimProvider}
      role="billing"
      onSave={handleSave}
      onCancel={resetFields}
      selector={{
        options,
        selectedOption: selectedProvider,
        onSelectOption: setSelectedProvider,
        fetchOptions: searchProviders,
      }}
    />
  );
}

function FacilitySection({
  claim,
  updateResource,
}: {
  claim: ClaimDetailResponse;
  updateResource: UpdateFn;
}): ReactElement {
  const { oystehrZambda } = useApiClients();

  const [serviceFacility, refetchServiceFacility] = useServiceFacility({
    id: claim.serviceFacilityId,
  });

  const [options, setOptions] = useState<ServiceFacilityItem[]>([]);
  const [selected, setSelected] = useState<ServiceFacilityItem | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const resetFields = useCallback((): void => {
    setSelected(null);
  }, []);

  useEffect(() => {
    resetFields();
  }, [resetFields]);

  const searchServiceFacilities = useCallback(
    (query?: string): void => {
      if (!oystehrZambda) return;
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(async () => {
        const res = await searchBillingServiceFacilities(oystehrZambda, query ? { name: query } : {});
        setOptions(res.facilities ?? []);
      }, 300);
    },
    [oystehrZambda]
  );

  const handleSave = async (payload: SaveServiceFacilityInput): Promise<string | null> => {
    if (!oystehrZambda) return null;
    try {
      // By default, update existing facility below, taking into account that the payload
      // may include the selected facility's ID at this point
      let facilityId = payload.facilityId ? (selected ? claim.serviceFacilityId : payload.facilityId) : undefined;
      if (!facilityId) {
        if (selected?.id) {
          // Selected from some base, add it to claim and update below
          await updateResource('Claim', claim.id, {
            serviceFacility: {
              id: selected.id,
            },
          });
          const updatedClaim = await getBillingClaimDetail(oystehrZambda, { claimId: claim.id });
          facilityId = updatedClaim.serviceFacilityId;
        } else {
          // No base selected, make a new one and attach it, returning early
          const result = await saveBillingServiceFacility(oystehrZambda, payload);
          return updateResource('Claim', claim.id, {
            serviceFacility: {
              id: result.id,
            },
          });
        }
      }
      // Update provider
      await saveBillingServiceFacility(oystehrZambda, { ...payload, facilityId });
      resetFields();
      await refetchServiceFacility();
      return null;
    } catch (err) {
      return getApiError({ error: err, defaultError: 'Failed to save changes' });
    }
  };

  return (
    <ServiceFacilityDetailForm
      facility={selected ?? serviceFacility}
      onSave={handleSave}
      onCancel={resetFields}
      selector={{
        options,
        selectedOption: selected,
        onSelectOption: setSelected,
        fetchOptions: searchServiceFacilities,
      }}
    />
  );
}

function BillingProviderSection({
  claim,
  updateResource,
}: {
  claim: ClaimDetailResponse;
  updateResource: UpdateFn;
}): ReactElement {
  const { oystehrZambda } = useApiClients();

  const setLoading = useCallback(() => {}, []);
  const setError = useCallback(() => {}, []);
  const [claimProvider, refetchClaimProvider] = useProvider({
    type: 'billing',
    id: claim.billingProviderFhirId,
    onLoading: setLoading,
    onError: setError,
  });

  const [options, setOptions] = useState<BillingProviderOption[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<BillingProviderOption | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const resetFields = useCallback((): void => {
    setSelectedProvider(null);
    // include claim to handle edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claim]);

  useEffect(() => {
    resetFields();
  }, [resetFields]);

  const searchProviders = useCallback(
    (query?: string): void => {
      if (!oystehrZambda) return;
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(async () => {
        const res = await searchBillingProviders(oystehrZambda, {
          providerType: 'billing',
          ...(query ? { name: query } : {}),
        });
        setOptions(res.providers ?? []);
      }, 300);
    },
    [oystehrZambda]
  );

  const handleSave = async (
    payload: CreateBillingProviderInput | UpdateBillingProviderInput
  ): Promise<string | null> => {
    if (!oystehrZambda) return null;
    try {
      // By default, update existing provider below, taking into account that the payload
      // may include the selected provider's ID at this point
      let providerId =
        'providerId' in payload && payload.providerId
          ? selectedProvider
            ? claim.billingProviderFhirId
            : payload.providerId
          : undefined;
      if (!providerId) {
        if (selectedProvider?.id) {
          // Selected from some base, add it to claim and update below
          await updateResource('Claim', claim.id, {
            billingProvider: {
              id: selectedProvider.id,
              type: selectedProvider.kind === 'organization' ? 'Organization' : 'Practitioner',
            },
          });
          const updatedClaim = await getBillingClaimDetail(oystehrZambda, { claimId: claim.id });
          providerId = updatedClaim.billingProviderFhirId;
        } else {
          // No base selected, make a new one and attach it, returning early
          const result = await createBillingProvider(oystehrZambda, payload);
          return updateResource('Claim', claim.id, {
            billingProvider: {
              id: result.id,
              type: payload.kind === 'individual' ? 'Practitioner' : 'Organization',
            },
          });
        }
      }
      // Update provider
      await updateBillingProvider(oystehrZambda, { ...payload, providerId });
      resetFields();
      await refetchClaimProvider();
      return null;
    } catch (err) {
      return getApiError({ error: err, defaultError: 'Failed to save changes' });
    }
  };

  return (
    <ProviderDetailForm
      provider={selectedProvider ?? claimProvider}
      role="billing"
      onSave={handleSave}
      onCancel={resetFields}
      selector={{
        options,
        selectedOption: selectedProvider,
        onSelectOption: setSelectedProvider,
        fetchOptions: searchProviders,
      }}
    />
  );
}

function DiagnosesSection({
  claim,
  updateResource,
}: {
  claim: ClaimDetailResponse;
  updateResource: UpdateFn;
}): ReactElement {
  const toRows = useCallback(
    () => claim.diagnoses.map((dx) => ({ code: dx.code, display: dx.display === dx.code ? '' : dx.display })),
    [claim]
  );
  const [rows, setRows] = useState(toRows);

  const resetFields = useCallback((): void => setRows(toRows()), [toRows]);

  useEffect(() => {
    resetFields();
  }, [resetFields]);

  const handleSave = async (): Promise<string | null> => {
    if (rows.some((row) => !row.code.trim())) return 'Each diagnosis needs an ICD-10 code';
    return updateResource('Claim', claim.id, {
      diagnoses: rows.map((row) => ({
        code: row.code.trim(),
        ...(row.display.trim() ? { display: row.display.trim() } : {}),
      })),
    });
  };

  return (
    <EditableSection
      title="Diagnoses"
      onSave={handleSave}
      onCancel={resetFields}
      editForm={<DiagnosesEditor value={rows} onChange={setRows} />}
    >
      {claim.diagnoses.length > 0 ? (
        <>
          {claim.diagnoses.map((dx) => (
            <Row
              key={dx.sequence}
              label={`${dx.sequence}`}
              value={dx.display && dx.display !== dx.code ? `${dx.code} - ${dx.display}` : dx.code}
            />
          ))}
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No diagnoses
        </Typography>
      )}
    </EditableSection>
  );
}

function ServiceLinesSection({
  claim,
  updateResource,
}: {
  claim: ClaimDetailResponse;
  updateResource: UpdateFn;
}): ReactElement {
  const toRows = useCallback(
    (): ServiceLineRow[] =>
      claim.serviceLines.map((line) => ({
        cptCode: line.cptCode,
        modifiers: line.modifiers.join(', '),
        units: String(line.units),
        charges: String(line.charges),
        serviceDate: line.serviceDate,
        placeOfService: line.placeOfService,
        diagnosisPointers: line.diagnosisPointers,
      })),
    [claim]
  );
  const [rows, setRows] = useState<ServiceLineRow[]>(toRows);

  const resetFields = useCallback((): void => setRows(toRows()), [toRows]);

  useEffect(() => {
    resetFields();
  }, [resetFields]);

  const dxCode = (sequence: number): string =>
    claim.diagnoses.find((dx) => dx.sequence === sequence)?.code ?? String(sequence);

  const handleSave = async (): Promise<string | null> => {
    for (const row of rows) {
      if (!row.cptCode.trim()) return 'Each service line needs a CPT code';
      if (!row.serviceDate) return 'Each service line needs a date of service';
      if (!(Number(row.units) > 0)) return 'Units must be a positive number';
      if (row.charges.trim() === '' || !Number.isFinite(Number(row.charges))) return 'Charges must be a number';
    }
    return updateResource('Claim', claim.id, {
      serviceLines: rows.map((row) => {
        const modifiers = row.modifiers
          .split(/[,\s]+/)
          .map((m) => m.trim())
          .filter(Boolean);
        return {
          cptCode: row.cptCode.trim(),
          units: Number(row.units),
          charges: Number(row.charges),
          serviceDate: row.serviceDate,
          ...(row.placeOfService.trim() ? { placeOfService: row.placeOfService.trim() } : {}),
          ...(modifiers.length ? { modifiers } : {}),
          ...(row.diagnosisPointers.length ? { diagnosisPointers: row.diagnosisPointers } : {}),
        };
      }),
    });
  };

  return (
    <EditableSection
      title="Service Lines"
      onSave={handleSave}
      onCancel={resetFields}
      editForm={
        <ServiceLinesEditor
          value={rows}
          onChange={setRows}
          diagnoses={claim.diagnoses}
          defaultServiceDate={claim.created}
        />
      }
    >
      {claim.serviceLines.length > 0 ? (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>#</TableCell>
                <TableCell sx={thSx}>Date of Service</TableCell>
                <TableCell sx={thSx}>CPT Code</TableCell>
                <TableCell sx={thSx}>Modifiers</TableCell>
                <TableCell sx={thSx}>Dx</TableCell>
                <TableCell sx={thSx}>POS</TableCell>
                <TableCell sx={thSx}>Qty</TableCell>
                <TableCell sx={thSx} align="right">
                  Billed
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {claim.serviceLines.map((line) => (
                <TableRow key={line.sequence}>
                  <TableCell>{line.sequence}</TableCell>
                  <TableCell>{line.serviceDate}</TableCell>
                  <TableCell>{line.cptCode}</TableCell>
                  <TableCell>{line.modifiers.join(', ') || '-'}</TableCell>
                  <TableCell>{line.diagnosisPointers.map(dxCode).join(', ') || '-'}</TableCell>
                  <TableCell>{line.placeOfService || '-'}</TableCell>
                  <TableCell>{line.units} UN</TableCell>
                  <TableCell align="right">{formatCurrency(line.charges)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No service lines
        </Typography>
      )}
    </EditableSection>
  );
}

function OtherClaimsSection({
  claims,
  navigate,
}: {
  claims: ClaimDetailResponse['otherClaims'];
  navigate: (path: string) => void;
}): ReactElement {
  if (claims.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No other claims for this patient
      </Typography>
    );
  }
  return (
    <Card variant="outlined">
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={thSx}>Claim ID</TableCell>
              <TableCell sx={thSx}>Service Date</TableCell>
              <TableCell sx={thSx}>Payer</TableCell>
              <TableCell sx={thSx}>AR Stage</TableCell>
              <TableCell sx={thSx} align="right">
                Billed
              </TableCell>
              <TableCell sx={thSx}>CPT Codes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {claims.map((oc) => (
              <TableRow
                key={oc.id}
                sx={{ cursor: 'pointer', '&:hover': { bgcolor: otherColors.apptHover } }}
                onClick={() => navigate(`/claims/${oc.id}`)}
              >
                <TableCell>{oc.id.slice(0, 8)}</TableCell>
                <TableCell>{oc.serviceDate}</TableCell>
                <TableCell>{oc.payerName}</TableCell>
                <TableCell>
                  {oc.arStage ? (
                    <Chip
                      label={formatClaimStatusValue(CLAIM_STATUS_FIELDS_BY_KEY.arStage, oc.arStage)}
                      color={claimStatusValueColor(oc.arStage)}
                      variant="outlined"
                      size="small"
                      sx={{ borderRadius: '4px' }}
                    />
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell align="right">{formatCurrency(oc.billed)}</TableCell>
                <TableCell>{oc.cptCodes.join(', ')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}

// Human labels for CLP02 claim status codes the ERA can carry.
const ERA_STATUS_LABELS: Record<EraClaimStatusCode, string> = {
  [ERA_CLAIM_STATUS_CODE.primary]: 'Primary',
  [ERA_CLAIM_STATUS_CODE.secondary]: 'Secondary',
  [ERA_CLAIM_STATUS_CODE.tertiary]: 'Tertiary',
  [ERA_CLAIM_STATUS_CODE.denied]: 'Denied',
  [ERA_CLAIM_STATUS_CODE.primaryForwarded]: 'Primary (forwarded)',
  [ERA_CLAIM_STATUS_CODE.secondaryForwarded]: 'Secondary (forwarded)',
  [ERA_CLAIM_STATUS_CODE.tertiaryForwarded]: 'Tertiary (forwarded)',
  [ERA_CLAIM_STATUS_CODE.reversal]: 'Reversal',
  [ERA_CLAIM_STATUS_CODE.notOurClaimForwarded]: 'Not our claim (forwarded)',
  [ERA_CLAIM_STATUS_CODE.predetermination]: 'Predetermination',
};

const formatAdjustment = (adj: ClaimRemitAdjustment): string =>
  `${adj.groupCode}${adj.reasonCode ? `-${adj.reasonCode}` : ''} ${formatCurrency(adj.amount)}`;

function RemitsSection({ remits }: { remits: ClaimDetailResponse['remits'] }): ReactElement {
  return (
    <ReadOnlySection title="Remits">
      {remits.length === 0 ? (
        'No remits yet'
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>Date</TableCell>
                <TableCell sx={thSx}>Payer</TableCell>
                <TableCell sx={thSx}>Status</TableCell>
                <TableCell sx={thSx}>ERA Status</TableCell>
                <TableCell sx={thSx}>Adjustments</TableCell>
                <TableCell sx={thSx} align="right">
                  Allowed
                </TableCell>
                <TableCell sx={thSx} align="right">
                  Paid
                </TableCell>
                <TableCell sx={thSx} align="right">
                  Patient Resp
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {remits.map((remit) => (
                <TableRow key={remit.claimResponseId}>
                  <TableCell>{formatDate(remit.date) || '-'}</TableCell>
                  <TableCell>{remit.payerName || '-'}</TableCell>
                  <TableCell>{remit.status || '-'}</TableCell>
                  <TableCell>{remit.eraStatusCode ? ERA_STATUS_LABELS[remit.eraStatusCode] : '-'}</TableCell>
                  <TableCell>{remit.adjustments.map(formatAdjustment).join(', ') || '-'}</TableCell>
                  <TableCell align="right">{remit.allowed === null ? '-' : formatCurrency(remit.allowed)}</TableCell>
                  <TableCell align="right">{formatCurrency(remit.paid)}</TableCell>
                  <TableCell align="right">
                    {remit.patientResp === null ? '-' : formatCurrency(remit.patientResp)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </ReadOnlySection>
  );
}

function InsurancePaymentsSection({
  payments,
  navigate,
}: {
  payments: ClaimDetailResponse['insurancePayments'];
  navigate: (path: string) => void;
}): ReactElement {
  return (
    <ReadOnlySection title="Insurance Payments">
      {payments.length === 0 ? (
        'No insurance payments yet'
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>Date</TableCell>
                <TableCell sx={thSx}>Payer</TableCell>
                <TableCell sx={thSx}>Check Number</TableCell>
                <TableCell sx={thSx}>Status</TableCell>
                <TableCell sx={thSx} align="right">
                  Check Amount
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((payment) => (
                <TableRow
                  key={payment.paymentReconciliationId}
                  sx={{ cursor: 'pointer', '&:hover': { bgcolor: otherColors.apptHover } }}
                  onClick={() => navigate(`/eras/${payment.paymentReconciliationId}`)}
                >
                  <TableCell>{formatDate(payment.paymentDate) || '-'}</TableCell>
                  <TableCell>{payment.payerName || '-'}</TableCell>
                  <TableCell>{payment.checkNumber || '-'}</TableCell>
                  <TableCell>{payment.status || '-'}</TableCell>
                  <TableCell align="right">{formatCurrency(payment.paymentAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </ReadOnlySection>
  );
}

function ReadOnlySection({ title, children }: { title: string; children: React.ReactNode }): ReactElement {
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" color="primary.dark" fontWeight={600} fontSize={16} sx={{ mb: 1.5 }}>
          {title}
        </Typography>
        {typeof children === 'string' ? (
          <Typography variant="body2" color="text.secondary">
            {children}
          </Typography>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export function Meta({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500}>
        {value || '-'}
      </Typography>
    </Box>
  );
}

function Amount({ label, sublabel, value }: { label: string; sublabel?: string; value: number }): ReactElement {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 48 }}>
      <Box>
        <Typography variant="caption" color="text.secondary" lineHeight={1.2}>
          {label}
        </Typography>
        {sublabel && (
          <Typography variant="caption" display="block" color="text.secondary" fontSize={10} lineHeight={1.2}>
            {sublabel}
          </Typography>
        )}
      </Box>
      <Typography variant="body1" fontWeight={600}>
        {formatCurrency(value)}
      </Typography>
    </Box>
  );
}

function TagAdder({
  claimId,
  oystehrZambda,
  onAdded,
  existingTags,
}: {
  claimId: string;
  oystehrZambda: ReturnType<typeof useApiClients>['oystehrZambda'];
  onAdded: () => Promise<void>;
  existingTags: string[];
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [allTags, setAllTags] = useState<BillingTag[]>([]);
  const [addError, setAddError] = useState<string | null>(null);

  const loadTags = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) return;
    setAddError(null);
    try {
      const res = await searchBillingTags(oystehrZambda);
      setAllTags(res.tags ?? []);
    } catch (err) {
      setAllTags([]);
      setAddError(getApiError({ error: err, defaultError: 'Failed to load tags' }));
    }
  }, [oystehrZambda]);

  const handleAdd = useCallback(
    async (tagName: string): Promise<void> => {
      if (!oystehrZambda) return;
      setAddError(null);
      try {
        await tagBillingClaim(oystehrZambda, { claimId, action: 'add', tagName });
      } catch (err) {
        setAddError(getApiError({ error: err, defaultError: 'Failed to add tag' }));
        return;
      }
      setOpen(false);
      await onAdded();
    },
    [oystehrZambda, claimId, onAdded]
  );

  const available = allTags.filter((t) => !existingTags.includes(t.name));

  return (
    <>
      <Chip
        label="+ Tag"
        size="small"
        variant="outlined"
        onClick={() => {
          setOpen(!open);
          if (!open) void loadTags();
        }}
        sx={{ borderRadius: '4px', cursor: 'pointer', borderStyle: 'dashed' }}
      />
      {open && available.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
          {available.map((t) => (
            <Chip
              key={t.id}
              label={t.name}
              size="small"
              color="primary"
              variant="outlined"
              onClick={() => void handleAdd(t.name)}
              sx={{ borderRadius: '4px', cursor: 'pointer' }}
            />
          ))}
          {addError && (
            <Typography variant="caption" color="error">
              {addError}
            </Typography>
          )}
        </Box>
      )}
    </>
  );
}
