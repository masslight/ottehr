import Oystehr from '@oystehr/sdk';
import type { Location } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';

export const findClinicalLocationByName = async (oystehr: Oystehr, name: string): Promise<Location | undefined> =>
  (
    await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [
        { name: 'name:exact', value: name },
        { name: '_tag:not', value: `${BILLING_RESOURCE_TAG.system}|${BILLING_RESOURCE_TAG.code}` },
        { name: '_count', value: '20' },
      ],
    })
  )
    .unbundle()
    .find((location) => location.name === name && location.status !== 'inactive');
