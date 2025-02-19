import DownloadIcon from '@mui/icons-material/Download';
import { Box, Button, CircularProgress, Divider, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { formatVisitDate, getPatientInfoFullName } from 'utils';
import { intakeFlowPageRoute } from '../App';
import { usePastVisitsStore } from '../features/past-visits';
import { useGetVisitDetails } from '../telemed/features/appointments';
import { useIntakeCommonStore } from '../telemed/features/common';
import { CustomContainer } from '../telemed/features/common';
import { usePatientInfoStore } from '../telemed/features/patient-info';
import { otherColors } from '../IntakeThemeProvider';
import { useOpenExternalLink } from '../telemed/hooks/useOpenExternalLink';
import { useZapEHRAPIClient } from '../telemed/utils';

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
            <Typography variant="subtitle1" color="primary.dark">
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

      {data?.files['school-work-note'] && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Typography variant="subtitle1" color="primary.dark">
              School & work notes
            </Typography>
            <Button
              variant="text"
              startIcon={<DownloadIcon />}
              onClick={() => {
                openExternalLink(data.files['school-work-note'].presignedUrl || '');
              }}
              disabled={!data?.files['school-work-note'].presignedUrl}
            >
              Download PDF
            </Button>
          </Box>

          <Divider sx={{ my: 3 }} />
        </>
      )}

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
  const { patientInfo: currentPatientInfo } = usePatientInfoStore.getState();
  const appointment = usePastVisitsStore.getState();

  const patientFullName = currentPatientInfo ? getPatientInfoFullName(currentPatientInfo) : '';
  const formattedPatientBirthDay = formatVisitDate(currentPatientInfo.dateOfBirth || '', 'birth');

  return (
    <CustomContainer
      title={patientFullName}
      subtext={`Birthday: ${formattedPatientBirthDay}`}
      description=""
      isFirstPage={true}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box>
          <Typography variant="h2" color="primary.dark">
            {appointment.appointmentDate}
          </Typography>
          <Typography variant="body2">Visit ID: {appointment.appointmentID}</Typography>
        </Box>

        {appointment.appointmentID && <VisitDetailsContent appointmentID={appointment.appointmentID} />}

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
            navigate(intakeFlowPageRoute.PastVisits.path);
          }}
        >
          Back to visits list
        </Button>
      </Box>
    </CustomContainer>
  );
};

export default VisitDetails;
