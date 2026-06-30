import { Box, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { FC } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import { useChartFields } from '../../../hooks/useChartFields';
import { PrescribedMedicationReviewItem } from './PrescribedMedicationReviewItem';

export const PrescribedMedicationsContainer: FC = () => {
  const { oystehr } = useApiClients();
  const { data: chartFields } = useChartFields({
    requestedFields: { prescribedMedications: {} },
  });

  const prescriptions = chartFields?.prescribedMedications;
  const pharmacyId = prescriptions?.find((m) => m.pharmacyId)?.pharmacyId;

  const { data: dispensingPharmacy } = useQuery({
    queryKey: ['erx-pharmacy', pharmacyId],
    queryFn: () => oystehr!.erx.getPharmacy({ pharmacyId: pharmacyId! }),
    enabled: !!oystehr && !!pharmacyId,
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Prescriptions
      </Typography>
      {dispensingPharmacy && (
        <Typography>
          <Typography component="span" fontWeight={600}>
            Pharmacy:{' '}
          </Typography>
          {[
            dispensingPharmacy.name,
            dispensingPharmacy.address1,
            dispensingPharmacy.address2,
            dispensingPharmacy.city,
            dispensingPharmacy.state,
            dispensingPharmacy.zipCode,
            dispensingPharmacy.phone,
          ]
            .filter(Boolean)
            .join(', ')}
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {prescriptions?.map((med) => (
          <PrescribedMedicationReviewItem medication={med} key={med.resourceId || med.name} />
        ))}
      </Box>
    </Box>
  );
};
