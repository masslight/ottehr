import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
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
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BillingCoverageOption,
  BillingLocationOption,
  BillingPayerOption,
  BillingProviderOption,
  BillingTag,
  CLAIM_STATUS_FIELDS_BY_KEY,
  ClaimDetailResponse,
  ClaimStatusFieldKey,
  formatClaimStatusValue,
  getApiError,
  UpdateBillingResourceInput,
} from 'utils';
import {
  getBillingClaimDetail,
  getPatientCoverages,
  searchBillingLocations,
  searchBillingPayers,
  searchBillingProviders,
  searchBillingTags,
  tagBillingClaim,
  updateBillingResource,
} from '../api/api';
import { ClaimStatusFields } from '../components/claim/ClaimStatusFields';
import { DiagnosesEditor } from '../components/claim/DiagnosesEditor';
import { EditableSection } from '../components/claim/EditableSection';
import { ServiceLineRow, ServiceLinesEditor } from '../components/claim/ServiceLinesEditor';
import { Field } from '../components/Field';
import {
  PolicyHolderFields,
  policyHolderPayload,
  PolicyHolderState,
  policyHolderStateFromSummary,
  validatePolicyHolder,
} from '../components/PolicyHolderFields';
import { claimStatusValueColor, formatAntCaseString } from '../constants/claimStatus';
import { useApiClients } from '../hooks/useAppClients';
import { otherColors } from '../themes/ottehr/colors';
import { buildAddressInput, formatCurrency, splitDisplayName } from '../utils/format';

type UpdateFn = (resourceType: string, resourceId: string, fields: Record<string, unknown>) => Promise<string | null>;

const thSx = { color: 'primary.dark', fontWeight: 600, fontSize: 13 };

export default function ClaimDetail(): ReactElement {
  const { id } = useParams();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [claim, setClaim] = useState<ClaimDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('1');

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
      if (!oystehrZambda) return 'Client not ready';
      try {
        await updateBillingResource(oystehrZambda, { resourceType, resourceId, fields } as UpdateBillingResourceInput);
      } catch (err) {
        return getApiError({ error: err, defaultError: 'Failed to save changes' });
      }
      await fetchDetail();
      return null;
    },
    [oystehrZambda, fetchDetail]
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

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
        <IconButton onClick={() => navigate('/claims')} size="small" sx={{ mt: 0.5 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5" color="primary.dark" fontWeight={600}>
            {claim.patientName}
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, mt: 0.5, flexWrap: 'wrap' }}>
            <Meta label="Date of Service" value={dos} />
            <Meta label="Claim ID" value={claim.id.slice(0, 8)} />
            <Meta label="Claim Type" value={formatAntCaseString(claim.type)} />
            <Meta label="Appointment Type" value={formatAntCaseString(claim.appointmentType)} />
            <Meta label="Patient DOB" value={claim.patientDob} />
          </Box>
        </Box>
      </Box>

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
          </TabList>

          <TabPanel value="1" sx={{ px: 0, pt: 2 }}>
            <PatientSection claim={claim} updateResource={updateResource} />
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
            <ReadOnlySection title="Remits">No remits yet</ReadOnlySection>
            <ReadOnlySection title="Insurance Payments">No insurance payments yet</ReadOnlySection>
          </TabPanel>

          <TabPanel value="3" sx={{ px: 0, pt: 2 }}>
            <ReadOnlySection title="Write offs">No write offs</ReadOnlySection>
            <ReadOnlySection title="Patient payments">No patient payments</ReadOnlySection>
          </TabPanel>

          <TabPanel value="4" sx={{ px: 0, pt: 2 }}>
            <OtherClaimsSection claims={claim.otherClaims} navigate={navigate} />
          </TabPanel>
        </TabContext>
      </Box>
    </Box>
  );
}

function PatientSection({
  claim,
  updateResource,
}: {
  claim: ClaimDetailResponse;
  updateResource: UpdateFn;
}): ReactElement {
  const initialName = splitDisplayName(claim.patientName);
  const [firstName, setFirstName] = useState(initialName.firstName);
  const [lastName, setLastName] = useState(initialName.lastName);
  const [dob, setDob] = useState(claim.patientDob);
  const [gender, setGender] = useState(claim.patientGender);
  const [line1, setLine1] = useState(claim.patientAddressParts.line1);
  const [line2, setLine2] = useState(claim.patientAddressParts.line2);
  const [city, setCity] = useState(claim.patientAddressParts.city);
  const [state, setState] = useState(claim.patientAddressParts.state);
  const [zip, setZip] = useState(claim.patientAddressParts.postalCode);

  const resetFields = useCallback((): void => {
    const name = splitDisplayName(claim.patientName);
    setFirstName(name.firstName);
    setLastName(name.lastName);
    setDob(claim.patientDob);
    setGender(claim.patientGender);
    setLine1(claim.patientAddressParts.line1);
    setLine2(claim.patientAddressParts.line2);
    setCity(claim.patientAddressParts.city);
    setState(claim.patientAddressParts.state);
    setZip(claim.patientAddressParts.postalCode);
  }, [claim]);

  useEffect(() => {
    resetFields();
  }, [resetFields]);

  const handleSave = async (): Promise<string | null> => {
    if (!firstName.trim() || !lastName.trim()) return 'First and last name are required';
    const address = buildAddressInput(line1, line2, city, state, zip);
    return updateResource('Patient', claim.patientId, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dob,
      gender,
      ...(address ? { address } : {}),
    });
  };

  return (
    <EditableSection
      title="Patient"
      onSave={handleSave}
      onCancel={resetFields}
      editForm={
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.25, maxWidth: 680 }}>
          <Field label="First name">
            <TextField size="small" fullWidth value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label="Last name">
            <TextField size="small" fullWidth value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
          <Field label="Date of birth">
            <TextField size="small" fullWidth type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </Field>
          <Field label="Gender">
            <Select
              size="small"
              fullWidth
              displayEmpty
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              renderValue={
                gender
                  ? undefined
                  : () => (
                      <Box component="span" sx={{ color: 'text.disabled' }}>
                        Select...
                      </Box>
                    )
              }
            >
              <MenuItem value="male">Male</MenuItem>
              <MenuItem value="female">Female</MenuItem>
              <MenuItem value="other">Other</MenuItem>
              <MenuItem value="unknown">Unknown</MenuItem>
            </Select>
          </Field>
          <Field label="Address line 1">
            <TextField size="small" fullWidth value={line1} onChange={(e) => setLine1(e.target.value)} />
          </Field>
          <Field label="Address line 2">
            <TextField size="small" fullWidth value={line2} onChange={(e) => setLine2(e.target.value)} />
          </Field>
          <Field label="City">
            <TextField size="small" fullWidth value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Field label="State">
              <TextField
                size="small"
                fullWidth
                value={state}
                onChange={(e) => setState(e.target.value)}
                inputProps={{ maxLength: 2, style: { textTransform: 'uppercase' } }}
              />
            </Field>
            <Field label="ZIP">
              <TextField size="small" fullWidth value={zip} onChange={(e) => setZip(e.target.value)} />
            </Field>
          </Box>
        </Box>
      }
    >
      <Row label="Patient" value={claim.patientName} />
      <Row label="Date of Birth" value={claim.patientDob} />
      <Row label="Gender" value={claim.patientGender} />
      <Row label="Address" value={claim.patientAddress} />
    </EditableSection>
  );
}

function InsuranceSection({
  claim,
  updateResource,
}: {
  claim: ClaimDetailResponse;
  updateResource: UpdateFn;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  const hasCoverage = !!claim.coverageFhirId;

  const [payer, setPayer] = useState<BillingPayerOption | null>(null);
  const [memberId, setMemberId] = useState(claim.memberId);
  const [status, setStatus] = useState(claim.coverageStatus);
  const [policyHolder, setPolicyHolder] = useState<PolicyHolderState>(() =>
    policyHolderStateFromSummary(claim.relationship, claim.policyHolder)
  );

  const [payerOptions, setPayerOptions] = useState<BillingPayerOption[]>([]);
  const [coverageOptions, setCoverageOptions] = useState<BillingCoverageOption[]>([]);
  const [selectedCoverage, setSelectedCoverage] = useState<BillingCoverageOption | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const resetFields = useCallback((): void => {
    setPayer(claim.payorFhirId ? { id: claim.payorFhirId, name: claim.payerName, payerId: claim.payerId } : null);
    setMemberId(claim.memberId);
    setStatus(claim.coverageStatus);
    setPolicyHolder(policyHolderStateFromSummary(claim.relationship, claim.policyHolder));
    setSelectedCoverage(null);
  }, [claim]);

  useEffect(() => {
    resetFields();
  }, [resetFields]);

  const searchPayers = useCallback(
    (query?: string): void => {
      if (!oystehrZambda) return;
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(async () => {
        const res = await searchBillingPayers(oystehrZambda, query ? { name: query } : {});
        setPayerOptions(res.payers ?? []);
      }, 300);
    },
    [oystehrZambda]
  );

  const loadCoverages = useCallback((): void => {
    if (!oystehrZambda || !claim.patientOriginalId) return;
    void (async () => {
      const res = await getPatientCoverages(oystehrZambda, { patientId: claim.patientOriginalId });
      setCoverageOptions(res.coverages ?? []);
    })();
  }, [oystehrZambda, claim.patientOriginalId]);

  const handleSave = async (): Promise<string | null> => {
    if (selectedCoverage?.id) {
      return updateResource('Claim', claim.id, { coverageId: selectedCoverage.id });
    }
    if (!hasCoverage) return 'Choose a coverage';
    const policyHolderError = validatePolicyHolder(policyHolder);
    if (policyHolderError) return policyHolderError;
    if (payer?.id && payer.id !== claim.payorFhirId) {
      const err = await updateResource('Claim', claim.id, { payerId: payer.id });
      if (err) return err;
    }
    const policyHolderInput = policyHolderPayload(policyHolder);
    return updateResource('Coverage', claim.coverageFhirId, {
      subscriberId: memberId,
      status,
      relationship: policyHolder.relationship,
      ...(policyHolderInput ? { policyHolder: policyHolderInput } : {}),
    });
  };

  return (
    <EditableSection
      title="Primary Insurance"
      onSave={handleSave}
      onCancel={resetFields}
      editForm={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
          <Field label={hasCoverage ? 'Change coverage' : 'Choose coverage'}>
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
                <TextField {...p} size="small" placeholder={claim.payerName || 'Choose coverage...'} />
              )}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              sx={{ maxWidth: 480 }}
            />
          </Field>
          {hasCoverage && !selectedCoverage && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.25, maxWidth: 680 }}>
              <Field label="Payer">
                <Autocomplete
                  size="small"
                  options={payerOptions}
                  value={payer}
                  onChange={(_, v) => setPayer(v)}
                  onInputChange={(_, val, reason) => {
                    if (reason === 'input') searchPayers(val || undefined);
                  }}
                  onOpen={() => searchPayers()}
                  filterOptions={(x) => x}
                  getOptionLabel={(o) => o.name}
                  renderOption={(props, o) => (
                    <Box component="li" {...props} key={o.id}>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {o.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Payer ID: {o.payerId}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                  renderInput={(p) => <TextField {...p} size="small" placeholder="Choose payer..." />}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                />
              </Field>
              <Field label="Member / Subscriber ID">
                <TextField size="small" fullWidth value={memberId} onChange={(e) => setMemberId(e.target.value)} />
              </Field>
              <Field label="Coverage status">
                <Select size="small" fullWidth value={status} onChange={(e) => setStatus(e.target.value)}>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="entered-in-error">Entered in error</MenuItem>
                </Select>
              </Field>
            </Box>
          )}
          {hasCoverage && !selectedCoverage && <PolicyHolderFields value={policyHolder} onChange={setPolicyHolder} />}
        </Box>
      }
    >
      <Row label="Payer" value={claim.payerName} />
      <Row label="Payer ID" value={claim.payerId} />
      <Row label="Member ID" value={claim.memberId} />
      <Row label="Relationship to insured" value={claim.relationship} />
      {claim.policyHolder && (
        <Row label="Policy holder" value={`${claim.policyHolder.firstName} ${claim.policyHolder.lastName}`.trim()} />
      )}
      <Row label="Coverage Status" value={claim.coverageStatus} />
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
  const hasProvider = !!claim.renderingProviderId;
  const isOrganization = claim.renderingProviderType === 'Organization';

  const initialName = splitDisplayName(claim.renderingProvider);
  const [name, setName] = useState(claim.renderingProvider);
  const [firstName, setFirstName] = useState(initialName.firstName);
  const [lastName, setLastName] = useState(initialName.lastName);
  const [npi, setNpi] = useState(claim.renderingNpi);
  const [taxonomy, setTaxonomy] = useState(claim.renderingTaxonomy);

  const [options, setOptions] = useState<BillingProviderOption[]>([]);
  const [selected, setSelected] = useState<BillingProviderOption | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const resetFields = useCallback((): void => {
    const parsed = splitDisplayName(claim.renderingProvider);
    setName(claim.renderingProvider);
    setFirstName(parsed.firstName);
    setLastName(parsed.lastName);
    setNpi(claim.renderingNpi);
    setTaxonomy(claim.renderingTaxonomy);
    setSelected(null);
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

  const handleSave = async (): Promise<string | null> => {
    if (selected) {
      return updateResource('Claim', claim.id, {
        renderingProvider: {
          id: selected.id,
          type: selected.kind === 'organization' ? 'Organization' : 'Practitioner',
        },
      });
    }
    if (!hasProvider) return 'Choose a rendering provider';
    if (isOrganization) {
      return updateResource('Organization', claim.renderingProviderId, {
        name,
        npi: npi.trim(),
        taxonomyCode: taxonomy.trim(),
      });
    }
    if (!firstName.trim() || !lastName.trim()) return 'First and last name are required';
    return updateResource('Practitioner', claim.renderingProviderId, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      npi: npi.trim(),
      taxonomyCode: taxonomy.trim(),
    });
  };

  return (
    <EditableSection
      title="Rendering Provider"
      onSave={handleSave}
      onCancel={resetFields}
      editForm={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
          <Field label={hasProvider ? 'Change provider' : 'Choose provider'}>
            <Autocomplete
              size="small"
              options={options}
              value={selected}
              onChange={(_, v) => setSelected(v)}
              onInputChange={(_, val, reason) => {
                if (reason === 'input') searchProviders(val || undefined);
              }}
              onOpen={() => searchProviders()}
              filterOptions={(x) => x}
              getOptionLabel={(o) => o.name}
              renderOption={(props, o) => (
                <Box component="li" {...props} key={o.id}>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      {o.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      NPI: {o.npi} | TIN: {o.taxId}
                    </Typography>
                  </Box>
                </Box>
              )}
              renderInput={(p) => (
                <TextField
                  {...p}
                  size="small"
                  placeholder={claim.renderingProvider || 'Choose rendering provider...'}
                />
              )}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              sx={{ maxWidth: 480 }}
            />
          </Field>
          {hasProvider && !selected && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.25, maxWidth: 680 }}>
              {isOrganization ? (
                <Field label="Organization name">
                  <TextField size="small" fullWidth value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
              ) : (
                <>
                  <Field label="First name">
                    <TextField
                      size="small"
                      fullWidth
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </Field>
                  <Field label="Last name">
                    <TextField size="small" fullWidth value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </Field>
                </>
              )}
              <Field label="NPI">
                <TextField size="small" fullWidth value={npi} onChange={(e) => setNpi(e.target.value)} />
              </Field>
              <Field label="Taxonomy Code">
                <TextField size="small" fullWidth value={taxonomy} onChange={(e) => setTaxonomy(e.target.value)} />
              </Field>
            </Box>
          )}
        </Box>
      }
    >
      <Row label="Provider" value={claim.renderingProvider} />
      <Row label="NPI" value={claim.renderingNpi} />
      <Row label="Taxonomy Code" value={claim.renderingTaxonomy} />
    </EditableSection>
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
  const hasFacility = !!claim.facilityFhirId;

  const [name, setName] = useState(claim.serviceFacility);
  const [npi, setNpi] = useState(claim.serviceFacilityNpi);
  const [line1, setLine1] = useState(claim.serviceFacilityAddressParts.line1);
  const [line2, setLine2] = useState(claim.serviceFacilityAddressParts.line2);
  const [city, setCity] = useState(claim.serviceFacilityAddressParts.city);
  const [state, setState] = useState(claim.serviceFacilityAddressParts.state);
  const [zip, setZip] = useState(claim.serviceFacilityAddressParts.postalCode);

  const [options, setOptions] = useState<BillingLocationOption[]>([]);
  const [selected, setSelected] = useState<BillingLocationOption | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const resetFields = useCallback((): void => {
    setName(claim.serviceFacility);
    setNpi(claim.serviceFacilityNpi);
    setLine1(claim.serviceFacilityAddressParts.line1);
    setLine2(claim.serviceFacilityAddressParts.line2);
    setCity(claim.serviceFacilityAddressParts.city);
    setState(claim.serviceFacilityAddressParts.state);
    setZip(claim.serviceFacilityAddressParts.postalCode);
    setSelected(null);
  }, [claim]);

  useEffect(() => {
    resetFields();
  }, [resetFields]);

  const searchLocations = useCallback(
    (query?: string): void => {
      if (!oystehrZambda) return;
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(async () => {
        const res = await searchBillingLocations(oystehrZambda, query ? { name: query } : {});
        setOptions(res.locations ?? []);
      }, 300);
    },
    [oystehrZambda]
  );

  const handleSave = async (): Promise<string | null> => {
    if (selected?.id) {
      return updateResource('Claim', claim.id, { facilityId: selected.id });
    }
    if (!hasFacility) return 'Choose a facility';
    const address = buildAddressInput(line1, line2, city, state, zip);
    return updateResource('Location', claim.facilityFhirId, {
      name,
      npi: npi.trim(),
      ...(address ? { address } : {}),
    });
  };

  return (
    <EditableSection
      title="Service Facility"
      onSave={handleSave}
      onCancel={resetFields}
      editForm={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
          <Field label={hasFacility ? 'Change facility' : 'Choose facility'}>
            <Autocomplete
              size="small"
              options={options}
              value={selected}
              onChange={(_, v) => setSelected(v)}
              onInputChange={(_, val, reason) => {
                if (reason === 'input') searchLocations(val || undefined);
              }}
              onOpen={() => searchLocations()}
              filterOptions={(x) => x}
              getOptionLabel={(o) => o.name}
              renderOption={(props, o) => (
                <Box component="li" {...props} key={o.id}>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      {o.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      NPI: {o.npi} | {o.address}
                    </Typography>
                  </Box>
                </Box>
              )}
              renderInput={(p) => (
                <TextField {...p} size="small" placeholder={claim.serviceFacility || 'Choose facility...'} />
              )}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              sx={{ maxWidth: 480 }}
            />
          </Field>
          {hasFacility && !selected && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.25, maxWidth: 680 }}>
              <Field label="Facility name">
                <TextField size="small" fullWidth value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="NPI">
                <TextField size="small" fullWidth value={npi} onChange={(e) => setNpi(e.target.value)} />
              </Field>
              <Field label="Address line 1">
                <TextField size="small" fullWidth value={line1} onChange={(e) => setLine1(e.target.value)} />
              </Field>
              <Field label="Address line 2">
                <TextField size="small" fullWidth value={line2} onChange={(e) => setLine2(e.target.value)} />
              </Field>
              <Field label="City">
                <TextField size="small" fullWidth value={city} onChange={(e) => setCity(e.target.value)} />
              </Field>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Field label="State">
                  <TextField
                    size="small"
                    fullWidth
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    inputProps={{ maxLength: 2, style: { textTransform: 'uppercase' } }}
                  />
                </Field>
                <Field label="ZIP">
                  <TextField size="small" fullWidth value={zip} onChange={(e) => setZip(e.target.value)} />
                </Field>
              </Box>
            </Box>
          )}
        </Box>
      }
    >
      <Row label="Facility" value={claim.serviceFacility} />
      <Row label="Address" value={claim.serviceFacilityAddress} />
      <Row label="NPI" value={claim.serviceFacilityNpi} />
    </EditableSection>
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
  const hasProvider = !!claim.billingProviderFhirId;
  const isPractitioner = claim.billingProviderType === 'Practitioner';

  const initialName = splitDisplayName(claim.billingProvider);
  const [name, setName] = useState(claim.billingProvider);
  const [firstName, setFirstName] = useState(initialName.firstName);
  const [lastName, setLastName] = useState(initialName.lastName);
  const [npi, setNpi] = useState(claim.billingNpi);
  const [tin, setTin] = useState(claim.billingTin);
  const [taxonomy, setTaxonomy] = useState(claim.billingTaxonomy);

  const [options, setOptions] = useState<BillingProviderOption[]>([]);
  const [selected, setSelected] = useState<BillingProviderOption | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const resetFields = useCallback((): void => {
    const parsed = splitDisplayName(claim.billingProvider);
    setName(claim.billingProvider);
    setFirstName(parsed.firstName);
    setLastName(parsed.lastName);
    setNpi(claim.billingNpi);
    setTin(claim.billingTin);
    setTaxonomy(claim.billingTaxonomy);
    setSelected(null);
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

  const handleSave = async (): Promise<string | null> => {
    if (selected) {
      return updateResource('Claim', claim.id, {
        billingProvider: {
          id: selected.id,
          type: selected.kind === 'organization' ? 'Organization' : 'Practitioner',
        },
      });
    }
    if (!hasProvider) return 'Choose a billing provider';
    if (isPractitioner) {
      if (!firstName.trim() || !lastName.trim()) return 'First and last name are required';
      return updateResource('Practitioner', claim.billingProviderFhirId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        npi: npi.trim(),
        taxId: tin.trim(),
        taxonomyCode: taxonomy.trim(),
      });
    }
    return updateResource('Organization', claim.billingProviderFhirId, {
      name,
      npi: npi.trim(),
      taxId: tin.trim(),
      taxonomyCode: taxonomy.trim(),
    });
  };

  return (
    <EditableSection
      title="Billing Provider"
      onSave={handleSave}
      onCancel={resetFields}
      editForm={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
          <Field label={hasProvider ? 'Change provider' : 'Choose provider'}>
            <Autocomplete
              size="small"
              options={options}
              value={selected}
              onChange={(_, v) => setSelected(v)}
              onInputChange={(_, val, reason) => {
                if (reason === 'input') searchProviders(val || undefined);
              }}
              onOpen={() => searchProviders()}
              filterOptions={(x) => x}
              getOptionLabel={(o) => o.name}
              renderOption={(props, o) => (
                <Box component="li" {...props} key={o.id}>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      {o.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      NPI: {o.npi} | TIN: {o.taxId}
                    </Typography>
                  </Box>
                </Box>
              )}
              renderInput={(p) => (
                <TextField {...p} size="small" placeholder={claim.billingProvider || 'Choose billing provider...'} />
              )}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              sx={{ maxWidth: 480 }}
            />
          </Field>
          {hasProvider && !selected && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.25, maxWidth: 680 }}>
              {isPractitioner ? (
                <>
                  <Field label="First name">
                    <TextField
                      size="small"
                      fullWidth
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </Field>
                  <Field label="Last name">
                    <TextField size="small" fullWidth value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </Field>
                </>
              ) : (
                <Field label="Organization name">
                  <TextField size="small" fullWidth value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
              )}
              <Field label="NPI">
                <TextField size="small" fullWidth value={npi} onChange={(e) => setNpi(e.target.value)} />
              </Field>
              <Field label="Tax ID">
                <TextField size="small" fullWidth value={tin} onChange={(e) => setTin(e.target.value)} />
              </Field>
              <Field label="Taxonomy Code">
                <TextField size="small" fullWidth value={taxonomy} onChange={(e) => setTaxonomy(e.target.value)} />
              </Field>
            </Box>
          )}
        </Box>
      }
    >
      <Row label="Provider" value={claim.billingProvider} />
      <Row label="NPI" value={claim.billingNpi} />
      <Row label="Tax ID" value={claim.billingTin} />
      <Row label="Taxonomy Code" value={claim.billingTaxonomy} />
    </EditableSection>
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

function Meta({ label, value }: { label: string; value: string }): ReactElement {
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

function Row({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <Box sx={{ display: 'flex', py: 0.75, borderBottom: `1px solid ${otherColors.lightDivider}` }}>
      <Typography variant="body2" color="primary.dark" sx={{ width: 180, flexShrink: 0, fontWeight: 500 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value || '-'}</Typography>
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
