import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Organization, Patient, Practitioner } from 'fhir/r4b';
import { getAllPractitionerCredentials, getOrganizationFaxNumber } from 'utils/lib/fhir/helpers';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { getReferralDetails, getReferralEarlierDocumentIds } from 'utils/lib/fhir/referral';
import { toTenDigitPhoneNumber } from 'utils/lib/helpers/helpers';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import {
  FaxDocumentAvailability,
  FaxRecipient,
  GetFaxPacketPreviewInput,
  GetFaxPacketPreviewOutput,
  REFERRAL_EARLIER_DOCUMENT_FAX_DOCUMENT_KIND,
  REFERRAL_FORM_FAX_DOCUMENT_KIND,
} from 'utils/lib/types/api/fax.types';
import { REFERRAL_ROLES, ReferralRecipient } from 'utils/lib/types/api/referrals/referrals.types';
import { PRACTICE_NAME_URL } from 'utils/lib/types/constants';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUser, getUserToken, requireUserWithRole } from '../../shared/auth';
import { collectMedicalRecordParts } from '../../shared/fax/collect-patient-documents';
import { resolveFaxDocumentAvailability } from '../../shared/fax/collect-visit-documents';
import { resolveReferralFaxContext } from '../../shared/fax/resolve-fax-source';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { loadReferralRecipient } from '../../shared/referrals/recipient';
import {
  byVisitDateAscending,
  loadReferralDocuments,
  referralDocumentTitle,
} from '../../shared/referrals/referral-documents';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'get-fax-packet-preview';

/** The contained Practitioner id `getPCPPatchOps` writes the patient's primary care physician under. */
const CONTAINED_PCP_ID = 'primary-care-physician';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedInput = validateRequestParameters(input);
  console.log(
    'get-fax-packet-preview for',
    validatedInput.referralId
      ? `referral ${validatedInput.referralId}`
      : `appointment ${validatedInput.appointmentId ?? '(none)'}`
  );

  // A referral preview reads the referral, so the caller needs a referral role; the other sources keep their gate.
  if (validatedInput.referralId) {
    await requireUserWithRole(getUserToken(input), validatedInput.secrets, REFERRAL_ROLES);
  } else {
    const authorization = input.headers.Authorization;
    await getUser(authorization.replace('Bearer ', ''), validatedInput.secrets);
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedInput.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validatedInput.secrets);

  const output = await performEffect(validatedInput, oystehr, validatedInput.secrets);
  return { statusCode: 200, body: JSON.stringify(output) };
});

export const findContainedPcp = (patient: Patient | undefined): Practitioner | undefined =>
  patient?.contained?.find(
    (resource): resource is Practitioner => resource.resourceType === 'Practitioner' && resource.id === CONTAINED_PCP_ID
  );

export const mapPcpToRecipient = (pcp: Practitioner | undefined): FaxRecipient | undefined => {
  if (!pcp) return undefined;

  const faxNumber = toTenDigitPhoneNumber(pcp.telecom?.find((telecom) => telecom.system === 'fax')?.value);

  if (!faxNumber) return undefined;

  const nameWithoutCredential = pcp.name?.map((name) => ({ ...name, suffix: undefined }));
  const credential = getAllPractitionerCredentials(pcp).join(', ');

  return {
    name: pcp.name?.length ? getFullestAvailableName({ ...pcp, name: nameWithoutCredential }) : undefined,
    ...(credential ? { credential } : {}),
    organization: pcp.extension?.find((extension) => extension.url === PRACTICE_NAME_URL)?.valueString?.trim(),
    faxNumber,
    phoneNumber: toTenDigitPhoneNumber(pcp.telecom?.find((telecom) => telecom.system === 'phone')?.value),
  };
};

/**
 * A referral's recipient as a fax recipient. Unlike the PCP, a recipient without a fax number is still
 * prefilled (name and phone) so only the number has to be typed in the dialog. The person name carries the
 * credential ("Jane Doe, MD"), which is what the cover sheet prints either way.
 */
export const mapReferralRecipientToFax = (recipient: ReferralRecipient | undefined): FaxRecipient | undefined => {
  if (!recipient) return undefined;
  return {
    ...(recipient.personName ? { name: recipient.personName } : {}),
    ...(recipient.organizationName ? { organization: recipient.organizationName } : {}),
    faxNumber: toTenDigitPhoneNumber(recipient.fax) ?? '',
    phoneNumber: toTenDigitPhoneNumber(recipient.phone),
  };
};

/**
 * A referral packet: the form always, then the referral's chosen visit documents as the visit has them, then its
 * earlier-visit documents oldest first (checked the way the packet checks them, so a preview never promises one
 * the send would refuse).
 * The dialog does not manage the PCP for a referral, so `hasSavedPcp` is reported as true to keep the
 * "save as PCP" default off.
 */
const previewReferral = async (
  oystehr: Oystehr,
  referralId: string,
  senderFaxNumber: Promise<string | undefined>
): Promise<GetFaxPacketPreviewOutput> => {
  const { serviceRequest, patientId, appointmentId, encounterId } = await resolveReferralFaxContext(
    oystehr,
    referralId
  );
  const includeDocuments = getReferralDetails(serviceRequest)?.includeDocuments ?? [];

  const [recipient, visitDocuments, earlierDocuments] = await Promise.all([
    // A contact deleted since the referral was saved prefills nothing.
    loadReferralRecipient(oystehr, serviceRequest).then(mapReferralRecipientToFax),
    appointmentId && encounterId && includeDocuments.length
      ? resolveFaxDocumentAvailability({ oystehr, appointmentId, encounterId })
      : ([] as FaxDocumentAvailability[]),
    loadReferralDocuments(oystehr, patientId, getReferralEarlierDocumentIds(serviceRequest)),
  ]);

  return {
    documents: [
      { kind: REFERRAL_FORM_FAX_DOCUMENT_KIND, available: true, count: 1 },
      ...visitDocuments.filter((document) => includeDocuments.some((kind) => kind === document.kind)),
      ...[...earlierDocuments].sort(byVisitDateAscending).map(
        ({ documentReference }): FaxDocumentAvailability => ({
          kind: REFERRAL_EARLIER_DOCUMENT_FAX_DOCUMENT_KIND,
          title: referralDocumentTitle(documentReference),
          available: true,
          count: 1,
        })
      ),
    ],
    recipient,
    hasSavedPcp: true,
    senderFaxNumber: await senderFaxNumber,
  };
};

/**
 * The number outbound faxes are transmitted from: the fax telecom of the organization
 * `sub-send-fax-packet` hands to the fax service as the sender. Never fails the preview — the dialog is
 * still usable when the number cannot be resolved, it just cannot name the sender.
 */
export const resolveSenderFaxNumber = async (
  oystehr: Oystehr,
  secrets: Secrets | null
): Promise<string | undefined> => {
  try {
    const organizationId = getSecret(SecretsKeys.ORGANIZATION_ID, secrets);
    const organization = await oystehr.fhir.get<Organization>({ resourceType: 'Organization', id: organizationId });
    return getOrganizationFaxNumber(organization);
  } catch (error) {
    console.error('Could not resolve the sending organization fax number', error);
    return undefined;
  }
};

export const performEffect = async (
  { appointmentId, medicalRecord, referralId }: GetFaxPacketPreviewInput,
  oystehr: Oystehr,
  secrets: Secrets | null
): Promise<GetFaxPacketPreviewOutput> => {
  // Started up front so it overlaps the visit lookups below. It never rejects, so awaiting it late is safe.
  const senderFaxNumber = resolveSenderFaxNumber(oystehr, secrets);

  if (referralId) {
    return previewReferral(oystehr, referralId, senderFaxNumber);
  }
  if (medicalRecord) {
    const parts = await collectMedicalRecordParts(oystehr, medicalRecord.patientId, medicalRecord.dateRange);
    return { documents: [], hasSavedPcp: false, senderFaxNumber: await senderFaxNumber, documentCount: parts.length };
  }
  // No visit in scope: the patient-level dialogs send a fixed set of documents and do not manage the
  // PCP, so the sender's number is the only part of the preview they need.
  if (!appointmentId) {
    return { documents: [], hasSavedPcp: false, senderFaxNumber: await senderFaxNumber };
  }

  const resources = (
    await oystehr.fhir.search<Encounter | Appointment | Patient>({
      resourceType: 'Encounter',
      params: [
        { name: 'appointment', value: `Appointment/${appointmentId}` },
        { name: '_include', value: 'Encounter:appointment' },
        { name: '_include', value: 'Encounter:subject' },
      ],
    })
  ).unbundle();

  const encounter = resources.find((resource): resource is Encounter => resource.resourceType === 'Encounter');
  const appointment = resources.find((resource): resource is Appointment => resource.resourceType === 'Appointment');
  const patient = resources.find((resource): resource is Patient => resource.resourceType === 'Patient');

  if (!appointment?.id || !encounter?.id) {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`No encounter found for appointment ${appointmentId}`);
  }

  const documents = await resolveFaxDocumentAvailability({
    oystehr,
    appointmentId: appointment.id,
    encounterId: encounter.id,
  });

  const containedPcp = findContainedPcp(patient);
  // A deactivated PCP is not offered as a prefill and does not count as "on file".
  const hasSavedPcp = Boolean(containedPcp && containedPcp.active !== false);

  return {
    documents,
    pcp: hasSavedPcp ? mapPcpToRecipient(containedPcp) : undefined,
    hasSavedPcp,
    senderFaxNumber: await senderFaxNumber,
  };
};
