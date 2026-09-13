import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  AttachFile as AttachFileIcon,
  Delete as DeleteIcon,
  EditNote as EditNoteIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  OpenInNew as OpenInNewIcon,
  Save as SaveIcon,
  Scanner as ScannerIcon,
  Search as SearchIcon,
  UploadFile as UploadFileIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Link,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ChangeEvent, ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { BillingClaimItem, ClaimDetailResponse } from 'utils/lib/types/data/billing/billing.types';
import { formatCurrency } from 'utils/lib/utils/convert';
import { getBillingClaimDetail } from '../api/api';
import { AddClaimsDialog } from '../components/AddClaimsDialog';
import { EnterEraClaimDialog, ManualEraClaim } from '../components/EnterEraClaimDialog';
import { ReadOnlySection, thSx } from '../components/ReadOnlySection';
import { isRemitFormComplete, RemitFields, RemitForm } from '../components/RemitFields';
import { LineEditor, num, RemitLine } from '../components/RemitLineEditor';
import { useApiClients } from '../hooks/useAppClients';
import { useEvolveUser } from '../hooks/useEvolveUser';
import { formatDate } from '../utils/format';

// enough to render the claim card header; claims keyed in manually have no real claim behind them
interface RemitClaimSummary {
  id: string;
  patientName: string;
  serviceDate: string;
  payerName: string;
  memberId: string;
  billed: number;
  manual: boolean;
}

interface RemitClaim {
  summary: RemitClaimSummary;
  detail: ClaimDetailResponse | null;
  loading: boolean;
  loadError: string | null;
  lines: RemitLine[];
}

interface RemitAttachment {
  name: string;
  size: number;
  type: string;
  // local object URL — prototype only, never uploaded
  url: string;
}

const formatBytes = (size: number): string =>
  size > 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;

const linesFromDetail = (detail: ClaimDetailResponse): RemitLine[] =>
  detail.serviceLines.map((line) => ({
    sequence: line.sequence,
    cptCode: line.cptCode,
    description: line.description,
    modifiers: line.modifiers,
    units: line.units,
    serviceDate: line.serviceDate,
    billed: line.charges,
    allowed: '',
    paid: '',
    deductible: '',
    coinsurance: '',
    copay: '',
    adjustments: [],
    remarks: [],
  }));

function ClaimCard({
  claim,
  onChange,
  onRemove,
}: {
  claim: RemitClaim;
  onChange: (claim: RemitClaim) => void;
  onRemove: () => void;
}): ReactElement {
  const totals = useMemo(() => {
    const paid = claim.lines.reduce((sum, line) => sum + num(line.paid), 0);
    const allowed = claim.lines.reduce((sum, line) => sum + num(line.allowed), 0);
    const patientResp = claim.lines.reduce(
      (sum, line) => sum + num(line.deductible) + num(line.coinsurance) + num(line.copay),
      0
    );
    return { paid, allowed, patientResp };
  }, [claim.lines]);

  // manual lines are editable, so their billed total is live
  const billed = claim.summary.manual ? claim.lines.reduce((sum, line) => sum + line.billed, 0) : claim.summary.billed;

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2, overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          bgcolor: '#FAFAFA',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={3} alignItems="baseline">
          {claim.summary.manual ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body1" fontWeight={600} component="span">
                {claim.summary.patientName}
              </Typography>
              <Chip label="Unmatched" color="warning" size="small" variant="outlined" sx={{ borderRadius: '4px' }} />
            </Stack>
          ) : (
            <Link component={RouterLink} to={`/claims/${claim.summary.id}`} underline="hover">
              <Typography variant="body1" fontWeight={600} component="span">
                {claim.summary.patientName}
              </Typography>
            </Link>
          )}
          <Typography variant="body2" color="text.secondary">
            DOS {formatDate(claim.summary.serviceDate) || '-'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {claim.summary.payerName}
          </Typography>
          {claim.summary.memberId && (
            <Typography variant="body2" color="text.secondary">
              Member ID {claim.summary.memberId}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            Billed {formatCurrency(billed)}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton size="small" aria-label="Remove claim" onClick={onRemove}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
      {claim.loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : claim.loadError ? (
        <Alert severity="error" sx={{ m: 2 }}>
          {claim.loadError}
        </Alert>
      ) : (
        <>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>#</TableCell>
                <TableCell sx={thSx}>DOS</TableCell>
                <TableCell sx={thSx}>Procedure</TableCell>
                <TableCell sx={thSx} align="right">
                  Billed
                </TableCell>
                <TableCell sx={thSx} colSpan={2}>
                  Adjudication
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {claim.lines.map((line, idx) => (
                <LineEditor
                  key={line.sequence}
                  line={line}
                  disabled={false}
                  editableProcedure={claim.summary.manual}
                  onChange={(updated) =>
                    onChange({ ...claim, lines: claim.lines.map((l, i) => (i === idx ? updated : l)) })
                  }
                />
              ))}
            </TableBody>
          </Table>
          <Stack direction="row" spacing={4} sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2">
              <Box component="span" sx={{ color: 'text.secondary' }}>
                Allowed:{' '}
              </Box>
              <Box component="span" fontWeight={600}>
                {formatCurrency(totals.allowed)}
              </Box>
            </Typography>
            <Typography variant="body2">
              <Box component="span" sx={{ color: 'text.secondary' }}>
                Ins Paid:{' '}
              </Box>
              <Box component="span" fontWeight={600}>
                {formatCurrency(totals.paid)}
              </Box>
            </Typography>
            <Typography variant="body2">
              <Box component="span" sx={{ color: 'text.secondary' }}>
                Patient Resp:{' '}
              </Box>
              <Box component="span" fontWeight={600}>
                {formatCurrency(totals.patientResp)}
              </Box>
            </Typography>
          </Stack>
        </>
      )}
    </Box>
  );
}

// UI-only prototype for manual remit (paper/PDF ERA) entry — issue #8978. Receives the header form
// from EnterRemitDialog via location.state; nothing here is persisted yet.
export default function RemitDetail(): ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const { currentUser } = useEvolveUser();

  const initialForm = (location.state as { form?: RemitForm } | null)?.form;
  const [form, setForm] = useState<RemitForm>(initialForm ?? ({} as RemitForm));
  const [claims, setClaims] = useState<RemitClaim[]>([]);
  const [attachments, setAttachments] = useState<RemitAttachment[]>([]);
  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null);
  const [showAddClaims, setShowAddClaims] = useState(false);
  const [showEnterEraClaim, setShowEnterEraClaim] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // release local object URLs on unmount
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  useEffect(() => () => attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.url)), []);

  if (!initialForm) return <Navigate to="/eras" replace />;

  const claimsPaid = claims.reduce(
    (sum, claim) => sum + claim.lines.reduce((lineSum, line) => lineSum + num(line.paid), 0),
    0
  );
  const checkAmount = num(form.checkAmount);
  const balanced = Math.abs(checkAmount - claimsPaid) < 0.005;
  const canSave = isRemitFormComplete(form);

  const handleAddClaims = (added: BillingClaimItem[]): void => {
    setShowAddClaims(false);
    const newClaims: RemitClaim[] = added.map((item) => ({
      summary: {
        id: item.id,
        patientName: item.patientName,
        serviceDate: item.serviceDate,
        payerName: item.payerName,
        memberId: item.memberId,
        billed: item.billed,
        manual: false,
      },
      detail: null,
      loading: true,
      loadError: null,
      lines: [],
    }));
    setClaims((prev) => [...prev, ...newClaims]);
    added.forEach((summary) => {
      if (!oystehrZambda) return;
      getBillingClaimDetail(oystehrZambda, { claimId: summary.id })
        .then((detail) => {
          setClaims((prev) =>
            prev.map((claim) =>
              claim.summary.id === summary.id
                ? { ...claim, detail, loading: false, lines: linesFromDetail(detail) }
                : claim
            )
          );
        })
        .catch((err) => {
          setClaims((prev) =>
            prev.map((claim) =>
              claim.summary.id === summary.id
                ? {
                    ...claim,
                    loading: false,
                    loadError: getApiError({ error: err, defaultError: 'Failed to load claim detail' }),
                  }
                : claim
            )
          );
        });
    });
  };

  const handleAddManualEraClaim = (manual: ManualEraClaim): void => {
    setShowEnterEraClaim(false);
    setClaims((prev) => [
      ...prev,
      {
        summary: {
          id: `manual-${Date.now()}`,
          patientName: manual.patientName,
          serviceDate: manual.serviceDate,
          payerName: form.payer?.name ?? '',
          memberId: manual.memberId,
          billed: manual.lines.reduce((sum, line) => sum + line.billed, 0),
          manual: true,
        },
        detail: null,
        loading: false,
        loadError: null,
        lines: manual.lines,
      },
    ]);
  };

  const handleFiles = (e: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files ?? []);
    setAttachments((prev) => [
      ...prev,
      ...files.map((file) => ({ name: file.name, size: file.size, type: file.type, url: URL.createObjectURL(file) })),
    ]);
    e.target.value = '';
  };

  const handleSaveRemit = (): void => {
    enqueueSnackbar('Prototype only — the remit was not saved.', { variant: 'info' });
  };

  return (
    <Box sx={{ p: 0, maxWidth: 1440 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <IconButton onClick={() => navigate('/eras')} aria-label="Back to ERAs">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" color="primary.dark" fontWeight={600}>
            Manual Remit {form.checkNumber ? `— ${form.checkNumber}` : ''}
          </Typography>
          <Chip label="Source: Manual" color="info" variant="outlined" size="small" sx={{ borderRadius: '4px' }} />
        </Stack>
        <Tooltip title={canSave ? '' : 'Fill in the required remit details first'}>
          <span>
            <Button variant="contained" startIcon={<SaveIcon />} disabled={!canSave} onClick={handleSaveRemit}>
              Save
            </Button>
          </span>
        </Tooltip>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, ml: 6.5 }}>
        Entered by {currentUser?.name ?? 'current user'} on {new Date().toLocaleDateString()}
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Box sx={{ flex: 2, minWidth: 420 }}>
          <ReadOnlySection title="Remit Details">
            <RemitFields form={form} onChange={setForm} />
          </ReadOnlySection>
        </Box>
        <Box sx={{ flex: 1, minWidth: 300 }}>
          <ReadOnlySection
            title="Attachments"
            actions={
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<UploadFileIcon fontSize="small" />}
                  onClick={() => fileInputRef.current?.click()}
                  sx={{ borderRadius: '20px', textTransform: 'none' }}
                >
                  Upload
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ScannerIcon fontSize="small" />}
                  onClick={() =>
                    enqueueSnackbar('Scanning is not wired up in this prototype yet.', { variant: 'info' })
                  }
                  sx={{ borderRadius: '20px', textTransform: 'none' }}
                >
                  Scan
                </Button>
              </Stack>
            }
          >
            <input ref={fileInputRef} type="file" multiple hidden onChange={handleFiles} />
            {attachments.length === 0 ? (
              'Attach a scan of the paper remit (PDF or image).'
            ) : (
              <Stack spacing={1}>
                {attachments.map((attachment, idx) => (
                  <Stack key={idx} direction="row" spacing={1} alignItems="center">
                    <AttachFileIcon fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                      {attachment.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatBytes(attachment.size)}
                    </Typography>
                    <Tooltip title="Preview">
                      <IconButton
                        size="small"
                        aria-label="Preview attachment"
                        onClick={() => window.open(attachment.url, '_blank', 'noopener')}
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <IconButton
                      size="small"
                      aria-label="Remove attachment"
                      onClick={() => {
                        URL.revokeObjectURL(attachment.url);
                        setAttachments((prev) => prev.filter((_, i) => i !== idx));
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            )}
          </ReadOnlySection>
        </Box>
      </Box>

      <ReadOnlySection
        title={`Claims (${claims.length})`}
        actions={
          <>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon fontSize="small" />}
              endIcon={<KeyboardArrowDownIcon fontSize="small" />}
              onClick={(e) => setAddMenuAnchor(e.currentTarget)}
            >
              Add
            </Button>
            <Menu anchorEl={addMenuAnchor} open={!!addMenuAnchor} onClose={() => setAddMenuAnchor(null)}>
              <MenuItem
                onClick={() => {
                  setAddMenuAnchor(null);
                  setShowAddClaims(true);
                }}
              >
                <ListItemIcon>
                  <SearchIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Add Existing Claims" secondary="Search and select claims to associate" />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setAddMenuAnchor(null);
                  setShowEnterEraClaim(true);
                }}
              >
                <ListItemIcon>
                  <EditNoteIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Enter ERA Claim Manually" secondary="Key in one claim's remit details" />
              </MenuItem>
            </Menu>
          </>
        }
      >
        {claims.length === 0 ? (
          'No claims on this remit yet. Use Add to search and associate claims or key one in manually.'
        ) : (
          <>
            {claims.map((claim, idx) => (
              <ClaimCard
                key={claim.summary.id}
                claim={claim}
                onChange={(updated) => setClaims((prev) => prev.map((c, i) => (i === idx ? updated : c)))}
                onRemove={() => setClaims((prev) => prev.filter((_, i) => i !== idx))}
              />
            ))}
            <Stack direction="row" spacing={4} alignItems="center">
              <Typography variant="body2">
                <Box component="span" sx={{ color: 'text.secondary' }}>
                  Check Amount:{' '}
                </Box>
                <Box component="span" fontWeight={700}>
                  {formatCurrency(checkAmount)}
                </Box>
              </Typography>
              <Typography variant="body2">
                <Box component="span" sx={{ color: 'text.secondary' }}>
                  Claims Ins Paid:{' '}
                </Box>
                <Box component="span" fontWeight={700}>
                  {formatCurrency(claimsPaid)}
                </Box>
              </Typography>
              <Chip
                label={balanced ? 'Balanced' : `Off by ${formatCurrency(checkAmount - claimsPaid)}`}
                color={balanced ? 'success' : 'warning'}
                variant="outlined"
                size="small"
                sx={{ borderRadius: '4px' }}
              />
            </Stack>
          </>
        )}
      </ReadOnlySection>

      {showAddClaims && (
        <AddClaimsDialog
          excludeClaimIds={claims.map((claim) => claim.summary.id)}
          onAdd={handleAddClaims}
          onClose={() => setShowAddClaims(false)}
        />
      )}
      {showEnterEraClaim && (
        <EnterEraClaimDialog onAdd={handleAddManualEraClaim} onClose={() => setShowEnterEraClaim(false)} />
      )}
    </Box>
  );
}
