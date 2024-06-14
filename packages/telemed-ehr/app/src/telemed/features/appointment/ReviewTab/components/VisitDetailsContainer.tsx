import React, { FC } from 'react';
import { Box, Typography } from '@mui/material';
import { VisitNoteItem } from './VisitNoteItem';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';
import { getQuestionnaireResponseByLinkId, mapEncounterStatusHistory } from 'ehr-utils';
import useOttehrUser from '../../../../../hooks/useOttehrUser';
import { DateTime } from 'luxon';
import { PatientInfoConfirmedCheckbox } from './PatientInfoConfirmedCheckbox';

export const VisitDetailsContainer: FC = () => {
  const { appointment, location, encounter, questionnaireResponse } = getSelectors(useAppointmentStore, [
    'appointment',
    'location',
    'encounter',
    'questionnaireResponse',
  ]);
  const user = useOttehrUser();

  const reasonForVisit = getQuestionnaireResponseByLinkId('reason-for-visit', questionnaireResponse)?.answer?.[0]
    .valueString;
  const state = location?.address?.state;
  const provider = [
    user?.userName ? [user.userName.split(' ').reverse().join(', ')] : [],
    ...(user?.profileResource?.name?.[0]?.suffix ? [user?.profileResource.name[0].suffix.join(' ')] : []),
  ].join(' | ');
  const address = getQuestionnaireResponseByLinkId('patient-street-address', questionnaireResponse)?.answer?.[0]
    .valueString;

  const statuses =
    encounter.statusHistory && appointment?.status
      ? mapEncounterStatusHistory(encounter.statusHistory, appointment.status)
      : undefined;
  const status = statuses?.find((item) => item.status === 'on-video')?.start;
  const dateOfService = status
    ? `${DateTime.fromISO(status)
        .setZone('America/New_York')
        .toLocaleString(DateTime.DATETIME_SHORT, { locale: 'en-US' })} (EDT)`
    : undefined;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Visit Details
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <VisitNoteItem label="Date of Service" value={dateOfService} />
        <VisitNoteItem label="Reason for Visit" value={reasonForVisit} />
        <VisitNoteItem label="Provider Signed On" value={provider} />
        <VisitNoteItem label="VID" value={appointment?.id} />
        <VisitNoteItem label="Visit State" value={state} />
        <VisitNoteItem label="Insurance Company Subscriber ID" />
      </Box>
      <PatientInfoConfirmedCheckbox />
      <Typography variant="body2">Address: {address}</Typography>
    </Box>
  );
};
