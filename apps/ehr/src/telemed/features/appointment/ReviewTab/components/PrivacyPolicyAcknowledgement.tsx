import { Typography } from '@mui/material';
import { FC } from 'react';
import { formatDateToMDYWithTime } from 'utils';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';

export const PrivacyPolicyAcknowledgement: FC = () => {
  const { appointment } = getSelectors(useAppointmentStore, ['appointment']);
  const appointmentStart = formatDateToMDYWithTime(appointment?.start);

  return (
    <Typography variant="body2" color="secondary.light">
      {`Privacy Policy and Terms and Conditions of Service were reviewed and accepted on ${appointmentStart}.`}
    </Typography>
  );
};
