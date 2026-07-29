import Oystehr from '@oystehr/sdk';
import { DocumentReference, Encounter, Location, Observation, Patient, Practitioner, ServiceRequest } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { Secrets, TIMEZONE_EXTENSION_URL } from 'utils';
import {
  createRadiologyOrderFormPDF,
  RADIOLOGY_ORDER_FORM_DOC_REF_DOCTYPE,
  RadiologyOrderFormInput,
} from '../../../shared/pdf/radiology-order-form-pdf';

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
  const locationId = encounter.location?.[0]?.location?.reference?.split('/')[1];

  const [patient, practitioner, location, weight] = await Promise.all([
    oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId }),
    practitionerId
      ? oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: practitionerId })
      : Promise.resolve(undefined),
    locationId ? oystehr.fhir.get<Location>({ resourceType: 'Location', id: locationId }) : Promise.resolve(undefined),
    fetchLatestWeight(encounterId, oystehr),
  ]);

  const timezone =
    location?.extension?.find((ext) => ext.url === TIMEZONE_EXTENSION_URL)?.valueString ?? 'America/New_York';

  return {
    input: { serviceRequest, patient, practitioner, location, timezone, weight, oystehr },
    refs: { patientId, encounterId, serviceRequestId },
  };
};

/** The order form on file that has not been superseded; at most one exists. */
export const findCurrentRadiologyOrderFormDocRef = async (
  serviceRequestId: string,
  oystehr: Oystehr
): Promise<DocumentReference | undefined> =>
  (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [
        { name: 'related', value: `ServiceRequest/${serviceRequestId}` },
        {
          name: 'type',
          value: `${RADIOLOGY_ORDER_FORM_DOC_REF_DOCTYPE.system}|${RADIOLOGY_ORDER_FORM_DOC_REF_DOCTYPE.code}`,
        },
        { name: 'status', value: 'current' },
      ],
    })
  ).unbundle()[0];

/** True when the order changed after its stored form was written, by any edit path. */
export const isRadiologyOrderFormStale = (docRef: DocumentReference, serviceRequest: ServiceRequest): boolean => {
  const generatedAt = docRef.date;
  const orderUpdatedAt = serviceRequest.meta?.lastUpdated;
  if (!generatedAt) return true; // nothing to compare against — regenerate rather than guess
  if (!orderUpdatedAt) return false;
  return DateTime.fromISO(orderUpdatedAt) > DateTime.fromISO(generatedAt);
};

export interface RadiologyOrderFormDocument {
  documentReference: DocumentReference;
  /** Z3 URL — what oystehr.fax.send takes as its media */
  mediaUrl: string;
  patientId: string;
  /** set only when the PDF was just generated */
  presignedURL?: string;
}

/**
 * The order form for this order, rendered only when no usable copy is on file — so a fax carries the
 * same document that was printed and reviewed.
 */
export const getOrCreateRadiologyOrderForm = async (
  serviceRequestId: string,
  secrets: Secrets | null,
  token: string,
  oystehr: Oystehr
): Promise<RadiologyOrderFormDocument> => {
  const existingDocRef = await findCurrentRadiologyOrderFormDocRef(serviceRequestId, oystehr);
  const existingMediaUrl = existingDocRef?.content?.[0]?.attachment?.url;
  const existingPatientId = existingDocRef?.subject?.reference?.split('/')[1];

  if (existingDocRef && existingMediaUrl && existingPatientId) {
    const serviceRequest = await oystehr.fhir.get<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: serviceRequestId,
    });
    if (!isRadiologyOrderFormStale(existingDocRef, serviceRequest)) {
      return { documentReference: existingDocRef, mediaUrl: existingMediaUrl, patientId: existingPatientId };
    }
  }

  const { input, refs } = await gatherRadiologyOrderFormInput(serviceRequestId, oystehr);
  const { documentReference, presignedURL } = await createRadiologyOrderFormPDF(input, refs, secrets, token);

  const mediaUrl = documentReference.content?.[0]?.attachment?.url;
  if (!mediaUrl) {
    throw new Error('Radiology order form PDF has no media URL');
  }

  return { documentReference, mediaUrl, patientId: refs.patientId, presignedURL };
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
