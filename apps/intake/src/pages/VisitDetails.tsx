import DownloadIcon from '@mui/icons-material/Download';
import { Box, Button, CircularProgress, Divider, Typography } from '@mui/material';
import { generatePath, useNavigate, useParams } from 'react-router-dom';
import { intakeFlowPageRoute } from '../App';
import { useGetVisitDetails } from '../telemed/features/appointments';
import { useIntakeCommonStore } from '../telemed/features/common';
import { otherColors } from '../IntakeThemeProvider';
import { useOpenExternalLink } from '../telemed/hooks/useOpenExternalLink';
import { useZapEHRAPIClient } from '../telemed/utils';
import { DateTime } from 'luxon';

const ExcuseNoteContent = ({
  appointmentID,
  docType,
}: {
  appointmentID: string;
  docType: string;
}): JSX.Element | null => {
  const apiClient = useZapEHRAPIClient();
  const openExternalLink = useOpenExternalLink();
  const { data } = useGetVisitDetails(apiClient, Boolean(apiClient) && Boolean(appointmentID), appointmentID);

  return data?.files[docType] ? (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
        <Typography variant="subtitle1" color="primary.dark" textTransform={'capitalize'}>
          {docType} note
        </Typography>
        <Button
          variant="text"
          startIcon={<DownloadIcon />}
          onClick={() => {
            openExternalLink(data.files[docType].presignedUrl || '');
          }}
          disabled={!data?.files[docType].presignedUrl}
        >
          Download PDF
        </Button>
      </Box>

      <Divider sx={{ my: 3 }} />
    </>
  ) : (
    <></>
  );
};

const VisitDetailsContent = ({ appointmentID }: { appointmentID: string }): JSX.Element | null => {
  const apiClient = useZapEHRAPIClient();
  const openExternalLink = useOpenExternalLink();
  const { data, isLoading, error } = useGetVisitDetails(
    apiClient,
    Boolean(apiClient) && Boolean(appointmentID),
    appointmentID
  );

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

  return (
    <>
      {data?.files['visit-note'] && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Typography variant="subtitle1" color="primary.dark" textTransform={'capitalize'}>
              Full visit note
            </Typography>
            <Button
              variant="text"
              startIcon={<DownloadIcon />}
              onClick={() => {
                openExternalLink(data.files['visit-note'].presignedUrl || '');
              }}
              disabled={!data?.files['visit-note'].presignedUrl}
            >
              Download PDF
            </Button>
          </Box>

          <Divider sx={{ my: 3 }} />
        </>
      )}

      {['school', 'work'].map((docType) => (
        <ExcuseNoteContent key={docType} appointmentID={appointmentID} docType={docType} />
      ))}

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

      <Divider />
    </>
  );
};

const VisitDetails = (): JSX.Element => {
  const navigate = useNavigate();

  const { patientId, visitId } = useParams();

  const apiClient = useZapEHRAPIClient();
  const { data } = useGetVisitDetails(apiClient, Boolean(apiClient) && Boolean(visitId), visitId);
  const appointmentDate = (() => {
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

        {visitId && <VisitDetailsContent appointmentID={visitId} />}

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
