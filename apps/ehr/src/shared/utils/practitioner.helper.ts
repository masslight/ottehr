import { Practitioner } from 'fhir/r4b';
import { getPractitionerNPIIdentifier } from 'utils';

export const getPractitionerMissingFields = (practitioner: Practitioner): string[] => {
  const missingFields: string[] = [];
  if (!practitioner) return [];
  if (!practitioner?.birthDate) {
    missingFields.push('birth date');
  }
  if (!practitioner?.telecom?.find((telecom) => telecom.system === 'phone')?.value) {
    missingFields.push('phone');
  }
  if (!practitioner?.telecom?.find((telecom) => telecom.system === 'fax')?.value) {
    missingFields.push('fax');
  }
  if (!practitioner?.address?.find((address) => address.line?.length)) {
    missingFields.push('Address line 1');
  }
  if (!practitioner?.address?.find((address) => address.city)) {
    missingFields.push('City');
  }
  if (!practitioner?.address?.find((address) => address.state)) {
    missingFields.push('State');
  }
  if (!practitioner?.address?.find((address) => address.postalCode)) {
    missingFields.push('Zip code');
  }
  if (!getPractitionerNPIIdentifier(practitioner)) {
    missingFields.push('NPI');
  }
  return missingFields;
};
