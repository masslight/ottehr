import { Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PatientInfo, yupDateTransform } from 'utils';
import { useGetFullName } from '../../../hooks/useGetFullName';
import { otherColors } from '../../../IntakeThemeProvider';
import i18n from '../../../lib/i18n';

export const PatientInformationKnownPatientFieldsDisplay = ({
  patientInfo,
  unconfirmedDateOfBirth,
  selectPatientPageUrl,
}: {
  patientInfo: PatientInfo;
  unconfirmedDateOfBirth?: string;
  selectPatientPageUrl: string;
}): JSX.Element => {
  const patientFullName = useGetFullName(patientInfo);
  const formattedBirthday = DateTime.fromFormat(
    yupDateTransform(unconfirmedDateOfBirth ?? patientInfo.dateOfBirth),
    'yyyy-MM-dd'
  )
    .setLocale(i18n.language)
    .toFormat('MMMM dd, yyyy');
  const { t } = useTranslation();

  return (
    <>
      <Typography variant="h3" color="secondary.main">
        {patientFullName}
      </Typography>
      <Typography variant="body2" sx={{ fontSize: '14px' }} color="secondary.main">
        {t('aboutPatient.birthdayLabel')} {formattedBirthday}
      </Typography>
      <Typography variant="body1" color={otherColors.wrongPatient} marginTop={2} marginBottom={4}>
        {t('aboutPatient.wrongPatient.body1')}{' '}
        <Link style={{ color: otherColors.wrongPatient }} to={selectPatientPageUrl}>
          {t('aboutPatient.wrongPatient.body2')}
        </Link>{' '}
        {t('aboutPatient.wrongPatient.body3')}
      </Typography>
    </>
  );
};
