import { Typography } from '@mui/material';
import { ottehrLightBlue } from '@theme/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generatePath, useNavigate } from 'react-router-dom';
import { PROJECT_NAME } from 'utils';
import { BOOKING_SLOT_ID_PARAM, intakeFlowPageRoute } from '../App';
import { PageContainer } from '../components';
import { ErrorDialog, ErrorDialogConfig } from '../components/ErrorDialog';
import PageForm from '../components/PageForm';
import { useBookingContext } from './BookingHome';

const NewUser = (): JSX.Element => {
  const navigate = useNavigate();
  const { slotId, patientInfo, setPatientInfo } = useBookingContext();
  const [errorConfig, setErrorConfig] = useState<ErrorDialogConfig | undefined>(undefined);
  const { t } = useTranslation();

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

    const path = generatePath(intakeFlowPageRoute.PatientInformation.path, {
      [BOOKING_SLOT_ID_PARAM]: slotId,
    });
    navigate(path);
  };

  return (
    <PageContainer
      title={t('newUser.title', { PROJECT_NAME })}
      img={ottehrLightBlue}
      imgAlt={`${PROJECT_NAME} icon`}
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
