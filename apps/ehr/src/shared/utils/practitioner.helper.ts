import { Practitioner } from 'fhir/r4b';
import { getNPIIdentifier } from 'utils/lib/fhir/patient';
import { isValidErxPhoneNumber } from 'utils/lib/helpers/helpers';

export const getPractitionerMissingFields = (practitioner: Practitioner): string[] => {
  const missingFields: string[] = [];
  if (!practitioner) return [];
  if (!practitioner?.birthDate) {
    missingFields.push('birth date');
  }
  const phone = practitioner.telecom?.find((telecom) => telecom.system === 'phone')?.value;
  if (!isValidErxPhoneNumber(phone)) {
    missingFields.push(phone ? 'valid phone' : 'phone');
  }
  const fax = practitioner.telecom?.find((telecom) => telecom.system === 'fax')?.value;
  if (!isValidErxPhoneNumber(fax)) {
    missingFields.push(fax ? 'valid fax' : 'fax');
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
  if (!getNPIIdentifier(practitioner)) {
    missingFields.push('NPI');
  }
  return missingFields;
};
