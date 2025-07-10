import { Box, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { getQuestionnaireResponseByLinkId } from 'utils';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';
import { getPatientName } from '../../../../utils';
import { VisitNoteItem } from './VisitNoteItem';

export const PatientInformationContainer: FC = () => {
  const { patient, questionnaireResponse } = getSelectors(useAppointmentStore, ['patient', 'questionnaireResponse']);

  const patientName = getPatientName(patient?.name).lastFirstName;
  const dob = patient?.birthDate && DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy');
  const phone = getQuestionnaireResponseByLinkId('guardian-number', questionnaireResponse)?.answer?.[0]?.valueString;
  const accompanyingPerson = {
    firstName: getQuestionnaireResponseByLinkId('person-accompanying-minor-first-name', questionnaireResponse)
      ?.answer?.[0]?.valueString,
    lastName: getQuestionnaireResponseByLinkId('person-accompanying-minor-last-name', questionnaireResponse)
      ?.answer?.[0]?.valueString,
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Patient information
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <VisitNoteItem label="Patient name" value={patientName} />
        <VisitNoteItem label="Date of birth" value={dob} />
        {accompanyingPerson.firstName && accompanyingPerson.lastName && (
          <VisitNoteItem
            label="Person accompanying the minor patient"
            value={`${accompanyingPerson.lastName}, ${accompanyingPerson.firstName}`}
          />
        )}
        {phone && <VisitNoteItem label="Phone" value={phone} />}
      </Box>
    </Box>
  );
};
