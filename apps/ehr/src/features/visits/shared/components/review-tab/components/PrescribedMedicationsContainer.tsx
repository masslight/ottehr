import { Box, Typography } from '@mui/material';
import { useQueries } from '@tanstack/react-query';
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

  const uniquePharmacyIds = [
    ...new Set((prescriptions ?? []).map((m) => m.pharmacyId).filter((id): id is string => !!id)),
  ];

  const pharmacyQueries = useQueries({
    queries: uniquePharmacyIds.map((pharmacyId) => ({
      queryKey: ['erx-pharmacy', pharmacyId],
      queryFn: () => oystehr!.erx.getPharmacy({ pharmacyId }),
      enabled: !!oystehr,
    })),
  });

  const pharmacyMap = new Map(uniquePharmacyIds.map((id, i) => [id, pharmacyQueries[i].data]));

  // Group prescriptions by pharmacyId
  const groups = new Map<string | undefined, typeof prescriptions>();
  for (const med of prescriptions ?? []) {
    const key = med.pharmacyId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(med);
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Prescriptions
      </Typography>
      {Array.from(groups.entries()).map(([pharmacyId, meds]) => {
        const pharmacy = pharmacyId ? pharmacyMap.get(pharmacyId) : undefined;
        return (
          <Box key={pharmacyId ?? 'no-pharmacy'} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {pharmacy && (
              <Typography>
                <Typography component="span" fontWeight={600}>
                  Pharmacy:{' '}
                </Typography>
                {[
                  pharmacy.name,
                  pharmacy.address1,
                  pharmacy.address2,
                  pharmacy.city,
                  pharmacy.state,
                  pharmacy.zipCode,
                  pharmacy.phone,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </Typography>
            )}
            {meds?.map((med) => <PrescribedMedicationReviewItem key={med.resourceId || med.name} medication={med} />)}
          </Box>
        );
      })}
    </Box>
  );
};
