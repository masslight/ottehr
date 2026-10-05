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
  useScrollTrigger,
  useTheme,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { uploadObjectToZ3 } from 'utils/lib/helpers/presigned-file-url/helpers';
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
} from '../api/api';
import { AddMenuButton } from '../components/AddMenuButton';
import { AttachmentsSection } from '../components/attachments/AttachmentsSection';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DateInput } from '../components/DateInput';
import { AssociateClaimDialog } from '../components/era/AssociateClaimDialog';
import { ManualEraClaimCard } from '../components/era/ManualEraClaimCard';
import { RemitBalanceChip, RemitReconciliation } from '../components/era/RemitReconciliation';
import { MAIN_PADDING_Y } from '../components/Layout';
import { MatchClaimDialog } from '../components/MatchClaimDialog';
import { PayerSelect } from '../components/PayerSelect';
import { ProviderSelect } from '../components/ProviderSelect';
import { ReadOnlySection } from '../components/ReadOnlySection';
import { useApiClients } from '../hooks/useAppClients';
import { useDebounce } from '../hooks/useDebounce';
import { useRevealFirstError } from '../hooks/useRevealFirstError';
import { formatDate } from '../utils/format';
import {
  ClaimForm,
  claimFormFromClaimDetail,
  claimFormFromEntry,
  claimFormToInput,
  claimTotals,
  emptyClaimForm,
  emptyHeaderForm,
  HeaderForm,
  headerFormFromEntry,
  headerFormToInput,
  ManualRemitFormValues,
  manualRemitResolver,
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

// The header sticks flush with the top of Layout's scrolling <main>. Sticky offsets count from inside
// main's padding, hence a negative top. The header reaches this far up into that padding, which is the
// room it keeps above the title once stuck.
const HEADER_TOP_ROOM = 2;
// Fields scrolled into view (tabbing back up the page, say), and a claim just added, stop this far below
// the top, clear of the stuck header.
const CLEAR_OF_HEADER = {
  '& input, & textarea, & button, & [tabindex], & .MuiCard-root': { scrollMarginTop: 96 },
};

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
    matched: false,
    claimResponseIds: claim.claimResponseId ? [claim.claimResponseId] : [],
    remits: [],
  };
}

// Keying in a paper or PDF remit: the check and who it pays, the scan, then each claim on it. Claims are
// added and keyed in on the page, and Save saves them with any edits to the remit details and to claims
// already on it. Removing, matching and unmatching a saved claim take effect straight away.
export default function ManualRemit(): ReactElement {
  const { id: eraId } = useParams();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [loading, setLoading] = useState(!!eraId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<EraDetailResponse | null>(null);
  const [versionId, setVersionId] = useState('');
  const [newHeader] = useState(emptyHeaderForm);
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<ManualRemitFormValues>({
    defaultValues: { header: newHeader, claims: [] },
    resolver: manualRemitResolver,
    // useRevealFirstError takes the cursor to the first field to fix, in a claim the save opens if it's
    // collapsed
    shouldFocusError: false,
  });
  const { header, claims } = useWatch({ control }) as ManualRemitFormValues;
  // what the remit and each stored claim looked like when last saved, to tell edits apart
  const [savedHeader, setSavedHeader] = useState<HeaderForm>(newHeader);
  const [savedClaims, setSavedClaims] = useState<Map<string, ClaimForm>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  useRevealFirstError(submitCount, errors);
  // Layout's <main> is what scrolls; the header shows a divider once the page scrolls under it
  const theme = useTheme();
  const [scroller, setScroller] = useState<HTMLElement | undefined>();
  const pageRef = useCallback((page: HTMLElement | null) => setScroller(page?.closest('main') ?? undefined), []);
  const scrolledUnder = useScrollTrigger({
    target: scroller,
    disableHysteresis: true,
    threshold: parseFloat(theme.spacing(MAIN_PADDING_Y - HEADER_TOP_ROOM)),
  });
  const [duplicateCheckWarning, setDuplicateCheckWarning] = useState<string | null>(null);

  // the claim just added, which the page scrolls to and puts the cursor in
  const [revealing, setRevealing] = useState<string | null>(null);
  const [associating, setAssociating] = useState(false);
  const [matching, setMatching] = useState<ClaimForm | null>(null);
  const [unmatching, setUnmatching] = useState<ClaimForm | null>(null);
  const [removing, setRemoving] = useState<ClaimForm | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const { debounce } = useDebounce(600);

  const applyDetail = useCallback(
    (data: EraDetailResponse): void => {
      if (!data.manualEntry) {
        setLoadError('Only manually entered remits can be edited here.');
        return;
      }
      const loadedHeader = headerFormFromEntry(data.manualEntry.header);
      const loadedClaims = data.manualEntry.claims.map(claimFormFromEntry);
      setDetail(data);
      setVersionId(data.versionId);
      reset({ header: loadedHeader, claims: loadedClaims });
      setSavedHeader(loadedHeader);
      setSavedClaims(new Map(loadedClaims.map((claim) => [claim.claimResponseId ?? '', claim])));
    },
    [reset]
  );

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

  const isHeaderDirty = (candidate: HeaderForm): boolean => JSON.stringify(candidate) !== JSON.stringify(savedHeader);
  const headerDirty = isHeaderDirty(header);
  // a claim added on the page counts as an edit until it's saved; one on the remit, once Save would send
  // something different for it
  const isClaimDirty = useCallback(
    (claim: ClaimForm): boolean => {
      const saved = claim.claimResponseId ? savedClaims.get(claim.claimResponseId) : undefined;
      return !saved || JSON.stringify(claimFormToInput(claim)) !== JSON.stringify(claimFormToInput(saved));
    },
    [savedClaims]
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

  const handleSaveError = (err: unknown, fallback: string): void => {
    setSaveError(
      isVersionConflict(err)
        ? 'Someone else saved this remit since you opened it. Reload the page to see their changes (unsaved edits here will be lost).'
        : getApiError({ error: err, defaultError: fallback })
    );
  };

  const save = handleSubmit(
    async ({ header: submittedHeader, claims: submittedClaims }) => {
      if (!oystehrZambda) return;
      setSaveError(null);
      const edited = submittedClaims.filter(isClaimDirty);
      try {
        if (!eraId) {
          const created = await saveBillingManualEra(oystehrZambda, {
            header: headerFormToInput(submittedHeader),
            ...(edited.length ? { claims: edited.map(claimFormToInput) } : {}),
          });
          setSavedHeader(submittedHeader);
          enqueueSnackbar('Remit saved', { variant: 'success' });
          // the page loads the remit as saved, claims and all
          navigate(`/eras/${created.eraId}/edit`, { replace: true });
          return;
        }
        const saved = await saveBillingManualEra(oystehrZambda, {
          eraId,
          expectedVersionId: versionId,
          ...(isHeaderDirty(submittedHeader) ? { header: headerFormToInput(submittedHeader) } : {}),
          claims: edited.map(claimFormToInput),
        });
        // claims added on the page take the ids they were saved under
        const addedIds = new Map(saved.claims.map((entry) => [entry.clientKey, entry.claimResponseId]));
        const savedAs = (claim: ClaimForm): ClaimForm =>
          claim.claimResponseId ? claim : { ...claim, claimResponseId: addedIds.get(claim.key) };
        setValue('claims', getValues('claims').map(savedAs));
        setVersionId(saved.versionId);
        setSavedHeader(submittedHeader);
        setSavedClaims((current) => {
          const next = new Map(current);
          edited.map(savedAs).forEach((claim) => {
            if (claim.claimResponseId) next.set(claim.claimResponseId, claim);
          });
          return next;
        });
        await refreshDetail();
        enqueueSnackbar('Remit saved', { variant: 'success' });
      } catch (err) {
        handleSaveError(err, 'Failed to save the remit');
      }
    },
    (invalid) => {
      setSaveError(null);
      const incomplete = getValues('claims')
        .filter((_, index) => invalid.claims?.[index])
        .map((claim) => claim.key);
      if (incomplete.length) setExpanded((current) => new Set([...current, ...incomplete]));
    }
  );

  // once a save has flagged a claim, its errors follow the edits
  const setClaim = (index: number, claim: ClaimForm): void =>
    setValue(`claims.${index}`, claim, { shouldValidate: !!errors.claims?.[index] });

  // Add: puts a new claim at the end of the page, open and ready to key in
  const addClaim = (claim: ClaimForm): void => {
    setValue('claims', [...getValues('claims'), claim]);
    setExpanded((current) => new Set([...current, claim.key]));
    setRevealing(claim.key);
  };

  // the claims after it move up, so any errors shown are worked out again for their new places
  const dropClaim = (claim: ClaimForm): void =>
    setValue(
      'claims',
      getValues('claims').filter((candidate) => candidate.key !== claim.key),
      { shouldValidate: !!errors.claims }
    );

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
      dropClaim(claim);
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
    const index = getValues('claims').findIndex((candidate) => candidate.key === claim.key);
    if (index >= 0) setValue(`claims.${index}.matchedClaimId`, stored?.matchedClaimId ?? null);
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

  const claimsOnRemit = new Set(claims.map((claim) => claim.matchedClaimId).filter((id): id is string => !!id));
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
    <Box ref={pageRef} sx={CLEAR_OF_HEADER}>
      <Box
        data-testid="remit-header"
        sx={{
          position: 'sticky',
          top: theme.spacing(-MAIN_PADDING_Y),
          zIndex: 'appBar',
          bgcolor: 'background.default',
          mt: -HEADER_TOP_ROOM,
          pt: HEADER_TOP_ROOM,
          pb: 1,
          borderBottom: 1,
          borderColor: scrolledUnder ? 'divider' : 'transparent',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            onClick={() => leave(eraId ? `/eras/${eraId}` : '/eras')}
            aria-label="Back"
            sx={{ minWidth: 0, color: 'text.secondary' }}
          >
            <ArrowBackIcon />
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', flexGrow: 1 }}>
            <Typography variant="h4" color="primary.dark" fontWeight={600}>
              {title}
            </Typography>
            <Chip label="Source: Manual" color="primary" variant="outlined" size="small" sx={{ borderRadius: '4px' }} />
          </Box>
          {/* how far the claims keyed so far are from the check, in view however far down the biller is */}
          {(eraId || claims.length > 0) && <RemitBalanceChip differenceCents={reconciliation.differenceCents} />}
          <Button
            variant="contained"
            startIcon={isSubmitting ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
            onClick={() => void save()}
            disabled={isSubmitting || (!!eraId && !dirty)}
            sx={{ ml: 1 }}
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </Box>
        {/* here rather than below the header, so a save made far down the page shows why it failed */}
        {saveError && (
          <Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setSaveError(null)}>
            {saveError}
          </Alert>
        )}
      </Box>
      {detail?.enteredBy && (
        // under the title, scrolling away with the page
        <Typography variant="body2" color="text.secondary" sx={{ pl: 6, mt: -0.5 }}>
          Entered by {detail.enteredBy}
          {detail.enteredAt ? ` on ${formatDate(detail.enteredAt.slice(0, 10))}` : ''}
        </Typography>
      )}

      <Box
        sx={{
          mt: detail?.enteredBy ? 2 : 1,
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
          alignItems: 'start',
        }}
      >
        <Card variant="outlined">
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6" color="primary.dark" fontWeight={600} fontSize={16}>
              Remit Details
            </Typography>
            <Controller
              name="header.payerId"
              control={control}
              render={({ field, fieldState: { error } }) => (
                <PayerSelect
                  multiple={false}
                  label="Payer"
                  required
                  fullWidth
                  value={field.value}
                  onChange={(value) => field.onChange(value as string)}
                  initialOptions={
                    field.value && detail?.payerName ? [{ id: field.value, name: detail.payerName, payerId: '' }] : []
                  }
                  error={!!error}
                  helperText={error?.message}
                  inputRef={field.ref}
                />
              )}
            />
            <Controller
              name="header.billingProviderRef"
              control={control}
              render={({ field, fieldState: { error } }) => (
                <ProviderSelect
                  providerRole="billing"
                  multiple={false}
                  label="Billing Provider"
                  required
                  fullWidth
                  showTaxId
                  value={field.value}
                  onChange={(value) => field.onChange(value as string)}
                  error={!!error}
                  helperText={error?.message}
                  inputRef={field.ref}
                />
              )}
            />
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
                alignItems: 'start',
              }}
            >
              <Controller
                name="header.checkNumber"
                control={control}
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    size="small"
                    label="Check Number"
                    required
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    inputRef={field.ref}
                    inputProps={{ maxLength: MANUAL_ERA_LIMITS.checkNumberLength }}
                    error={!!error}
                    helperText={error?.message ?? duplicateCheckWarning ?? undefined}
                    FormHelperTextProps={{
                      sx: duplicateCheckWarning && !error ? { color: 'warning.main' } : {},
                    }}
                  />
                )}
              />
              <Controller
                name="header.checkAmount"
                control={control}
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    size="small"
                    label="Check Amount"
                    required
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    inputRef={field.ref}
                    InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                    inputProps={{ inputMode: 'decimal' }}
                    error={!!error}
                    helperText={error?.message}
                  />
                )}
              />
              <Controller
                name="header.paymentMethod"
                control={control}
                render={({ field }) => (
                  <FormControl size="small">
                    <InputLabel id="payment-method-label">Payment Method</InputLabel>
                    <Select
                      labelId="payment-method-label"
                      label="Payment Method"
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value as EraPaymentMethodCode | '')}
                      inputRef={field.ref}
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
                )}
              />
              <Controller
                name="header.remitDate"
                control={control}
                render={({ field, fieldState: { error } }) => (
                  <DateInput
                    label="Remit Date *"
                    value={field.value}
                    onChange={field.onChange}
                    fullWidth
                    error={!!error}
                    helperText={error?.message}
                  />
                )}
              />
              <Controller
                name="header.checkDate"
                control={control}
                render={({ field, fieldState: { error } }) => (
                  <DateInput
                    label="Check Date *"
                    value={field.value}
                    onChange={field.onChange}
                    fullWidth
                    error={!!error}
                    helperText={error?.message}
                  />
                )}
              />
              <Controller
                name="header.depositDate"
                control={control}
                render={({ field }) => (
                  <DateInput label="Deposit Date" value={field.value} onChange={field.onChange} fullWidth />
                )}
              />
            </Box>
            <Controller
              name="header.notes"
              control={control}
              render={({ field }) => (
                <TextField
                  size="small"
                  label="Notes"
                  multiline
                  minRows={2}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                  inputProps={{ maxLength: MANUAL_ERA_LIMITS.notesLength }}
                />
              )}
            />
          </CardContent>
        </Card>

        <AttachmentsSection
          attachments={detail?.attachments ?? []}
          description="Attach a scan of the paper remit (PDF or image)."
          accept={SCAN_TYPES}
          disabledReason={notSavedYet}
          onUpload={async ({ name, file }) => {
            if (!oystehrZambda || !eraId) return;
            const { uploadUrl, documentReferenceId } = await addEraAttachment(oystehrZambda, {
              eraId,
              name,
              fileName: file.name,
              mimeType: file.type,
            });
            try {
              await uploadObjectToZ3(file, uploadUrl, file.type);
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
                  onSelect: () => addClaim(emptyClaimForm()),
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
              {claims.map((claim, index) => (
                <ManualEraClaimCard
                  key={claim.key}
                  claim={claim}
                  errors={errors.claims?.[index]}
                  onChange={(next) => setClaim(index, next)}
                  expanded={expanded.has(claim.key)}
                  onToggle={() =>
                    setExpanded((current) => {
                      const next = new Set(current);
                      if (next.has(claim.key)) next.delete(claim.key);
                      else next.add(claim.key);
                      return next;
                    })
                  }
                  dirty={isClaimDirty(claim)}
                  reveal={claim.key === revealing}
                  actions={{
                    onMatch: () => setMatching(claim),
                    onUnmatch: () => setUnmatching(claim),
                    onView: () =>
                      leave(
                        `/eras/${eraId}/claims/${claim.matchedClaimId ?? `unmatched-${claim.claimResponseId ?? ''}`}`
                      ),
                    // a claim not saved yet is just dropped from the page
                    onRemove: () => (claim.claimResponseId ? setRemoving(claim) : dropClaim(claim)),
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
            addClaim(claimFormFromClaimDetail(claimDetail));
          }}
        />
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
