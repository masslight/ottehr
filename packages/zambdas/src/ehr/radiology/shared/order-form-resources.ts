import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, Location, Observation, Patient, Practitioner, ServiceRequest } from 'fhir/r4b';
import { TIMEZONE_EXTENSION_URL } from 'utils';
import { RadiologyOrderFormInput } from '../../../shared/pdf/radiology-order-form-pdf';
import { fetchServiceCategoryCatalog } from '../../../shared/pdf/service-category-catalog';

export interface RadiologyOrderFormResources {
  input: RadiologyOrderFormInput;
  refs: { patientId: string; encounterId: string; serviceRequestId: string };
}

/**
 * Fetches every resource the radiology order-form PDF needs and shapes them into the composer input.
 * Shared by the get-order-pdf and send-fax zambdas so they build identical documents.
 */
export const gatherRadiologyOrderFormInput = async (
  serviceRequestId: string,
  oystehr: Oystehr
): Promise<RadiologyOrderFormResources> => {
  const serviceRequest = await oystehr.fhir.get<ServiceRequest>({
    resourceType: 'ServiceRequest',
    id: serviceRequestId,
  });

  const patientId = serviceRequest.subject?.reference?.split('/')[1];
  const encounterId = serviceRequest.encounter?.reference?.split('/')[1];
  const practitionerId = serviceRequest.requester?.reference?.split('/')[1];
  if (!patientId || !encounterId) {
    throw new Error('ServiceRequest is missing subject or encounter reference');
  }

  const encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId });
  const appointmentId = encounter.appointment?.[0]?.reference?.split('/')[1];
  const locationId = encounter.location?.[0]?.location?.reference?.split('/')[1];

  const [patient, practitioner, appointment, location, serviceCategories, weight] = await Promise.all([
    oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId }),
    practitionerId
      ? oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: practitionerId })
      : Promise.resolve(undefined),
    appointmentId
      ? oystehr.fhir.get<Appointment>({ resourceType: 'Appointment', id: appointmentId })
      : Promise.resolve(undefined),
    locationId ? oystehr.fhir.get<Location>({ resourceType: 'Location', id: locationId }) : Promise.resolve(undefined),
    fetchServiceCategoryCatalog(oystehr),
    fetchLatestWeight(encounterId, oystehr),
  ]);

  const timezone =
    location?.extension?.find((ext) => ext.url === TIMEZONE_EXTENSION_URL)?.valueString ?? 'America/New_York';

  return {
    input: {
      serviceRequest,
      patient,
      practitioner,
      appointment,
      location,
      timezone,
      serviceCategories,
      weight,
      oystehr,
    },
    refs: { patientId, encounterId, serviceRequestId },
  };
};

const fetchLatestWeight = async (
  encounterId: string,
  oystehr: Oystehr
): Promise<{ value: number; unit: string } | undefined> => {
  const observations = (
    await oystehr.fhir.search<Observation>({
      resourceType: 'Observation',
      params: [
        { name: 'encounter', value: `Encounter/${encounterId}` },
        { name: 'code', value: 'http://loinc.org|29463-7' },
        { name: '_sort', value: '-date' },
        { name: '_count', value: '1' },
      ],
    })
  ).unbundle();

  const quantity = observations[0]?.valueQuantity;
  if (quantity?.value == null) {
    return undefined;
  }
  return { value: quantity.value, unit: quantity.unit ?? 'kg' };
};
