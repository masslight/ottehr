import { ErxGetPharmacyResponse } from '@oystehr/sdk';
import { formatPhoneNumberDisplay, formatZipcodeForDisplay } from 'utils/lib/helpers/helpers';
import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
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
  return Array.from(groups.entries()).map(([pharmacyId, groupMeds]) => {
    const looked = pharmacyId ? erxPharmacies?.[pharmacyId] : undefined;
    // The eRx lookup can fail (fetchErxPharmacies logs it); the name stored on the prescription still says where it went.
    const storedName = groupMeds.find((med) => med.pharmacyName)?.pharmacyName;
    const stored = pharmacyId && storedName ? { name: storedName, address: '', phone: '' } : undefined;
    return {
      pharmacy: looked ? toPharmacyInfo(looked) : stored,
      meds: groupMeds,
    };
  });
};
