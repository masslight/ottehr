import { FC, ReactElement } from 'react';
import { Box, Stack, Typography, useTheme } from '@mui/material';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';
import { DateTime } from 'luxon';

export const ProceduresContainer: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);
  const theme = useTheme();
  const procedures = chartData?.procedures;

  const renderProperty = (label: string, value: string | undefined): ReactElement | undefined => {
    if (value == null) {
      return undefined;
    }
    return (
      <Box>
        <Typography display="inline" sx={{ fontWeight: '500' }}>
          {label}:
        </Typography>{' '}
        {value}
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Procedures
      </Typography>
      {procedures?.length ? (
        procedures.map((procedure) => (
          <Stack key={procedure.resourceId}>
            <Typography sx={{ color: '#0F347C', fontWeight: '500' }}>{procedure.procedureType}</Typography>
            {renderProperty('CPT', procedure.cptCodes.map((cptCode) => cptCode.display).join('; '))}
            {renderProperty('Dx', procedure.diagnoses.map((diagnosis) => diagnosis.display).join('; '))}
            {renderProperty(
              'Date and time of the procedure',
              DateTime.fromISO(procedure.procedureDateTime).toFormat('MM/dd/yyyy, HH:mm a')
            )}
            {renderProperty('Performed by', procedure.performerType)}
            {renderProperty('Anaesthesia / medication used', procedure.medicationUsed)}
            {renderProperty('Site/location', procedure.bodySite)}
            {renderProperty('Side of body', procedure.bodySide)}
            {renderProperty('Technique', procedure.technique)}
            {renderProperty('Instruments / supplies used', procedure.suppliesUsed)}
            {renderProperty('Procedure details', procedure.procedureDetails)}
            {renderProperty(
              'Specimen sent',
              procedure.specimenSent != null ? (procedure.specimenSent ? 'Yes' : 'No') : undefined
            )}
            {renderProperty('Complications', procedure.complications)}
            {renderProperty('Patient response', procedure.patientResponse)}
            {renderProperty('Post-procedure instructions', procedure.postInstructions)}
            {renderProperty('Time spent', procedure.timeSpent)}
            {renderProperty('Documented by', procedure.documentedBy)}
          </Stack>
        ))
      ) : (
        <Typography color={theme.palette.text.secondary}>No procedures</Typography>
      )}
    </Box>
  );
};
