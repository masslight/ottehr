import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { getQuestionnaireResponseByLinkId } from 'utils';
import useEvolveUser from '../../../hooks/useEvolveUser';
import { getSelectors } from '../../../shared/store/getSelectors';
import { ReminderIcon } from '../../assets';
import { InnerStatePopover } from '../../components';
import { useGetAppointmentAccessibility } from '../../hooks';
import { useAppointmentStore } from '../../state';

export const VideoProviderReminderPopover: FC = () => {
  const { licensedPractitionerStates: availableStates } = useGetAppointmentAccessibility();
  const { questionnaireResponse } = getSelectors(useAppointmentStore, ['questionnaireResponse']);
  const user = useEvolveUser();

  const providerName = user?.userName || '___';
  const states = availableStates && availableStates.length > 0 ? availableStates.join(', ') : '___';
  const address =
    getQuestionnaireResponseByLinkId('patient-street-address', questionnaireResponse)?.answer?.[0]?.valueString ||
    '___';

  return (
    <InnerStatePopover
      popoverChildren={
        <Box sx={{ p: 2, maxWidth: '330px' }}>
          <Typography fontWeight={500}>Provider reminder</Typography>
          <Typography>
            Please confirm the patient's name, DOB, and introduce yourself with your licensure and credentials (e.g. My
            name is Dr. {providerName} and I am licensed in {states} and board certified in pediatrics). For patients
            located in NJ you must also confirm their address, the address for this patient is: {address}
          </Typography>
        </Box>
      }
      popoverProps={{ sx: undefined }}
    >
      {({ handlePopoverOpen }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }} onClick={handlePopoverOpen}>
          <ReminderIcon fontSize="small" />
          <Typography variant="body2" fontWeight={500}>
            Reminder
          </Typography>
        </Box>
      )}
    </InnerStatePopover>
  );
};
