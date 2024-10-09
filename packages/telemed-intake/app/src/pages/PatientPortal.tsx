import { Skeleton, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IntakeFlowPageRoute } from '../App';
import { otherColors } from '../IntakeThemeProvider';
import { useGetAppointments } from '../features/appointments';
import { CustomContainer, useIntakeCommonStore } from '../features/common';
import HomepageOption from '../features/homepage/HomepageOption';
import { useZapEHRAPIClient } from '../utils';
import { requestVisit, pastVisits, contactSupport } from '@theme/icons';
import { useGetPatients, usePatientsStore } from 'src/features/patients';

const PatientPortal = (): JSX.Element => {
  localStorage.removeItem('welcomePath');
  const apiClient = useZapEHRAPIClient();
  const { t } = useTranslation();

  const { data: appointmentsData, isFetching } = useGetAppointments(apiClient, Boolean(apiClient));

  const activeAppointment = appointmentsData?.appointments.find((appointment) =>
    ['ready', 'pre-video', 'on-video'].includes(appointment.telemedStatus),
  );

  const { data: patientsData } = useGetPatients(apiClient, (data) => {
    usePatientsStore.setState({ patients: data?.patients });
  });

  const isAppointmentStatusReady = Boolean(activeAppointment);

  const appointmentID = activeAppointment?.id || '';

  const handleContactSupport = (): void => {
    useIntakeCommonStore.setState({ supportDialogOpen: true });
  };

  return (
    <CustomContainer
      title={t('patientPortal.title')}
      description={t('patientPortal.description')}
      bgVariant={IntakeFlowPageRoute.PatientPortal.path}
      isFirstPage={true}
    >
      {isFetching ? (
        <Skeleton
          sx={{
            borderRadius: 2,
            backgroundColor: otherColors.coachingVisit,
            p: 10,
            mt: -4,
          }}
        />
      ) : (
        <>
          {isAppointmentStatusReady && (
            <Link
              to={`${IntakeFlowPageRoute.WaitingRoom.path}?appointment_id=${appointmentID}`}
              style={{ textDecoration: 'none', color: 'var(--text-primary)' }}
            >
              <HomepageOption
                title={t('patientPortal.returnToCall')}
                icon={requestVisit}
                subSlot={
                  <Typography
                    variant="overline"
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      backgroundColor: '#FFD271',
                      color: '#A67100',
                      borderRadius: 1,
                      px: 1,
                    }}
                  >
                    {t('patientPortal.activeCall')}
                  </Typography>
                }
              />
            </Link>
          )}

          <Link
            to={IntakeFlowPageRoute.ScheduleSelect.path}
            style={{ textDecoration: 'none', color: 'var(--text-primary)' }}
          >
            <HomepageOption title={t('patientPortal.requestVisit')} icon={requestVisit} />
          </Link>

          {patientsData?.patients?.length && (
            <Link
              to={`${IntakeFlowPageRoute.SelectPatient.path}?flow=pastVisits`}
              style={{ textDecoration: 'none', color: 'var(--text-primary)' }}
            >
              <HomepageOption
                title={t('patientPortal.pastVisits')}
                icon={pastVisits}
                subtitle={t('patientPortal.pastVisitsSubtitle')}
              />
            </Link>
          )}
        </>
      )}
      <HomepageOption
        title={t('patientPortal.contactSupport')}
        icon={contactSupport}
        handleClick={handleContactSupport}
      />
    </CustomContainer>
  );
};

export default PatientPortal;
