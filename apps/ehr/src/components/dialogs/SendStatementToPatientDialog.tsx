import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Switch,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useState } from 'react';
import { chooseJson, generateStatement, InvoiceablePatientReport, StatementDetails } from 'utils';
import { useApiClients } from '../../hooks/useAppClients';
import { RoundedButton } from '../RoundedButton';

interface SendStatementToPatientDialogProps {
  modalOpen: boolean;
  handleClose: () => void;
  onSubmit: () => void;
  report?: InvoiceablePatientReport;
}

interface StatementStatusResponse {
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
  const [applyGreyscalePreview, setApplyGreyscalePreview] = useState(false);
  const [confirmMailOpen, setConfirmMailOpen] = useState(false);
  const [isSendingMail, setIsSendingMail] = useState(false);
  const [isGeneratingStatement, setIsGeneratingStatement] = useState(false);
  const [isMailStatusLoading, setIsMailStatusLoading] = useState(false);
  const [mailStatusText, setMailStatusText] = useState('No mailed statement found yet');
  const [hasMailedStatement, setHasMailedStatement] = useState(false);

  useEffect(() => {
    if (modalOpen) {
      // Color toggle should default to off whenever the dialog is opened.
      setApplyGreyscalePreview(false);
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
        setPreviewError('Unable to load statement preview');
        enqueueSnackbar('Error loading statement preview', { variant: 'error' });
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
        setHasMailedStatement(Boolean(statementStatus.mailProcessor?.found));
        setMailStatusText(getMailStatusText(statementStatus.mailProcessor));
      } catch (error) {
        console.error('Error loading statement mail status:', error);
        setHasMailedStatement(false);
        setMailStatusText('Unable to load mail status');
      } finally {
        setIsMailStatusLoading(false);
      }
    };

    void loadMailStatus();
  }, [encounterId, modalOpen, oystehrZambda]);

  const statementTypeLabel = getStatementTypeLabel(statementType);
  const printModeLabel = applyGreyscalePreview ? 'color' : 'black & white';

  const handleSendByMailClick = (): void => {
    if (!encounterId) {
      enqueueSnackbar('Missing encounter id for statement mailing', { variant: 'error' });
      return;
    }
    setConfirmMailOpen(true);
  };

  const handleGenerateStatement = async (): Promise<void> => {
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
        color: applyGreyscalePreview,
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
      <Dialog
        open={modalOpen}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            width: '74vw',
            maxWidth: '1080px',
            height: '92vh',
          },
        }}
      >
        <IconButton onClick={handleClose} size="medium" sx={{ position: 'absolute', right: 12, top: 12 }}>
          <CloseIcon fontSize="medium" sx={{ color: '#938B7D' }} />
        </IconButton>

        <Grid container direction="column" sx={{ padding: 1 }} spacing={0.5}>
          <DialogTitle variant="h4" color="primary.dark">
            Send Statement
          </DialogTitle>

          <Box
            sx={{
              pl: 3,
              pr: 2,
              pt: 0,
              pb: 1,
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
                <strong>Patient:</strong> {patient?.fullName ?? '-'}, DOB {patient?.dob ?? '-'},{' '}
                {patient?.gender ?? '-'} - {patientCityStateZip}
              </Typography>
              <Typography
                variant="body2"
                sx={{ lineHeight: 1.35, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}
              >
                <strong>Responsible Party:</strong> {responsibleParty?.fullName ?? '-'} - {responsiblePartyCityStateZip}
              </Typography>
            </Box>

            <Box sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <RoundedButton
                  variant="contained"
                  color="primary"
                  onClick={() => void handleGenerateStatement()}
                  disabled={isGeneratingStatement}
                >
                  {isGeneratingStatement ? 'Generating...' : 'Generate PDF'}
                </RoundedButton>
                <RoundedButton
                  variant="contained"
                  color="primary"
                  onClick={handleSendByMailClick}
                  sx={
                    hasMailedStatement
                      ? {
                          backgroundColor: '#8B1E1E',
                          '&:hover': {
                            backgroundColor: '#6E1717',
                          },
                        }
                      : undefined
                  }
                >
                  {hasMailedStatement ? 'Resend by Mail' : 'Send by Mail'}
                </RoundedButton>
              </Box>
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

          <DialogContent sx={{ flex: 1, overflow: 'auto' }}>
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
                        checked={applyGreyscalePreview}
                        onChange={(event) => {
                          setApplyGreyscalePreview(event.target.checked);
                        }}
                        size="small"
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
                      sandbox="allow-same-origin allow-scripts"
                      srcDoc={generatedHtml}
                      sx={{
                        width: '100%',
                        minHeight: 800,
                        border: 'none',
                        backgroundColor: '#fff',
                        borderRadius: 1,
                        filter: applyGreyscalePreview ? 'none' : 'grayscale(100%)',
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
          </DialogContent>
        </Grid>
      </Dialog>
      <Dialog open={confirmMailOpen} onClose={() => setConfirmMailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Send by Mail</DialogTitle>
        <DialogContent>
          <Typography>
            Send {statementTypeLabel} statement for {patient?.fullName ?? 'this patient'} to{' '}
            {responsibleParty?.fullName ?? 'the responsible party'}, printed in {printModeLabel}?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <RoundedButton variant="outlined" color="primary" onClick={() => setConfirmMailOpen(false)}>
            Cancel
          </RoundedButton>
          <RoundedButton variant="contained" color="primary" onClick={() => void handleConfirmSendByMail()}>
            {isSendingMail ? 'Sending...' : 'OK'}
          </RoundedButton>
        </DialogActions>
      </Dialog>
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
