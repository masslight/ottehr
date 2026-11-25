import {
  Box,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Switch,
  Typography,
} from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useState } from 'react';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import { generateStatement, StatementDetails } from 'utils/lib/statements/generate-statement';
import { InvoiceablePatientReport } from 'utils/lib/types/api/invoicing.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { useApiClients } from '../../hooks/useAppClients';
import { AppDialog } from './AppDialog';

interface SendStatementToPatientDialogProps {
  modalOpen: boolean;
  handleClose: () => void;
  onSubmit: () => void;
  report?: InvoiceablePatientReport;
}

interface StatementStatusResponse {
  generated?: {
    generated: boolean;
    lastGenerated?: string;
  };
  mailProcessor?: {
    found: boolean;
    status?: string;
    sendDate?: string;
  };
}

export default function SendStatementToPatientDialog({
  modalOpen,
  handleClose,
  onSubmit,
  report,
}: SendStatementToPatientDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const { patient, responsibleParty } = report ?? {};
  const encounterId = report?.task?.encounter?.reference?.split('/')[1];
  const patientCityStateZip = formatCityStateZip(patient?.city, patient?.state, patient?.fullAddress);
  const responsiblePartyCityStateZip = formatCityStateZip(
    responsibleParty?.city,
    responsibleParty?.state,
    responsibleParty?.fullAddress
  );
  const [generatedHtml, setGeneratedHtml] = useState<string>('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string>('');
  const [statementType, setStatementType] = useState<'standard' | 'past-due' | 'final-notice'>('past-due');
  const [useColor, setUseColor] = useState(false);
  const [confirmMailOpen, setConfirmMailOpen] = useState(false);
  const [isSendingMail, setIsSendingMail] = useState(false);
  const [isGeneratingStatement, setIsGeneratingStatement] = useState(false);
  const [isMailStatusLoading, setIsMailStatusLoading] = useState(false);
  const [hasGeneratedStatement, setHasGeneratedStatement] = useState(false);
  const [generatedStatusText, setGeneratedStatusText] = useState('');
  const [mailStatusText, setMailStatusText] = useState('No mailed statement found yet');
  const [hasMailedStatement, setHasMailedStatement] = useState(false);

  useEffect(() => {
    if (modalOpen) {
      // Color toggle should default to off whenever the dialog is opened.
      setUseColor(false);
    }
  }, [modalOpen]);

  useEffect(() => {
    const loadTemplateAndPreview = async (): Promise<void> => {
      if (!modalOpen || !oystehrZambda || !encounterId) return;

      setIsPreviewLoading(true);
      setPreviewError('');
      try {
        const response = await oystehrZambda.zambda.execute({
          id: 'get-statement-template',
          template: 'statement-template',
        });

        const templateResponse = chooseJson(response) as { template: string; fileName: string; logoBase64: string };
        const statementDetailsResponse = await oystehrZambda.zambda.execute({
          id: 'get-statement-details',
          statementType,
          encounterId,
        });
        const statementDetails = chooseJson(statementDetailsResponse) as StatementDetails;
        const html = generateStatement(templateResponse.template, statementDetails);
        setGeneratedHtml(html);
      } catch (error) {
        console.error('Error generating statement preview:', error);
        const sdkError = error as Oystehr.OystehrSdkError;
        const message =
          sdkError?.code === APIErrorCode.STATEMENT_BILLING_CLAIM_NOT_FOUND
            ? sdkError.message
            : 'Unable to load statement preview';
        setPreviewError(message);
        enqueueSnackbar(message, { variant: 'error' });
      } finally {
        setIsPreviewLoading(false);
      }
    };

    void loadTemplateAndPreview();
  }, [encounterId, modalOpen, oystehrZambda, statementType]);

  useEffect(() => {
    const loadMailStatus = async (): Promise<void> => {
      if (!modalOpen || !oystehrZambda || !encounterId) return;

      setIsMailStatusLoading(true);
      try {
        const response = await oystehrZambda.zambda.execute({
          id: 'get-statement-status',
          encounterId,
        });

        const statementStatus = chooseJson(response) as StatementStatusResponse;
        setHasGeneratedStatement(Boolean(statementStatus.generated?.generated));
        setGeneratedStatusText(getGeneratedStatusText(statementStatus.generated));
        setHasMailedStatement(Boolean(statementStatus.mailProcessor?.found));
        setMailStatusText(getMailStatusText(statementStatus.mailProcessor));
      } catch (error) {
        console.error('Error loading statement mail status:', error);
        setHasGeneratedStatement(false);
        setGeneratedStatusText('');
        setHasMailedStatement(false);
        setMailStatusText('Unable to load mail status');
      } finally {
        setIsMailStatusLoading(false);
      }
    };

    void loadMailStatus();
  }, [encounterId, modalOpen, oystehrZambda]);

  const statementTypeLabel = getStatementTypeLabel(statementType);
  const printModeLabel = useColor ? 'color' : 'black & white';
  const hasPreviewError = previewError !== '';
  const mailDisabled = !FEATURE_FLAGS.MAILING_PAPER_STATEMENTS_ENABLED || hasPreviewError;

  const handleSendByMailClick = (): void => {
    if (mailDisabled) {
      return;
    }

    if (!encounterId) {
      enqueueSnackbar('Missing encounter id for statement mailing', { variant: 'error' });
      return;
    }
    setConfirmMailOpen(true);
  };

  const handleGenerateStatement = async (): Promise<void> => {
    if (hasPreviewError) {
      return;
    }

    if (!oystehrZambda || !encounterId) {
      enqueueSnackbar('Missing encounter id for statement generation', { variant: 'error' });
      return;
    }

    setIsGeneratingStatement(true);
    try {
      await oystehrZambda.zambda.execute({
        id: 'create-generate-statement-task',
        encounterId,
      });

      enqueueSnackbar('Statement generation started', { variant: 'success' });
      onSubmit();
    } catch (error) {
      console.error('Error creating generate statement task:', error);
      enqueueSnackbar('Error starting statement generation', { variant: 'error' });
    } finally {
      setIsGeneratingStatement(false);
    }
  };

  const handleConfirmSendByMail = async (): Promise<void> => {
    if (!oystehrZambda || !encounterId) return;

    setIsSendingMail(true);
    try {
      await oystehrZambda.zambda.execute({
        id: 'create-mail-statement-task',
        encounterId,
        statementType,
        color: useColor,
      });

      enqueueSnackbar('Statement sent to mail queue', { variant: 'success' });
      setConfirmMailOpen(false);
      onSubmit();
    } catch (error) {
      console.error('Error sending statement by mail:', error);
      enqueueSnackbar('Error sending statement by mail', { variant: 'error' });
    } finally {
      setIsSendingMail(false);
    }
  };

  return (
    <>
      <AppDialog
        variant="form"
        size="l"
        open={modalOpen}
        onClose={handleClose}
        // This dialog never closed on Esc or a backdrop click, which would discard what was entered.
        disableOutsideClose
        title="Send Statement"
        dismiss={{ label: 'Close' }}
        actions={[
          {
            label: hasGeneratedStatement ? 'Regenerate Statement' : 'Generate Statement',
            onClick: handleGenerateStatement,
            loading: isGeneratingStatement,
            disabled: hasPreviewError,
          },
        ]}
        primary={{
          label: hasMailedStatement ? 'Resend by Mail' : 'Send by Mail',
          onClick: handleSendByMailClick,
          disabled: mailDisabled,
        }}
      >
        <Box
          sx={{
            // Stays in view while the preview scrolls underneath, as the old fixed header did.
            position: 'sticky',
            top: 0,
            zIndex: 1,
            bgcolor: 'background.paper',
            pb: 1,
            mb: 1,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box
            sx={{
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <Typography
              variant="body2"
              sx={{ lineHeight: 1.35, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}
            >
              <strong>Patient:</strong> {patient?.fullName ?? '-'}, DOB {patient?.dob ?? '-'}, {patient?.gender ?? '-'}{' '}
              - {patientCityStateZip}
            </Typography>
            <Typography
              variant="body2"
              sx={{ lineHeight: 1.35, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}
            >
              <strong>Responsible Party:</strong> {responsibleParty?.fullName ?? '-'} - {responsiblePartyCityStateZip}
            </Typography>
          </Box>

          <Box sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
            {generatedStatusText && (
              <Typography
                variant="body2"
                sx={{
                  lineHeight: 1.35,
                  textAlign: 'right',
                  color: '#000000',
                }}
              >
                {generatedStatusText}
              </Typography>
            )}
            {(isMailStatusLoading || hasMailedStatement || mailStatusText === 'Unable to load mail status') && (
              <Typography
                variant="body2"
                sx={{
                  lineHeight: 1.35,
                  textAlign: 'right',
                  color: hasMailedStatement ? '#8B1E1E' : 'inherit',
                }}
              >
                {isMailStatusLoading ? 'Loading...' : mailStatusText}
              </Typography>
            )}
          </Box>
        </Box>

        {report !== undefined ? (
          <Box>
            <Box
              sx={{
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <FormControl size="small" sx={{ minWidth: 260, flex: '1 1 260px', maxWidth: 360 }}>
                <InputLabel id="statement-type-label">Statement Type</InputLabel>
                <Select
                  labelId="statement-type-label"
                  label="Statement Type"
                  value={statementType}
                  onChange={(event) => {
                    setStatementType(event.target.value as 'standard' | 'past-due' | 'final-notice');
                  }}
                >
                  <MenuItem value="standard">Standard</MenuItem>
                  <MenuItem value="past-due">Past Due</MenuItem>
                  <MenuItem value="final-notice">Final Notice</MenuItem>
                </Select>
              </FormControl>

              <FormControlLabel
                sx={{ m: 0, flexShrink: 0 }}
                control={
                  <Switch
                    checked={useColor}
                    onChange={(event) => {
                      setUseColor(event.target.checked);
                    }}
                    size="small"
                    disabled
                  />
                }
                label="Color"
              />
            </Box>

            <Box
              sx={{
                border: '1px solid',
                borderColor: '#2B3440',
                borderRadius: 1,
                minHeight: 700,
                backgroundColor: '#1E2630',
                p: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {isPreviewLoading ? (
                <CircularProgress size={28} />
              ) : previewError ? (
                <Typography color="error">{previewError}</Typography>
              ) : generatedHtml ? (
                <Box
                  component="iframe"
                  title="Statement Preview"
                  sandbox="allow-scripts"
                  srcDoc={generatedHtml}
                  sx={{
                    width: '100%',
                    minHeight: 800,
                    border: 'none',
                    backgroundColor: '#fff',
                    borderRadius: 1,
                    filter: useColor ? 'none' : 'grayscale(100%)',
                  }}
                />
              ) : (
                <Typography color="text.secondary">Statement HTML preview will go here</Typography>
              )}
            </Box>
          </Box>
        ) : (
          <Skeleton variant="rectangular" animation="wave" height={400} />
        )}
      </AppDialog>
      <AppDialog
        variant="confirm"
        open={confirmMailOpen}
        onClose={() => setConfirmMailOpen(false)}
        title="Confirm Send by Mail"
        primary={{ label: 'Send by Mail', onClick: handleConfirmSendByMail, loading: isSendingMail }}
      >
        Send {statementTypeLabel} statement for {patient?.fullName ?? 'this patient'} to{' '}
        {responsibleParty?.fullName ?? 'the responsible party'}, printed in {printModeLabel}?
      </AppDialog>
    </>
  );
}

function getStatementTypeLabel(statementType: 'standard' | 'past-due' | 'final-notice'): string {
  if (statementType === 'past-due') return 'past due';
  if (statementType === 'final-notice') return 'final notice';
  return 'standard';
}

function formatCityStateZip(city?: string, state?: string, fullAddress?: string): string {
  const zipMatch = fullAddress?.match(/\b\d{5}(?:-\d{4})?\b/);
  const zip = zipMatch?.[0];

  const cityPart = city?.trim() || '-';
  const statePart = state?.trim() || '-';
  const zipPart = zip ? ` ${zip}` : '';

  return `${cityPart}, ${statePart}${zipPart}`;
}

function getMailStatusText(mailProcessor?: StatementStatusResponse['mailProcessor']): string {
  if (!mailProcessor?.found) {
    return '';
  }

  const status = (mailProcessor.status ?? '').toLowerCase();
  const statusText =
    status === 'completed'
      ? 'Mailed'
      : status === 'printing' || status === 'processed_for_delivery'
      ? 'Printing mail'
      : status === 'ready'
      ? 'Preparing to mail'
      : status === 'cancelled'
      ? 'Mail cancelled'
      : status
      ? `Mail Status: ${mailProcessor.status}`
      : 'Unknown Mail Status';

  const formattedSendDate = formatLocalDateTime(mailProcessor.sendDate);
  if (formattedSendDate) {
    return `${statusText} (as of ${formattedSendDate})`;
  }

  return statusText;
}

function getGeneratedStatusText(generated?: StatementStatusResponse['generated']): string {
  if (!generated?.generated) {
    return '';
  }

  const formattedDate = formatLocalDate(generated.lastGenerated);
  if (!formattedDate) {
    return 'Statement generated';
  }

  return `Statement generated on ${formattedDate}`;
}

function formatLocalDate(dateValue?: string): string | undefined {
  if (!dateValue) return undefined;

  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) return undefined;

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsedDate);
}

function formatLocalDateTime(dateValue?: string): string | undefined {
  if (!dateValue) return undefined;

  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) return undefined;

  const parts = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(parsedDate);

  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  const year = parts.find((part) => part.type === 'year')?.value;
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;

  if (!month || !day || !year || !hour || !minute) return undefined;
  return `${month} ${day}, ${year} ${hour}:${minute}`;
}
