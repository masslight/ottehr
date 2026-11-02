import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import {
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  FormControlLabel,
  Link,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { FC, useEffect, useRef, useState } from 'react';
import { Controller, FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { ConfirmationDialog } from 'src/components/ConfirmationDialog';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { addressBookContactLabel } from 'src/features/address-book/AddressBookDialog';
import { AddressBookPicker } from 'src/features/address-book/AddressBookPicker';
import { useContactFields } from 'src/features/address-book/useContactFields';
import { UppercaseCaptionTypography } from 'src/features/visits/shared/components/UppercaseCaptionTypography';
import { DATE_FORMAT } from 'src/helpers/formatDateTime';
import { useApiClients } from 'src/hooks/useAppClients';
import { OTHER_SPECIALTY_TRANSFER_OPTION } from 'utils/lib/fhir/disposition';
import { isPhoneNumberValid } from 'utils/lib/helpers/helpers';
import { FAX_DOCUMENT_LABELS, FAX_DOCUMENT_ORDER } from 'utils/lib/types/api/fax.types';
import {
  isReferralOpen,
  REFERRAL_ASK_LABELS,
  REFERRAL_ASKS,
  REFERRAL_CLOSE_REASON_LABELS,
  REFERRAL_SCHEDULER_LABELS,
  REFERRAL_SCHEDULERS,
  REFERRAL_STATUS_LABELS,
  REFERRAL_URGENCIES,
  REFERRAL_URGENCY_LABELS,
  ReferralDTO,
} from 'utils/lib/types/api/referrals/referrals.types';
import { AddressBookContact } from 'utils/lib/types/data/address-book';
import { CloseReferralDialog } from './CloseReferralDialog';
import {
  NO_FAX_SEND_TEXT,
  NO_RECIPIENT_SEND_TEXT,
  REFERRAL_SPECIALTY_OPTIONS,
  ReferralFormValues,
  specialtyTag,
  toReferralFormValues,
  toSaveReferralInput,
} from './referralForm.helpers';
import { openReferralPdf, useSaveReferralMutation, useUpdateReferralStatusMutation } from './referrals.queries';

const SAVE_ERROR = 'Failed to save the referral. Please try again.';
const RECIPIENT_ERROR = 'Pick a directory contact or add a new one, or clear the field so the patient chooses.';

const formatLocalDate = (iso: string): string => DateTime.fromISO(iso).toLocal().toFormat(DATE_FORMAT);

interface ReferralFormProps {
  patientId: string;
  /** Omitted when the referral is created from the patient record without a visit. */
  encounterId?: string;
  /** Omitted for a new referral. */
  referral?: ReferralDTO;
  /** The fields cannot change: a read-only visit, or a visit's referral opened from the patient record. */
  readOnly?: boolean;
  /** With readOnly: keep the send, print and close actions (only Save and Preview go). */
  keepActions?: boolean;
  /** A new referral was saved or an existing one changed; the parent decides what to show next. */
  onSaved?: (referral: ReferralDTO) => void;
  /** Discard a new, unsaved referral. */
  onDiscard?: () => void;
  /** Open the parent's fax dialog for this referral; the parent owns the fax so it outlives this form. */
  onSendFax?: (referralId: string) => void;
}

export const ReferralForm: FC<ReferralFormProps> = (props) => {
  const methods = useForm<ReferralFormValues>({
    defaultValues: toReferralFormValues(props.referral, !!(props.encounterId ?? props.referral?.encounterId)),
  });
  // The directory picker and useContactFields read the form from context, so the fields sit under the provider.
  return (
    <FormProvider {...methods}>
      <ReferralFormFields {...props} />
    </FormProvider>
  );
};

const ReferralFormFields: FC<ReferralFormProps> = ({
  patientId,
  encounterId,
  referral,
  readOnly = false,
  keepActions = false,
  onSaved,
  onDiscard,
  onSendFax,
}) => {
  const { oystehrZambda } = useApiClients();
  const { control, handleSubmit, setValue, setError, reset } = useFormContext<ReferralFormValues>();

  // The id the actions work on: the referral's, or the one a first save of a new referral returns.
  const [savedId, setSavedId] = useState(referral?.id);
  const [closing, setClosing] = useState(false);
  const [sendMenuAnchor, setSendMenuAnchor] = useState<HTMLElement | null>(null);
  const saveMutation = useSaveReferralMutation();
  const statusMutation = useUpdateReferralStatusMutation();
  // The name the picked contact filled in: typing anything else means the text is no longer that contact.
  const pickedName = useRef(referral?.recipient?.name ?? '');

  useEffect(() => {
    if (referral) {
      reset(toReferralFormValues(referral));
      pickedName.current = referral.recipient?.name ?? '';
      setSavedId(referral.id);
    }
    // Only a different referral, or a status change, replaces what is on the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referral?.id, referral?.status, reset]);

  const specialty = useWatch({ control, name: 'specialty' });
  const recipientName = useWatch({ control, name: 'recipientName' });
  const recipientContactId = useWatch({ control, name: 'recipientContactId' });
  const recipientFax = useWatch({ control, name: 'recipientFax' });

  const contactFields = useContactFields({
    organizationName: 'recipientName',
    fax: 'recipientFax',
    phone: 'recipientPhone',
  });
  const handleSelect = (contact: AddressBookContact): void => {
    contactFields.onSelect(contact);
    // The picker writes the organization; a contact without one would leave the field blank.
    const name = contact.organizationName || addressBookContactLabel(contact);
    pickedName.current = name;
    setValue('recipientName', name, { shouldDirty: true });
    setValue('recipientContactId', contact.id, { shouldDirty: true });
  };

  useEffect(() => {
    if (recipientContactId && recipientName !== pickedName.current) {
      setValue('recipientContactId', '');
      setValue('recipientFax', '');
      setValue('recipientPhone', '');
    }
  }, [recipientName, recipientContactId, setValue]);

  const finished = !!referral && !isReferralOpen(referral.status);
  const busy = saveMutation.isPending || statusMutation.isPending;
  const locked = readOnly || finished;
  const disabled = locked || busy;
  const showActions = !finished && (!readOnly || keepActions);
  const hasRecipient = !!recipientContactId;
  // A referral made from the patient record has no visit documents to include.
  const hasVisit = !!(encounterId ?? referral?.encounterId);
  const canFax = hasRecipient && !!recipientFax;

  const save = async (values: ReferralFormValues): Promise<ReferralDTO | undefined> => {
    // Locked fields have nothing to save; the actions work on the referral as it is.
    if (readOnly && referral) return referral;
    if (values.recipientName.trim() && !values.recipientContactId) {
      setError('recipientName', { message: RECIPIENT_ERROR });
      return undefined;
    }
    try {
      const { referral: saved } = await saveMutation.mutateAsync(
        toSaveReferralInput(values, { patientId, encounterId, referralId: savedId })
      );
      setSavedId(saved.id);
      reset(toReferralFormValues(saved));
      pickedName.current = saved.recipient?.name ?? '';
      return saved;
    } catch (error) {
      console.error(error);
      enqueueSnackbar(SAVE_ERROR, { variant: 'error' });
      return undefined;
    }
  };

  const onSave = handleSubmit(async (values) => {
    const saved = await save(values);
    if (saved) onSaved?.(saved);
  });

  const onPreview = handleSubmit(async (values) => {
    const saved = await save(values);
    if (!saved || !oystehrZambda) return;
    try {
      await openReferralPdf(oystehrZambda, saved.id);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Failed to open the referral form. Please try again.', { variant: 'error' });
    }
    onSaved?.(saved);
  });

  const onSendFaxNow = handleSubmit(async (values) => {
    const saved = await save(values);
    if (!saved) return;
    onSaved?.(saved);
    onSendFax?.(saved.id);
  });

  const onGivenToPatient = handleSubmit(async (values) => {
    const saved = await save(values);
    if (!saved) return;
    try {
      const { referral: updated } = await statusMutation.mutateAsync({
        action: 'given-to-patient',
        referralId: saved.id,
      });
      onSaved?.(updated);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Failed to update the referral. Please try again.', { variant: 'error' });
    }
  });

  const onCancelReferral = async (): Promise<void> => {
    if (!savedId) return;
    const { referral: updated } = await statusMutation.mutateAsync({ action: 'cancel', referralId: savedId });
    onSaved?.(updated);
  };

  const onPrint = async (): Promise<void> => {
    if (!savedId || !oystehrZambda) return;
    try {
      await openReferralPdf(oystehrZambda, savedId);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Failed to open the referral form. Please try again.', { variant: 'error' });
    }
  };

  const lastFaxText = referral?.lastFax
    ? referral.lastFax.status === 'failed'
      ? 'Fax failed, see Fax Logs'
      : referral.lastFax.status === 'sent'
      ? `Fax sent ${referral.lastFax.sentAt ? formatLocalDate(referral.lastFax.sentAt) : ''}`.trim()
      : 'Fax pending'
    : undefined;

  return (
    <>
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }} data-testid={dataTestIds.referrals.form}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Controller
            name="specialty"
            control={control}
            rules={{ required: 'Specialty is required' }}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                select
                size="small"
                label="Specialty"
                disabled={disabled}
                error={!!error}
                helperText={error?.message}
                sx={{ minWidth: 220 }}
                data-testid={dataTestIds.referrals.specialty}
              >
                {REFERRAL_SPECIALTY_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
                <MenuItem value={OTHER_SPECIALTY_TRANSFER_OPTION}>{OTHER_SPECIALTY_TRANSFER_OPTION}</MenuItem>
              </TextField>
            )}
          />
          {specialty === OTHER_SPECIALTY_TRANSFER_OPTION && (
            <Controller
              name="specialtyOther"
              control={control}
              rules={{ validate: (value) => !!value.trim() || 'Enter the specialty' }}
              render={({ field, fieldState: { error } }) => (
                <TextField
                  {...field}
                  size="small"
                  label="Other specialty"
                  disabled={disabled}
                  error={!!error}
                  helperText={error?.message}
                  sx={{ minWidth: 220 }}
                  inputProps={{ 'data-testid': dataTestIds.referrals.specialtyOther }}
                />
              )}
            />
          )}
          <Box sx={{ flexGrow: 1, minWidth: 260 }}>
            {locked ? (
              <TextField
                size="small"
                fullWidth
                label="Recipient (optional)"
                value={recipientName}
                disabled
                data-testid={dataTestIds.referrals.recipient}
              />
            ) : (
              <AddressBookPicker
                name="recipientName"
                label="Recipient (optional)"
                tag={specialtyTag(specialty)}
                onSelect={handleSelect}
                toContact={contactFields.toContact}
                dataTestId={dataTestIds.referrals.recipient}
              />
            )}
          </Box>
          {hasRecipient && (
            <Controller
              name="recipientFax"
              control={control}
              rules={{ validate: (value) => !value.trim() || isPhoneNumberValid(value) || 'Enter a valid fax number' }}
              render={({ field, fieldState: { error } }) => (
                <TextField
                  {...field}
                  size="small"
                  label="Fax"
                  disabled={disabled}
                  error={!!error}
                  helperText={
                    error?.message ?? (field.value ? undefined : 'None on file; typed here it stays on this referral')
                  }
                  sx={{ minWidth: 200 }}
                  inputProps={{ 'data-testid': dataTestIds.referrals.recipientFax }}
                />
              )}
            />
          )}
        </Box>

        <Controller
          name="reason"
          control={control}
          rules={{ validate: (value) => !!value.trim() || 'Reason for referral is required' }}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              size="small"
              fullWidth
              label="Reason for referral"
              disabled={disabled}
              error={!!error}
              helperText={error?.message}
              inputProps={{ 'data-testid': dataTestIds.referrals.reason }}
            />
          )}
        />

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Controller
            name="urgency"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                select
                size="small"
                label="Urgency"
                disabled={disabled}
                sx={{ minWidth: 160 }}
                data-testid={dataTestIds.referrals.urgency}
              >
                {REFERRAL_URGENCIES.map((option) => (
                  <MenuItem key={option} value={option}>
                    {REFERRAL_URGENCY_LABELS[option]}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          <Controller
            name="whatIsAsked"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                select
                size="small"
                label="What is asked"
                disabled={disabled}
                sx={{ minWidth: 220 }}
                data-testid={dataTestIds.referrals.whatIsAsked}
              >
                {REFERRAL_ASKS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {REFERRAL_ASK_LABELS[option]}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          <Controller
            name="whoSchedules"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                select
                size="small"
                label="Who schedules"
                disabled={disabled}
                sx={{ minWidth: 180 }}
                data-testid={dataTestIds.referrals.whoSchedules}
              >
                {REFERRAL_SCHEDULERS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {REFERRAL_SCHEDULER_LABELS[option]}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          {hasRecipient && (
            <Controller
              name="responseRequested"
              control={control}
              render={({ field: { value, onChange } }) => (
                <FormControlLabel
                  label="Response requested"
                  control={
                    <Checkbox
                      checked={value}
                      onChange={onChange}
                      disabled={disabled}
                      data-testid={dataTestIds.referrals.responseRequested}
                    />
                  }
                />
              )}
            />
          )}
        </Box>

        {hasVisit && (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <UppercaseCaptionTypography>Include</UppercaseCaptionTypography>
            <Controller
              name="includeDocuments"
              control={control}
              render={({ field: { value, onChange } }) => (
                <>
                  {FAX_DOCUMENT_ORDER.map((kind) => (
                    <FormControlLabel
                      key={kind}
                      label={FAX_DOCUMENT_LABELS[kind]}
                      control={
                        <Checkbox
                          checked={value.includes(kind)}
                          disabled={disabled}
                          onChange={(event) =>
                            onChange(
                              event.target.checked
                                ? FAX_DOCUMENT_ORDER.filter((item) => item === kind || value.includes(item))
                                : value.filter((item) => item !== kind)
                            )
                          }
                          data-testid={dataTestIds.referrals.includeDocument(kind)}
                        />
                      }
                    />
                  ))}
                </>
              )}
            />
          </Box>
        )}

        <Controller
          name="notesToRecipient"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              size="small"
              fullWidth
              multiline
              rows={3}
              label="Notes to the recipient"
              disabled={disabled}
              inputProps={{ 'data-testid': dataTestIds.referrals.notes }}
            />
          )}
        />

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Stack sx={{ flexGrow: 1 }} spacing={0.5}>
            {referral && (
              <Typography variant="body2" color="text.secondary">
                Created {formatLocalDate(referral.createdAt)} by {referral.referringProvider.name}
              </Typography>
            )}
            {lastFaxText && (
              <Typography variant="body2" color="text.secondary">
                {lastFaxText}
              </Typography>
            )}
            {finished && referral && (
              <Typography variant="body2" color="text.secondary">
                {REFERRAL_STATUS_LABELS[referral.status]}
                {referral.closedAt ? ` ${formatLocalDate(referral.closedAt)}` : ''}
                {referral.closeReason ? `: ${REFERRAL_CLOSE_REASON_LABELS[referral.closeReason]}` : ''}
                {referral.outcome ? ` — ${referral.outcome}` : ''}
              </Typography>
            )}
          </Stack>

          {!showActions && savedId ? (
            <RoundedButton onClick={onPrint} data-testid={dataTestIds.referrals.printLink}>
              Print form
            </RoundedButton>
          ) : (
            <>
              {savedId && (
                <>
                  <RoundedButton
                    color="error"
                    disabled={busy}
                    onClick={() => setClosing(true)}
                    data-testid={dataTestIds.referrals.closeButton}
                  >
                    Close
                  </RoundedButton>
                  <ConfirmationDialog
                    title="Cancel this referral?"
                    description="The referral is taken off the list and nothing is sent."
                    response={onCancelReferral}
                    actionButtons={{ proceed: { text: 'Cancel referral', color: 'error', loading: busy } }}
                  >
                    {(showDialog) => (
                      <RoundedButton
                        color="error"
                        disabled={busy}
                        onClick={showDialog}
                        data-testid={dataTestIds.referrals.cancelButton}
                      >
                        Cancel
                      </RoundedButton>
                    )}
                  </ConfirmationDialog>
                </>
              )}
              {!savedId && onDiscard && (
                <RoundedButton disabled={busy} onClick={onDiscard}>
                  Discard
                </RoundedButton>
              )}
              {!readOnly && (
                <>
                  <RoundedButton disabled={busy} onClick={onPreview} data-testid={dataTestIds.referrals.previewButton}>
                    Preview form
                  </RoundedButton>
                  <RoundedButton
                    loading={saveMutation.isPending}
                    disabled={busy}
                    onClick={onSave}
                    data-testid={dataTestIds.referrals.saveButton}
                  >
                    Save
                  </RoundedButton>
                </>
              )}
              <ButtonGroup variant="contained" sx={{ boxShadow: 'none' }}>
                {/* Always shown; disabled until the referral has a fax number, the hover says where to put one. */}
                <Tooltip title={canFax ? '' : hasRecipient ? NO_FAX_SEND_TEXT : NO_RECIPIENT_SEND_TEXT}>
                  <span>
                    <Button
                      variant="contained"
                      disabled={busy || !canFax}
                      onClick={onSendFaxNow}
                      data-testid={dataTestIds.referrals.sendFaxButton}
                      sx={{ borderRadius: '100px', textTransform: 'none' }}
                    >
                      Fax
                    </Button>
                  </span>
                </Tooltip>
                <Button
                  variant="contained"
                  size="small"
                  disabled={busy}
                  onClick={(event) => setSendMenuAnchor(event.currentTarget)}
                  data-testid={dataTestIds.referrals.sendMenuButton}
                  sx={{ borderRadius: '100px' }}
                >
                  <ArrowDropDownIcon fontSize="small" />
                </Button>
              </ButtonGroup>
              <Menu anchorEl={sendMenuAnchor} open={!!sendMenuAnchor} onClose={() => setSendMenuAnchor(null)}>
                <MenuItem
                  onClick={() => {
                    setSendMenuAnchor(null);
                    void onGivenToPatient();
                  }}
                  data-testid={dataTestIds.referrals.givenToPatientButton}
                >
                  Add to discharge paperwork
                </MenuItem>
              </Menu>
              {/* Preview covers printing while the form is editable; otherwise the saved form prints as is. */}
              {savedId && (readOnly || !canFax) && (
                <Link
                  component="button"
                  type="button"
                  onClick={onPrint}
                  sx={{ fontSize: 14 }}
                  data-testid={dataTestIds.referrals.printLink}
                >
                  Print form
                </Link>
              )}
            </>
          )}
        </Box>
      </Box>

      {closing && savedId && (
        <CloseReferralDialog
          referralId={savedId}
          onClose={() => {
            setClosing(false);
          }}
        />
      )}
    </>
  );
};
