import {
  ArrowBack as ArrowBackIcon,
  EditNote as EditNoteIcon,
  Save as SaveIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import {
  ERA_PAYMENT_METHODS,
  EraPaymentMethodCode,
  MANUAL_ERA_LIMITS,
} from 'utils/lib/types/data/billing/billing.constants';
import { EraClaimListItem, EraDetailResponse } from 'utils/lib/types/data/billing/billing.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import {
  addEraAttachment,
  deleteEraAttachment,
  downloadEraAttachment,
  getBillingEraDetail,
  renameEraAttachment,
  saveBillingManualEra,
  searchBillingEras,
  unmatchClaimResponse,
  uploadFileToPresignedUrl,
} from '../api/api';
import { AddMenuButton } from '../components/AddMenuButton';
import { AttachmentsSection } from '../components/attachments/AttachmentsSection';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DateInput } from '../components/DateInput';
import { AssociateClaimDialog } from '../components/era/AssociateClaimDialog';
import { ManualEraClaimCard } from '../components/era/ManualEraClaimCard';
import { ManualEraClaimDialog } from '../components/era/ManualEraClaimDialog';
import { RemitReconciliation } from '../components/era/RemitReconciliation';
import { MatchClaimDialog } from '../components/MatchClaimDialog';
import { PayerSelect } from '../components/PayerSelect';
import { ProviderSelect } from '../components/ProviderSelect';
import { ReadOnlySection } from '../components/ReadOnlySection';
import { useApiClients } from '../hooks/useAppClients';
import { useDebounce } from '../hooks/useDebounce';
import { formatDate } from '../utils/format';
import {
  ClaimForm,
  claimFormFromClaimDetail,
  claimFormFromEntry,
  claimFormToInput,
  claimProblems,
  claimTotals,
  emptyClaimForm,
  emptyHeaderForm,
  HeaderField,
  HeaderForm,
  headerFormFromEntry,
  headerFormToInput,
  headerProblems,
  newKey,
  parseMoneyToCents,
  reconcileRemit,
} from '../utils/manualEra';

// Files a paper remit scan can be.
const SCAN_TYPES = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/tiff': ['.tif', '.tiff'],
};
const SCAN_MAX_BYTES = 20 * 1024 * 1024;

// what a stored claim looked like when last saved, to tell edited cards apart
const snapshotOf = (claim: ClaimForm): string => JSON.stringify({ ...claimFormToInput(claim), clientKey: undefined });
const cardId = (claim: ClaimForm): string => claim.claimResponseId ?? claim.key;

const isVersionConflict = (error: unknown): boolean =>
  (error as { output?: { code?: number } } | undefined)?.output?.code === APIErrorCode.MANUAL_ERA_VERSION_CONFLICT ||
  (error as { code?: number } | undefined)?.code === APIErrorCode.MANUAL_ERA_VERSION_CONFLICT;

// what the ERA screen's match dialog shows about the remit claim
function eraClaimFor(claim: ClaimForm): EraClaimListItem {
  const totals = claimTotals(claim);
  const billedCents = claim.serviceLines.reduce((sum, line) => sum + (parseMoneyToCents(line.billed) ?? 0), 0);
  return {
    claimId: '',
    patientName: claim.patientName,
    patientDob: '',
    dos: claim.serviceDate,
    billed: billedCents / 100,
    allowed: totals.allowedCents / 100,
    paid: totals.paidCents / 100,
    posted: totals.paidCents / 100,
    patientResp: totals.patientRespCents / 100,
    patientAccountNumber: claim.patientAccountNumber,
    memberId: claim.memberId,
    status: '',
    matched: false,
    claimResponseIds: claim.claimResponseId ? [claim.claimResponseId] : [],
    remits: [],
  };
}

// Keying in a paper or PDF remit: the check and who it pays, the scan, then each claim on it. The remit
// is saved on its own first; claims are added (and removed, matched, unmatched) one at a time and
// saved as that happens, while edits to the remit details and to claims already on it are saved with
// the Save button.
export default function ManualRemit(): ReactElement {
  const { id: eraId } = useParams();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [loading, setLoading] = useState(!!eraId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<EraDetailResponse | null>(null);
  const [versionId, setVersionId] = useState('');
  const [header, setHeader] = useState<HeaderForm>(emptyHeaderForm);
  const [savedHeader, setSavedHeader] = useState<HeaderForm>(emptyHeaderForm);
  const [claims, setClaims] = useState<ClaimForm[]>([]);
  const [savedSnapshots, setSavedSnapshots] = useState<Map<string, string>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showHeaderErrors, setShowHeaderErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [duplicateCheckWarning, setDuplicateCheckWarning] = useState<string | null>(null);
  // one per page visit, so a retried create returns the remit the first attempt made
  const [idempotencyKey] = useState(() => globalThis.crypto?.randomUUID?.() ?? newKey());

  const [claimDialog, setClaimDialog] = useState<ClaimForm | null>(null);
  const [associating, setAssociating] = useState(false);
  const [matching, setMatching] = useState<ClaimForm | null>(null);
  const [unmatching, setUnmatching] = useState<ClaimForm | null>(null);
  const [removing, setRemoving] = useState<ClaimForm | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const { debounce } = useDebounce(600);

  const applyDetail = useCallback((data: EraDetailResponse): void => {
    if (!data.manualEntry) {
      setLoadError('Only manually entered remits can be edited here.');
      return;
    }
    const loadedHeader = headerFormFromEntry(data.manualEntry.header);
    const loadedClaims = data.manualEntry.claims.map(claimFormFromEntry);
    setDetail(data);
    setVersionId(data.versionId);
    setHeader(loadedHeader);
    setSavedHeader(loadedHeader);
    setClaims(loadedClaims);
    setSavedSnapshots(new Map(loadedClaims.map((claim) => [claim.claimResponseId ?? '', snapshotOf(claim)])));
  }, []);

  const loadAll = useCallback(async (): Promise<void> => {
    if (!oystehrZambda || !eraId) return;
    setLoading(true);
    setLoadError(null);
    try {
      applyDetail(await getBillingEraDetail(oystehrZambda, { eraId }));
    } catch (err) {
      setLoadError(getApiError({ error: err, defaultError: 'Failed to load the remit' }));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, eraId, applyDetail]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // refreshes what the page shows from the server without touching unsaved edits
  const refreshDetail = useCallback(async (): Promise<EraDetailResponse | null> => {
    if (!oystehrZambda || !eraId) return null;
    const data = await getBillingEraDetail(oystehrZambda, { eraId });
    setDetail(data);
    return data;
  }, [oystehrZambda, eraId]);

  const headerDirty = JSON.stringify(header) !== JSON.stringify(savedHeader);
  const isClaimDirty = useCallback(
    (claim: ClaimForm): boolean =>
      !!claim.claimResponseId && savedSnapshots.get(claim.claimResponseId) !== snapshotOf(claim),
    [savedSnapshots]
  );
  const dirtyClaims = claims.filter(isClaimDirty);
  const dirty = headerDirty || dirtyClaims.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const leave = (path: string): void => {
    if (dirty && !window.confirm('You have unsaved changes on this remit. Leave anyway?')) return;
    navigate(path);
  };

  // a check number already on another ERA is worth a second look (the same remit keyed twice)
  const checkNumber = header.checkNumber.trim();
  const lastCheckedNumber = useRef('');
  useEffect(() => {
    if (!oystehrZambda || !checkNumber || checkNumber === lastCheckedNumber.current) {
      if (!checkNumber) setDuplicateCheckWarning(null);
      return;
    }
    debounce(async () => {
      lastCheckedNumber.current = checkNumber;
      try {
        const found = await searchBillingEras(oystehrZambda, { checkNumber, pageSize: 5 });
        const others = (found.eras ?? []).filter((era) => era.id !== eraId);
        setDuplicateCheckWarning(
          others.length
            ? `Another ERA already has check number ${checkNumber} (${others[0].payerName || 'unknown payer'})`
            : null
        );
      } catch {
        setDuplicateCheckWarning(null);
      }
    }, 'check-number');
  }, [oystehrZambda, checkNumber, eraId, debounce]);

  const problems = headerProblems(header);
  const fieldError = (field: HeaderField): string | undefined => (showHeaderErrors ? problems[field] : undefined);
  const setField = <K extends HeaderField>(field: K, value: HeaderForm[K]): void =>
    setHeader((current) => ({ ...current, [field]: value }));

  const handleSaveError = (err: unknown, fallback: string): void => {
    setSaveError(
      isVersionConflict(err)
        ? 'Someone else saved this remit since you opened it. Reload the page to see their changes (unsaved edits here will be lost).'
        : getApiError({ error: err, defaultError: fallback })
    );
  };

  const save = async (): Promise<void> => {
    if (!oystehrZambda) return;
    setShowHeaderErrors(true);
    setSaveError(null);
    if (Object.keys(problems).length > 0) return;
    const incomplete = dirtyClaims.find((claim) => claimProblems(claim).length > 0);
    if (incomplete) {
      setExpanded((current) => new Set(current).add(cardId(incomplete)));
      setSaveError(
        `Finish the claim for ${incomplete.patientName || 'the unnamed patient'}: ${claimProblems(incomplete)[0]}`
      );
      return;
    }
    setSaving(true);
    try {
      if (!eraId) {
        const created = await saveBillingManualEra(oystehrZambda, {
          idempotencyKey,
          header: headerFormToInput(header),
        });
        setSavedHeader(header);
        enqueueSnackbar('Remit saved. Add its claims below.', { variant: 'success' });
        navigate(`/eras/${created.eraId}/edit`, { replace: true });
        return;
      }
      const saved = await saveBillingManualEra(oystehrZambda, {
        eraId,
        expectedVersionId: versionId,
        ...(headerDirty ? { header: headerFormToInput(header) } : {}),
        claims: dirtyClaims.map(claimFormToInput),
      });
      setVersionId(saved.versionId);
      setSavedHeader(header);
      setSavedSnapshots((current) => {
        const next = new Map(current);
        dirtyClaims.forEach((claim) => next.set(claim.claimResponseId ?? '', snapshotOf(claim)));
        return next;
      });
      await refreshDetail();
      enqueueSnackbar('Remit saved', { variant: 'success' });
    } catch (err) {
      handleSaveError(err, 'Failed to save the remit');
    } finally {
      setSaving(false);
    }
  };

  // Add to Remit: saves just this claim (not other pending edits) and puts it on the page
  const addClaim = async (claim: ClaimForm): Promise<void> => {
    if (!oystehrZambda || !eraId) return;
    try {
      const saved = await saveBillingManualEra(oystehrZambda, {
        eraId,
        expectedVersionId: versionId,
        claims: [claimFormToInput(claim)],
      });
      const claimResponseId = saved.claims.find((entry) => entry.clientKey === claim.key)?.claimResponseId;
      const added: ClaimForm = { ...claim, claimResponseId };
      setVersionId(saved.versionId);
      setClaims((current) => [...current, added]);
      setSavedSnapshots((current) => new Map(current).set(claimResponseId ?? '', snapshotOf(added)));
      setExpanded(new Set([cardId(added)]));
      setClaimDialog(null);
      void refreshDetail();
      enqueueSnackbar('Claim added to the remit', { variant: 'success' });
    } catch (err) {
      if (isVersionConflict(err)) {
        throw new Error('Someone else saved this remit since you opened it. Reload the page before adding claims.');
      }
      throw err;
    }
  };

  const removeClaim = async (claim: ClaimForm): Promise<void> => {
    if (!oystehrZambda || !eraId || !claim.claimResponseId) return;
    setConfirmBusy(true);
    try {
      const saved = await saveBillingManualEra(oystehrZambda, {
        eraId,
        expectedVersionId: versionId,
        deleteClaimResponseIds: [claim.claimResponseId],
      });
      setVersionId(saved.versionId);
      setClaims((current) => current.filter((candidate) => candidate.key !== claim.key));
      void refreshDetail();
    } catch (err) {
      handleSaveError(err, 'Failed to remove the claim');
    } finally {
      setConfirmBusy(false);
      setRemoving(null);
    }
  };

  // match / unmatch go through the ERA screen's endpoints; only the match state is refreshed here
  const refreshMatch = async (claim: ClaimForm): Promise<void> => {
    const data = await refreshDetail();
    const stored = data?.manualEntry?.claims.find((entry) => entry.claimResponseId === claim.claimResponseId);
    setClaims((current) =>
      current.map((candidate) =>
        candidate.key === claim.key ? { ...candidate, matchedClaimId: stored?.matchedClaimId ?? null } : candidate
      )
    );
  };

  const unmatchClaim = async (claim: ClaimForm): Promise<void> => {
    if (!oystehrZambda || !claim.claimResponseId) return;
    setConfirmBusy(true);
    try {
      await unmatchClaimResponse(oystehrZambda, { claimResponseId: claim.claimResponseId });
      await refreshMatch(claim);
    } catch (err) {
      setSaveError(getApiError({ error: err, defaultError: 'Failed to unmatch the claim' }));
    } finally {
      setConfirmBusy(false);
      setUnmatching(null);
    }
  };

  const claimsOnRemit = useMemo(
    () => new Set(claims.map((claim) => claim.matchedClaimId).filter((id): id is string => !!id)),
    [claims]
  );
  const reconciliation = reconcileRemit(header.checkAmount, claims);
  const title = savedHeader.checkNumber ? `Manual Remit — ${savedHeader.checkNumber}` : 'Manual Remit';
  const notSavedYet = eraId ? undefined : 'Save the remit details first';

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box>
        <Alert severity="error">{loadError}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/eras')}>
          Back to ERAs
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
        <Button
          onClick={() => leave(eraId ? `/eras/${eraId}` : '/eras')}
          aria-label="Back"
          sx={{ minWidth: 0, mt: 0.25, color: 'text.secondary' }}
        >
          <ArrowBackIcon />
        </Button>
        <Box sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="h4" color="primary.dark" fontWeight={600}>
              {title}
            </Typography>
            <Chip label="Source: Manual" color="primary" variant="outlined" size="small" sx={{ borderRadius: '4px' }} />
          </Box>
          {detail?.enteredBy && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Entered by {detail.enteredBy}
              {detail.enteredAt ? ` on ${formatDate(detail.enteredAt.slice(0, 10))}` : ''}
            </Typography>
          )}
        </Box>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          onClick={() => void save()}
          disabled={saving || (!!eraId && !dirty)}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>

      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError(null)}>
          {saveError}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, alignItems: 'start' }}>
        <Card variant="outlined">
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6" color="primary.dark" fontWeight={600} fontSize={16}>
              Remit Details
            </Typography>
            <PayerSelect
              multiple={false}
              label="Payer"
              required
              fullWidth
              value={header.payerId}
              onChange={(value) => setField('payerId', value as string)}
              initialOptions={
                header.payerId && detail?.payerName ? [{ id: header.payerId, name: detail.payerName, payerId: '' }] : []
              }
              error={!!fieldError('payerId')}
              helperText={fieldError('payerId')}
            />
            <ProviderSelect
              providerRole="billing"
              multiple={false}
              label="Billing Provider"
              required
              fullWidth
              showTaxId
              value={header.billingProviderRef}
              onChange={(value) => setField('billingProviderRef', value as string)}
              error={!!fieldError('billingProviderRef')}
              helperText={fieldError('billingProviderRef')}
            />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' } }}>
              <TextField
                size="small"
                label="Check Number"
                required
                value={header.checkNumber}
                onChange={(event) => setField('checkNumber', event.target.value)}
                inputProps={{ maxLength: MANUAL_ERA_LIMITS.checkNumberLength }}
                error={!!fieldError('checkNumber')}
                helperText={fieldError('checkNumber') ?? duplicateCheckWarning ?? undefined}
                FormHelperTextProps={{
                  sx: duplicateCheckWarning && !fieldError('checkNumber') ? { color: 'warning.main' } : {},
                }}
              />
              <TextField
                size="small"
                label="Check Amount"
                required
                value={header.checkAmount}
                onChange={(event) => setField('checkAmount', event.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                inputProps={{ inputMode: 'decimal' }}
                error={!!fieldError('checkAmount')}
                helperText={fieldError('checkAmount')}
              />
              <FormControl size="small">
                <InputLabel id="payment-method-label">Payment Method</InputLabel>
                <Select
                  labelId="payment-method-label"
                  label="Payment Method"
                  value={header.paymentMethod}
                  onChange={(event) => setField('paymentMethod', event.target.value as EraPaymentMethodCode | '')}
                >
                  <MenuItem value="">
                    <em>Not specified</em>
                  </MenuItem>
                  {ERA_PAYMENT_METHODS.map((method) => (
                    <MenuItem key={method.code} value={method.code}>
                      {method.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <DateInput
                label="Remit Date *"
                value={header.remitDate}
                onChange={(value) => setField('remitDate', value)}
                fullWidth
                error={!!fieldError('remitDate')}
                helperText={fieldError('remitDate')}
              />
              <DateInput
                label="Check Date *"
                value={header.checkDate}
                onChange={(value) => setField('checkDate', value)}
                fullWidth
                error={!!fieldError('checkDate')}
                helperText={fieldError('checkDate')}
              />
              <DateInput
                label="Deposit Date *"
                value={header.depositDate}
                onChange={(value) => setField('depositDate', value)}
                fullWidth
                error={!!fieldError('depositDate')}
                helperText={fieldError('depositDate')}
              />
            </Box>
            <TextField
              size="small"
              label="Notes"
              multiline
              minRows={2}
              value={header.notes}
              onChange={(event) => setField('notes', event.target.value)}
              inputProps={{ maxLength: MANUAL_ERA_LIMITS.notesLength }}
            />
          </CardContent>
        </Card>

        <AttachmentsSection
          attachments={detail?.attachments ?? []}
          description="Attach a scan of the paper remit (PDF or image)."
          accept={SCAN_TYPES}
          maxSize={SCAN_MAX_BYTES}
          disabledReason={notSavedYet}
          onUpload={async ({ name, file }) => {
            if (!oystehrZambda || !eraId) return;
            const { uploadUrl, documentReferenceId } = await addEraAttachment(oystehrZambda, {
              eraId,
              name,
              contentType: file.type,
            });
            try {
              await uploadFileToPresignedUrl(uploadUrl, file);
            } catch (err) {
              // don't keep a record pointing at a file that never arrived
              await deleteEraAttachment(oystehrZambda, { eraId, documentReferenceId }).catch(() => undefined);
              throw err;
            } finally {
              await refreshDetail();
            }
          }}
          onRename={async (documentReferenceId, name) => {
            if (!oystehrZambda || !eraId) return;
            await renameEraAttachment(oystehrZambda, { eraId, documentReferenceId, name });
            await refreshDetail();
          }}
          onDelete={async (documentReferenceId) => {
            if (!oystehrZambda || !eraId) return;
            await deleteEraAttachment(oystehrZambda, { eraId, documentReferenceId });
            await refreshDetail();
          }}
          onDownload={async (documentReferenceId) => {
            if (!oystehrZambda || !eraId) return;
            const { downloadUrl } = await downloadEraAttachment(oystehrZambda, { eraId, documentReferenceId });
            window.open(downloadUrl, '_blank');
          }}
        />
      </Box>

      <Box sx={{ mt: 2 }}>
        <ReadOnlySection
          title={`Claims (${claims.length})`}
          action={
            <AddMenuButton
              size="small"
              disabledReason={notSavedYet}
              options={[
                {
                  label: 'Existing Claim',
                  description: 'Find a claim in the system and key in its adjudication',
                  icon: <SearchIcon fontSize="small" />,
                  onSelect: () => setAssociating(true),
                },
                {
                  label: 'Enter Manually',
                  description: 'Key in a claim from the paper remit',
                  icon: <EditNoteIcon fontSize="small" />,
                  onSelect: () => setClaimDialog(emptyClaimForm()),
                },
              ]}
            />
          }
        >
          {claims.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No claims on this remit yet. Use Add to search and associate claims or key one in manually.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {claims.map((claim) => (
                <ManualEraClaimCard
                  key={claim.key}
                  claim={claim}
                  onChange={(next) =>
                    setClaims((current) => current.map((candidate) => (candidate.key === claim.key ? next : candidate)))
                  }
                  expanded={expanded.has(cardId(claim))}
                  onToggle={() =>
                    setExpanded((current) => {
                      const next = new Set(current);
                      if (next.has(cardId(claim))) next.delete(cardId(claim));
                      else next.add(cardId(claim));
                      return next;
                    })
                  }
                  dirty={isClaimDirty(claim)}
                  actions={{
                    onMatch: () => setMatching(claim),
                    onUnmatch: () => setUnmatching(claim),
                    onView: () =>
                      leave(
                        `/eras/${eraId}/claims/${claim.matchedClaimId ?? `unmatched-${claim.claimResponseId ?? ''}`}`
                      ),
                    onRemove: () => setRemoving(claim),
                  }}
                />
              ))}
            </Box>
          )}
          <Divider sx={{ my: 2 }} />
          <RemitReconciliation reconciliation={reconciliation} />
        </ReadOnlySection>
      </Box>

      {associating && (
        <AssociateClaimDialog
          claimsOnRemit={claimsOnRemit}
          onCancel={() => setAssociating(false)}
          onSelected={(claimDetail) => {
            setAssociating(false);
            setClaimDialog(claimFormFromClaimDetail(claimDetail));
          }}
        />
      )}
      {claimDialog && (
        <ManualEraClaimDialog initialClaim={claimDialog} onCancel={() => setClaimDialog(null)} onAdd={addClaim} />
      )}
      {matching?.claimResponseId && (
        <MatchClaimDialog
          claimResponseId={matching.claimResponseId}
          eraClaim={eraClaimFor(matching)}
          onClose={() => setMatching(null)}
          onMatched={() => void refreshMatch(matching)}
        />
      )}
      {unmatching && (
        <ConfirmDialog
          open
          title="Unmatch"
          confirmLabel="Unmatch"
          loading={confirmBusy}
          onConfirm={() => void unmatchClaim(unmatching)}
          onCancel={() => setUnmatching(null)}
        >
          Unmatch this remit claim from claim {unmatching.matchedClaimId}? Its payment no longer counts toward that
          claim.
        </ConfirmDialog>
      )}
      {removing && (
        <ConfirmDialog
          open
          title="Remove claim"
          confirmLabel="Remove"
          loading={confirmBusy}
          onConfirm={() => void removeClaim(removing)}
          onCancel={() => setRemoving(null)}
        >
          Remove the claim for {removing.patientName || 'this patient'} from the remit? This cannot be undone.
        </ConfirmDialog>
      )}
    </Box>
  );
}
