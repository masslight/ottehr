import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import {
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  Chip,
  FormControlLabel,
  Link,
  Menu,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { BaseSyntheticEvent, FC, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { ConfirmationDialog } from 'src/components/ConfirmationDialog';
import { FormTextField } from 'src/components/form/FormTextField';
import { PhoneInput } from 'src/components/input/PhoneInput';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { addressBookContactLabel } from 'src/features/address-book/AddressBookDialog';
import { AddressBookPicker } from 'src/features/address-book/AddressBookPicker';
import { useContactFields } from 'src/features/address-book/useContactFields';
import { useDocumentPacketPreview } from 'src/features/send-documents/hooks/useDocumentPacketPreview';
import { UppercaseCaptionTypography } from 'src/features/visits/shared/components/UppercaseCaptionTypography';
import { useSpecialtyTransferOptions } from 'src/hooks/useSpecialtyTransferOptions';
import { getSpecialtyTransferSelectOptions, OTHER_SPECIALTY_TRANSFER_OPTION } from 'utils/lib/fhir/disposition';
import {
  PACKET_DOCUMENT_LABELS,
  PACKET_DOCUMENT_ORDER,
  PACKET_DOCUMENT_UNAVAILABLE_REASONS,
} from 'utils/lib/types/api/document-packet.types';
import {
  isReferralEditable,
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
  ReferralEarlierDocument,
} from 'utils/lib/types/api/referrals/referrals.types';
import { AddressBookContact } from 'utils/lib/types/data/address-book';
import { formatDateForDisplay } from 'utils/lib/utils/dateUtils';
import { CloseReferralDialog } from './CloseReferralDialog';
import { ReferralDocumentsPickerDialog } from './ReferralDocumentsPickerDialog';
import {
  faxBlockedReason,
  ReferralFormValues,
  specialtyTag,
  toReferralFormValues,
  toSaveReferralInput,
} from './referralForm.helpers';
import { useSaveReferralMutation, useUpdateReferralStatusMutation } from './referrals.queries';
import { usePrintReferralForm } from './usePrintReferralForm';

const SAVE_ERROR = 'Failed to save the referral. Please try again.';
const RECIPIENT_ERROR = 'Pick a directory contact or add a new one, or clear the field so the patient chooses.';

const requiredText =
  (message: string) =>
  (value: unknown): true | string =>
    (typeof value === 'string' && !!value.trim()) || message;

const earlierDocumentLabel = (document: ReferralEarlierDocument): string => {
  const date = document.visitDate ?? document.date;
  return date ? `${formatDateForDisplay(date)} · ${document.title}` : document.title;
};

interface ReferralFormProps {
  patientId: string;
  encounterId?: string;
  appointmentId?: string;
  referral?: ReferralDTO;
  onSaved?: (referral: ReferralDTO) => void;
  onDiscard?: () => void;
  /** Open the parent's fax dialog for this referral; the parent owns the fax so it outlives this form. */
  onSendFax?: (referralId: string) => void;
}

interface ReferralFormFieldsProps extends ReferralFormProps {
  specialtyOptions: string[];
}

export const ReferralForm: FC<ReferralFormProps> = (props) => {
  const { options, isLoading } = useSpecialtyTransferOptions();
  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton variant="rounded" height={160} />
      </Box>
    );
  }
  return <ReferralFormWithValues {...props} specialtyOptions={options} />;
};

const ReferralFormWithValues: FC<ReferralFormFieldsProps> = (props) => {
  const methods = useForm<ReferralFormValues>({
    defaultValues: toReferralFormValues(
      props.referral,
      !!(props.encounterId ?? props.referral?.encounterId),
      props.specialtyOptions
    ),
  });
  return (
    <FormProvider {...methods}>
      <ReferralFormFields {...props} />
    </FormProvider>
  );
};

const ReferralFormFields: FC<ReferralFormFieldsProps> = ({
  patientId,
  encounterId,
  appointmentId,
  referral,
  specialtyOptions,
  onSaved,
  onDiscard,
  onSendFax,
}) => {
  const printReferralForm = usePrintReferralForm();
  const { control, handleSubmit, setValue, setError, reset } = useFormContext<ReferralFormValues>();

  const [savedId, setSavedId] = useState(referral?.id);
  const [closing, setClosing] = useState(false);
  const [pickingDocuments, setPickingDocuments] = useState(false);
  const [sendMenuAnchor, setSendMenuAnchor] = useState<HTMLElement | null>(null);
  const saveMutation = useSaveReferralMutation();
  const statusMutation = useUpdateReferralStatusMutation();
  const pickedName = useRef(referral?.recipient?.name ?? '');

  useEffect(() => {
    if (referral) {
      reset(toReferralFormValues(referral, true, specialtyOptions));
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
  const earlierDocuments = useWatch({ control, name: 'earlierDocuments' });

  const contactFields = useContactFields({
    organizationName: 'recipientName',
    fax: 'recipientFax',
    phone: 'recipientPhone',
  });
  const handleSelect = (contact: AddressBookContact): void => {
    contactFields.onSelect(contact);
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
  const editable = !referral || isReferralEditable(referral.status);
  const busy = saveMutation.isPending || statusMutation.isPending;
  const disabled = !editable || busy;
  const hasRecipient = !!recipientContactId;
  const hasVisit = !!(encounterId ?? referral?.encounterId);
  const canFax = hasRecipient && !!recipientFax.trim();
  const visitAppointmentId = appointmentId ?? referral?.appointmentId;
  const specialtySelectOptions = getSpecialtyTransferSelectOptions(specialtyOptions);

  const { data: packetPreview } = useDocumentPacketPreview(
    visitAppointmentId ? { appointmentId: visitAppointmentId } : undefined,
    hasVisit && editable
  );
  const unavailableDocuments = useMemo(
    () =>
      new Map(
        (packetPreview?.documents ?? []).flatMap((document) => {
          const kind = PACKET_DOCUMENT_ORDER.find((item) => item === document.kind);
          return kind && !document.available && !document.title
            ? [[kind, document.unavailableReason || PACKET_DOCUMENT_UNAVAILABLE_REASONS[kind]] as const]
            : [];
        })
      ),
    [packetPreview?.documents]
  );

  const save = async (values: ReferralFormValues): Promise<ReferralDTO | undefined> => {
    if (values.recipientName.trim() && !values.recipientContactId) {
      setError('recipientName', { message: RECIPIENT_ERROR });
      return undefined;
    }
    try {
      const { referral: saved } = await saveMutation.mutateAsync(
        toSaveReferralInput(values, {
          patientId,
          encounterId,
          referralId: savedId,
          unavailableDocuments: [...unavailableDocuments.keys()],
        })
      );
      setSavedId(saved.id);
      reset(toReferralFormValues(saved, true, specialtyOptions));
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

  const onPreview = (event: BaseSyntheticEvent): void => {
    let saved: ReferralDTO | undefined;
    void printReferralForm(async () => {
      await handleSubmit(async (values) => {
        saved = await save(values);
      })(event);
      return saved?.id;
    }).then(() => {
      if (saved) onSaved?.(saved);
    });
  };

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

  const onPrint = (): void => {
    if (savedId) void printReferralForm(savedId);
  };

  const lastFaxText = referral?.lastFax
    ? referral.lastFax.status === 'failed'
      ? 'Fax failed, see Fax Logs'
      : referral.lastFax.status === 'sent'
      ? `Fax sent ${referral.lastFax.sentAt ? formatDateForDisplay(referral.lastFax.sentAt) : ''}`.trim()
      : 'Fax pending'
    : undefined;

  return (
    <>
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }} data-testid={dataTestIds.referrals.form}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 220 }}>
            <FormTextField
              name="specialty"
              control={control}
              rules={{ required: 'Specialty is required' }}
              select
              variant="outlined"
              size="small"
              label="Specialty"
              disabled={disabled}
              data-testid={dataTestIds.referrals.specialty}
            >
              {specialtySelectOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </FormTextField>
          </Box>
          {specialty === OTHER_SPECIALTY_TRANSFER_OPTION && (
            <Box sx={{ minWidth: 220 }}>
              <FormTextField
                name="specialtyOther"
                control={control}
                rules={{ validate: requiredText('Enter the specialty') }}
                variant="outlined"
                size="small"
                label="Other specialty"
                disabled={disabled}
                inputProps={{ 'data-testid': dataTestIds.referrals.specialtyOther }}
              />
            </Box>
          )}
          <Box sx={{ flexGrow: 1, minWidth: 260 }}>
            {!editable ? (
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
            <Box sx={{ minWidth: 200 }}>
              <PhoneInput
                name="recipientFax"
                label="Fax"
                disabled={disabled}
                helperText={
                  recipientFax ? undefined : 'None on file. The number here is the one this referral faxes to.'
                }
                dataTestId={dataTestIds.referrals.recipientFax}
              />
            </Box>
          )}
        </Box>

        <FormTextField
          name="reason"
          control={control}
          rules={{ validate: requiredText('Reason for referral is required') }}
          variant="outlined"
          size="small"
          label="Reason for referral"
          disabled={disabled}
          inputProps={{ 'data-testid': dataTestIds.referrals.reason }}
        />

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Box sx={{ minWidth: 160 }}>
            <FormTextField
              name="urgency"
              control={control}
              select
              variant="outlined"
              size="small"
              label="Urgency"
              disabled={disabled}
              data-testid={dataTestIds.referrals.urgency}
            >
              {REFERRAL_URGENCIES.map((option) => (
                <MenuItem key={option} value={option}>
                  {REFERRAL_URGENCY_LABELS[option]}
                </MenuItem>
              ))}
            </FormTextField>
          </Box>
          <Box sx={{ minWidth: 220 }}>
            <FormTextField
              name="whatIsAsked"
              control={control}
              select
              variant="outlined"
              size="small"
              label="What is asked"
              disabled={disabled}
              data-testid={dataTestIds.referrals.whatIsAsked}
            >
              {REFERRAL_ASKS.map((option) => (
                <MenuItem key={option} value={option}>
                  {REFERRAL_ASK_LABELS[option]}
                </MenuItem>
              ))}
            </FormTextField>
          </Box>
          <Box sx={{ minWidth: 180 }}>
            <FormTextField
              name="whoSchedules"
              control={control}
              select
              variant="outlined"
              size="small"
              label="Who schedules"
              disabled={disabled}
              data-testid={dataTestIds.referrals.whoSchedules}
            >
              {REFERRAL_SCHEDULERS.map((option) => (
                <MenuItem key={option} value={option}>
                  {REFERRAL_SCHEDULER_LABELS[option]}
                </MenuItem>
              ))}
            </FormTextField>
          </Box>
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
            <UppercaseCaptionTypography sx={{ width: 120 }}>This visit</UppercaseCaptionTypography>
            <Controller
              name="includeDocuments"
              control={control}
              render={({ field: { value, onChange } }) => (
                <>
                  {PACKET_DOCUMENT_ORDER.map((kind) => {
                    const unavailableReason = unavailableDocuments.get(kind);
                    const unavailable = unavailableDocuments.has(kind);
                    return (
                      <Tooltip key={kind} title={unavailableReason ?? ''}>
                        <span>
                          <FormControlLabel
                            label={PACKET_DOCUMENT_LABELS[kind]}
                            control={
                              <Checkbox
                                checked={value.includes(kind) && !unavailable}
                                disabled={disabled || unavailable}
                                onChange={(event) =>
                                  onChange(
                                    event.target.checked
                                      ? PACKET_DOCUMENT_ORDER.filter((item) => item === kind || value.includes(item))
                                      : value.filter((item) => item !== kind)
                                  )
                                }
                                data-testid={dataTestIds.referrals.includeDocument(kind)}
                              />
                            }
                          />
                        </span>
                      </Tooltip>
                    );
                  })}
                </>
              )}
            />
          </Box>
        )}

        {(editable || earlierDocuments.length > 0) && (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <UppercaseCaptionTypography sx={{ width: 120, flexShrink: 0, pt: 0.75 }}>
              {hasVisit ? 'Earlier visits' : 'Documents'}
            </UppercaseCaptionTypography>
            <Controller
              name="earlierDocuments"
              control={control}
              render={({ field: { value, onChange } }) => (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
                  {value.map((document) => (
                    <Chip
                      key={document.id}
                      variant="outlined"
                      label={earlierDocumentLabel(document)}
                      onDelete={
                        disabled ? undefined : () => onChange(value.filter((chosen) => chosen.id !== document.id))
                      }
                      data-testid={dataTestIds.referrals.earlierDocument(document.id)}
                    />
                  ))}
                  {!disabled && (
                    <Button
                      variant="text"
                      onClick={() => setPickingDocuments(true)}
                      sx={{ textTransform: 'none' }}
                      data-testid={dataTestIds.referrals.addEarlierDocumentsButton}
                    >
                      {hasVisit ? '+ Add from earlier visits' : '+ Add from visits'}
                    </Button>
                  )}
                  {pickingDocuments && (
                    <ReferralDocumentsPickerDialog
                      patientId={patientId}
                      encounterId={encounterId ?? referral?.encounterId}
                      selected={value}
                      onClose={() => setPickingDocuments(false)}
                      onAdd={(documents) => {
                        onChange(documents);
                        setPickingDocuments(false);
                      }}
                    />
                  )}
                </Box>
              )}
            />
          </Box>
        )}

        <FormTextField
          name="notesToRecipient"
          control={control}
          variant="outlined"
          size="small"
          multiline
          rows={3}
          label="Notes to the recipient"
          disabled={disabled}
          inputProps={{ 'data-testid': dataTestIds.referrals.notes }}
        />

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Stack sx={{ flexGrow: 1 }} spacing={0.5}>
            {referral && (
              <Typography variant="body2" color="text.secondary">
                Created {formatDateForDisplay(referral.createdAt)} by {referral.referringProvider.name}
              </Typography>
            )}
            {lastFaxText && (
              <Typography variant="body2" color="text.secondary">
                {lastFaxText}
              </Typography>
            )}
            {referral?.givenToPatientAt && (
              <Typography variant="body2" color="text.secondary">
                Given to patient {formatDateForDisplay(referral.givenToPatientAt)}
                {referral.givenToPatientBy?.name ? ` by ${referral.givenToPatientBy.name}` : ''}
              </Typography>
            )}
            {finished && referral && (
              <Typography variant="body2" color="text.secondary">
                {REFERRAL_STATUS_LABELS[referral.status]}
                {referral.closedAt ? ` ${formatDateForDisplay(referral.closedAt)}` : ''}
                {referral.closedBy?.name ? ` by ${referral.closedBy.name}` : ''}
                {referral.closeReason ? `: ${REFERRAL_CLOSE_REASON_LABELS[referral.closeReason]}` : ''}
                {referral.outcome ? ` — ${referral.outcome}` : ''}
              </Typography>
            )}
          </Stack>

          {savedId && !finished && (
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
          {!editable && savedId ? (
            <RoundedButton onClick={onPrint} data-testid={dataTestIds.referrals.printLink}>
              Print form
            </RoundedButton>
          ) : (
            <>
              {!savedId && onDiscard && (
                <RoundedButton disabled={busy} onClick={onDiscard}>
                  Discard
                </RoundedButton>
              )}
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
              <ButtonGroup variant="contained" sx={{ boxShadow: 'none' }}>
                <Tooltip title={faxBlockedReason(hasRecipient, recipientFax)}>
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
              {savedId && !canFax && (
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
