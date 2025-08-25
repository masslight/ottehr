import { Typography } from '@mui/material';
import { FC, useMemo } from 'react';
import { formatDateToMDYWithTime } from 'utils';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';

export const PrivacyPolicyAcknowledgement: FC = () => {
  const { appointment } = getSelectors(useAppointmentStore, ['appointment']);
  const appointmentStart = useMemo(() => formatDateToMDYWithTime(appointment?.start), [appointment?.start]);

  return (
    <Typography variant="body2" color="secondary.light">
      {`Privacy Policy and Terms and Conditions of Service were reviewed and accepted on ${appointmentStart?.date} at ${appointmentStart?.time}.`}
    </Typography>
  );
};
