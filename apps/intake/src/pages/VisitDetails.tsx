import DownloadIcon from '@mui/icons-material/Download';
import { Box, Button, CircularProgress, Divider, Link, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { generatePath, useNavigate, useParams } from 'react-router-dom';
import { VisitFiles, VisitFileType, visitFileTypes } from 'src/types/types';
import { FileURLs, GetVisitDetailsResponse } from 'utils';
import { intakeFlowPageRoute } from '../App';
import { otherColors } from '../IntakeThemeProvider';
import { useGetVisitDetails } from '../telemed/features/appointments';
import { useIntakeCommonStore } from '../telemed/features/common';
import { useOpenExternalLink } from '../telemed/hooks/useOpenExternalLink';
import { useOystehrAPIClient } from '../telemed/utils';

function adaptVisitFiles(files?: FileURLs): VisitFiles | undefined {
  if (!files) return undefined;

  const result: VisitFiles = {};

  for (const key of Object.values(visitFileTypes)) {
    if (files[key]) {
      result[key] = files[key];
    }
  }

  return result;
}

const FILE_SECTIONS: {
  key: VisitFileType;
  label: string;
}[] = [
  { key: visitFileTypes.visitNote, label: 'Full visit note' },
  { key: visitFileTypes.dischargeSummary, label: 'Discharge papers' },
  { key: visitFileTypes.school, label: 'School note' },
  { key: visitFileTypes.work, label: 'Work note' },
  { key: visitFileTypes.receipt, label: 'Receipt' },
  { key: visitFileTypes.statement, label: 'Statement' },
];

const VisitDetailsContent = ({
  data,
  isLoading,
  error,
}: {
  data: GetVisitDetailsResponse | undefined;
  isLoading: boolean;
  error: any | undefined;
}): JSX.Element | null => {
  const openExternalLink = useOpenExternalLink();
  if (error) {
    useIntakeCommonStore.setState({ error: 'Failed to load appointment details' });
    return null;
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  const typedFiles = adaptVisitFiles(data?.files);

  return (
    <>
      {FILE_SECTIONS.map(({ key, label }, index) => {
        const file = typedFiles?.[key];
        if (!file) return null;

        const url = file.presignedUrl;

        return (
          <Box key={key}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
              <Typography variant="subtitle1" color="primary.dark" textTransform={'capitalize'}>
                {label}
              </Typography>

              <Button
                variant="text"
                startIcon={<DownloadIcon />}
                onClick={() => url && openExternalLink(url)}
                disabled={!url}
              >
                Download PDF
              </Button>
            </Box>

            {index < FILE_SECTIONS.length - 1 && <Divider sx={{ my: 3 }} />}
          </Box>
        );
      })}

      {!!(data?.medications && data.medications.length > 0) && (
        <Box>
          <Typography variant="subtitle1" color="primary.dark">
            Medications Prescribed
          </Typography>
          {data?.medications.map((medication) => (
            <Box sx={{ mb: 3 }} key={medication.resourceId}>
              <Typography sx={{ fontSize: 18 }}>{medication.name}</Typography>
              <Typography sx={{ fontSize: 14 }}>{medication.instructions}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {!!(data?.reviewedLabResults && data?.reviewedLabResults.length > 0) && (
        <Box sx={{ display: 'flex', flexDirection: 'column', rowGap: '8px' }}>
          <Typography variant="subtitle1" color="primary.dark" sx={{ fontWeight: '600 !important' }}>
            Labs
          </Typography>
          {data.reviewedLabResults.map((labResult, idx) => (
            <Box key={`${idx}-lab-result`}>
              <Link sx={{ cursor: 'pointer' }} onClick={() => openExternalLink(labResult.presignedUrl || '')}>
                {labResult.description}
              </Link>
            </Box>
          ))}
        </Box>
      )}

      {data?.followUps && data.followUps.length > 0 && (
        <>
          <Divider sx={{ my: 3 }} />
          <Box>
            <Typography variant="subtitle1" color="primary.dark" sx={{ mb: 2 }}>
              Follow-up Visits
            </Typography>
            {data.followUps.map((followUp, index) => {
              const followUpDate = (() => {
                if (!followUp.encounterTime) {
                  return '';
                }
                const dt = DateTime.fromISO(followUp.encounterTime);
                return dt.toFormat('MMMM dd, yyyy');
              })();
              const hasVisitNote = Boolean(followUp.documents[visitFileTypes.visitNote]?.presignedUrl);

              return (
                <Box key={index} sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body1" color="primary.dark">
                      {followUpDate}
                    </Typography>
                    {hasVisitNote && (
                      <Button
                        variant="text"
                        startIcon={<DownloadIcon />}
                        onClick={() => {
                          openExternalLink(followUp.documents[visitFileTypes.visitNote].presignedUrl || '');
                        }}
                        disabled={!followUp.documents[visitFileTypes.visitNote]?.presignedUrl}
                      >
                        View Follow-up Note
                      </Button>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </>
      )}

      <Divider />
    </>
  );
};

const VisitDetails = (): JSX.Element => {
  const navigate = useNavigate();

  const { patientId, visitId } = useParams();

  const apiClient = useOystehrAPIClient();
  const { data, isLoading, error } = useGetVisitDetails(apiClient, Boolean(apiClient) && Boolean(visitId), visitId);
  const appointmentDate = (() => {
    if (!data?.appointmentTime) {
      return '';
    }
    const dt = DateTime.fromISO(data?.appointmentTime ?? '');
    return dt.toFormat('MMMM dd, yyyy');
  })();
  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box>
          <Typography variant="h2" color="primary.dark">
            {appointmentDate}
          </Typography>
          <Typography variant="body2">Visit ID: {visitId}</Typography>
        </Box>

        {visitId && <VisitDetailsContent data={data} isLoading={isLoading} error={error} />}

        <Button
          sx={{
            alignSelf: 'baseline',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: otherColors.white,
            color: 'primary.light',
            border: '1px solid',
            borderColor: otherColors.purple,
            borderRadius: '100px',
            py: 1,
            px: 2,
          }}
          onClick={() => {
            if (!patientId) {
              return;
            }
            const destination = generatePath(intakeFlowPageRoute.PastVisits.path, {
              patientId,
            });
            navigate(destination);
          }}
        >
          Back to visits list
        </Button>
      </Box>
    </Box>
  );
};

export default VisitDetails;
