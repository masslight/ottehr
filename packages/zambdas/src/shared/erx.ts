import Oystehr, { ErxGetPharmacyResponse } from '@oystehr/sdk';
import { PrescribedMedicationDTO } from 'utils';

export const fetchErxPharmacies = async (
  oystehr: Oystehr,
  prescriptions: PrescribedMedicationDTO[] | undefined
): Promise<Record<string, ErxGetPharmacyResponse>> => {
  const uniquePharmacyIds = [
    ...new Set((prescriptions ?? []).map((prescription) => prescription.pharmacyId).filter((id): id is string => !!id)),
  ];
  const erxPharmacies: Record<string, ErxGetPharmacyResponse> = {};
  await Promise.all(
    uniquePharmacyIds.map(async (id) => {
      try {
        erxPharmacies[id] = await oystehr.erx.getPharmacy({ pharmacyId: id });
      } catch (e) {
        console.error('Failed to fetch eRx pharmacy:', e);
      }
    })
  );
  return erxPharmacies;
};
