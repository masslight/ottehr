import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { DocumentReference, Encounter, Location, Organization, Patient, Practitioner, ServiceRequest } from 'fhir/r4b';
import { getEncounterLocationId } from 'utils/lib/fhir/encounter';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import {
  getReferralEarlierDocumentIds,
  REFERRAL_FORM_DOC_REF_DOCTYPE,
  REFERRAL_FORM_SOURCE_VERSION_IDENTIFIER_SYSTEM,
} from 'utils/lib/fhir/referral';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { DEFAULT_TIMEZONE, resourceTimezone } from '../document-packet/deliver-document-packet';
import { isFhirNotFoundError } from '../errors';
import { findCurrentOrderFormDocRef, getReusableOrderFormUrl, makeOrderFormVersion } from '../order-form-version';
import { createReferralFormPDF } from '../pdf/referral-form-pdf';
import { mapReferralRecipient, withReferralFax } from './recipient';
import { findReferralDocuments } from './referral-documents';

export const REFERRAL_FORM_TEMPLATE_VERSION = 1;

export interface ReferralFormDocument {
  documentReference: DocumentReference;
  z3Url: string;
  presignedURL?: string;
}

const loadPractice = (oystehr: Oystehr, secrets: Secrets | null): Promise<Organization | undefined> =>
  oystehr.fhir
    .get<Organization>({ resourceType: 'Organization', id: getSecret(SecretsKeys.ORGANIZATION_ID, secrets) })
    .catch((error: unknown) => {
      if (!isFhirNotFoundError(error)) throw error;
      console.error('[referral-form] ORGANIZATION_ID names no Organization; From block falls back to the office');
      captureException(error);
      return undefined;
    });

const loadOffice = async (oystehr: Oystehr, encounterId: string | undefined): Promise<Location | undefined> => {
  if (!encounterId) return undefined;
  const encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId });
  const locationId = getEncounterLocationId(encounter);
  return locationId ? oystehr.fhir.get<Location>({ resourceType: 'Location', id: locationId }) : undefined;
};

const loadRecipientOrganization = async (
  oystehr: Oystehr,
  serviceRequest: ServiceRequest
): Promise<Organization | undefined> => {
  const contactId = getIdFromReference(serviceRequest.performer?.[0]?.reference, 'Organization');
  if (!contactId) return undefined;
  const [organization] = (
    await oystehr.fhir.search<Organization>({
      resourceType: 'Organization',
      params: [{ name: '_id', value: contactId }],
    })
  ).unbundle();
  return organization;
};

export const getOrCreateReferralForm = async (
  serviceRequest: ServiceRequest,
  args: { oystehr: Oystehr; secrets: Secrets | null; token: string }
): Promise<ReferralFormDocument> => {
  const { oystehr, secrets, token } = args;
  const referralId = serviceRequest.id;
  const patientId = getIdFromReference(serviceRequest.subject?.reference, 'Patient');
  if (!referralId || !patientId) throw new Error('Referral is missing its id or patient');

  const encounterId = getIdFromReference(serviceRequest.encounter?.reference, 'Encounter');
  const practitionerId = getIdFromReference(serviceRequest.requester?.reference, 'Practitioner');
  const earlierDocumentIds = getReferralEarlierDocumentIds(serviceRequest);
  const [existing, patient, practice, location, practitioner, recipientOrganization, earlierDocuments] =
    await Promise.all([
      findCurrentOrderFormDocRef(oystehr, `ServiceRequest/${referralId}`, REFERRAL_FORM_DOC_REF_DOCTYPE),
      oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId }),
      loadPractice(oystehr, secrets),
      loadOffice(oystehr, encounterId),
      practitionerId ? oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: practitionerId }) : undefined,
      loadRecipientOrganization(oystehr, serviceRequest),
      findReferralDocuments(oystehr, patientId, earlierDocumentIds).then((found) =>
        earlierDocumentIds.flatMap((id) => found.get(id) ?? [])
      ),
    ]);

  const resourceVersion = makeOrderFormVersion(
    REFERRAL_FORM_TEMPLATE_VERSION,
    [
      serviceRequest,
      patient,
      practitioner,
      practice,
      location,
      recipientOrganization,
      ...earlierDocuments.map((document) => document.documentReference),
    ].flatMap((resource) => (resource ? [resource] : []))
  );
  const sourceVersion =
    resourceVersion &&
    [
      resourceVersion,
      ...earlierDocuments.flatMap(({ documentReference, visitDate }) =>
        visitDate ? [`visit:DocumentReference/${documentReference.id}=${visitDate}`] : []
      ),
    ].join('|');
  const existingUrl = getReusableOrderFormUrl(existing, REFERRAL_FORM_SOURCE_VERSION_IDENTIFIER_SYSTEM, sourceVersion);
  if (existing && existingUrl) {
    return { documentReference: existing, z3Url: existingUrl };
  }

  const { documentReference, presignedURL } = await createReferralFormPDF(
    {
      serviceRequest,
      patient,
      practitioner,
      practice,
      location,
      recipient: recipientOrganization
        ? withReferralFax(serviceRequest, mapReferralRecipient(recipientOrganization))
        : undefined,
      earlierDocuments,
      timezone: resourceTimezone(location) ?? resourceTimezone(practice) ?? DEFAULT_TIMEZONE,
      oystehr,
    },
    { patientId, encounterId, referralId },
    secrets,
    token,
    sourceVersion
  );
  const z3Url = documentReference.content?.[0]?.attachment?.url;
  if (!z3Url) throw new Error('Referral form PDF has no media URL');
  return { documentReference, z3Url, presignedURL };
};

export const presignReferralForm = async (form: ReferralFormDocument, token: string): Promise<string> => {
  const url = form.presignedURL ?? (await getPresignedURL(form.z3Url, token));
  if (!url) throw new Error('Failed to get presigned URL for referral form PDF');
  return url;
};
