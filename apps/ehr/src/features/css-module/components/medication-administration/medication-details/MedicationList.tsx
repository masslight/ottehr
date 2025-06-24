import { Box, Typography } from '@mui/material';
import React, { useMemo } from 'react';
import { useMedicationManagement } from '../../../hooks/useMedicationManagement';
import { EditableMedicationCard } from '../medication-editable-card/EditableMedicationCard';
import { MedicationWarnings } from './MedicationWarnings';

export const MedicationList: React.FC = () => {
  const { medications } = useMedicationManagement();
  // const selectsOptions = useFieldsSelectsOptions();

  const pendingMedications = useMemo(() => {
    return medications.filter((medication) => medication.status === 'pending');
  }, [medications]);

  if (medications.length === 0) {
    return <Typography>No medications found.</Typography>;
  }

  return (
    <Box>
      <MedicationWarnings />
      {pendingMedications.map((medication) => (
        <Box
          sx={{
            scrollMarginTop: '48px', // used for correct positioning on scrollIntoView to prevent table header overflow top card content
          }}
          key={medication.id}
          id={`medication-${medication.id}`}
        >
          <EditableMedicationCard medication={medication} type="dispense" />
        </Box>
      ))}
    </Box>
  );
};
