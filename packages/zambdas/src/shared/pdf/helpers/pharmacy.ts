import { ErxGetPharmacyResponse } from '@oystehr/sdk';
import { formatPhoneNumberDisplay, formatZipcodeForDisplay, PrescribedMedicationDTO } from 'utils';
import { pharmacyInfo } from '../types';

export const toPharmacyInfo = (pharmacy: ErxGetPharmacyResponse): pharmacyInfo => ({
  name: pharmacy.name,
  address: [
    pharmacy.address1,
    pharmacy.address2,
    pharmacy.city,
    pharmacy.state,
    pharmacy.zipCode ? formatZipcodeForDisplay(pharmacy.zipCode) : undefined,
  ]
    .filter(Boolean)
    .join(', '),
  phone: formatPhoneNumberDisplay(pharmacy.phone),
});

export const groupPrescriptionsByPharmacy = (
  meds: PrescribedMedicationDTO[],
  erxPharmacies?: Record<string, ErxGetPharmacyResponse>
): { pharmacy?: pharmacyInfo; meds: PrescribedMedicationDTO[] }[] => {
  const groups = new Map<string | undefined, PrescribedMedicationDTO[]>();
  for (const med of meds) {
    const key = med.pharmacyId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(med);
  }
  return Array.from(groups.entries()).map(([pharmacyId, groupMeds]) => ({
    pharmacy: pharmacyId && erxPharmacies?.[pharmacyId] ? toPharmacyInfo(erxPharmacies[pharmacyId]) : undefined,
    meds: groupMeds,
  }));
};
