import { SearchOptionsFilters } from '../types';

/**
 * Generates all possible formatting variants for US phone numbers (+1)
 * @param {string} normalizedPhone - Phone number in format +1XXXXXXXXXX
 * @returns {string[]} Array of formatted phone number variants
 */
const generatePhoneVariants = (normalizedPhone: string): string[] => {
  // Check if it's a US number (+1 with 11 digits total)
  const digitsOnly = normalizedPhone.replace(/\D/g, '');

  // Only generate variants for +1 numbers (11 digits starting with 1)
  if (digitsOnly.length !== 11 || !digitsOnly.startsWith('1')) {
    return [normalizedPhone];
  }

  // Extract parts (US format: +1 XXX XXXXXXX)
  const areaCode = digitsOnly.substring(1, 4);
  const firstPart = digitsOnly.substring(4, 7);
  const lastPart = digitsOnly.substring(7);

  const localNumber = `${areaCode}${firstPart}${lastPart}`;

  const variants = [
    `+1${localNumber}`, // +11234567890 (E.164 - FHIR standard)
    localNumber, // 1234567890 (most common user input)
    `(${areaCode}) ${firstPart}-${lastPart}`, // (123) 456-7890 (most common display)
  ];

  return variants;
};

export const buildSearchQuery = (filter: Partial<SearchOptionsFilters>): string => {
  const baseUrl = 'r4/Patient';
  const params: string[] = [];

  if (filter.location && filter.location !== 'All') {
    params.push(`_has:Appointment:patient:actor:Location.name:contains=${encodeURIComponent(filter.location)}`);
  }
  params.push('_revinclude=Appointment:patient');
  params.push('_include:iterate=Appointment:actor:Location');

  if (filter.phone) {
    let completedPhone = filter.phone.replace(/\D/g, '');

    if (!completedPhone.startsWith('+')) {
      if (completedPhone.length === 10) {
        completedPhone = `+1${completedPhone}`;
      } else if (completedPhone.length === 11) {
        completedPhone = `+${completedPhone}`;
      }
    }

    const phoneVariants = generatePhoneVariants(completedPhone);

    const phoneConditions = phoneVariants
      .map((variant) => {
        const encoded = encodeURIComponent(variant);
        return `phone=${encoded},_has:RelatedPerson:patient:phone=${encoded},_has:RelatedPerson:patient:_has:Person:link:phone=${encoded}`;
      })
      .join(',');

    params.push(phoneConditions);
    params.push('_revinclude=RelatedPerson:patient');
    params.push('_revinclude:iterate=Person:link');
  }

  if (filter.lastName) {
    params.push(`family:contains=${encodeURIComponent(filter.lastName)}`);
  }
  if (filter.givenNames) {
    const names = filter.givenNames.replace(' ', ',');
    params.push(`given:contains=${encodeURIComponent(names)}`);
  }

  if (filter.status === 'Active') params.push('active=true');
  else if (filter.status === 'Deceased') params.push('deceased=true');
  else if (filter.status === 'Inactive') params.push('active=false');

  if (filter.address) {
    params.push(`address:contains=${encodeURIComponent(filter.address)}`);
  }

  if (filter.dob) params.push(`birthdate=${encodeURIComponent(filter.dob)}`);
  if (filter.email) params.push(`email=${encodeURIComponent(filter.email)}`);

  params.push('_total=accurate');

  return `${baseUrl}?${params.join('&')}`;
};
