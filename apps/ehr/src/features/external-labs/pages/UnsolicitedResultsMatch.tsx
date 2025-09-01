import { otherColors } from '@ehrTheme/colors';
import ClearIcon from '@mui/icons-material/Clear';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { SearchResultParsedPatient } from 'src/components/PatientsSearch/types';
import DetailPageContainer from 'src/features/common/DetailPageContainer';
import PageContainer from 'src/layout/PageContainer';
import {
  useCancelMatchUnsolicitedResultTask,
  useFinalizeUnsolicitedResultMatch,
  useGetUnsolicitedResultsMatchData,
} from 'src/telemed';
import { formatDateForLabs, LAB_ORDER_UPDATE_RESOURCES_EVENTS, UnsolicitedResultsRequestType } from 'utils';
import { UnsolicitedPatientMatchSearchCard } from '../components/unsolicited-results/UnsolicitedPatientMatchSearchCard';
import { UnsolicitedVisitMatchCard } from '../components/unsolicited-results/UnsolicitedVisitMatchCard';

export const UnsolicitedResultsMatch: React.FC = () => {
  const { diagnosticReportId } = useParams();
  const { mutate: cancelTask, isPending: isCancelling } = useCancelMatchUnsolicitedResultTask();
  const { mutate: matchResult, isPending: isMatching } = useFinalizeUnsolicitedResultMatch();
  const navigate = useNavigate();
  const [selectedPatient, setSelectedPatient] = useState<SearchResultParsedPatient | undefined>();
  const [confirmedSelectedPatient, setConfirmedSelectedPatient] = useState<SearchResultParsedPatient | undefined>();
  const [srIdForConfirmedMatchedVisit, setSrIdForConfirmedMatchedVisit] = useState<string>('');
  const PAGE_TITLE = 'Match Unsolicited Test Results';

  if (!diagnosticReportId) {
    throw new Error('diagnosticReportId is required');
  }

  const {
    data,
    isLoading,
    error: resourceSearchError,
  } = useGetUnsolicitedResultsMatchData({
    requestType: UnsolicitedResultsRequestType.MATCH_UNSOLICITED_RESULTS,
    diagnosticReportId,
  });

  if (resourceSearchError) {
    return (
      <PageContainer>
        <DetailPageContainer>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: '600px', color: 'primary.dark' }}>
              {PAGE_TITLE}
            </Typography>
          </Box>
          <Paper sx={{ p: 3 }}>
            <Typography color="error">There was an error loading the page, please try again.</Typography>
            {resourceSearchError.message && (
              <Typography color="error">Error message: {resourceSearchError.message}</Typography>
            )}
          </Paper>
        </DetailPageContainer>
      </PageContainer>
    );
  }

  const labProvidedInfo = [
    {
      fieldName: 'Patient name',
      value: data?.unsolicitedLabInfo?.patientName,
    },
    {
      fieldName: 'Patient DOB',
      value: data?.unsolicitedLabInfo?.patientDOB,
    },
    {
      fieldName: 'Provider',
      value: data?.unsolicitedLabInfo?.provider,
    },
    {
      fieldName: 'Test',
      value: data?.unsolicitedLabInfo?.test,
    },
    {
      fieldName: 'Performing Lab',
      value: data?.unsolicitedLabInfo?.labName,
    },
    {
      fieldName: 'Received',
      value: formatDateForLabs(data?.unsolicitedLabInfo?.resultsReceived, undefined),
    },
  ];

  const handleConfirmPatientMatch = (confirmed: SearchResultParsedPatient | undefined): void => {
    setSelectedPatient(undefined);
    setConfirmedSelectedPatient(confirmed);
  };

  const readyToSubmit = !!confirmedSelectedPatient;

  const handleReject = (): void => {
    if (data?.taskId) {
      cancelTask(
        {
          taskId: data.taskId,
          event: LAB_ORDER_UPDATE_RESOURCES_EVENTS.cancelUnsolicitedResultTask,
        },
        {
          onSuccess: () => {
            navigate('/unsolicited-results');
          },
          onError: (error) => {
            console.error('Cancel task failed:', error);
            enqueueSnackbar('An error occurred rejecting this task. Please try again.', { variant: 'error' });
          },
        }
      );
    } else {
      console.log('data.task could not be parsed');
      enqueueSnackbar('An error occurred rejecting this task. Please try again.', { variant: 'error' });
    }
  };

  const handleMatch = (): void => {
    if (data?.taskId && confirmedSelectedPatient) {
      matchResult(
        {
          event: LAB_ORDER_UPDATE_RESOURCES_EVENTS.matchUnsolicitedResult,
          taskId: data.taskId,
          diagnosticReportId,
          patientToMatchId: confirmedSelectedPatient.id,
          srToMatchId: srIdForConfirmedMatchedVisit,
        },
        {
          onSuccess: () => {
            navigate('/unsolicited-results');
          },
          onError: (error) => {
            console.error('Matching unsolicited result failed:', error);
            enqueueSnackbar('An error occurred matching this result. Please try again.', { variant: 'error' });
          },
        }
      );
    } else {
      console.log('data.task or confirmedSelectedPatient could not be parsed');
      enqueueSnackbar('An error occurred rejecting this task. Please try again.', { variant: 'error' });
    }
  };

  return (
    <PageContainer>
      <DetailPageContainer>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: '600px', color: 'primary.dark' }}>
            {PAGE_TITLE}
          </Typography>
        </Box>
        <Paper sx={{ p: 3 }}>
          {isLoading ? (
            <CircularProgress />
          ) : (
            <Stack spacing={'24px'}>
              <Stack spacing={'8px'}>
                <Typography variant="body1" sx={{ fontWeight: 500, color: 'primary.dark' }}>
                  Lab provided info:
                </Typography>
                {labProvidedInfo.map((info, idx) => {
                  return (
                    <Typography variant="body1" key={`lab-provided-info-${idx}`}>
                      <span style={{ fontWeight: 500 }}>{info.fieldName}: </span>
                      {info.value ?? 'n/a'}
                    </Typography>
                  );
                })}
              </Stack>
              <Stack spacing={'8px'}>
                <Typography variant="body1" sx={{ fontWeight: 500, color: 'primary.dark' }}>
                  Match to patient:
                </Typography>
                {confirmedSelectedPatient ? (
                  <TextField
                    label="Selected"
                    InputProps={{
                      readOnly: true,
                      endAdornment: (
                        <IconButton onClick={() => setConfirmedSelectedPatient(undefined)} edge="end" size="small">
                          <ClearIcon />
                        </IconButton>
                      ),
                    }}
                    value={`${confirmedSelectedPatient.name} (${confirmedSelectedPatient.birthDate})`}
                  ></TextField>
                ) : (
                  <UnsolicitedPatientMatchSearchCard
                    selectedPatient={selectedPatient}
                    setSelectedPatient={setSelectedPatient}
                    handleConfirmPatientMatch={handleConfirmPatientMatch}
                  ></UnsolicitedPatientMatchSearchCard>
                )}
              </Stack>
              <Stack spacing={'8px'}>
                <Typography variant="body1" sx={{ fontWeight: 500, color: 'primary.dark' }}>
                  Match to visit:
                </Typography>
                {!confirmedSelectedPatient?.id ? (
                  <RadioGroup value={''}>
                    <FormControlLabel
                      key={`visit-date-radio-none-val-locked`}
                      value=""
                      control={<Radio disabled />}
                      label="none"
                    />
                  </RadioGroup>
                ) : (
                  <UnsolicitedVisitMatchCard
                    diagnosticReportId={diagnosticReportId}
                    patientId={confirmedSelectedPatient.id}
                    srIdForConfirmedMatchedVisit={srIdForConfirmedMatchedVisit}
                    setSrIdForConfirmedMatchedVisit={setSrIdForConfirmedMatchedVisit}
                  />
                )}
              </Stack>
              {confirmedSelectedPatient?.id && (
                <Stack>
                  <Box
                    sx={{
                      width: '100%',
                      height: '48px',
                      background: `${otherColors.infoBackground}`,
                      display: 'flex',
                      justifyContent: 'left',
                      alignItems: 'center',
                      borderRadius: '4px',
                      py: '6px',
                      px: '16px',
                    }}
                    gap="12px"
                  >
                    <InfoIcon sx={{ color: 'info.main' }}></InfoIcon>
                    <Typography variant="button" sx={{ textTransform: 'none', color: 'primary.dark' }}>
                      Please notify provider to review the unsolicited test result.
                    </Typography>
                  </Box>
                </Stack>
              )}
              <Stack>
                <Grid container sx={{ justifyContent: 'end' }} gap={'12px'}>
                  <LoadingButton
                    loading={isCancelling}
                    variant="outlined"
                    sx={{
                      borderRadius: '50px',
                      textTransform: 'none',
                      py: 1,
                      px: 5,
                      textWrap: 'nowrap',
                      fontSize: '15px',
                    }}
                    color="error"
                    size={'medium'}
                    onClick={handleReject}
                  >
                    Reject
                  </LoadingButton>
                  <LoadingButton
                    loading={isMatching}
                    variant="contained"
                    sx={{ borderRadius: '50px', textTransform: 'none', py: 1, px: 5, textWrap: 'nowrap' }}
                    color="primary"
                    size={'medium'}
                    onClick={handleMatch}
                    disabled={!readyToSubmit}
                  >
                    Submit
                  </LoadingButton>
                </Grid>
              </Stack>
            </Stack>
          )}
        </Paper>
        <Button
          onClick={() => navigate(-1)}
          variant="outlined"
          sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 500, fontSize: '15px', width: '100px' }}
        >
          Back
        </Button>
      </DetailPageContainer>
    </PageContainer>
  );
};
