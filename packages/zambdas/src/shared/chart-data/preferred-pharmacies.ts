import { Patient, QuestionnaireResponse } from 'fhir/r4b';
import { PharmacyDTO } from 'utils/lib/types/api/chart-data/chart-data.types';

/**
 * The patient's preferred pharmacies are the Organizations contained in the Patient; the one the
 * intake paperwork named (by name, address or phone) is marked primary.
 */
export function makePreferredPharmacies(
  patient: Patient | undefined,
  questionnaireResponse: QuestionnaireResponse | undefined
): PharmacyDTO[] {
  const pharmacies: PharmacyDTO[] = (patient?.contained ?? [])
    .filter((r) => r.resourceType === 'Organization')
    .map((org) => ({
      name: org.name || '',
      address: org.address?.[0]?.text || '',
      phone: org.telecom?.find((t) => t.system === 'phone')?.value,
    }));

  if (questionnaireResponse) {
    const getAnswer = (linkId: string): string | undefined =>
      questionnaireResponse.item?.find((i) => i.linkId === linkId)?.answer?.[0]?.valueString;

    const qrName = getAnswer('pharmacy-name');
    const qrAddress = getAnswer('pharmacy-address');
    const qrPhone = getAnswer('pharmacy-phone');

    pharmacies.forEach((ph) => {
      if (
        (qrName && ph.name?.toLowerCase() === qrName.toLowerCase()) ||
        (qrAddress && ph.address?.toLowerCase().includes(qrAddress.toLowerCase())) ||
        (qrPhone && ph.phone === qrPhone)
      ) {
        ph.primary = true;
      }
    });
  }

  return pharmacies;
}
