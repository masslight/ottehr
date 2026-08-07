import Oystehr from '@oystehr/sdk';
import {
  DocumentReference,
  Encounter,
  Location,
  Observation,
  Patient,
  Practitioner,
  Resource,
  ServiceRequest,
} from 'fhir/r4b';
import { TIMEZONE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { getAttendingPractitionerId } from 'utils/lib/fhir/practitioners';
import { Secrets } from 'utils/lib/secrets';
import {
  createRadiologyOrderFormPDF,
  RADIOLOGY_ORDER_FORM_DOC_REF_DOCTYPE,
  RADIOLOGY_ORDER_FORM_SOURCE_VERSION_SYSTEM,
  RadiologyOrderFormInput,
} from '../../../shared/pdf/radiology-order-form-pdf';

/** The identifying bits of a resource an order form was rendered from. */
export type OrderFormSource = Pick<Resource, 'resourceType' | 'id' | 'meta'>;

export interface RadiologyOrderFormResources {
  input: RadiologyOrderFormInput;
  refs: { patientId: string; encounterId: string; serviceRequestId: string };
  sources: OrderFormSource[];
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
  if (!patientId || !encounterId) {
    throw new Error('ServiceRequest is missing subject or encounter reference');
  }

  const encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId });
  const locationId = encounter.location?.[0]?.location?.reference?.split('/')[1];
  // The ordering provider on the form is the provider assigned to the visit — orders are often placed
  // by an MA on the provider's behalf, and the requester is whoever placed the order.
  const practitionerId = getAttendingPractitionerId(encounter) ?? serviceRequest.requester?.reference?.split('/')[1];

  const [patient, practitioner, location, weightObservation] = await Promise.all([
    oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId }),
    practitionerId
      ? oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: practitionerId })
      : Promise.resolve(undefined),
    locationId ? oystehr.fhir.get<Location>({ resourceType: 'Location', id: locationId }) : Promise.resolve(undefined),
    fetchLatestWeightObservation(encounterId, oystehr),
  ]);

  const timezone =
    location?.extension?.find((ext) => ext.url === TIMEZONE_EXTENSION_URL)?.valueString ?? 'America/New_York';

  const quantity = weightObservation?.valueQuantity;
  const weight = quantity?.value != null ? { value: quantity.value, unit: quantity.unit ?? 'kg' } : undefined;

  return {
    input: { serviceRequest, patient, practitioner, location, timezone, weight, oystehr },
    refs: { patientId, encounterId, serviceRequestId },
    sources: [serviceRequest, encounter, patient, practitioner, location, weightObservation].flatMap((resource) =>
      resource ? [resource] : []
    ),
  };
};

/**
 * The order form on file for this order. Each generation supersedes its predecessor, so normally only
 * one is current — but two prints racing each other can leave two, so the newest wins.
 */
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
        { name: '_sort', value: '-date' },
      ],
    })
  ).unbundle()[0];

/**
 * The version each source resource was at when the form was rendered: `Type/id@versionId` for every
 * resource the PDF draws from, sorted and joined. Stamped on the form's DocumentReference, then
 * recomputed and compared on the next print — any source that has moved on since makes them differ.
 *
 * Undefined when a source is unversioned, which leaves the form incomparable and so never reused.
 */
export const makeRadiologyOrderFormSourceVersion = (sources: OrderFormSource[]): string | undefined => {
  const versions = sources.map((resource) =>
    resource.id && resource.meta?.versionId
      ? `${resource.resourceType}/${resource.id}@${resource.meta.versionId}`
      : undefined
  );
  if (versions.some((version) => version === undefined)) {
    return undefined;
  }
  return versions.sort().join('|');
};

/** The source version stamped on a stored order form, if any. */
export const getStoredOrderFormSourceVersion = (docRef: DocumentReference): string | undefined =>
  docRef.identifier?.find((identifier) => identifier.system === RADIOLOGY_ORDER_FORM_SOURCE_VERSION_SYSTEM)?.value;

export interface RadiologyOrderFormDocument {
  documentReference: DocumentReference;
  /** Z3 URL — what oystehr.fax.send takes as its media */
  mediaUrl: string;
  patientId: string;
  /** set only when the PDF was just generated */
  presignedURL?: string;
}

/** The order form for this order, re-rendered only when the copy on file no longer matches it. */
export const getOrCreateRadiologyOrderForm = async (
  serviceRequestId: string,
  secrets: Secrets | null,
  token: string,
  oystehr: Oystehr
): Promise<RadiologyOrderFormDocument> => {
  const [existingDocRef, { input, refs, sources }] = await Promise.all([
    findCurrentRadiologyOrderFormDocRef(serviceRequestId, oystehr),
    gatherRadiologyOrderFormInput(serviceRequestId, oystehr),
  ]);

  const sourceVersion = makeRadiologyOrderFormSourceVersion(sources);
  const existingMediaUrl = existingDocRef?.content?.[0]?.attachment?.url;

  if (
    existingDocRef &&
    existingMediaUrl &&
    sourceVersion &&
    getStoredOrderFormSourceVersion(existingDocRef) === sourceVersion
  ) {
    return { documentReference: existingDocRef, mediaUrl: existingMediaUrl, patientId: refs.patientId };
  }

  const { documentReference, presignedURL } = await createRadiologyOrderFormPDF(
    input,
    refs,
    secrets,
    token,
    sourceVersion
  );

  const mediaUrl = documentReference.content?.[0]?.attachment?.url;
  if (!mediaUrl) {
    throw new Error('Radiology order form PDF has no media URL');
  }

  return { documentReference, mediaUrl, patientId: refs.patientId, presignedURL };
};

const PRINTABLE_OBSERVATION_STATUSES: Observation['status'][] = [
  'registered',
  'preliminary',
  'final',
  'amended',
  'corrected',
];

export const isPrintableObservation = (observation: Observation): boolean =>
  PRINTABLE_OBSERVATION_STATUSES.includes(observation.status);

const fetchLatestWeightObservation = async (
  encounterId: string,
  oystehr: Oystehr
): Promise<Observation | undefined> => {
  const [observation] = (
    await oystehr.fhir.search<Observation>({
      resourceType: 'Observation',
      params: [
        { name: 'encounter', value: `Encounter/${encounterId}` },
        { name: 'code', value: 'http://loinc.org|29463-7' },
        { name: 'status', value: PRINTABLE_OBSERVATION_STATUSES.join(',') },
        { name: '_sort', value: '-date' },
        { name: '_count', value: '1' },
      ],
    })
  ).unbundle();

  return observation && isPrintableObservation(observation) ? observation : undefined;
};
