import { Appointment, Encounter } from 'fhir/r4';
import { PUBLIC_EXTENSION_BASE_URL } from '../../fhir';
import { EncounterVirtualServiceExtension } from '../../types';

export const getVirtualServiceResourceExtension = (
  resource: Appointment | Encounter,
  code: 'twilio-video-group-rooms' | 'twilio-conversations'
): EncounterVirtualServiceExtension | null => {
  let resourcePrefix: string;
  if (resource.resourceType === 'Appointment') {
    resourcePrefix = 'appointment';
  } else if (resource.resourceType === 'Encounter') {
    resourcePrefix = 'encounter';
  } else {
    return null;
  }

  for (let index = 0; index < (resource.extension?.length ?? 0); index++) {
    const extension = resource.extension?.[index];
    if (extension?.url !== `${PUBLIC_EXTENSION_BASE_URL}/${resourcePrefix}-virtual-service-pre-release`) {
      continue;
    }
    for (let j = 0; j < (extension?.extension?.length ?? 0); j++) {
      const internalExtension = extension.extension?.[j];
      if (internalExtension?.url === 'channelType' && internalExtension?.valueCoding?.code === code) {
        return extension as EncounterVirtualServiceExtension;
      }
    }
  }
  return null;
};
