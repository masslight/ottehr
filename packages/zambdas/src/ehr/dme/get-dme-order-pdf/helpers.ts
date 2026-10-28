import Oystehr from '@oystehr/sdk';
import { DeviceRequest, DocumentReference, Encounter, Location, Patient, Practitioner } from 'fhir/r4b';
import { TIMEZONE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { Secrets } from 'utils/lib/secrets';
import { DME_ORDER_TAG_CODE, DME_ORDER_TAG_SYSTEM } from 'utils/lib/types/api/dme.types';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { getDmePractitionerIds, isDmeOrderDeleted } from '../../../shared/dme';
import {
  createDmeOrderFormPDF,
  DME_ORDER_FORM_DOC_REF_DOCTYPE,
  DME_ORDER_FORM_SOURCE_VERSION_SYSTEM,
  DmeOrderFormInput,
} from '../../../shared/pdf/dme-order-form-pdf';
import { makeRadiologyOrderFormSourceVersion, OrderFormSource } from '../../radiology/shared/order-form-resources';

interface DmeOrderFormResources {
  input: DmeOrderFormInput;
  refs: { patientId: string; encounterId: string; deviceRequestId: string };
  sources: OrderFormSource[];
}

const isDmeOrder = (deviceRequest: DeviceRequest): boolean =>
  !!deviceRequest.meta?.tag?.some((tag) => tag.system === DME_ORDER_TAG_SYSTEM && tag.code === DME_ORDER_TAG_CODE);

export const gatherDmeOrderFormInput = async (
  deviceRequestId: string,
  oystehr: Oystehr
): Promise<DmeOrderFormResources> => {
  const deviceRequest = await oystehr.fhir.get<DeviceRequest>({ resourceType: 'DeviceRequest', id: deviceRequestId });
  if (!isDmeOrder(deviceRequest)) throw FHIR_RESOURCE_NOT_FOUND('DeviceRequest');
  if (isDmeOrderDeleted(deviceRequest)) throw INVALID_INPUT_ERROR('DME order has been deleted');

  const patientId = deviceRequest.subject?.reference?.split('/')[1];
  const encounterId = deviceRequest.encounter?.reference?.split('/')[1];
  if (!patientId || !encounterId) {
    throw new Error('DeviceRequest is missing subject or encounter reference');
  }

  const practitionerIds = [...new Set(getDmePractitionerIds(deviceRequest))];
  const [patient, encounter, practitioners] = await Promise.all([
    oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId }),
    oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId }),
    practitionerIds.length
      ? oystehr.fhir
          .search<Practitioner>({
            resourceType: 'Practitioner',
            params: [{ name: '_id', value: practitionerIds.join(',') }],
          })
          .then((bundle) => bundle.unbundle())
      : Promise.resolve([]),
  ]);

  const locationId = encounter.location?.[0]?.location?.reference?.split('/')[1];
  const location = locationId
    ? await oystehr.fhir.get<Location>({ resourceType: 'Location', id: locationId })
    : undefined;
  const timezone =
    location?.extension?.find((ext) => ext.url === TIMEZONE_EXTENSION_URL)?.valueString ?? 'America/New_York';

  return {
    input: { deviceRequest, patient, practitioners, location, timezone, oystehr },
    refs: { patientId, encounterId, deviceRequestId },
    sources: [deviceRequest, encounter, patient, ...practitioners, location].flatMap((resource) =>
      resource ? [resource] : []
    ),
  };
};

/** Newest first, in case two concurrent prints both left a current form. */
const findCurrentDmeOrderFormDocRef = async (
  deviceRequestId: string,
  oystehr: Oystehr
): Promise<DocumentReference | undefined> =>
  (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [
        { name: 'related', value: `DeviceRequest/${deviceRequestId}` },
        { name: 'type', value: `${DME_ORDER_FORM_DOC_REF_DOCTYPE.system}|${DME_ORDER_FORM_DOC_REF_DOCTYPE.code}` },
        { name: 'status', value: 'current' },
        { name: '_sort', value: '-date' },
      ],
    })
  ).unbundle()[0];

export interface DmeOrderFormDocument {
  documentReference: DocumentReference;
  mediaUrl: string;
  /** set only when the PDF was just generated */
  presignedURL?: string;
}

/** The order form on file, re-rendered only when a resource it was drawn from has changed since. */
export const getOrCreateDmeOrderForm = async (
  deviceRequestId: string,
  secrets: Secrets | null,
  token: string,
  oystehr: Oystehr
): Promise<DmeOrderFormDocument> => {
  const [existingDocRef, { input, refs, sources }] = await Promise.all([
    findCurrentDmeOrderFormDocRef(deviceRequestId, oystehr),
    gatherDmeOrderFormInput(deviceRequestId, oystehr),
  ]);

  const sourceVersion = makeRadiologyOrderFormSourceVersion(sources);
  const existingMediaUrl = existingDocRef?.content?.[0]?.attachment?.url;
  const storedSourceVersion = existingDocRef?.identifier?.find(
    (identifier) => identifier.system === DME_ORDER_FORM_SOURCE_VERSION_SYSTEM
  )?.value;

  if (existingDocRef && existingMediaUrl && sourceVersion && storedSourceVersion === sourceVersion) {
    return { documentReference: existingDocRef, mediaUrl: existingMediaUrl };
  }

  const { documentReference, presignedURL } = await createDmeOrderFormPDF(input, refs, secrets, token, sourceVersion);
  const mediaUrl = documentReference.content?.[0]?.attachment?.url;
  if (!mediaUrl) {
    throw new Error('DME order form PDF has no media URL');
  }

  return { documentReference, mediaUrl, presignedURL };
};
