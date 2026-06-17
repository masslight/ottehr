import locationsConfig from '../../../config/oystehr/locations-and-schedules.json' assert { type: 'json' };

const VIRTUAL_LOCATION_EXTENSION_URL = 'https://extensions.fhir.zapehr.com/location-form-pre-release';

function getIsTelemedEnabled(): boolean {
  const fhirResources = (locationsConfig as { fhirResources?: Record<string, any> })?.fhirResources;

  if (!fhirResources) {
    return false;
  }

  // Check if any location has the virtual location extension
  for (const item of Object.values(fhirResources)) {
    const location = item?.resource;
    if (
      location?.resourceType === 'Location' &&
      location?.extension?.some(
        (ext: any) => ext.url === VIRTUAL_LOCATION_EXTENSION_URL && ext.valueCoding?.code === 'vi'
      )
    ) {
      return true;
    }
  }

  return false;
}

export const isTelemedEnabled = getIsTelemedEnabled();
