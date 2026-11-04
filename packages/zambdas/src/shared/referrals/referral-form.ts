import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { DocumentReference, Encounter, Location, Organization, Patient, Practitioner, ServiceRequest } from 'fhir/r4b';
import { TIMEZONE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { REFERRAL_FORM_DOC_REF_DOCTYPE, REFERRAL_FORM_SOURCE_VERSION_IDENTIFIER_SYSTEM } from 'utils/lib/fhir/referral';
import { removePrefix } from 'utils/lib/helpers/helpers';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { isFhirNotFoundError } from '../errors';
import { DEFAULT_TIMEZONE } from '../fax/run-fax-packet';
import { createReferralFormPDF } from '../pdf/referral-form-pdf';
import { loadReferralRecipient } from './recipient';

/** `ServiceRequest/<id>@<versionId>`: the form is reused only while the referral has not changed. */
export const makeReferralFormSourceVersion = (serviceRequest: ServiceRequest): string | undefined =>
  serviceRequest.id && serviceRequest.meta?.versionId
    ? `ServiceRequest/${serviceRequest.id}@${serviceRequest.meta.versionId}`
    : undefined;

export const getStoredReferralFormSourceVersion = (docRef: DocumentReference): string | undefined =>
  docRef.identifier?.find((identifier) => identifier.system === REFERRAL_FORM_SOURCE_VERSION_IDENTIFIER_SYSTEM)?.value;

/** The referral's current form: the one lookup every reader of the form goes through. */
const findCurrentReferralFormDocRef = async (
  oystehr: Oystehr,
  referralId: string
): Promise<DocumentReference | undefined> =>
  (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [
        { name: 'related', value: `ServiceRequest/${referralId}` },
        { name: 'type', value: `${REFERRAL_FORM_DOC_REF_DOCTYPE.system}|${REFERRAL_FORM_DOC_REF_DOCTYPE.code}` },
        { name: 'status', value: 'current' },
        { name: '_sort', value: '-date' },
      ],
    })
  ).unbundle()[0];

const timezoneOf = (resource: Location | Organization | undefined): string | undefined =>
  resource?.extension?.find((extension) => extension.url === TIMEZONE_EXTENSION_URL)?.valueString;

const referenceId = (reference: string | undefined, prefix: string): string | undefined =>
  removePrefix(prefix, reference ?? '') || undefined;

export interface ReferralFormDocument {
  documentReference: DocumentReference;
  /** Z3 URL, what the fax service takes as its media. */
  z3Url: string;
  /** Set only when the PDF was just generated. */
  presignedURL?: string;
}

/** The referral form on file, re-rendered when the referral has changed since it was made. */
export const getOrCreateReferralForm = async (
  serviceRequest: ServiceRequest,
  args: { oystehr: Oystehr; secrets: Secrets | null; token: string }
): Promise<ReferralFormDocument> => {
  const { oystehr, secrets, token } = args;
  const referralId = serviceRequest.id;
  const patientId = referenceId(serviceRequest.subject?.reference, 'Patient/');
  if (!referralId || !patientId) throw new Error('Referral is missing its id or patient');

  const existing = await findCurrentReferralFormDocRef(oystehr, referralId);
  const sourceVersion = makeReferralFormSourceVersion(serviceRequest);
  const existingUrl = existing?.content?.[0]?.attachment?.url;
  if (existing && existingUrl && sourceVersion && getStoredReferralFormSourceVersion(existing) === sourceVersion) {
    return { documentReference: existing, z3Url: existingUrl };
  }

  const encounterId = referenceId(serviceRequest.encounter?.reference, 'Encounter/');
  const practitionerId = referenceId(serviceRequest.requester?.reference, 'Practitioner/');
  const [patient, practice, encounter, practitioner, recipient] = await Promise.all([
    oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId }),
    // The practice fills the From block; when ORGANIZATION_ID names no Organization the form still renders from
    // the visit's office, the way the fax packet preview tolerates a missing sending organization. That is a
    // misconfiguration worth seeing in Sentry, and any other failure (auth, outage) fails the form as usual.
    oystehr.fhir
      .get<Organization>({ resourceType: 'Organization', id: getSecret(SecretsKeys.ORGANIZATION_ID, secrets) })
      .catch((error: unknown) => {
        if (!isFhirNotFoundError(error)) throw error;
        console.error('[referral-form] ORGANIZATION_ID names no Organization; From block falls back to the office');
        captureException(error);
        return undefined;
      }),
    encounterId ? oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId }) : undefined,
    practitionerId ? oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: practitionerId }) : undefined,
    loadReferralRecipient(oystehr, serviceRequest),
  ]);
  const locationId = referenceId(encounter?.location?.[0]?.location?.reference, 'Location/');
  const location = locationId
    ? await oystehr.fhir.get<Location>({ resourceType: 'Location', id: locationId })
    : undefined;

  const { documentReference, presignedURL } = await createReferralFormPDF(
    {
      serviceRequest,
      patient,
      practitioner,
      practice,
      location,
      recipient,
      timezone: timezoneOf(location) ?? timezoneOf(practice) ?? DEFAULT_TIMEZONE,
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

/** A reused form has to be signed for this view; a freshly generated one already is. */
export const presignReferralForm = async (form: ReferralFormDocument, token: string): Promise<string> => {
  const url = form.presignedURL ?? (await getPresignedURL(form.z3Url, token));
  if (!url) throw new Error('Failed to get presigned URL for referral form PDF');
  return url;
};
