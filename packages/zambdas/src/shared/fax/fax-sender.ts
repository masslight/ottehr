import Oystehr from '@oystehr/sdk';
import { Organization } from 'fhir/r4b';
import { getAddressString, TIMEZONE_EXTENSION_URL, TIMEZONES } from 'utils';
import { FaxSender } from './fax-cover-page';

export interface ResolvedFaxSender {
  sender: FaxSender;
  /** Timezone the practice keeps; used to stamp faxes that don't belong to a single visit. */
  timezone: string;
}

/**
 * The "From" block of the cover sheet, read from the configured Organization. Contact details are
 * cosmetic, so a missing Organization degrades to the sender's name only rather than failing the fax.
 */
export const resolveFaxSender = async (
  oystehr: Oystehr,
  organizationId: string,
  senderName: string | undefined
): Promise<ResolvedFaxSender> => {
  let organization: Organization | undefined;
  try {
    organization = await oystehr.fhir.get<Organization>({ resourceType: 'Organization', id: organizationId });
  } catch (error) {
    console.error(`Could not load Organization/${organizationId} for the fax cover page: ${String(error)}`);
  }

  return {
    sender: {
      organizationName: organization?.name ?? '',
      address: getAddressString(organization?.address?.[0]) || undefined,
      faxNumber: findTelecom(organization, 'fax'),
      phoneNumber: findTelecom(organization, 'phone'),
      senderName,
    },
    timezone: findTimezone(organization) ?? TIMEZONES[0],
  };
};

const findTelecom = (organization: Organization | undefined, system: 'fax' | 'phone'): string | undefined =>
  organization?.telecom?.find((telecom) => telecom.system === system)?.value;

/** Same standard timezone extension the schedule-owning resources carry. */
const findTimezone = (organization: Organization | undefined): string | undefined =>
  organization?.extension?.find((extension) => extension.url === TIMEZONE_EXTENSION_URL)?.valueString;
