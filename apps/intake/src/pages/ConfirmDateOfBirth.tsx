import { Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { PageContainer } from '../components';
import ConfirmDateOfBirthForm from '../components/ConfirmDateOfBirthForm';
import { useNavigateInFlow } from '../hooks/useNavigateInFlow';
import { useBookingContext } from './BookingHome';

const ConfirmDateOfBirth = (): JSX.Element => {
  const { patientInfo, unconfirmedDateOfBirth, setUnconfirmedDateOfBirth } = useBookingContext();
  const navigateInFlow = useNavigateInFlow();
  const { t } = useTranslation();

  const handleContinueAnywaySubmit = (): void => {
    navigateInFlow('patient-information');
  };

  return (
    <PageContainer
      title={`${t('paperwork.confirmPatient.confirm')} ${
        patientInfo?.firstName ? `${patientInfo?.firstName}'s` : t('paperwork.confirmPatient.unknownPatient')
      } ${t('paperwork.confirmPatient.dob')}`}
    >
      <ConfirmDateOfBirthForm
        patientInfo={patientInfo}
        defaultValue={unconfirmedDateOfBirth}
        required={true}
        onConfirmedSubmit={async () => {
          // in case the user initially set the wrong birthday, but then clicked 'back' and fixed it
          setUnconfirmedDateOfBirth(undefined);
          navigateInFlow('patient-information');
        }}
        onUnconfirmedSubmit={(unconfirmedDateOfBirth: string) => {
          setUnconfirmedDateOfBirth(unconfirmedDateOfBirth);
        }}
        wrongDateOfBirthModal={{
          buttonText: t('confirmDob.notConfirmed.continue'),
          message: <Typography marginTop={2}>{t('confirmDob.notConfirmed.body3')}</Typography>,
          onSubmit: handleContinueAnywaySubmit,
        }}
      />
    </PageContainer>
  );
};

export default ConfirmDateOfBirth;
