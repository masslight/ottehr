import { Button } from '@mui/material';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { intakeFlowPageRoute } from '../App';
import { PageContainer } from '../components';
import { PhoneNumberMessage, useVisitContext } from './ThankYou';

const CancellationConfirmation = (): JSX.Element => {
  const { appointmentData } = useVisitContext();
  const { t } = useTranslation();

  const selectedLocation = useMemo(() => {
    return appointmentData?.appointment?.location;
  }, [appointmentData?.appointment?.location]);

  useEffect(() => {
    window.history.pushState(null, document.title, window.location.href);
    window.addEventListener('popstate', handlePopstate);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('popstate', handlePopstate);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handlePopstate = (_event: any): void => {
    window.history.pushState(null, document.title, window.location.href);
  };

  const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
    event.preventDefault();
    event.returnValue = '';
  };

  return (
    <PageContainer
      title={t('emailComms.canceled.title')}
      description={<PhoneNumberMessage locationTelecom={selectedLocation?.telecom} />}
    >
      <Link to={intakeFlowPageRoute.Homepage.path} className="appointment-button">
        <Button variant="outlined" color="secondary" size="large" type="button">
          {t('emailComms.canceled.bookAgainButton')}
        </Button>
      </Link>
    </PageContainer>
  );
};

export default CancellationConfirmation;
