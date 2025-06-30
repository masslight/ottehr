import { Box, Typography } from '@mui/material';
import React, { useLayoutEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMedicationManagement } from '../../../hooks/useMedicationManagement';
import { EditableMedicationCard } from '../medication-editable-card/EditableMedicationCard';
import { MedicationWarnings } from './MedicationWarnings';

export const MedicationList: React.FC = () => {
  const { medications } = useMedicationManagement();
  // const selectsOptions = useFieldsSelectsOptions();
  const [searchParams] = useSearchParams();
  const scrollTo = searchParams.get('scrollTo');

  const pendingMedications = useMemo(() => {
    return medications.filter((medication) => medication.status === 'pending');
  }, [medications]);

  useLayoutEffect(() => {
    if (scrollTo && pendingMedications.length > 0) {
      requestAnimationFrame(() => {
        const element = document.getElementById(`medication-${scrollTo}`);
        element?.scrollIntoView?.({ behavior: 'auto', block: 'start', inline: 'nearest' });

        const url = new URL(window.location.href);
        url.searchParams.delete('scrollTo');
        window.history.replaceState({}, '', url.toString());
      });
    }
  }, [scrollTo, pendingMedications]);

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
