import { Box, Typography } from '@mui/material';
import React, { FC, useMemo } from 'react';
import {
  formatDateTimeToEDT,
  getProviderNameWithProfession,
  getQuestionnaireResponseByLinkId,
  mapEncounterStatusHistory,
} from 'utils';
import { PatientInfoConfirmedCheckbox } from './PatientInfoConfirmedCheckbox';
import { VisitNoteItem } from './VisitNoteItem';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore, useGetInsurancePlan } from '../../../../state';

export const VisitDetailsContainer: FC = () => {
  const { appointment, practitioner, location, encounter, questionnaireResponse, reviewAndSignData } = getSelectors(
    useAppointmentStore,
    ['appointment', 'practitioner', 'location', 'encounter', 'questionnaireResponse', 'reviewAndSignData']
  );

  const state = location?.address?.state;
  const provider = practitioner ? getProviderNameWithProfession(practitioner) : '';

  const address = getQuestionnaireResponseByLinkId('patient-street-address', questionnaireResponse)?.answer?.[0]
    .valueString;

  const statuses = useMemo(
    () =>
      encounter.statusHistory && appointment?.status
        ? mapEncounterStatusHistory(encounter.statusHistory, appointment.status)
        : undefined,
    [encounter.statusHistory, appointment?.status]
  );
  const dateOfService = formatDateTimeToEDT(statuses?.find((item) => item.status === 'on-video')?.start);
  const signedOnDate = formatDateTimeToEDT(reviewAndSignData?.signedOnDate);

  const insuranceCompanyID = getQuestionnaireResponseByLinkId('insurance-carrier', questionnaireResponse)?.answer?.[0]
    .valueString;

  const { data: insuranceCompany } = useGetInsurancePlan({
    id: insuranceCompanyID,
  });

  const subscriberID = getQuestionnaireResponseByLinkId('insurance-member-id', questionnaireResponse)?.answer?.[0]
    .valueString;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Visit Details
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <VisitNoteItem label="Date of Service" value={dateOfService} />
        <VisitNoteItem label="Reason for Visit" value={appointment?.description ?? ''} />
        <VisitNoteItem label="Provider" value={provider} />
        <VisitNoteItem label="Signed On" value={signedOnDate} />
        <VisitNoteItem label="Visit ID" value={appointment?.id} />
        <VisitNoteItem label="Visit State" value={state} />
        {insuranceCompanyID && (
          <>
            <VisitNoteItem label="Insurance Company" value={insuranceCompany?.name} />
            <VisitNoteItem label="Subscriber ID" value={subscriberID} />
          </>
        )}
      </Box>
      <PatientInfoConfirmedCheckbox />
      <Typography variant="body2">Address: {address}</Typography>
    </Box>
  );
};
