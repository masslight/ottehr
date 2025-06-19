import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, Grid, IconButton, Stack, Typography } from '@mui/material';
import { TypographyOptions } from '@mui/material/styles/createTypography';
import { styled } from '@mui/system';
import { enqueueSnackbar } from 'notistack';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PRACTITIONER_CODINGS, VisitStatusLabel } from 'utils';
import { dataTestIds } from '../../../constants/data-test-ids';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../telemed';
import { useNavigationContext } from '../context/NavigationContext';
import { useAppointment } from '../hooks/useAppointment';
import { usePractitionerActions } from '../hooks/usePractitioner';
import { ChangeStatusDropdown } from './ChangeStatusDropdown';
import { InternalNotes } from './InternalNotes';
import { PrintVisitLabelButton } from './PrintVisitLabelButton';
import { ProfileAvatar } from './ProfileAvatar';
import { SwitchIntakeModeButton } from './SwitchIntakeModeButton';

const HeaderWrapper = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: '8px 16px 8px 0',
  borderBottom: `1px solid ${theme.palette.divider}`,
  boxShadow: '0px 2px 4px -1px #00000033',
}));

const PatientName = styled(Typography)(({ theme }) => ({
  ...(theme?.typography as TypographyOptions).h4,
  textAlign: 'left',
  fontWeight: 'bold',
  color: theme.palette.primary.dark,
  cursor: 'pointer',
}));

const PatientMetadata = styled(Typography)(({ theme }) => ({
  fontSize: '14px',
  fontWeight: 400,
  color: theme.palette.text.secondary,
}));

const PatientInfoWrapper = styled(Box)({
  display: 'flex',
  alignItems: 'baseline',
  gap: '8px',
});

const format = (
  value: string | undefined,
  placeholder = '',
  keepPlaceholderIfValueFulfilled = false,
  emptyValuePlaceholder = 'N/A'
): string => {
  const prefix = !value || (keepPlaceholderIfValueFulfilled && value) ? `${placeholder}: ` : '';
  return prefix + (value || emptyValuePlaceholder);
};

export const Header = (): JSX.Element => {
  const { id: appointmentID } = useParams();
  const navigate = useNavigate();
  const {
    resources: { appointment, patient },
    mappedData,
    visitState: telemedData,
    refetch,
  } = useAppointment(appointmentID);
  const { encounter } = telemedData;
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);
  const encounterId = encounter?.id;
  const patientName = format(mappedData?.patientName, 'Name');
  const pronouns = format(mappedData?.pronouns, 'Pronouns');
  const gender = format(mappedData?.gender, 'Gender');
  const language = format(mappedData?.preferredLanguage, 'Lang');
  const dob = format(mappedData?.DOB, 'DOB', true);
  const allergies = format(
    chartData?.allergies
      ?.filter((allergy) => allergy.current === true)
      ?.map((allergy) => allergy.name)
      ?.join(', '),
    'Allergy',
    true,
    'none'
  );
  const reasonForVisit = format(appointment?.description, 'Reason for Visit');
  const userId = format(patient?.id);
  const [_status, setStatus] = useState<VisitStatusLabel | undefined>(undefined);
  const { interactionMode, setInteractionMode } = useNavigationContext();
  const nextMode = interactionMode === 'intake' ? 'provider' : 'intake';
  const practitionerTypeFromMode =
    interactionMode === 'intake' ? PRACTITIONER_CODINGS.Attender : PRACTITIONER_CODINGS.Admitter;
  const { isEncounterUpdatePending, handleUpdatePractitioner } = usePractitionerActions(
    encounter,
    'start',
    practitionerTypeFromMode
  );

  const handleSwitchMode = async (): Promise<void> => {
    try {
      if (!appointmentID) return;
      await handleUpdatePractitioner();
      void refetch();
      setInteractionMode(nextMode, true);
    } catch (error: any) {
      console.log(error.message);
      enqueueSnackbar(`An error occurred trying to switch to ${nextMode} mode. Please try again.`, {
        variant: 'error',
      });
    }
  };

  return (
    <HeaderWrapper data-testid={dataTestIds.cssHeader.container}>
      <Stack flexDirection="row">
        <Box sx={{ width: 70 }} display="flex" alignItems="center" justifyContent="center">
          <IconButton onClick={() => navigate('/visits')} sx={{ width: 40, height: 40 }}>
            <ArrowBackIcon />
          </IconButton>
        </Box>
        <Grid container spacing={2} sx={{ padding: '0 18px 0 4px' }}>
          <Grid item xs={12}>
            <Grid container alignItems="center" justifyContent="space-between">
              <Grid item>
                <Grid container alignItems="center" spacing={2}>
                  <Grid item>
                    <ChangeStatusDropdown appointmentID={appointmentID} onStatusChange={setStatus} />
                  </Grid>
                  <Grid item>
                    <PatientMetadata>
                      PID:{' '}
                      <u style={{ cursor: 'pointer' }} onClick={() => navigate(`/patient/${userId}`)}>
                        {userId}
                      </u>
                    </PatientMetadata>
                  </Grid>
                </Grid>
              </Grid>
              <Grid item>
                <IconButton onClick={() => navigate('/visits')}>
                  <CloseIcon />
                </IconButton>
              </Grid>
            </Grid>
          </Grid>
          <Grid item xs={12} sx={{ mt: -2 }}>
            <Grid container alignItems="center" spacing={2}>
              <Grid item>
                <ProfileAvatar appointmentID={appointmentID} />
              </Grid>
              <Grid item xs>
                <PatientInfoWrapper>
                  <PatientName
                    data-testid={dataTestIds.cssHeader.patientName}
                    onClick={() => navigate(`/patient/${userId}`)}
                  >
                    {patientName}
                  </PatientName>
                  <PrintVisitLabelButton encounterId={encounterId} />
                  <PatientMetadata sx={{ fontWeight: 500 }}>{dob}</PatientMetadata> |
                  <PatientMetadata
                    noWrap
                    sx={{ fontWeight: chartData?.allergies?.length ? 700 : 400, maxWidth: '250px' }}
                  >
                    {allergies}
                  </PatientMetadata>
                </PatientInfoWrapper>
                <PatientInfoWrapper>
                  <PatientMetadata>{pronouns}</PatientMetadata> | <PatientMetadata>{gender}</PatientMetadata> |
                  <PatientMetadata>{language}</PatientMetadata> |<PatientMetadata>{reasonForVisit}</PatientMetadata>
                </PatientInfoWrapper>
              </Grid>
              <Grid
                item
                sx={{
                  '@media (max-width: 1179px)': {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5,
                  },
                }}
              >
                <SwitchIntakeModeButton
                  isDisabled={!appointmentID || isEncounterUpdatePending}
                  handleSwitchMode={handleSwitchMode}
                  nextMode={nextMode}
                />
                {encounterId ? <InternalNotes encounterId={encounterId} /> : null}
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Stack>
    </HeaderWrapper>
  );
};
