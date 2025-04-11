import { Stack, Typography } from '@mui/material';
import { FC } from 'react';
import { getProviderNameWithProfession, getQuestionnaireResponseByLinkId, getSelectors } from 'utils';
import { formatDateUsingSlashes } from '../../../../helpers/formatDateTime';
import { ActionsList, useAppointmentStore } from '../../../../telemed';
import { VisitNoteItem } from '../../../../telemed/features/appointment/ReviewTab';

export const VisitDetailsContainer: FC = () => {
  const { appointment, practitioner, location, questionnaireResponse } = getSelectors(useAppointmentStore, [
    'appointment',
    'practitioner',
    'location',
    'questionnaireResponse',
  ]);

  const insuranceCompanyID = getQuestionnaireResponseByLinkId('insurance-carrier', questionnaireResponse)?.answer?.[0]
    .valueString;
  const subscriberID = getQuestionnaireResponseByLinkId('insurance-member-id', questionnaireResponse)?.answer?.[0]
    .valueString;
  const date = formatDateUsingSlashes(appointment?.start);
  const provider = practitioner && getProviderNameWithProfession(practitioner);
  const facility = location?.name;

  return (
    <Stack spacing={2}>
      <Typography fontSize={18} color="primary.dark" fontWeight={600}>
        Visit Details
      </Typography>

      <ActionsList
        data={[
          { label: 'Primary Insurance', value: insuranceCompanyID },
          { label: 'Subscriber ID', value: subscriberID },
          { label: 'Encounter Date', value: date },
          { label: 'Provider', value: provider },
          { label: 'Appointment Facility', value: facility },
        ]}
        getKey={(item) => item.label}
        renderItem={(item) => (
          <Stack width="100%">
            <VisitNoteItem label={item.label} value={item.value} noMaxWidth />
          </Stack>
        )}
        gap={0.75}
        divider
      />
    </Stack>
  );
};
