import { Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generatePath, useNavigate, useParams } from 'react-router-dom';
import { ErrorDialog, ErrorDialogConfig, PageForm } from 'ui-components';
import { intakeFlowPageRoute } from '../App';
import { ottehrLightBlue } from '../assets/icons';
import { PageContainer } from '../components';
import { NO_LOCATION_ERROR, PROJECT_NAME } from '../helpers';
import { useTrackMixpanelEvents } from '../hooks/useTrackMixpanelEvents';
import { useBookingContext } from './Welcome';

const NewUser = (): JSX.Element => {
  const navigate = useNavigate();
  const { patientInfo, visitType, serviceType, selectedLocation, locationLoading, setPatientInfo } =
    useBookingContext();
  const [errorConfig, setErrorConfig] = useState<ErrorDialogConfig | undefined>(undefined);
  const { slug: slugParam } = useParams();
  const { t } = useTranslation();

  useEffect(() => {
    if (!visitType || (!selectedLocation && !locationLoading)) {
      setErrorConfig(NO_LOCATION_ERROR(t));
    }
  }, [visitType, selectedLocation, locationLoading, t]);

  useTrackMixpanelEvents({
    eventName: 'New User',
    visitType: visitType,
    bookingCity: selectedLocation?.address?.city,
    bookingState: selectedLocation?.address?.state,
  });

  const onSubmit = async (): Promise<void> => {
    if (!patientInfo) {
      setPatientInfo({
        id: undefined,
        newPatient: true,
        firstName: undefined,
        lastName: undefined,
        dobDay: undefined,
        dobMonth: undefined,
        dobYear: undefined,
        sex: undefined,
        reasonForVisit: undefined,
        email: undefined,
      });
    }

    console.log(`
      visit type and selected location extracted from store on new user page, ${visitType}, ${serviceType}, ${JSON.stringify(
        selectedLocation
      )}
    `);
    const path = generatePath(intakeFlowPageRoute.PatientInformation.path, {
      visit_type: visitType ?? null,
      service_mode: serviceType ?? null,
      slug: slugParam ?? null,
    });
    navigate(path);
  };

  return (
    <PageContainer
      title={t('newUser.title', { PROJECT_NAME })}
      img={ottehrLightBlue}
      imgAlt="ottehr icon"
      imgWidth={100}
    >
      <Typography variant="body1" className="user-description">
        {t('newUser.body')}
      </Typography>
      <PageForm onSubmit={onSubmit} controlButtons={{ backButton: false }} />
      <ErrorDialog
        open={errorConfig != undefined}
        title={errorConfig?.title ?? ''}
        description={errorConfig?.description ?? ''}
        closeButtonText={errorConfig?.closeButtonText ?? t('newUser.ok')}
        handleClose={() => {
          setErrorConfig(undefined);
        }}
      />
    </PageContainer>
  );
};

export default NewUser;
