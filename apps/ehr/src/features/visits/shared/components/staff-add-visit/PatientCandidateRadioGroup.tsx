import { Box, FormControlLabel, Radio, RadioGroup, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { AddVisitPatientInfo } from 'src/pages/AddPatient';

export const getFullNameFromPatientInfo = (patient: AddVisitPatientInfo): string =>
  `${patient.firstName}${patient.middleName ? ` ${patient.middleName}` : ''} ${patient.lastName}`;

interface PatientCandidateRadioGroupProps {
  patients: AddVisitPatientInfo[];
  value: string;
  onChange: (patientId: string) => void;
  getOptionState?: (patient: AddVisitPatientInfo) => { disabled?: boolean; note?: string };
}

export const PatientCandidateRadioGroup: FC<PatientCandidateRadioGroupProps> = ({
  patients,
  value,
  onChange,
  getOptionState,
}) => (
  <RadioGroup value={value} onChange={(e) => onChange(e.target.value)}>
    {patients.map((patient) => {
      const details = [
        patient.dateOfBirth ? `DOB: ${DateTime.fromISO(patient.dateOfBirth).toFormat('MMMM dd, yyyy')}` : undefined,
        patient.sex ? `Sex: ${patient.sex}` : undefined,
        patient.phoneNumber ? `Phone: ${patient.phoneNumber}` : undefined,
      ].filter(Boolean);
      const { disabled, note } = getOptionState?.(patient) ?? {};
      return (
        <FormControlLabel
          key={patient.id}
          value={patient.id ?? ''}
          control={<Radio />}
          disabled={disabled}
          sx={{ alignItems: 'flex-start', marginY: 0.5 }}
          label={
            <Box>
              <Typography variant="body1" fontWeight={600}>
                {getFullNameFromPatientInfo(patient)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {details.join(' · ')}
              </Typography>
              {note && (
                <Typography variant="body2" color="error">
                  {note}
                </Typography>
              )}
            </Box>
          }
        />
      );
    })}
  </RadioGroup>
);
