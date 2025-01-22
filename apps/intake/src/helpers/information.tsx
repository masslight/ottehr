import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const useAppointmentNotFoundInformation = (): JSX.Element => {
  const { t } = useTranslation();

  return (
    <>
      {t('paperwork.errors.notFoundDescription')}
      <br />
      <br />
      <Link to="/">{t('paperwork.errors.notFoundLink1')}</Link>&nbsp;{t('paperwork.errors.notFoundLink2')}
    </>
  );
};

export default useAppointmentNotFoundInformation;
