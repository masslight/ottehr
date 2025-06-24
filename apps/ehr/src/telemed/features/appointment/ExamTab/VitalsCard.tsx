import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { AccordionCard } from '../../../components';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { useAppointmentStore } from '../../../state';
import { getValidationValuesByDOB, isEmptyValidation, isNumberValidation } from '../../../utils';
import { VitalsBloodPressure, VitalsComponent, VitalsTemperature } from './components';

export const VitalsCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('vitals');

  const { patient } = getSelectors(useAppointmentStore, ['patient']);

  const validationValues = getValidationValuesByDOB(patient!.birthDate!);

  return (
    <AccordionCard label="Vitals" collapsed={isCollapsed} onSwitch={onSwitch}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
        <Typography variant="subtitle1" fontSize={16} sx={{ whiteSpace: 'nowrap' }}>
          Patient provided:
        </Typography>
        <VitalsTemperature
          validate={(value) => {
            if (isEmptyValidation(value)) {
              return;
            }
            const isNotNumber = isNumberValidation(value);
            if (isNotNumber) {
              return isNotNumber;
            }
            if (+value > validationValues.temperature.high) {
              return 'Invalid temperature';
            }
            return;
          }}
        />
        <VitalsComponent
          name="vitals-pulse"
          label="Pulse Ox"
          validate={(value) => {
            if (isEmptyValidation(value)) {
              return;
            }
            const isNotNumber = isNumberValidation(value);
            if (isNotNumber) {
              return isNotNumber;
            }
            if (+value > validationValues.pulse.high) {
              return 'Invalid pulse';
            }
            return;
          }}
        />
        <VitalsComponent
          name="vitals-hr"
          label="HR"
          validate={(value) => {
            if (isEmptyValidation(value)) {
              return;
            }
            const isNotNumber = isNumberValidation(value);
            if (isNotNumber) {
              return isNotNumber;
            }
            if (+value > validationValues.hr.high) {
              return 'Invalid heart rate';
            }
            return;
          }}
        />
        <VitalsComponent
          name="vitals-rr"
          label="RR"
          validate={(value) => {
            if (isEmptyValidation(value)) {
              return;
            }
            const isNotNumber = isNumberValidation(value);
            if (isNotNumber) {
              return isNotNumber;
            }
            if (+value > validationValues.rr.high) {
              return 'Invalid respiration rate';
            }
            return;
          }}
        />
        <VitalsBloodPressure
          validate={(value) => {
            const [systolic, diastolic] = value.split('/');
            if (isEmptyValidation(systolic) && isEmptyValidation(diastolic)) {
              return;
            }
            const isNotNumberSystolic = isNumberValidation(systolic);
            const isNotNumberDiastolic = isNumberValidation(diastolic);
            if (isNotNumberSystolic) {
              return `Systolic ${isNotNumberSystolic}`;
            }
            if (isNotNumberDiastolic) {
              return `Diastolic ${isNotNumberDiastolic}`;
            }
            return;
          }}
        />
      </Box>
    </AccordionCard>
  );
};
