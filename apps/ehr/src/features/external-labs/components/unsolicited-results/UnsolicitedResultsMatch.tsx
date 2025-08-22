import ClearIcon from '@mui/icons-material/Clear';
import { LoadingButton } from '@mui/lab';
import {
  Box,
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
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { SearchResultParsedPatient } from 'src/components/PatientsSearch/types';
import DetailPageContainer from 'src/features/common/DetailPageContainer';
import PageContainer from 'src/layout/PageContainer';
import { useGetUnsolicitedResultsResourcesForMatch } from 'src/telemed';
import { formatDateForLabs, UnsolicitedResultsRequestType } from 'utils';
import { UnsolicitedPatientMatchSearchCard } from './UnsolicitedPatientMatchSearchCard';
import { UnsolicitedVisitMatchCard } from './UnsolicitedVisitMatchCard';

export const UnsolicitedResultsMatch: React.FC = () => {
  const { diagnosticReportId } = useParams();
  const [selectedPatient, setSelectedPatient] = useState<SearchResultParsedPatient | undefined>();
  const [confirmedSelectedPatient, setConfirmedSelectedPatient] = useState<SearchResultParsedPatient | undefined>();
  const [srIdForConfirmedMatchedVisit, setSrIdForConfirmedMatchedVisit] = useState<string>('');
  const PAGE_TITLE = 'Match Unsolicited Result';

  if (!diagnosticReportId) {
    throw new Error('diagnosticReportId is required');
  }

  const {
    data,
    isLoading,
    error: resourceSearchError,
  } = useGetUnsolicitedResultsResourcesForMatch({
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
      value: data?.labInfo?.patientName,
    },
    {
      fieldName: 'Patient DOB',
      value: data?.labInfo?.patientDOB,
    },
    {
      fieldName: 'Provider',
      value: data?.labInfo?.provider,
    },
    {
      fieldName: 'Test',
      value: data?.labInfo?.test,
    },
    {
      fieldName: 'Source',
      value: undefined, // we dont have access to this yet, need change from oystehr
    },
    {
      fieldName: 'Results received',
      value: formatDateForLabs(data?.labInfo?.resultsReceived, undefined),
    },
  ];

  const handleConfirmPatientMatch = (confirmed: SearchResultParsedPatient | undefined): void => {
    setSelectedPatient(undefined);
    setConfirmedSelectedPatient(confirmed);
  };

  const readyToSubmit = !!confirmedSelectedPatient;

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
              <Stack>
                <Grid container sx={{ justifyContent: 'end' }} gap={'12px'}>
                  <LoadingButton
                    variant="outlined"
                    sx={{ borderRadius: '50px', textTransform: 'none', py: 1, px: 5, textWrap: 'nowrap' }}
                    color="error"
                    size={'medium'}
                    onClick={() => console.log('hi')}
                    // disabled={pendingLabs.length > 0}
                  >
                    Reject
                  </LoadingButton>
                  <LoadingButton
                    variant="contained"
                    sx={{ borderRadius: '50px', textTransform: 'none', py: 1, px: 5, textWrap: 'nowrap' }}
                    color="primary"
                    size={'medium'}
                    onClick={() => console.log('hi')}
                    disabled={!readyToSubmit}
                  >
                    Submit
                  </LoadingButton>
                </Grid>
              </Stack>
            </Stack>
          )}
        </Paper>
      </DetailPageContainer>
    </PageContainer>
  );
};
