import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  CircularProgress,
  Dialog,
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

export default function SendStatementToPatientDialog({
  modalOpen,
  handleClose,
  onSubmit,
  report,
}: SendStatementToPatientDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const { patient, responsibleParty } = report ?? {};
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

  useEffect(() => {
    if (modalOpen) {
      // Color toggle should default to off whenever the dialog is opened.
      setApplyGreyscalePreview(false);
    }
  }, [modalOpen]);

  useEffect(() => {
    const loadTemplateAndPreview = async (): Promise<void> => {
      if (!modalOpen || !oystehrZambda) return;

      setIsPreviewLoading(true);
      setPreviewError('');
      try {
        const response = await oystehrZambda.zambda.execute({
          id: 'get-statement-template',
          template: 'statement-template',
        });

        const templateResponse = chooseJson(response) as { template: string; fileName: string; logoBase64: string };
        const statementDetails = createStubStatementDetails(templateResponse.logoBase64, statementType);
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
  }, [modalOpen, oystehrZambda, statementType]);

  return (
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

          <Box sx={{ flexShrink: 0 }}>
            <RoundedButton variant="contained" color="primary" onClick={onSubmit}>
              Send
            </RoundedButton>
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
  );
}

function formatCityStateZip(city?: string, state?: string, fullAddress?: string): string {
  const zipMatch = fullAddress?.match(/\b\d{5}(?:-\d{4})?\b/);
  const zip = zipMatch?.[0];

  const cityPart = city?.trim() || '-';
  const statePart = state?.trim() || '-';
  const zipPart = zip ? ` ${zip}` : '';

  return `${cityPart}, ${statePart}${zipPart}`;
}

function createStubStatementDetails(
  logoBase64: string,
  statementType: 'standard' | 'past-due' | 'final-notice'
): StatementDetails {
  const pastDue = statementType === 'past-due' || statementType === 'final-notice';
  const finalNotice = statementType === 'final-notice';

  const mergeVariables = {
    respParty: {
      firstName: 'Jonathan',
      lastName: 'Mercer',
      addressLine1: '1122 Elmwood Drive',
      addressLine2: 'Apt 4B',
      city: 'Springfield',
      provinceOrState: 'IL',
      postalOrZip: '62701',
      countryCode: 'US',
    },
    pastDue,
    finalNotice,
    statement: {
      number: '2026-00847',
      issueDate: 'March 5, 2026',
      dueDate: 'April 4, 2026',
    },
    patient: {
      firstName: 'Sophia',
      lastName: 'Mercer',
      dob: '09 / 14 / 2018',
    },
    insurance: {
      payerName: 'BlueCross BlueShield of Illinois',
      memberId: 'BCB-774-002918',
    },
    visit: {
      date: 'Feb 18, 2026',
      time: '10:30 AM',
    },
    facility: {
      name: 'Ottehr Clinic — Washington DC',
    },
    service:
      '[{"cpt":"99214","description":"Office or other outpatient visit for the evaluation and management of an established patient, which requires a medically appropriate history and/or examination and moderate level of medical decision making","charged":"$225.00","insurancePaid":"$160.00","patientPaid":"$25.00","patientOwes":"$40.00"},{"cpt":"93000","description":"Electrocardiogram, routine ECG with at least 12 leads including interpretation and report, performed as a standalone diagnostic procedure during an office visit","charged":"$95.00","insurancePaid":"$70.00","patientPaid":"$0.00","patientOwes":"$25.00"},{"cpt":"85025","description":"Complete blood count with differential white blood cell count, automated, including red blood cell indices, hemoglobin, hematocrit, and platelet count","charged":"$68.00","insurancePaid":"$50.00","patientPaid":"$0.00","patientOwes":"$18.00"},{"cpt":"80053","description":"Comprehensive metabolic panel including glucose, calcium, albumin, total protein, sodium, potassium, carbon dioxide, chloride, creatinine, BUN, and liver function tests","charged":"$74.00","insurancePaid":"$55.00","patientPaid":"$0.00","patientOwes":"$19.00"},{"cpt":"71046","description":"Radiologic examination of the chest, two views, posteroanterior and lateral projections, with interpretation and written report by a licensed radiologist","charged":"$110.00","insurancePaid":"$82.00","patientPaid":"$0.00","patientOwes":"$28.00"},{"cpt":"36415","description":"Collection of venous blood by venipuncture from a peripheral vein for laboratory analysis, performed by trained clinical staff in an outpatient setting","charged":"$22.00","insurancePaid":"$15.00","patientPaid":"$0.00","patientOwes":"$7.00"},{"cpt":"90714","description":"Tetanus and diphtheria toxoids adsorbed, preservative free, when administered to individuals 7 years or older, for intramuscular use, single-dose injection","charged":"$52.00","insurancePaid":"$52.00","patientPaid":"$0.00","patientOwes":"$0.00"}]',
    totals: {
      charged: '$646.00',
      insurancePaid: '$484.00',
      patientPaid: '$25.00',
      deductible: '$137.00',
      balanceDue: '$137.00',
    },
    payment: {
      url: 'patient.oystehr.com/visit',
    },
    biller: {
      addressLine1: '200 Massachusetts Ave NW',
      addressLine2: '',
      city: 'Washington',
      provinceOrState: 'DC',
      postalOrZip: '20001',
      website: 'oystehr.com',
      email: 'billing@oystehr.com',
      logoBase64,
    },
  };

  return {
    ...mergeVariables,
    service: JSON.parse(mergeVariables.service) as StatementDetails['service'],
  };
}
