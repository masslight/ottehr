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
  FormControl,
  IconButton,
  InputLabel,
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
import { ReactElement, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BillingTag, chooseJson, ClaimDetailResponse } from 'utils';
import { EditableSection } from '../components/claim/EditableSection';
import { CLAIM_STATUS_COLORS, formatClaimStatus } from '../constants/claimStatus';
import { useApiClients } from '../hooks/useAppClients';
import { otherColors } from '../themes/ottehr/colors';
import { formatCurrency } from '../utils/format';

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
      const response = await oystehrZambda.zambda.execute({ id: 'get-billing-claim-detail', claimId: id });
      setClaim(chooseJson(response));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
        await oystehrZambda.zambda.execute({
          id: 'update-billing-claim',
          resourceId,
          resourceType,
          fields,
        });
        await fetchDetail();
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : 'Failed to save changes';
      }
    },
    [oystehrZambda, fetchDetail]
  );

  const handleTagAction = useCallback(
    async (action: 'add' | 'remove', tagName: string): Promise<void> => {
      if (!oystehrZambda || !id) return;
      try {
        await oystehrZambda.zambda.execute({ id: 'tag-billing-claim', claimId: id, action, tagName });
        await fetchDetail();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update tag');
      }
    },
    [oystehrZambda, id, fetchDetail]
  );

  if (loading) {
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

  const statusColor = CLAIM_STATUS_COLORS[claim.status] ?? 'default';
  const statusLabel = formatClaimStatus(claim.status);
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
            <Meta label="Patient DOB" value={claim.patientDob} />
            <Meta label="Billing Type" value={claim.billingType} />
            <Meta label="Billable Status" value={claim.billableStatus} />
          </Box>
        </Box>
      </Box>

      <Box sx={{ ml: 5, mb: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip label={statusLabel} color={statusColor} variant="outlined" size="small" sx={{ borderRadius: '4px' }} />
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
            <DiagnosesSection claim={claim} />
            <ServiceLinesSection claim={claim} />
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
  const nameParts = claim.patientName.split(', ');
  const [firstName, setFirstName] = useState(nameParts[1] ?? '');
  const [lastName, setLastName] = useState(nameParts[0] ?? '');
  const [dob, setDob] = useState(claim.patientDob);
  const [gender, setGender] = useState(claim.patientGender);

  const resetFields = useCallback((): void => {
    const parts = claim.patientName.split(', ');
    setFirstName(parts[1] ?? '');
    setLastName(parts[0] ?? '');
    setDob(claim.patientDob);
    setGender(claim.patientGender);
  }, [claim]);

  useEffect(() => {
    resetFields();
  }, [resetFields]);

  const handleSave = async (): Promise<string | null> => {
    if (!firstName.trim() || !lastName.trim()) return 'First and last name are required';
    return updateResource('Patient', claim.patientId, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dob,
      gender,
    });
  };

  return (
    <EditableSection
      title="Patient"
      onSave={handleSave}
      onCancel={resetFields}
      editForm={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              size="small"
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              fullWidth
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              size="small"
              label="Date of Birth"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 200 }}
            />
            <FormControl size="small" sx={{ width: 200 }}>
              <InputLabel>Gender</InputLabel>
              <Select value={gender} label="Gender" onChange={(e) => setGender(e.target.value)}>
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="other">Other</MenuItem>
                <MenuItem value="unknown">Unknown</MenuItem>
              </Select>
            </FormControl>
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
  const [memberId, setMemberId] = useState(claim.memberId);

  const resetFields = useCallback((): void => setMemberId(claim.memberId), [claim]);
  useEffect(() => {
    resetFields();
  }, [resetFields]);

  const handleSave = async (): Promise<string | null> => {
    if (!claim.coverageFhirId) return 'No coverage to edit';
    return updateResource('Coverage', claim.coverageFhirId, { subscriberId: memberId });
  };

  return (
    <EditableSection
      title="Primary Insurance"
      onSave={handleSave}
      onCancel={resetFields}
      disableEdit={!claim.coverageFhirId}
      editForm={
        <TextField
          size="small"
          label="Member / Subscriber ID"
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          fullWidth
        />
      }
    >
      <Row label="Payer" value={claim.payerName} />
      <Row label="Payer ID" value={claim.payerId} />
      <Row label="Member ID" value={claim.memberId} />
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
  const nameParts = claim.renderingProvider.split(', ');
  const [firstName, setFirstName] = useState(nameParts[1] ?? '');
  const [lastName, setLastName] = useState(nameParts[0] ?? '');

  const resetFields = useCallback((): void => {
    const parts = claim.renderingProvider.split(', ');
    setFirstName(parts[1] ?? '');
    setLastName(parts[0] ?? '');
  }, [claim]);

  useEffect(() => {
    resetFields();
  }, [resetFields]);

  const handleSave = async (): Promise<string | null> => {
    if (!claim.renderingProviderId) return 'No rendering provider to edit';
    return updateResource('Practitioner', claim.renderingProviderId, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    });
  };

  return (
    <EditableSection
      title="Rendering Provider"
      onSave={handleSave}
      onCancel={resetFields}
      disableEdit={!claim.renderingProviderId}
      editForm={
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            size="small"
            label="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            fullWidth
          />
          <TextField
            size="small"
            label="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            fullWidth
          />
        </Box>
      }
    >
      <Row label="Provider" value={claim.renderingProvider} />
      <Row label="NPI" value={claim.renderingNpi} />
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
  const [name, setName] = useState(claim.serviceFacility);

  const resetFields = useCallback((): void => setName(claim.serviceFacility), [claim]);
  useEffect(() => {
    resetFields();
  }, [resetFields]);

  const handleSave = async (): Promise<string | null> => {
    if (!claim.facilityFhirId) return 'No facility to edit';
    return updateResource('Location', claim.facilityFhirId, { name });
  };

  return (
    <EditableSection
      title="Service Facility"
      onSave={handleSave}
      onCancel={resetFields}
      disableEdit={!claim.facilityFhirId}
      editForm={
        <TextField
          size="small"
          label="Facility Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
        />
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
  const [name, setName] = useState(claim.billingProvider);

  const resetFields = useCallback((): void => setName(claim.billingProvider), [claim]);
  useEffect(() => {
    resetFields();
  }, [resetFields]);

  const handleSave = async (): Promise<string | null> => {
    if (!claim.billingProviderFhirId) return 'No billing provider to edit';
    return updateResource('Organization', claim.billingProviderFhirId, { name });
  };

  return (
    <EditableSection
      title="Billing Provider"
      onSave={handleSave}
      onCancel={resetFields}
      disableEdit={!claim.billingProviderFhirId}
      editForm={
        <TextField
          size="small"
          label="Organization Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
        />
      }
    >
      <Row label="Provider" value={claim.billingProvider} />
      <Row label="NPI" value={claim.billingNpi} />
      <Row label="Tax ID" value={claim.billingTin} />
    </EditableSection>
  );
}

function DiagnosesSection({ claim }: { claim: ClaimDetailResponse }): ReactElement {
  return (
    <ReadOnlySection title="Diagnoses">
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
    </ReadOnlySection>
  );
}

function ServiceLinesSection({ claim }: { claim: ClaimDetailResponse }): ReactElement {
  return (
    <ReadOnlySection title="Service Lines">
      {claim.serviceLines.length > 0 ? (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>#</TableCell>
                <TableCell sx={thSx}>Date of Service</TableCell>
                <TableCell sx={thSx}>CPT Code</TableCell>
                <TableCell sx={thSx}>Modifiers</TableCell>
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
    </ReadOnlySection>
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
              <TableCell sx={thSx}>Status</TableCell>
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
                  <Chip
                    label={formatClaimStatus(oc.status)}
                    color={CLAIM_STATUS_COLORS[oc.status] ?? 'default'}
                    variant="outlined"
                    size="small"
                    sx={{ borderRadius: '4px' }}
                  />
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
      const res = await oystehrZambda.zambda.execute({ id: 'search-billing-tags' });
      setAllTags(chooseJson(res).tags ?? []);
    } catch (err) {
      setAllTags([]);
      setAddError(err instanceof Error ? err.message : 'Failed to load tags');
    }
  }, [oystehrZambda]);

  const handleAdd = useCallback(
    async (tagName: string): Promise<void> => {
      if (!oystehrZambda) return;
      setAddError(null);
      try {
        await oystehrZambda.zambda.execute({ id: 'tag-billing-claim', claimId, action: 'add', tagName });
        setOpen(false);
        await onAdded();
      } catch (err) {
        setAddError(err instanceof Error ? err.message : 'Failed to add tag');
      }
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
